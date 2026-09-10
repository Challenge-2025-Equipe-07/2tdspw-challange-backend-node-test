import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import type { CreateConsultaDto, UpdateConsultaDto } from './consulta.schemas';

const petSelect = {
  id: true,
  name: true,
  breed: true,
  sex: true,
  weight: true,
  age: true,
  isCastrated: true,
  species: true,
  ownerId: true,
  owner: {
    select: {
      id: true,
      name: true,
      email: true,
      telephone: true,
      document: true,
    },
  },
} as const;

const consultaSelect = {
  id: true,
  petId: true,
  resumo: true,
  diagnostico: true,
  prescription: true,
  exams: true,
  finalizedAt: true,
  aiFedAt: true,
  aiFeedError: true,
  createdAt: true,
  updatedAt: true,
  pet: { select: petSelect },
} as const;

@Injectable()
export class ConsultaService {
  constructor(private readonly prisma: PrismaService) {}

  private async findOwnedPet(userId: string, petId: string) {
    const pet = await this.prisma.pet.findFirst({
      where: { id: petId, owner: { userId } },
      select: { id: true },
    });
    if (!pet) {
      throw new NotFoundException('Pet not found');
    }
    return pet;
  }

  async create(userId: string, dto: CreateConsultaDto) {
    await this.findOwnedPet(userId, dto.petId);

    return this.prisma.consulta.create({
      data: { petId: dto.petId },
      select: consultaSelect,
    });
  }

  async findById(userId: string, id: string) {
    const consulta = await this.prisma.consulta.findFirst({
      where: { id, pet: { owner: { userId } } },
      select: consultaSelect,
    });
    if (!consulta) {
      throw new NotFoundException('Consulta not found');
    }
    return consulta;
  }

  async findLatestByPet(userId: string, petId: string) {
    await this.findOwnedPet(userId, petId);

    const consulta = await this.prisma.consulta.findFirst({
      where: { petId, pet: { owner: { userId } } },
      orderBy: { createdAt: 'desc' },
      select: consultaSelect,
    });
    if (!consulta) {
      throw new NotFoundException('Consulta not found');
    }
    return consulta;
  }

  async update(userId: string, id: string, dto: UpdateConsultaDto) {
    await this.findById(userId, id);

    const data: Prisma.ConsultaUpdateInput = {};
    if (dto.resumo !== undefined) data.resumo = dto.resumo;
    if (dto.diagnostico !== undefined) data.diagnostico = dto.diagnostico;
    if (dto.prescription !== undefined) data.prescription = dto.prescription;
    if (dto.exams !== undefined) {
      data.exams = dto.exams as Prisma.InputJsonValue;
    }
    if (dto.finalizedAt !== undefined) {
      data.finalizedAt = dto.finalizedAt ? new Date(dto.finalizedAt) : null;
    }
    if (dto.aiFedAt !== undefined) {
      data.aiFedAt = dto.aiFedAt ? new Date(dto.aiFedAt) : null;
      if (dto.aiFedAt) {
        data.aiFeedError = null;
      }
    }
    if (dto.aiFeedError !== undefined) {
      data.aiFeedError = dto.aiFeedError;
    }

    return this.prisma.consulta.update({
      where: { id },
      data,
      select: consultaSelect,
    });
  }
}
