import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { digitsOnly } from '../common/document';
import {
  buildProductLookup,
  resolveAppointmentPrice,
  resolveProduct,
} from '../common/product-lookup';
import { buildAppointments } from '../common/schedule';
import { PrismaService } from '../prisma/prisma.service';
import type {
  CreateAppointmentDto,
  CreateOwnerDto,
  CreatePetDto,
  CreatePlanDto,
  UpdatePlanNotificationsDto,
} from './owner.schemas';

const petSelect = {
  id: true,
  name: true,
  breed: true,
  sex: true,
  weight: true,
  age: true,
  isCastrated: true,
  species: true,
} as const;

const ownerWithPetsSelect = {
  id: true,
  name: true,
  email: true,
  telephone: true,
  document: true,
  pets: { select: petSelect },
} as const;

@Injectable()
export class OwnerService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(userId: string) {
    return this.prisma.owner.findMany({
      where: { userId },
      select: ownerWithPetsSelect,
      orderBy: { name: 'asc' },
    });
  }

  async findByDocument(userId: string, document: string) {
    const owner = await this.prisma.owner.findFirst({
      where: { userId, document: digitsOnly(document) },
      select: {
        id: true,
        name: true,
        email: true,
        telephone: true,
        document: true,
      },
    });
    if (!owner) {
      throw new NotFoundException('Owner not found');
    }
    return owner;
  }

  async findById(userId: string, id: string) {
    const owner = await this.prisma.owner.findFirst({
      where: { id, userId },
      select: ownerWithPetsSelect,
    });
    if (!owner) {
      throw new NotFoundException('Owner not found');
    }
    return owner;
  }

  async create(userId: string, dto: CreateOwnerDto) {
    const document = digitsOnly(dto.owner.document);
    const existing = await this.prisma.owner.findUnique({
      where: { document },
    });
    if (existing) {
      throw new ConflictException('Owner with this document already exists');
    }

    return this.prisma.owner.create({
      data: {
        userId,
        name: dto.owner.name,
        email: dto.owner.email,
        telephone: dto.owner.telephone,
        document,
        pets: {
          create: dto.pet.map((pet) => ({
            name: pet.name,
            breed: pet.breed,
            sex: pet.sex,
            weight: pet.weight,
            age: pet.age,
            isCastrated: pet.isCastrated,
            species: pet.species ?? '',
          })),
        },
      },
      select: ownerWithPetsSelect,
    });
  }

  async addPet(userId: string, ownerId: string, dto: CreatePetDto) {
    await this.findById(userId, ownerId);
    return this.prisma.pet.create({
      data: {
        ownerId,
        name: dto.name,
        breed: dto.breed,
        sex: dto.sex,
        weight: dto.weight,
        age: dto.age,
        isCastrated: dto.isCastrated,
        species: dto.species ?? '',
      },
      select: petSelect,
    });
  }

  async createPlan(userId: string, petId: string, dto: CreatePlanDto) {
    const pet = await this.findOwnedPet(userId, petId);

    return this.prisma.$transaction(async (tx) => {
      await tx.notification.deleteMany({
        where: { petId: pet.id, fromCarePlan: true },
      });
      await tx.carePlan.deleteMany({
        where: { petId: pet.id },
      });

      const carePlan = await tx.carePlan.create({
        data: {
          petId: pet.id,
          description: dto.carePlanDescription,
          items: {
            create: dto.carePlan.map((item) => ({
              planItemName: item.planItemName,
              planRecurrency: item.planRecurrency,
              planRecurrencyRate: item.planRecurrencyRate,
              planDurationInMonths: item.planDurationInMonths,
              notifyWhatsapp: item.notifyWhatsapp,
              notifyWeb: item.notifyWeb,
            })),
          },
        },
        include: { items: true },
      });

      const appointments = buildAppointments(carePlan.createdAt, dto.carePlan);
      if (appointments.length > 0) {
        const products = await tx.product.findMany({
          select: { id: true, productName: true, productPrice: true },
        });
        const productLookup = buildProductLookup(products);

        await tx.notification.createMany({
          data: appointments.map((appointment) => {
            const product = resolveProduct(
              productLookup,
              appointment.appointmentName,
            );
            return {
              petId: pet.id,
              userId,
              appointmentName: appointment.appointmentName,
              appointmentDateTime: appointment.appointmentDateTime,
              appointmentPrice: product?.productPrice ?? null,
              productId: product?.id ?? null,
              notifyWhatsapp: appointment.notifyWhatsapp,
              notifyWeb: appointment.notifyWeb,
              fromCarePlan: true,
            };
          }),
        });
      }

      return carePlan;
    });
  }

  async getPlan(userId: string, petId: string) {
    const pet = await this.findOwnedPet(userId, petId);
    const carePlan = await this.requireCarePlan(pet.id);

    const [notifications, products] = await Promise.all([
      this.prisma.notification.findMany({
        where: { petId: pet.id, userId },
        include: { product: true },
        orderBy: { appointmentDateTime: 'asc' },
      }),
      this.prisma.product.findMany({
        select: { id: true, productName: true, productPrice: true },
      }),
    ]);
    const productLookup = buildProductLookup(products);

    return {
      carePlanDescription: carePlan.description,
      carePlan: notifications.map((notification) => {
        const matched = resolveProduct(
          productLookup,
          notification.appointmentName,
        );
        return {
          id: notification.id,
          appointmentName: notification.appointmentName,
          appointmentPrice: resolveAppointmentPrice(
            notification.appointmentPrice,
            notification.product?.productPrice,
            matched?.productPrice,
          ),
          appointmentDate: notification.appointmentDateTime.toISOString(),
          ownerContact: pet.owner.telephone,
          notifyWhatsapp: notification.notifyWhatsapp,
          notifyWeb: notification.notifyWeb,
        };
      }),
    };
  }

  async updatePlan(
    userId: string,
    petId: string,
    dto: UpdatePlanNotificationsDto,
  ) {
    const pet = await this.findOwnedPet(userId, petId);
    await this.requireCarePlan(pet.id);

    const ids = dto.appointments.map((appointment) => appointment.id);
    const existing = await this.prisma.notification.findMany({
      where: { id: { in: ids }, petId: pet.id, userId },
      select: { id: true },
    });
    if (existing.length !== ids.length) {
      throw new NotFoundException('Appointment not found');
    }

    await this.prisma.$transaction(
      dto.appointments.map((appointment) =>
        this.prisma.notification.update({
          where: { id: appointment.id },
          data: {
            notifyWhatsapp: appointment.notifyWhatsapp,
            notifyWeb: appointment.notifyWeb,
          },
        }),
      ),
    );

    return this.getPlan(userId, petId);
  }

  async createAppointment(
    userId: string,
    petId: string,
    dto: CreateAppointmentDto,
  ) {
    const pet = await this.findOwnedPet(userId, petId);
    await this.requireCarePlan(pet.id);

    const product = await this.prisma.product.findUnique({
      where: { id: dto.productId },
    });
    if (!product) {
      throw new NotFoundException('Product not found');
    }

    await this.prisma.notification.create({
      data: {
        petId: pet.id,
        userId,
        productId: product.id,
        appointmentName: product.productName,
        appointmentDateTime: new Date(dto.appointmentDate),
        appointmentPrice: product.productPrice,
        notifyWhatsapp: dto.notifyWhatsapp ?? false,
        notifyWeb: dto.notifyWeb ?? true,
        fromCarePlan: false,
      },
    });

    return this.getPlan(userId, petId);
  }

  async deleteAppointment(
    userId: string,
    petId: string,
    appointmentId: string,
  ) {
    const pet = await this.findOwnedPet(userId, petId);
    await this.requireCarePlan(pet.id);

    const existing = await this.prisma.notification.findFirst({
      where: { id: appointmentId, petId: pet.id, userId },
      select: { id: true },
    });
    if (!existing) {
      throw new NotFoundException('Appointment not found');
    }

    await this.prisma.notification.delete({
      where: { id: appointmentId },
    });

    return this.getPlan(userId, petId);
  }

  private async requireCarePlan(petId: string) {
    const carePlan = await this.prisma.carePlan.findFirst({
      where: { petId },
      orderBy: { createdAt: 'desc' },
    });
    if (!carePlan) {
      throw new NotFoundException('Care plan not found');
    }
    return carePlan;
  }

  private async findOwnedPet(userId: string, petId: string) {
    const pet = await this.prisma.pet.findUnique({
      where: { id: petId },
      include: { owner: true },
    });
    if (!pet || pet.owner.userId !== userId) {
      throw new NotFoundException('Pet not found');
    }
    return pet;
  }
}
