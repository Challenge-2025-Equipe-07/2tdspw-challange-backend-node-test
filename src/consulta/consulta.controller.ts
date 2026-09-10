import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';

import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthUser } from '../auth/auth.types';
import {
  createConsultaSchema,
  updateConsultaSchema,
  uuidParamSchema,
  type CreateConsultaDto,
  type UpdateConsultaDto,
} from './consulta.schemas';
import { ConsultaService } from './consulta.service';

@Controller('consulta')
export class ConsultaController {
  constructor(private readonly consultaService: ConsultaService) {}

  @Post()
  create(
    @CurrentUser() user: AuthUser,
    @Body({ schema: createConsultaSchema }) body: CreateConsultaDto,
  ) {
    return this.consultaService.create(user.id, body);
  }

  @Get()
  findLatest(
    @CurrentUser() user: AuthUser,
    @Query('petId', { schema: uuidParamSchema }) petId: string,
  ) {
    return this.consultaService.findLatestByPet(user.id, petId);
  }

  @Get(':id')
  findOne(
    @CurrentUser() user: AuthUser,
    @Param('id', { schema: uuidParamSchema }) id: string,
  ) {
    return this.consultaService.findById(user.id, id);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', { schema: uuidParamSchema }) id: string,
    @Body({ schema: updateConsultaSchema }) body: UpdateConsultaDto,
  ) {
    return this.consultaService.update(user.id, id, body);
  }
}
