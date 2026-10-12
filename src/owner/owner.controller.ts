import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';

import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthUser } from '../auth/auth.types';
import {
  createAppointmentSchema,
  createOwnerSchema,
  createPlanSchema,
  petSchema,
  tutorPlanNotificationsSchema,
  updatePlanNotificationsSchema,
  uuidParamSchema,
  type CreateAppointmentDto,
  type CreateOwnerDto,
  type CreatePetDto,
  type CreatePlanDto,
  type TutorPlanNotificationsDto,
  type UpdatePlanNotificationsDto,
} from './owner.schemas';
import { OwnerService } from './owner.service';

@Controller('owner')
export class OwnerController {
  constructor(private readonly ownerService: OwnerService) {}

  @Get()
  find(@CurrentUser() user: AuthUser, @Query('document') document?: string) {
    const userId = clinicId(user);
    if (document) {
      return this.ownerService.findByDocument(userId, document);
    }
    return this.ownerService.findAll(userId);
  }

  @Get('me')
  findMine(@CurrentUser() user: AuthUser) {
    return this.ownerService.findByTelephone(requiredPhone(user));
  }

  @Get(':petId/plan')
  getPlan(
    @CurrentUser() user: AuthUser,
    @Param('petId', { schema: uuidParamSchema }) petId: string,
  ) {
    if (user.role === 'tutor') {
      return this.ownerService.getPlanForTutor(tutorPhone(user), petId);
    }
    return this.ownerService.getPlan(user.id, petId);
  }

  @Get(':id')
  findOne(
    @CurrentUser() user: AuthUser,
    @Param('id', { schema: uuidParamSchema }) id: string,
  ) {
    return this.ownerService.findById(clinicId(user), id);
  }

  @Post()
  create(
    @CurrentUser() user: AuthUser,
    @Body({ schema: createOwnerSchema }) body: CreateOwnerDto,
  ) {
    return this.ownerService.create(clinicId(user), body);
  }

  @Post(':id/pet')
  addPet(
    @CurrentUser() user: AuthUser,
    @Param('id', { schema: uuidParamSchema }) id: string,
    @Body({ schema: petSchema }) body: CreatePetDto,
  ) {
    return this.ownerService.addPet(clinicId(user), id, body);
  }

  @Post(':petId/plan')
  createPlan(
    @CurrentUser() user: AuthUser,
    @Param('petId', { schema: uuidParamSchema }) petId: string,
    @Body({ schema: createPlanSchema }) body: CreatePlanDto,
  ) {
    return this.ownerService.createPlan(clinicId(user), petId, body);
  }

  @Patch(':petId/plan/notifications')
  updatePlanNotifications(
    @CurrentUser() user: AuthUser,
    @Param('petId', { schema: uuidParamSchema }) petId: string,
    @Body({ schema: tutorPlanNotificationsSchema })
    body: TutorPlanNotificationsDto,
  ) {
    if (user.role !== 'tutor') {
      throw new ForbiddenException(
        'Clinic accounts cannot change notification preferences',
      );
    }
    return this.ownerService.updatePlanNotificationsForTutor(
      tutorPhone(user),
      petId,
      body,
    );
  }

  @Patch(':petId/plan')
  updatePlan(
    @CurrentUser() user: AuthUser,
    @Param('petId', { schema: uuidParamSchema }) petId: string,
    @Body({ schema: updatePlanNotificationsSchema })
    body: UpdatePlanNotificationsDto,
  ) {
    return this.ownerService.updatePlan(clinicId(user), petId, body);
  }

  @Post(':petId/plan/appointments')
  @HttpCode(HttpStatus.CREATED)
  createAppointment(
    @CurrentUser() user: AuthUser,
    @Param('petId', { schema: uuidParamSchema }) petId: string,
    @Body({ schema: createAppointmentSchema }) body: CreateAppointmentDto,
  ) {
    return this.ownerService.createAppointment(clinicId(user), petId, body);
  }

  @Delete(':petId/plan/appointments/:appointmentId')
  deleteAppointment(
    @CurrentUser() user: AuthUser,
    @Param('petId', { schema: uuidParamSchema }) petId: string,
    @Param('appointmentId', { schema: uuidParamSchema }) appointmentId: string,
  ) {
    return this.ownerService.deleteAppointment(
      clinicId(user),
      petId,
      appointmentId,
    );
  }
}

function clinicId(user: AuthUser): string {
  if (user.role === 'tutor') {
    throw new ForbiddenException('Tutor accounts can only read a care plan');
  }
  return user.id;
}

function tutorPhone(user: AuthUser): string {
  return requiredPhone(user);
}

function requiredPhone(user: AuthUser): string {
  if (!user.phoneNumber) {
    throw new ForbiddenException('Tutor accounts can only read a care plan');
  }
  return user.phoneNumber;
}
