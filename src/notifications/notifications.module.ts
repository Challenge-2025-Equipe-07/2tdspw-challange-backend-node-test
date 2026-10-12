import { Module } from '@nestjs/common';

import { ChatWebhookGuard } from './chat-webhook.guard';
import { ExpoPushService } from './expo-push.service';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { WebPushService } from './web-push.service';

@Module({
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    ExpoPushService,
    WebPushService,
    ChatWebhookGuard,
  ],
})
export class NotificationsModule {}
