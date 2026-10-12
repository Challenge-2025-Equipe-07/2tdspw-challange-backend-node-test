import {
  Body,
  Controller,
  Delete,
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
  webPushSubscriptionSchema,
  webPushUnsubscribeSchema,
  type ChatPushDto,
  type PushTokenDto,
  type WebPushSubscriptionDto,
  type WebPushUnsubscribeDto,
} from './notifications.schemas';
import { NotificationsService } from './notifications.service';
import { WebPushService } from './web-push.service';

const pageSchema = z.coerce.number().int().positive().optional();
const optionalDateSchema = z.string().min(1).optional();

@Controller('notifications')
export class NotificationsController {
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly expoPushService: ExpoPushService,
    private readonly webPushService: WebPushService,
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

  @Put('web-push')
  @HttpCode(HttpStatus.NO_CONTENT)
  saveWebPush(
    @CurrentUser() user: AuthUser,
    @Body({ schema: webPushSubscriptionSchema }) body: WebPushSubscriptionDto,
  ) {
    if (user.role !== 'tutor') {
      throw new ForbiddenException(
        'Clinic accounts cannot register a web push subscription',
      );
    }
    return this.webPushService.saveSubscription(user.id, body);
  }

  @Delete('web-push')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteWebPush(
    @CurrentUser() user: AuthUser,
    @Body({ schema: webPushUnsubscribeSchema }) body: WebPushUnsubscribeDto,
  ) {
    if (user.role !== 'tutor') {
      throw new ForbiddenException(
        'Clinic accounts cannot register a web push subscription',
      );
    }
    return this.webPushService.deleteSubscription(user.id, body);
  }

  @Public()
  @UseGuards(ChatWebhookGuard)
  @Post('chat')
  @HttpCode(HttpStatus.ACCEPTED)
  deliverChat(@Body({ schema: chatPushSchema }) body: ChatPushDto) {
    if (body.audience === 'tutor') {
      return this.webPushService.deliverTutorChat(body);
    }
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
