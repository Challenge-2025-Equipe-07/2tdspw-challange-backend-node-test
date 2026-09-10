import { Injectable, NotFoundException } from '@nestjs/common';

import {
  buildProductLookup,
  resolveAppointmentPrice,
  resolveProduct,
  type ProductBid,
} from '../common/product-lookup';
import { PrismaService } from '../prisma/prisma.service';

const MS_PER_DAY = 1000 * 60 * 60 * 24;
const DAYS_PER_PAGE = 7;
const MAX_PAGES = 8;

export type ListedNotification = {
  id: string;
  petName: string;
  petRace: string;
  ownerName: string;
  ownerId: string;
  petId: string;
  ownerContact: string;
  appointmentName: string;
  appointmentPrice: number;
  appointmentDate: string;
  plan: {
    date: string;
    procedure: string;
  };
};

export type ListFilteredParams = {
  dateFrom?: string;
  dateTo?: string;
  ownerId?: string;
};

function startOfDay(date = new Date()): Date {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function endOfDay(date: Date): Date {
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next;
}

function parseBoundary(
  value: string | undefined,
  end: boolean,
): Date | undefined {
  if (!value) return undefined;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return end ? endOfDay(parsed) : startOfDay(parsed);
}

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  private mapRow(
    row: {
      id: string;
      appointmentName: string;
      appointmentPrice: number | null;
      appointmentDateTime: Date;
      product: { productPrice: number } | null;
      pet: {
        id: string;
        name: string;
        breed: string;
        owner: {
          id: string;
          name: string;
          telephone: string;
        };
      };
    },
    productLookup: Map<string, ProductBid>,
  ): ListedNotification {
    const appointmentDate = row.appointmentDateTime.toISOString();
    const matched = resolveProduct(productLookup, row.appointmentName);
    return {
      id: row.id,
      petName: row.pet.name,
      petRace: row.pet.breed,
      ownerName: row.pet.owner.name,
      ownerId: row.pet.owner.id,
      petId: row.pet.id,
      ownerContact: row.pet.owner.telephone,
      appointmentName: row.appointmentName,
      appointmentPrice: resolveAppointmentPrice(
        row.appointmentPrice,
        row.product?.productPrice,
        matched?.productPrice,
      ),
      appointmentDate,
      plan: {
        date: appointmentDate,
        procedure: row.appointmentName,
      },
    };
  }

  private async findRows(
    userId: string,
    params: ListFilteredParams = {},
  ): Promise<ListedNotification[]> {
    const dateFrom = parseBoundary(params.dateFrom, false);
    const dateTo = parseBoundary(params.dateTo, true);

    const [rows, products] = await Promise.all([
      this.prisma.notification.findMany({
        where: {
          userId,
          notifyWeb: true,
          ...(dateFrom || dateTo
            ? {
                appointmentDateTime: {
                  ...(dateFrom ? { gte: dateFrom } : {}),
                  ...(dateTo ? { lte: dateTo } : {}),
                },
              }
            : {}),
          ...(params.ownerId ? { pet: { ownerId: params.ownerId } } : {}),
        },
        include: {
          product: true,
          pet: {
            include: { owner: true },
          },
        },
        orderBy: { appointmentDateTime: 'asc' },
      }),
      this.prisma.product.findMany({
        select: { id: true, productName: true, productPrice: true },
      }),
    ]);

    const productLookup = buildProductLookup(products);
    return rows.map((row) => this.mapRow(row, productLookup));
  }

  async list(userId: string, page = 1) {
    const notifications = await this.findRows(userId);

    const origin = startOfDay();
    let maxOffsetDays = DAYS_PER_PAGE - 1;
    for (const notification of notifications) {
      const diff = Math.floor(
        (startOfDay(new Date(notification.plan.date)).getTime() -
          origin.getTime()) /
          MS_PER_DAY,
      );
      if (diff > maxOffsetDays) {
        maxOffsetDays = diff;
      }
    }

    const totalPages = Math.min(
      MAX_PAGES,
      Math.max(1, Math.ceil((maxOffsetDays + 1) / DAYS_PER_PAGE)),
    );
    const safePage = Math.min(Math.max(page, 1), totalPages);

    return {
      page: safePage,
      totalPages,
      notifications,
    };
  }

  async listFiltered(userId: string, params: ListFilteredParams = {}) {
    if (params.ownerId) {
      const owner = await this.prisma.owner.findFirst({
        where: { id: params.ownerId, userId },
        select: { id: true },
      });
      if (!owner) {
        throw new NotFoundException('Owner not found');
      }
    }

    const notifications = await this.findRows(userId, params);
    return { notifications };
  }
}
