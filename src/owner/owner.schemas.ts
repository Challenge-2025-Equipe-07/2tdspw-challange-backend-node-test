import { z } from 'zod';

export const petSexSchema = z.enum(['M', 'F']);

export const petSchema = z.object({
  name: z.string().min(1),
  breed: z.string().min(1),
  sex: petSexSchema,
  weight: z.number(),
  age: z.number().int(),
  isCastrated: z.boolean(),
  species: z.string().optional(),
});

export const createOwnerSchema = z.object({
  owner: z.object({
    name: z.string().min(1),
    email: z.string().email(),
    telephone: z.string().min(1),
    document: z.string().min(1),
  }),
  pet: z.array(petSchema).min(1),
});

export const createPlanItemSchema = z.object({
  planItemName: z.string().min(1),
  planRecurrency: z.enum(['single', 'recurrent']),
  planRecurrencyRate: z.number().int().positive().optional(),
  planDurationInMonths: z.number().int(),
  notifyWhatsapp: z.boolean(),
  notifyWeb: z.boolean(),
});

export const createPlanSchema = z.object({
  carePlanDescription: z.string(),
  carePlan: z.array(createPlanItemSchema).min(1),
});

export const uuidParamSchema = z.string().uuid();

export const updatePlanAppointmentSchema = z.object({
  id: z.string().uuid(),
  notifyWhatsapp: z.boolean(),
  notifyWeb: z.boolean(),
});

export const updatePlanNotificationsSchema = z.object({
  appointments: z.array(updatePlanAppointmentSchema).min(1),
});

export const createAppointmentSchema = z.object({
  productId: z.string().uuid(),
  appointmentDate: z
    .string()
    .min(1)
    .refine((value) => !Number.isNaN(Date.parse(value)), {
      message: 'Invalid appointment date',
    }),
  notifyWhatsapp: z.boolean().optional().default(false),
  notifyWeb: z.boolean().optional().default(true),
});

export type CreateOwnerDto = z.infer<typeof createOwnerSchema>;
export type CreatePetDto = z.infer<typeof petSchema>;
export type CreatePlanDto = z.infer<typeof createPlanSchema>;
export type UpdatePlanNotificationsDto = z.infer<
  typeof updatePlanNotificationsSchema
>;
export type CreateAppointmentDto = z.infer<typeof createAppointmentSchema>;
