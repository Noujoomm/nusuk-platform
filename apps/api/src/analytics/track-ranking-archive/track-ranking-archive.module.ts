import { Module } from '@nestjs/common';
import { PrismaModule } from '../../common/prisma.module';
import { AnalyticsModule } from '../analytics.module';
import { TrackRankingArchiveController } from './track-ranking-archive.controller';
import { TrackRankingArchiveScheduler } from './track-ranking-archive.scheduler';
import { TrackRankingArchiveService } from './track-ranking-archive.service';

@Module({
  imports: [PrismaModule, AnalyticsModule],
  controllers: [TrackRankingArchiveController],
  providers: [TrackRankingArchiveService, TrackRankingArchiveScheduler],
  exports: [TrackRankingArchiveService],
})
export class TrackRankingArchiveModule {}
