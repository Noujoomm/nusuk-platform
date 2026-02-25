import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { AIReportsService } from './ai-reports.service';
import { AuditService } from '../audit/audit.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('ai/reports')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'pm')
export class AIReportsController {
  constructor(
    private aiReports: AIReportsService,
    private audit: AuditService,
  ) {}

  @Post('generate')
  async generate(
    @Body() body: { type: string; trackId?: string },
    @CurrentUser() user: any,
  ) {
    const report = await this.aiReports.generateReport({
      type: body.type,
      trackId: body.trackId,
      userId: user.id,
    });

    await this.audit.log({
      actorId: user.id,
      actionType: 'ai_report_generated',
      entityType: 'ai_report',
      entityId: report.id,
      trackId: body.trackId,
      afterData: { type: body.type, trackId: body.trackId },
    });

    return report;
  }

  @Get()
  async findAll(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('type') type?: string,
    @Query('trackId') trackId?: string,
  ) {
    return this.aiReports.findAll({
      page: page ? +page : 1,
      pageSize: pageSize ? +pageSize : 25,
      type,
      trackId,
    });
  }

  @Get(':id')
  async findById(@Param('id') id: string) {
    return this.aiReports.findById(id);
  }

  @Get(':id/excel')
  async exportToExcel(@Param('id') id: string, @Res() res: Response) {
    const buffer = await this.aiReports.exportToExcel(id);

    res.set({
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename=report.xlsx',
      'Content-Length': buffer.length,
    });

    res.end(buffer);
  }

  @Delete(':id')
  async delete(@Param('id') id: string, @CurrentUser() user: any) {
    const result = await this.aiReports.delete(id);

    await this.audit.log({
      actorId: user.id,
      actionType: 'ai_report_deleted',
      entityType: 'ai_report',
      entityId: id,
    });

    return result;
  }
}
