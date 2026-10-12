import { Module } from '@nestjs/common';

import { TutorAccountService } from '../auth/tutor-account.service';
import { OwnerController } from './owner.controller';
import { OwnerService } from './owner.service';

@Module({
  controllers: [OwnerController],
  providers: [OwnerService, TutorAccountService],
})
export class OwnerModule {}
