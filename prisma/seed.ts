import 'dotenv/config';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';

import {
  buildProductLookup,
  resolveProduct,
} from '../src/common/product-lookup';
import {
  buildAppointments,
  nudgeToWeekday,
} from '../src/common/schedule';

const connectionString = `${process.env.DATABASE_URL}`;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const SEED_USER_ID = process.env.SEED_USER_ID ?? 'seed-vet-demo';

type SeedPet = {
  name: string;
  breed: string;
  species: string;
  sex: 'M' | 'F';
  weight: number;
  age: number;
  isCastrated: boolean;
};

const owners: Array<{
  name: string;
  email: string;
  telephone: string;
  document: string;
  pets: SeedPet[];
}> = [
  {
    name: 'Ana Paula Ferreira',
    email: 'ana.ferreira@email.com',
    telephone: '(11) 99123-4567',
    document: '12345678900',
    pets: [
      {
        name: 'Thor',
        breed: 'Labrador',
        species: 'cachorro',
        sex: 'M',
        weight: 28.5,
        age: 3,
        isCastrated: false,
      },
    ],
  },
  {
    name: 'Carlos Eduardo Santos',
    email: 'carlos.santos@email.com',
    telephone: '(21) 98765-4321',
    document: '98765432100',
    pets: [
      {
        name: 'Mel',
        breed: 'Poodle',
        species: 'cachorro',
        sex: 'F',
        weight: 5.2,
        age: 2,
        isCastrated: true,
      },
    ],
  },
  {
    name: 'Mariana Costa',
    email: 'mariana.costa@email.com',
    telephone: '(31) 97654-3210',
    document: '45678912300',
    pets: [
      {
        name: 'Nina',
        breed: 'Shih Tzu',
        species: 'cachorro',
        sex: 'F',
        weight: 4.8,
        age: 5,
        isCastrated: true,
      },
      {
        name: 'Bob',
        breed: 'Beagle',
        species: 'cachorro',
        sex: 'M',
        weight: 12.0,
        age: 4,
        isCastrated: false,
      },
    ],
  },
  {
    name: 'Pedro Henrique Lima',
    email: 'pedro.lima@email.com',
    telephone: '(41) 96543-2109',
    document: '32165498700',
    pets: [
      {
        name: 'Rex',
        breed: 'Pastor Alemão',
        species: 'cachorro',
        sex: 'M',
        weight: 32.0,
        age: 6,
        isCastrated: false,
      },
    ],
  },
];

const catalogProducts: Array<{
  productName: string;
  productPrice: number;
  productQuantity: number | null;
}> = [
  { productName: 'V10', productPrice: 120, productQuantity: null },
  { productName: 'V8', productPrice: 100, productQuantity: null },
  { productName: 'Antirrábica', productPrice: 80, productQuantity: null },
  { productName: 'Giárdia', productPrice: 90, productQuantity: null },
  { productName: 'Vermífugo', productPrice: 30, productQuantity: null },
  { productName: 'Hemograma', productPrice: 80, productQuantity: null },
  { productName: 'Exame de fezes', productPrice: 50, productQuantity: null },
  { productName: 'Castração', productPrice: 450, productQuantity: 1 },
  { productName: 'V5', productPrice: 110, productQuantity: null },
  { productName: 'Vacina FeLV', productPrice: 95, productQuantity: null },
  { productName: 'Teste FIV/FeLV', productPrice: 70, productQuantity: 1 },
  {
    productName: 'Avaliação de peso e escore corporal',
    productPrice: 40,
    productQuantity: null,
  },
  { productName: 'Ultrassom abdominal', productPrice: 180, productQuantity: 1 },
  {
    productName: 'Tratamento de dermatite',
    productPrice: 95,
    productQuantity: null,
  },
  { productName: 'Raspado de pele', productPrice: 55, productQuantity: null },
];

const HISTORY_PROCEDURES: Array<{
  appointmentName: string;
  notifyWhatsapp: boolean;
}> = [
  { appointmentName: 'Vermífugo', notifyWhatsapp: true },
  { appointmentName: 'Hemograma', notifyWhatsapp: false },
  { appointmentName: 'Antirrábica', notifyWhatsapp: true },
  { appointmentName: 'V10', notifyWhatsapp: false },
  { appointmentName: 'Exame de fezes', notifyWhatsapp: false },
  { appointmentName: 'Ultrassom abdominal', notifyWhatsapp: true },
  { appointmentName: 'Tratamento de dermatite', notifyWhatsapp: false },
  { appointmentName: 'Avaliação de peso e escore corporal', notifyWhatsapp: true },
];

