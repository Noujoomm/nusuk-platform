import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { AIAnalysisService } from './ai-analysis.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@Controller('ai/analysis')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'pm')
export class AIAnalysisController {
  constructor(private aiAnalysis: AIAnalysisService) {}

  @Get('track/:trackId')
  async analyzeTrack(@Param('trackId') trackId: string) {
    return this.aiAnalysis.analyzeTrack(trackId);
  }

  @Get('kpis')
  async analyzeKPIs(@Query('trackId') trackId?: string) {
    return this.aiAnalysis.analyzeKPIs(trackId);
  }
}
