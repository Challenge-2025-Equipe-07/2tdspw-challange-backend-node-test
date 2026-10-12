import { z } from 'zod';

export const pushTokenSchema = z.object({
  token: z.string().regex(/^(ExponentPushToken|ExpoPushToken)\[[^\]]+\]$/),
});

export const chatPushSchema = z.object({
  vetFirebaseUid: z.string().min(1),
  conversationId: z.string().min(1),
  tutorName: z.string().min(1),
  petName: z.string().min(1),
  text: z.string().min(1),
  messageId: z.string().min(1),
});

export type PushTokenDto = z.infer<typeof pushTokenSchema>;
export type ChatPushDto = z.infer<typeof chatPushSchema>;
