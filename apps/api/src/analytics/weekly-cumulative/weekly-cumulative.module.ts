import { Module } from '@nestjs/common';
import { PrismaModule } from '../../common/prisma.module';
import { AnalyticsModule } from '../analytics.module';
import { WeeklyCumulativeController } from './weekly-cumulative.controller';
import { WeeklyCumulativeScheduler } from './weekly-cumulative.scheduler';
import { WeeklyCumulativeService } from './weekly-cumulative.service';

@Module({
  imports: [PrismaModule, AnalyticsModule],
  controllers: [WeeklyCumulativeController],
  providers: [WeeklyCumulativeService, WeeklyCumulativeScheduler],
  exports: [WeeklyCumulativeService],
})
export class WeeklyCumulativeModule {}
