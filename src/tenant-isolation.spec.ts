import { ConflictException, NotFoundException } from '@nestjs/common';

jest.mock('@nestjs/common', () => {
  class HttpError extends Error {}
  return {
    Injectable: () => (target: unknown) => target,
    ConflictException: class ConflictException extends HttpError {},
    NotFoundException: class NotFoundException extends HttpError {},
    UnauthorizedException: class UnauthorizedException extends HttpError {},
  };
});
jest.mock('./prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

import { ConsultaService } from './consulta/consulta.service';
import { DashboardService } from './dashboard/dashboard.service';
import { NotificationsService } from './notifications/notifications.service';
import { OwnerService } from './owner/owner.service';
import { PrismaService } from './prisma/prisma.service';
import type { CreateOwnerDto } from './owner/owner.schemas';

const USER_A = 'firebase-uid-a';
const USER_B = 'firebase-uid-b';
const OWNER_A = '11111111-1111-1111-1111-111111111111';
const PET_A = '22222222-2222-2222-2222-222222222222';
const CONSULTA_A = '33333333-3333-3333-3333-333333333333';
const DOCUMENT_A = '12345678900';

const ownerA = {
  id: OWNER_A,
  name: 'Tutor A',
  email: 'tutor.a@email.com',
  telephone: '11999999999',
  document: DOCUMENT_A,
  userId: USER_A,
  pets: [
    {
      id: PET_A,
      name: 'Thor',
      breed: 'SRD',
      sex: 'M' as const,
      weight: 12,
      age: 4,
      isCastrated: true,
      species: 'cão',
      ownerId: OWNER_A,
      owner: { userId: USER_A },
    },
  ],
};

const consultaA = {
  id: CONSULTA_A,
  petId: PET_A,
  resumo: 'Check-up',
  diagnostico: '',
  prescription: [],
  exams: [],
  finalizedAt: null,
  aiFedAt: null,
  aiFeedError: null,
  createdAt: new Date('2026-09-01T12:00:00.000Z'),
  updatedAt: new Date('2026-09-01T12:00:00.000Z'),
  pet: {
    id: PET_A,
    name: 'Thor',
    breed: 'SRD',
    sex: 'M',
    weight: 12,
    age: 4,
    isCastrated: true,
    species: 'cão',
    ownerId: OWNER_A,
    owner: {
      id: OWNER_A,
      name: 'Tutor A',
      email: 'tutor.a@email.com',
      telephone: '11999999999',
      document: DOCUMENT_A,
      userId: USER_A,
    },
  },
};

const notificationA = {
  id: '44444444-4444-4444-4444-444444444444',
  userId: USER_A,
  notifyWeb: true,
  petId: PET_A,
  appointmentName: 'Vacina',
  appointmentPrice: 120,
  appointmentDateTime: new Date('2026-09-10T15:00:00.000Z'),
  fromCarePlan: true,
  product: { productPrice: 120 },
  pet: {
    id: PET_A,
    name: 'Thor',
    breed: 'SRD',
    owner: {
      id: OWNER_A,
      name: 'Tutor A',
      telephone: '11999999999',
    },
  },
};

const newOwnerDto: CreateOwnerDto = {
  owner: {
    name: 'Tutor B',
    email: 'tutor.b@email.com',
    telephone: '11888888888',
    document: DOCUMENT_A,
  },
  pet: [
    {
      name: 'Mel',
      breed: 'Poodle',
      sex: 'F',
      weight: 6,
      age: 2,
      isCastrated: true,
      species: 'cão',
    },
  ],
};

function createPrisma() {
  return {
    owner: {
      findMany: jest.fn(async ({ where }: { where: { userId?: string } }) =>
        [ownerA]
          .filter((owner) => owner.userId === where.userId)
          .map(({ userId: _userId, ...row }) => row),
      ),
      findFirst: jest.fn(
        async ({
          where,
        }: {
          where: { id?: string; userId?: string; document?: string };
        }) => {
          const match = [ownerA].find((owner) => {
            if (where.id && owner.id !== where.id) return false;
            if (where.userId && owner.userId !== where.userId) return false;
            if (where.document && owner.document !== where.document) {
              return false;
            }
            return true;
          });
          if (!match) return null;
          const { userId: _userId, ...row } = match;
          return row;
        },
      ),
      findUnique: jest.fn(
        async ({
          where,
        }: {
          where: { userId_document?: { userId: string; document: string } };
        }) => {
          const key = where.userId_document;
          if (!key) return null;
          return (
            [ownerA].find(
              (owner) =>
                owner.userId === key.userId && owner.document === key.document,
            ) ?? null
          );
        },
      ),
      create: jest.fn(async ({ data }: { data: { userId: string } }) => ({
        id: '55555555-5555-5555-5555-555555555555',
        ...data,
      })),
    },
    pet: {
      findFirst: jest.fn(
        async ({
          where,
        }: {
          where: { id?: string; owner?: { userId?: string } };
        }) => {
          const pet = ownerA.pets[0];
          if (where.id && pet.id !== where.id) return null;
          if (where.owner?.userId && pet.owner.userId !== where.owner.userId) {
            return null;
          }
          return { id: pet.id };
        },
      ),
      findUnique: jest.fn(async ({ where }: { where: { id: string } }) => {
        const pet = ownerA.pets.find((row) => row.id === where.id);
        return pet ?? null;
      }),
    },
    consulta: {
      findFirst: jest.fn(
        async ({
          where,
        }: {
          where: {
            id?: string;
            petId?: string;
            pet?: { owner?: { userId?: string } };
          };
        }) => {
          if (where.id && consultaA.id !== where.id) return null;
          if (where.petId && consultaA.petId !== where.petId) return null;
          if (
            where.pet?.owner?.userId &&
            consultaA.pet.owner.userId !== where.pet.owner.userId
          ) {
            return null;
          }
          return consultaA;
        },
      ),
    },
    notification: {
      findMany: jest.fn(
        async ({ where }: { where: { userId?: string; notifyWeb?: boolean } }) =>
          [notificationA].filter((row) => {
            if (where.userId && row.userId !== where.userId) return false;
            if (where.notifyWeb !== undefined && row.notifyWeb !== where.notifyWeb) {
              return false;
            }
            return true;
          }),
      ),
    },
    product: {
      findMany: jest.fn(async () => []),
    },
    user: {
      findUnique: jest.fn(async ({ where }: { where: { id: string } }) => {
        if (where.id !== USER_A && where.id !== USER_B) return null;
        return {
          saasPlan: 'starter',
          saasTutorQuota: 100,
          saasMonthlyFee: null,
        };
      }),
    },
  };
}

describe('tenant isolation for a new Firebase user', () => {
  let prisma: ReturnType<typeof createPrisma>;
  let ownerService: OwnerService;
  let consultaService: ConsultaService;
  let notificationsService: NotificationsService;
  let dashboardService: DashboardService;

  beforeEach(() => {
    prisma = createPrisma();
    const prismaService = prisma as unknown as PrismaService;
    ownerService = new OwnerService(prismaService);
    consultaService = new ConsultaService(prismaService);
    notificationsService = new NotificationsService(prismaService);
    dashboardService = new DashboardService(prismaService);
  });

  it('hides user A tutors, appointments, and consultas from user B', async () => {
    await expect(ownerService.findAll(USER_B)).resolves.toEqual([]);
    await expect(ownerService.findById(USER_B, OWNER_A)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(ownerService.getPlan(USER_B, PET_A)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(
      consultaService.findById(USER_B, CONSULTA_A),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      consultaService.findLatestByPet(USER_B, PET_A),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(notificationsService.listFiltered(USER_B)).resolves.toEqual({
      notifications: [],
    });

    const metrics = await dashboardService.getMetrics(USER_B);
    expect(metrics.pacientesUnicos.value).toBe(0);
  });

  it('still returns user A clinic data to user A', async () => {
    const owners = await ownerService.findAll(USER_A);
    expect(owners).toHaveLength(1);
    expect(owners[0].id).toBe(OWNER_A);

    await expect(consultaService.findById(USER_A, CONSULTA_A)).resolves.toEqual(
      consultaA,
    );

    const feed = await notificationsService.listFiltered(USER_A);
    expect(feed.notifications).toHaveLength(1);

    const metrics = await dashboardService.getMetrics(USER_A);
    expect(metrics.pacientesUnicos.value).toBeGreaterThan(0);
  });

  it('lets user B reuse a tutor document that belongs to user A', async () => {
    await expect(ownerService.create(USER_A, newOwnerDto)).rejects.toBeInstanceOf(
      ConflictException,
    );

    await ownerService.create(USER_B, newOwnerDto);
    expect(prisma.owner.findUnique).toHaveBeenCalledWith({
      where: { userId_document: { userId: USER_B, document: DOCUMENT_A } },
    });
    expect(prisma.owner.create).toHaveBeenCalled();
  });
});
