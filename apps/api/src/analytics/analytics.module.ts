import { Module } from '@nestjs/common';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { TrackPerformanceService } from './track-performance.service';
import { DailyTracksSnapshotService } from './daily-tracks-snapshot.service';
import { QualityFirstPerformanceService } from './quality-first/quality-first.service';
import { QualityFirstPerformanceScheduler } from './quality-first/quality-first.scheduler';
import { QualityFirstPerformanceController } from './quality-first/quality-first.controller';
import { PrismaModule } from '../common/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [AnalyticsController, QualityFirstPerformanceController],
  providers: [
    AnalyticsService,
    TrackPerformanceService,
    DailyTracksSnapshotService,
    QualityFirstPerformanceService,
    QualityFirstPerformanceScheduler,
  ],
  exports: [QualityFirstPerformanceService],
})
export class AnalyticsModule {}
