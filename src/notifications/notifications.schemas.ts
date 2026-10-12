import { z } from 'zod';

export const pushTokenSchema = z.object({
  token: z.string().regex(/^(ExponentPushToken|ExpoPushToken)\[[^\]]+\]$/),
});

const chatPushFields = {
  conversationId: z.string().min(1),
  tutorName: z.string().min(1),
  petName: z.string().min(1),
  text: z.string().min(1),
  messageId: z.string().min(1),
};

export const chatPushSchema = z.union([
  z.object({
    ...chatPushFields,
    audience: z.literal('vet').optional(),
    vetFirebaseUid: z.string().min(1),
  }),
  z.object({
    ...chatPushFields,
    audience: z.literal('tutor'),
    tutorFirebaseUid: z.string().min(1),
    planStepId: z.string().uuid(),
  }),
]);

export const webPushSubscriptionSchema = z.object({
  endpoint: z.string().min(1),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
});

export const webPushUnsubscribeSchema = z.object({
  endpoint: z.string().min(1),
});

export type PushTokenDto = z.infer<typeof pushTokenSchema>;
export type ChatPushDto = z.infer<typeof chatPushSchema>;
export type WebPushSubscriptionDto = z.infer<typeof webPushSubscriptionSchema>;
export type WebPushUnsubscribeDto = z.infer<typeof webPushUnsubscribeSchema>;
