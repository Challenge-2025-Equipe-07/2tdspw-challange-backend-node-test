import { Injectable, NotFoundException } from '@nestjs/common';

import {
  buildProductLookup,
  resolveAppointmentPrice,
  resolveProduct,
} from '../common/product-lookup';
import { resolveSaasFee } from '../common/saas-plan';
import { PrismaService } from '../prisma/prisma.service';
import {
  computeDashboardMetrics,
  type DashboardMetrics,
  type PricedAppointment,
} from './dashboard.metrics';

const MS_PER_DAY = 1000 * 60 * 60 * 24;

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getMetrics(userId: string): Promise<DashboardMetrics> {
    const now = new Date();
    const from = new Date(now.getTime() - 370 * MS_PER_DAY);
    const to = new Date(now.getTime() + 40 * MS_PER_DAY);

    const [user, products, notifications] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          saasPlan: true,
          saasTutorQuota: true,
          saasMonthlyFee: true,
        },
      }),
      this.prisma.product.findMany({
        select: { id: true, productName: true, productPrice: true },
      }),
      this.prisma.notification.findMany({
        where: {
          userId,
          appointmentDateTime: { gte: from, lte: to },
        },
        select: {
          petId: true,
          appointmentName: true,
          appointmentDateTime: true,
          appointmentPrice: true,
          fromCarePlan: true,
          product: { select: { productPrice: true } },
        },
      }),
    ]);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const lookup = buildProductLookup(products);
    const rows: PricedAppointment[] = notifications.map((row) => {
      const matched = resolveProduct(lookup, row.appointmentName);
      return {
        petId: row.petId,
        appointmentName: matched?.productName ?? row.appointmentName,
        appointmentDateTime: row.appointmentDateTime,
        fromCarePlan: row.fromCarePlan,
        price: resolveAppointmentPrice(
          row.appointmentPrice,
          row.product?.productPrice,
          matched?.productPrice,
        ),
      };
    });

    const saasFee = resolveSaasFee(user);
    return computeDashboardMetrics(rows, saasFee, now);
  }
}