async function persistPlanNotifications(
  petId: string,
  userId: string,
  createdAt: Date,
  items: Array<{
    planItemName: string;
    planRecurrency: 'single' | 'recurrent';
    planRecurrencyRate?: number;
    planDurationInMonths: number;
    notifyWhatsapp: boolean;
    notifyWeb: boolean;
  }>,
) {
  const appointments = buildAppointments(createdAt, items);
  if (appointments.length === 0) {
    return;
  }

  const products = await prisma.product.findMany({
    select: { id: true, productName: true, productPrice: true },
  });
  const productLookup = buildProductLookup(products);

  await prisma.notification.createMany({
    data: appointments.map((appointment) => {
      const product = resolveProduct(
        productLookup,
        appointment.appointmentName,
      );
      return {
        petId,
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

async function persistDashboardHistory(
  pets: Array<{ id: string }>,
  userId: string,
) {
  if (pets.length === 0) {
    return;
  }

  const products = await prisma.product.findMany({
    select: { id: true, productName: true, productPrice: true },
  });
  const productLookup = buildProductLookup(products);
  const now = new Date();
  const rows: Array<{
    petId: string;
    userId: string;
    appointmentName: string;
    appointmentDateTime: Date;
    appointmentPrice: number | null;
    productId: string | null;
    notifyWhatsapp: boolean;
    notifyWeb: boolean;
    fromCarePlan: boolean;
  }> = [];

  for (let monthOffset = 6; monthOffset >= -1; monthOffset -= 1) {
    for (const [petIndex, pet] of pets.entries()) {
      const procedure =
        HISTORY_PROCEDURES[(monthOffset + petIndex + 8) % HISTORY_PROCEDURES.length];
      const day = 3 + ((petIndex * 4 + monthOffset + 12) % 22);
      const date = nudgeToWeekday(
        new Date(now.getFullYear(), now.getMonth() - monthOffset, day, 14, 0, 0),
      );
      const product = resolveProduct(productLookup, procedure.appointmentName);
      rows.push({
        petId: pet.id,
        userId,
        appointmentName: procedure.appointmentName,
        appointmentDateTime: date,
        appointmentPrice: product?.productPrice ?? null,
        productId: product?.id ?? null,
        notifyWhatsapp: procedure.notifyWhatsapp,
        notifyWeb: true,
        fromCarePlan: true,
      });
    }
  }

  for (let dayOffset = 0; dayOffset < 7; dayOffset += 1) {
    const pet = pets[dayOffset % pets.length];
    if (!pet) {
      continue;
    }
    const procedure = HISTORY_PROCEDURES[dayOffset % HISTORY_PROCEDURES.length];
    const date = nudgeToWeekday(
      new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() - dayOffset,
        10 + dayOffset,
        0,
        0,
      ),
    );
    const product = resolveProduct(productLookup, procedure.appointmentName);
    rows.push({
      petId: pet.id,
      userId,
      appointmentName: procedure.appointmentName,
      appointmentDateTime: date,
      appointmentPrice: product?.productPrice ?? null,
      productId: product?.id ?? null,
      notifyWhatsapp: procedure.notifyWhatsapp,
      notifyWeb: true,
      fromCarePlan: true,
    });
  }

  await prisma.notification.createMany({ data: rows });
}

async function main() {
  await prisma.notification.deleteMany();
  await prisma.carePlanItem.deleteMany();
  await prisma.carePlan.deleteMany();
  await prisma.pet.deleteMany();
  await prisma.owner.deleteMany();
  await prisma.user.deleteMany();
  await prisma.product.deleteMany();

  await prisma.product.createMany({ data: catalogProducts });

  await prisma.user.create({
    data: {
      id: SEED_USER_ID,
      userName: 'Vet Demo',
      userEmail: 'vet.demo@email.com',
      saasPlan: 'starter',
      saasTutorQuota: 100,
    },
  });

  const created = [];
  for (const owner of owners) {
    created.push(
      await prisma.owner.create({
        data: {
          name: owner.name,
          email: owner.email,
          telephone: owner.telephone,
          document: owner.document,
          userId: SEED_USER_ID,
          pets: { create: owner.pets },
        },
        include: { pets: true },
      }),
    );
  }

  const thor = created[0]?.pets[0];
  const mel = created[1]?.pets[0];

  if (thor) {
    const thorItems = [
      {
        planItemName: 'v10',
        planRecurrency: 'recurrent' as const,
        planRecurrencyRate: 12,
        planDurationInMonths: 24,
        notifyWhatsapp: false,
        notifyWeb: true,
      },
      {
        planItemName: 'Vermifugação',
        planRecurrency: 'recurrent' as const,
        planRecurrencyRate: 3,
        planDurationInMonths: 12,
        notifyWhatsapp: false,
        notifyWeb: true,
      },
    ];
    const thorPlan = await prisma.carePlan.create({
      data: {
        petId: thor.id,
        description:
          'Plano de vacinação e vermifugação para Thor, com reforço periódico.',
        items: { create: thorItems },
      },
    });
    await persistPlanNotifications(
      thor.id,
      SEED_USER_ID,
      thorPlan.createdAt,
      thorItems,
    );
  }

  if (mel) {
    const melItems = [
      {
        planItemName: 'Antirrábica',
        planRecurrency: 'single' as const,
        planDurationInMonths: 12,
        notifyWhatsapp: true,
        notifyWeb: true,
      },
      {
        planItemName: 'Check-up',
        planRecurrency: 'recurrent' as const,
        planRecurrencyRate: 6,
        planDurationInMonths: 12,
        notifyWhatsapp: false,
        notifyWeb: true,
      },
    ];
    const melPlan = await prisma.carePlan.create({
      data: {
        petId: mel.id,
        description: 'Check-up anual e reforço antirrábico para Mel.',
        items: { create: melItems },
      },
    });
    await persistPlanNotifications(
      mel.id,
      SEED_USER_ID,
      melPlan.createdAt,
      melItems,
    );
  }

  const allPets = created.flatMap((owner) => owner.pets);
  await persistDashboardHistory(allPets, SEED_USER_ID);
}

main()
  .then(async () => {
    await prisma.$disconnect();
    await pool.end();
  })
  .catch(async (error: unknown) => {
    console.error(error);
    await prisma.$disconnect();
    await pool.end();
    process.exit(1);
  });
