import {
  Body,
  Controller,
  Delete,
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
  updatePlanNotificationsSchema,
  uuidParamSchema,
  type CreateAppointmentDto,
  type CreateOwnerDto,
  type CreatePetDto,
  type CreatePlanDto,
  type UpdatePlanNotificationsDto,
} from './owner.schemas';
import { OwnerService } from './owner.service';

@Controller('owner')
export class OwnerController {
  constructor(private readonly ownerService: OwnerService) {}

  @Get()
  find(
    @CurrentUser() user: AuthUser,
    @Query('document') document?: string,
  ) {
    if (document) {
      return this.ownerService.findByDocument(user.id, document);
    }
    return this.ownerService.findAll(user.id);
  }

  @Get(':petId/plan')
  getPlan(
    @CurrentUser() user: AuthUser,
    @Param('petId', { schema: uuidParamSchema }) petId: string,
  ) {
    return this.ownerService.getPlan(user.id, petId);
  }

  @Get(':id')
  findOne(
    @CurrentUser() user: AuthUser,
    @Param('id', { schema: uuidParamSchema }) id: string,
  ) {
    return this.ownerService.findById(user.id, id);
  }

  @Post()
  create(
    @CurrentUser() user: AuthUser,
    @Body({ schema: createOwnerSchema }) body: CreateOwnerDto,
  ) {
    return this.ownerService.create(user.id, body);
  }

  @Post(':id/pet')
  addPet(
    @CurrentUser() user: AuthUser,
    @Param('id', { schema: uuidParamSchema }) id: string,
    @Body({ schema: petSchema }) body: CreatePetDto,
  ) {
    return this.ownerService.addPet(user.id, id, body);
  }

  @Post(':petId/plan')
  createPlan(
    @CurrentUser() user: AuthUser,
    @Param('petId', { schema: uuidParamSchema }) petId: string,
    @Body({ schema: createPlanSchema }) body: CreatePlanDto,
  ) {
    return this.ownerService.createPlan(user.id, petId, body);
  }

  @Patch(':petId/plan')
  updatePlan(
    @CurrentUser() user: AuthUser,
    @Param('petId', { schema: uuidParamSchema }) petId: string,
    @Body({ schema: updatePlanNotificationsSchema })
    body: UpdatePlanNotificationsDto,
  ) {
    return this.ownerService.updatePlan(user.id, petId, body);
  }

  @Post(':petId/plan/appointments')
  @HttpCode(HttpStatus.CREATED)
  createAppointment(
    @CurrentUser() user: AuthUser,
    @Param('petId', { schema: uuidParamSchema }) petId: string,
    @Body({ schema: createAppointmentSchema }) body: CreateAppointmentDto,
  ) {
    return this.ownerService.createAppointment(user.id, petId, body);
  }

  @Delete(':petId/plan/appointments/:appointmentId')
  deleteAppointment(
    @CurrentUser() user: AuthUser,
    @Param('petId', { schema: uuidParamSchema }) petId: string,
    @Param('appointmentId', { schema: uuidParamSchema }) appointmentId: string,
  ) {
    return this.ownerService.deleteAppointment(user.id, petId, appointmentId);
  }
}
