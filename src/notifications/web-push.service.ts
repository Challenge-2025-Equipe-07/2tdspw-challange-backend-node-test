import {
  BadGatewayException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { sendNotification, setVapidDetails } from 'web-push';

import { PrismaService } from '../prisma/prisma.service';
import type {
  ChatPushDto,
  WebPushSubscriptionDto,
  WebPushUnsubscribeDto,
} from './notifications.schemas';

@Injectable()
export class WebPushService {
  private readonly logger = new Logger(WebPushService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async saveSubscription(
    firebaseUid: string,
    dto: WebPushSubscriptionDto,
  ): Promise<void> {
    await this.prisma.webPushSubscription.upsert({
      where: { endpoint: dto.endpoint },
      create: {
        endpoint: dto.endpoint,
        p256dh: dto.keys.p256dh,
        auth: dto.keys.auth,
        firebaseUid,
      },
      update: {
        p256dh: dto.keys.p256dh,
        auth: dto.keys.auth,
        firebaseUid,
      },
    });
  }

  async deleteSubscription(
    firebaseUid: string,
    dto: WebPushUnsubscribeDto,
  ): Promise<void> {
    const removed = await this.prisma.webPushSubscription.deleteMany({
      where: { endpoint: dto.endpoint, firebaseUid },
    });
    if (removed.count === 0) {
      throw new NotFoundException('Web push subscription not found');
    }
  }

  async deliverTutorChat(input: ChatPushDto): Promise<void> {
    if (input.audience !== 'tutor') {
      throw new BadGatewayException('Web push failed');
    }

    const existing = await this.prisma.chatPushReceipt.findUnique({
      where: { messageId: input.messageId },
    });
    if (existing) return;

    const notification = await this.prisma.notification.findUnique({
      where: { id: input.planStepId },
      select: { notifyWeb: true },
    });
    if (!notification || !notification.notifyWeb) {
      await this.recordReceipt(input.messageId);
      return;
    }

    const subscriptions = await this.prisma.webPushSubscription.findMany({
      where: { firebaseUid: input.tutorFirebaseUid },
      select: { endpoint: true, p256dh: true, auth: true },
    });
    if (subscriptions.length === 0) {
      await this.recordReceipt(input.messageId);
      return;
    }

    const vapid = this.readVapid();
    if (!vapid) {
      this.logger.error(`Web push is not configured for ${input.messageId}`);
      throw new BadGatewayException('Web push failed');
    }

    try {
      setVapidDetails(vapid.subject, vapid.publicKey, vapid.privateKey);
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      this.logger.error(`Web push failed for ${input.messageId}: ${detail}`);
      throw new BadGatewayException('Web push failed');
    }

    const payload = JSON.stringify({
      title: 'Clínica',
      body: input.text.slice(0, 178),
      data: { conversationId: input.conversationId },
    });

    let failed = false;
    for (const subscription of subscriptions) {
      try {
        await sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: {
              p256dh: subscription.p256dh,
              auth: subscription.auth,
            },
          },
          payload,
        );
      } catch (error) {
        const statusCode = readStatusCode(error);
        if (statusCode === 404 || statusCode === 410) {
          await this.prisma.webPushSubscription.deleteMany({
            where: { endpoint: subscription.endpoint },
          });
          continue;
        }
        const detail = error instanceof Error ? error.message : String(error);
        this.logger.error(`Web push failed for ${input.messageId}: ${detail}`);
        failed = true;
      }
    }

    if (failed) {
      throw new BadGatewayException('Web push failed');
    }

    await this.recordReceipt(input.messageId);
  }

  private readVapid(): {
    subject: string;
    publicKey: string;
    privateKey: string;
  } | null {
    const publicKey = this.config.get<string>('VAPID_PUBLIC_KEY');
    const privateKey = this.config.get<string>('VAPID_PRIVATE_KEY');
    const subject = this.config.get<string>('VAPID_SUBJECT');
    if (!publicKey || !privateKey || !subject) return null;
    return { subject, publicKey, privateKey };
  }

  private async recordReceipt(messageId: string): Promise<void> {
    try {
      await this.prisma.chatPushReceipt.create({ data: { messageId } });
    } catch (error) {
      if (isUniqueViolation(error)) return;
      throw error;
    }
  }
}

function readStatusCode(error: unknown): number | undefined {
  if (
    typeof error === 'object' &&
    error !== null &&
    'statusCode' in error &&
    typeof error.statusCode === 'number'
  ) {
    return error.statusCode;
  }
  return undefined;
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'P2002'
  );
}
