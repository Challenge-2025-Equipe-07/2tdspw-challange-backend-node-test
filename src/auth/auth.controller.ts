import { Controller, Get } from '@nestjs/common';

import { AuthService } from './auth.service';
import { CurrentUser } from './current-user.decorator';
import type { AuthUser, MeProfile } from './auth.types';

@Controller('me')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get()
  me(@CurrentUser() user: AuthUser): Promise<MeProfile> {
    return this.authService.getMe(user.id);
  }
}
