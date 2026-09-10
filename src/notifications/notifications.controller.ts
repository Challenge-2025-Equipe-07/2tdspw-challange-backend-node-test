import { Controller, Get, Param, Query } from '@nestjs/common';
import { z } from 'zod';

import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthUser } from '../auth/auth.types';
import { uuidParamSchema } from '../owner/owner.schemas';
import { NotificationsService } from './notifications.service';

const pageSchema = z.coerce.number().int().positive().optional();
const optionalDateSchema = z.string().min(1).optional();

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

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
