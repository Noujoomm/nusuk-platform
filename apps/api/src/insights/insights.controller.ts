import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { InsightsService } from './insights.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@Controller('insights')
@UseGuards(JwtAuthGuard)
export class InsightsController {
  constructor(private insights: InsightsService) {}

  @Get('executive')
  getExecutiveSummary() {
    return this.insights.getExecutiveSummary();
  }

  @Get('track/:trackId')
  getTrackInsights(@Param('trackId') trackId: string) {
    return this.insights.getTrackInsights(trackId);
  }
}
