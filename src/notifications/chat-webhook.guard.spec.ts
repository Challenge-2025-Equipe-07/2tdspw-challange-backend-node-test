import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { ChatWebhookGuard } from './chat-webhook.guard';

jest.mock('@nestjs/common', () => {
  class HttpError extends Error {}
  return {
    Injectable: () => (target: unknown) => target,
    UnauthorizedException: class UnauthorizedException extends HttpError {},
  };
});
jest.mock('@nestjs/config', () => ({
  ConfigService: class ConfigService {},
}));

function createGuard(secret: string | undefined) {
  const config = {
    get: jest.fn((key: string) =>
      key === 'CHAT_WEBHOOK_SECRET' ? secret : undefined,
    ),
  } as unknown as ConfigService;
  return new ChatWebhookGuard(config);
}

function contextWith(header?: string): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({
        headers:
          header === undefined ? {} : { 'x-chat-webhook-secret': header },
      }),
    }),
  } as ExecutionContext;
}

describe('ChatWebhookGuard', () => {
  it('rejects a missing secret', () => {
    const guard = createGuard('expected-secret');
    expect(() => guard.canActivate(contextWith())).toThrow(
      UnauthorizedException,
    );
  });

  it('rejects a wrong secret', () => {
    const guard = createGuard('expected-secret');
    expect(() => guard.canActivate(contextWith('expected-secre!'))).toThrow(
      UnauthorizedException,
    );
  });

  it('rejects every request when the env var is empty', () => {
    const guard = createGuard('');
    expect(() => guard.canActivate(contextWith(''))).toThrow(
      UnauthorizedException,
    );
  });

  it('allows a matching secret', () => {
    const guard = createGuard('expected-secret');
    expect(guard.canActivate(contextWith('expected-secret'))).toBe(true);
  });
});
