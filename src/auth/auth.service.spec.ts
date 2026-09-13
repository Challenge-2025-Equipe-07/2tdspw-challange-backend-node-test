import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from './auth.service';
import { getFirebaseAdminAuth } from './firebase';

jest.mock('@nestjs/common', () => {
  class HttpError extends Error {}
  return {
    Injectable: () => (target: unknown) => target,
    UnauthorizedException: class UnauthorizedException extends HttpError {},
    NotFoundException: class NotFoundException extends HttpError {},
  };
});
jest.mock('@nestjs/config', () => ({
  ConfigService: class ConfigService {},
}));
jest.mock('../prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));
jest.mock('./firebase', () => ({
  getFirebaseAdminAuth: jest.fn(),
}));

const mockGetFirebaseAdminAuth = jest.mocked(getFirebaseAdminAuth);

function createService(env: Record<string, string | undefined> = {}) {
  const config = {
    get: jest.fn((key: string) => env[key]),
  } as unknown as ConfigService;
  const prisma = {
    user: {
      upsert: jest.fn(
        async ({
          where,
          create,
        }: {
          where: { id: string };
          create: { userName: string; userEmail: string };
        }) => ({
          id: where.id,
          userName: create.userName,
          userEmail: create.userEmail,
        }),
      ),
    },
  };

  return {
    service: new AuthService(prisma as unknown as PrismaService, config),
    prisma,
  };
}

describe('AuthService.authenticate', () => {
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    mockGetFirebaseAdminAuth.mockReset();
  });

  it('maps a verified Firebase token to that uid, not the demo user', async () => {
    mockGetFirebaseAdminAuth.mockReturnValue({
      verifyIdToken: jest.fn().mockResolvedValue({
        uid: 'firebase-uid-b',
        name: 'Vet B',
        email: 'vet.b@email.com',
      }),
    } as never);

    const { service, prisma } = createService({
      AUTH_DEV_BYPASS: 'true',
      AUTH_DEV_USER_ID: 'seed-vet-demo',
    });

    const user = await service.authenticate('real-id-token');

    expect(user.id).toBe('firebase-uid-b');
    expect(prisma.user.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'firebase-uid-b' },
      }),
    );
  });

  it('returns 401 when a Bearer token is present but Firebase Admin is missing', async () => {
    mockGetFirebaseAdminAuth.mockReturnValue(null);
    const { service, prisma } = createService({
      AUTH_DEV_BYPASS: 'true',
      AUTH_DEV_USER_ID: 'seed-vet-demo',
    });

    await expect(service.authenticate('any-token')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(prisma.user.upsert).not.toHaveBeenCalled();
  });

  it('uses the demo user only when bypass is on and no token is sent', async () => {
    const { service, prisma } = createService({
      AUTH_DEV_BYPASS: 'true',
      AUTH_DEV_USER_ID: 'seed-vet-demo',
    });

    const user = await service.authenticate(undefined);

    expect(user.id).toBe('seed-vet-demo');
    expect(prisma.user.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'seed-vet-demo' },
      }),
    );
  });

  it('ignores AUTH_DEV_BYPASS in production', async () => {
    process.env.NODE_ENV = 'production';
    const { service, prisma } = createService({
      AUTH_DEV_BYPASS: 'true',
      AUTH_DEV_USER_ID: 'seed-vet-demo',
    });

    await expect(service.authenticate(undefined)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(prisma.user.upsert).not.toHaveBeenCalled();
  });
});
