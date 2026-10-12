import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { z } from 'zod';

import { CurrentUser } from '../auth/current-user.decorator';
import { Public } from '../auth/public.decorator';
import type { AuthUser } from '../auth/auth.types';
import { uuidParamSchema } from '../owner/owner.schemas';
import { ChatWebhookGuard } from './chat-webhook.guard';
import { ExpoPushService } from './expo-push.service';
import {
  chatPushSchema,
  pushTokenSchema,
  type ChatPushDto,
  type PushTokenDto,
} from './notifications.schemas';
import { NotificationsService } from './notifications.service';

const pageSchema = z.coerce.number().int().positive().optional();
const optionalDateSchema = z.string().min(1).optional();

@Controller('notifications')
export class NotificationsController {
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly expoPushService: ExpoPushService,
  ) {}

  @Put('push-token')
  @HttpCode(HttpStatus.NO_CONTENT)
  savePushToken(
    @CurrentUser() user: AuthUser,
    @Body({ schema: pushTokenSchema }) body: PushTokenDto,
  ) {
    if (user.role === 'tutor') {
      throw new ForbiddenException('Tutor accounts can only read a care plan');
    }
    return this.expoPushService.saveToken(user.id, body.token);
  }

  @Public()
  @UseGuards(ChatWebhookGuard)
  @Post('chat')
  @HttpCode(HttpStatus.ACCEPTED)
  deliverChat(@Body({ schema: chatPushSchema }) body: ChatPushDto) {
    return this.expoPushService.deliverChat(body);
  }

  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @Query('page', { schema: pageSchema }) page?: number,
    @Query('dateFrom', { schema: optionalDateSchema }) dateFrom?: string,
    @Query('dateTo', { schema: optionalDateSchema }) dateTo?: string,
  ) {
    if (dateFrom !== undefined || dateTo !== undefined || page === undefined) {
      return this.notificationsService.listFiltered(user.id, {
        dateFrom,
        dateTo,
      });
    }

    return this.notificationsService.list(user.id, page);
  }

  @Get(':ownerId')
  listByOwner(
    @CurrentUser() user: AuthUser,
    @Param('ownerId', { schema: uuidParamSchema }) ownerId: string,
    @Query('dateFrom', { schema: optionalDateSchema }) dateFrom?: string,
    @Query('dateTo', { schema: optionalDateSchema }) dateTo?: string,
  ) {
    return this.notificationsService.listFiltered(user.id, {
      ownerId,
      dateFrom,
      dateTo,
    });
  }
}
