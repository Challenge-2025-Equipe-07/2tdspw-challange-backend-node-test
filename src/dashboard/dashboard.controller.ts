import { Controller, Get } from '@nestjs/common';

import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthUser } from '../auth/auth.types';
import { DashboardService } from './dashboard.service';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get()
  getMetrics(@CurrentUser() user: AuthUser) {
    return this.dashboardService.getMetrics(user.id);
  }
}
