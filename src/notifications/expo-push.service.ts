import { BadGatewayException, Injectable, Logger } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import type { ChatPushDto } from './notifications.schemas';

@Injectable()
export class ExpoPushService {
  private readonly logger = new Logger(ExpoPushService.name);

  constructor(private readonly prisma: PrismaService) {}

  async saveToken(userId: string, token: string): Promise<void> {
    await this.prisma.expoPushToken.upsert({
      where: { token },
      create: { token, userId },
      update: { userId },
    });
  }

  async deliverChat(input: ChatPushDto): Promise<void> {
    const existing = await this.prisma.chatPushReceipt.findUnique({
      where: { messageId: input.messageId },
    });
    if (existing) return;

    const rows = await this.prisma.expoPushToken.findMany({
      where: { userId: input.vetFirebaseUid },
      select: { token: true },
    });
    if (rows.length === 0) {
      await this.recordReceipt(input.messageId);
      return;
    }

    const tokens = rows.map((row) => row.token);
    let response: Response;
    try {
      response = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(
          tokens.map((token) => ({
            to: token,
            title: input.tutorName,
            body: input.text.slice(0, 178),
            data: { conversationId: input.conversationId },
            sound: 'default',
          })),
        ),
      });
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      this.logger.error(`Expo push failed for ${input.messageId}: ${detail}`);
      throw new BadGatewayException('Expo push failed');
    }

    if (!response.ok) {
      this.logger.error(
        `Expo push failed for ${input.messageId}: HTTP ${response.status}`,
      );
      throw new BadGatewayException('Expo push failed');
    }

    const body: unknown = await response.json().catch(() => null);
    this.logTicketErrors(input.messageId, body);
    const dead = unregisteredTokens(tokens, body);
    if (dead.length > 0) {
      await this.prisma.expoPushToken.deleteMany({
        where: { token: { in: dead } },
      });
    }

    await this.recordReceipt(input.messageId);
  }

  private async recordReceipt(messageId: string): Promise<void> {
    try {
      await this.prisma.chatPushReceipt.create({ data: { messageId } });
    } catch (error) {
      if (isUniqueViolation(error)) return;
      throw error;
    }
  }

  private logTicketErrors(messageId: string, body: unknown): void {
    for (const ticket of readTickets(body)) {
      if (ticket.status !== 'error') continue;
      const code = ticket.details?.error ?? 'unknown';
      this.logger.error(`Expo ticket error for ${messageId}: ${code}`);
    }
  }
}

type ExpoTicket = {
  status?: string;
  details?: { error?: string };
};

function readTickets(body: unknown): ExpoTicket[] {
  if (typeof body !== 'object' || body === null || !('data' in body)) {
    return [];
  }
  const data = body.data;
  if (!Array.isArray(data)) return [];
  return data.filter(
    (item): item is ExpoTicket => typeof item === 'object' && item !== null,
  );
}

function unregisteredTokens(tokens: string[], body: unknown): string[] {
  const dead: string[] = [];
  readTickets(body).forEach((ticket, index) => {
    if (ticket.details?.error !== 'DeviceNotRegistered') return;
    const token = tokens[index];
    if (token) dead.push(token);
  });
  return dead;
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'P2002'
  );
}
