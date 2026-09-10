import { z } from 'zod';

import { uuidParamSchema } from '../owner/owner.schemas';

export { uuidParamSchema };

export const createConsultaSchema = z.object({
  petId: z.string().uuid(),
});

export const examEntrySchema = z.object({
  name: z.string().min(1),
  date: z.string().min(1),
});

const isoDateSchema = z
  .string()
  .min(1)
  .refine((value) => !Number.isNaN(Date.parse(value)), {
    message: 'Invalid date',
  });

export const updateConsultaSchema = z.object({
  resumo: z.string().optional(),
  diagnostico: z.string().optional(),
  prescription: z.array(z.string()).optional(),
  exams: z.array(examEntrySchema).optional(),
  finalizedAt: isoDateSchema.nullable().optional(),
  aiFedAt: isoDateSchema.nullable().optional(),
  aiFeedError: z.string().nullable().optional(),
});

export type CreateConsultaDto = z.infer<typeof createConsultaSchema>;
export type UpdateConsultaDto = z.infer<typeof updateConsultaSchema>;
