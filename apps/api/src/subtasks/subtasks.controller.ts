import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { SubtasksService } from './subtasks.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import {
  CreateSubtaskDto,
  UpdateSubtaskDto,
  CreateChecklistItemDto,
  UpdateChecklistItemDto,
} from './subtasks.dto';

@Controller('subtasks')
@UseGuards(JwtAuthGuard)
export class SubtasksController {
  constructor(private subtasks: SubtasksService) {}

  // ───────────────────── Subtasks ─────────────────────

  @Get('record/:recordId')
  listByRecord(@Param('recordId') recordId: string) {
    return this.subtasks.listByRecord(recordId);
  }

  @Post()
  create(@Body() dto: CreateSubtaskDto, @CurrentUser() user: any) {
    return this.subtasks.create({
      ...dto,
      createdById: user.id,
    });
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateSubtaskDto, @CurrentUser() user: any) {
    return this.subtasks.update(id, dto, user.id);
  }

  @Delete(':id')
  delete(@Param('id') id: string, @CurrentUser() user: any) {
    return this.subtasks.delete(id, user.id);
  }

  // ───────────────────── Checklist ─────────────────────

  @Get(':recordId/checklist')
  getChecklist(@Param('recordId') recordId: string) {
    return this.subtasks.getChecklist(recordId);
  }

  @Post('checklist')
  createChecklistItem(@Body() dto: CreateChecklistItemDto, @CurrentUser() user: any) {
    return this.subtasks.createChecklistItem(dto, user.id);
  }

  @Patch('checklist/:id')
  updateChecklistItem(
    @Param('id') id: string,
    @Body() dto: UpdateChecklistItemDto,
    @CurrentUser() user: any,
  ) {
    return this.subtasks.updateChecklistItem(id, dto, user.id);
  }

  @Delete('checklist/:id')
  deleteChecklistItem(@Param('id') id: string, @CurrentUser() user: any) {
    return this.subtasks.deleteChecklistItem(id, user.id);
  }
}
