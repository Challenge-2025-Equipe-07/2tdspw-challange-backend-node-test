import { BadGatewayException } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { ExpoPushService } from './expo-push.service';
import type { ChatPushDto } from './notifications.schemas';

jest.mock('@nestjs/common', () => {
  class HttpError extends Error {}
  return {
    Injectable: () => (target: unknown) => target,
    Logger: class Logger {
      error(): void {}
    },
    BadGatewayException: class BadGatewayException extends HttpError {},
  };
});
jest.mock('../prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

const message: ChatPushDto = {
  vetFirebaseUid: 'vet-1',
  conversationId: 'conv-1',
  tutorName: 'Ana',
  petName: 'Luna',
  text: 'O exame ficou pronto',
  messageId: 'msg-1',
};

function createService() {
  const prisma = {
    expoPushToken: {
      upsert: jest.fn(),
      findMany: jest.fn(),
      deleteMany: jest.fn(),
    },
    chatPushReceipt: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
  };
  const service = new ExpoPushService(prisma as unknown as PrismaService);
  return { service, prisma };
}

describe('ExpoPushService', () => {
  const fetchMock = jest.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock;
  });

  it('saves a token for the vet and can move it to another vet', async () => {
    const { service, prisma } = createService();
    const token = 'ExponentPushToken[abc]';

    await service.saveToken('vet-1', token);
    await service.saveToken('vet-2', token);

    expect(prisma.expoPushToken.upsert).toHaveBeenNthCalledWith(1, {
      where: { token },
      create: { token, userId: 'vet-1' },
      update: { userId: 'vet-1' },
    });
    expect(prisma.expoPushToken.upsert).toHaveBeenNthCalledWith(2, {
      where: { token },
      create: { token, userId: 'vet-2' },
      update: { userId: 'vet-2' },
    });
  });

  it('does not call Expo when the message was already delivered', async () => {
    const { service, prisma } = createService();
    prisma.chatPushReceipt.findUnique.mockResolvedValue({
      messageId: message.messageId,
    });

    await service.deliverChat(message);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(prisma.chatPushReceipt.create).not.toHaveBeenCalled();
  });

  it('acknowledges a vet with no token and does not call Expo', async () => {
    const { service, prisma } = createService();
    prisma.chatPushReceipt.findUnique.mockResolvedValue(null);
    prisma.expoPushToken.findMany.mockResolvedValue([]);

    await service.deliverChat(message);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(prisma.chatPushReceipt.create).toHaveBeenCalledWith({
      data: { messageId: message.messageId },
    });
  });

  it('sends one Expo message per token and records the receipt', async () => {
    const { service, prisma } = createService();
    prisma.chatPushReceipt.findUnique.mockResolvedValue(null);
    prisma.expoPushToken.findMany.mockResolvedValue([
      { token: 'ExponentPushToken[abc]' },
      { token: 'ExpoPushToken[def]' },
    ]);
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          data: [{ status: 'ok' }, { status: 'ok' }],
        }),
    });

    await service.deliverChat({
      ...message,
      text: 'x'.repeat(200),
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://exp.host/--/api/v2/push/send',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify([
          {
            to: 'ExponentPushToken[abc]',
            title: 'Ana',
            body: 'x'.repeat(178),
            data: { conversationId: 'conv-1' },
            sound: 'default',
          },
          {
            to: 'ExpoPushToken[def]',
            title: 'Ana',
            body: 'x'.repeat(178),
            data: { conversationId: 'conv-1' },
            sound: 'default',
          },
        ]),
      }),
    );
    expect(prisma.expoPushToken.deleteMany).not.toHaveBeenCalled();
    expect(prisma.chatPushReceipt.create).toHaveBeenCalledWith({
      data: { messageId: message.messageId },
    });
  });

  it('deletes a token Expo reports as not registered', async () => {
    const { service, prisma } = createService();
    prisma.chatPushReceipt.findUnique.mockResolvedValue(null);
    prisma.expoPushToken.findMany.mockResolvedValue([
      { token: 'ExponentPushToken[gone]' },
      { token: 'ExponentPushToken[ok]' },
    ]);
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          data: [
            {
              status: 'error',
              details: { error: 'DeviceNotRegistered' },
            },
            { status: 'ok' },
          ],
        }),
    });

    await service.deliverChat(message);

    expect(prisma.expoPushToken.deleteMany).toHaveBeenCalledWith({
      where: { token: { in: ['ExponentPushToken[gone]'] } },
    });
    expect(prisma.chatPushReceipt.create).toHaveBeenCalledWith({
      data: { messageId: message.messageId },
    });
  });

  it('does not record a receipt when Expo rejects the push', async () => {
    const { service, prisma } = createService();
    prisma.chatPushReceipt.findUnique.mockResolvedValue(null);
    prisma.expoPushToken.findMany.mockResolvedValue([
      { token: 'ExponentPushToken[abc]' },
    ]);
    fetchMock.mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.resolve({}),
    });

    await expect(service.deliverChat(message)).rejects.toBeInstanceOf(
      BadGatewayException,
    );
    expect(prisma.chatPushReceipt.create).not.toHaveBeenCalled();
    expect(prisma.expoPushToken.deleteMany).not.toHaveBeenCalled();
  });

  it('does not record a receipt when the Expo call throws', async () => {
    const { service, prisma } = createService();
    prisma.chatPushReceipt.findUnique.mockResolvedValue(null);
    prisma.expoPushToken.findMany.mockResolvedValue([
      { token: 'ExponentPushToken[abc]' },
    ]);
    fetchMock.mockRejectedValue(new Error('network down'));

    await expect(service.deliverChat(message)).rejects.toBeInstanceOf(
      BadGatewayException,
    );
    expect(prisma.chatPushReceipt.create).not.toHaveBeenCalled();
  });
});
