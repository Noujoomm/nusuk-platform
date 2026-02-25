import { Module } from '@nestjs/common';
import { OpenAIModule } from '../openai/openai.module';
import { AuditModule } from '../audit/audit.module';
import { AIReportsService } from './ai-reports.service';
import { AIReportsController } from './ai-reports.controller';

@Module({
  imports: [OpenAIModule, AuditModule],
  providers: [AIReportsService],
  controllers: [AIReportsController],
  exports: [AIReportsService],
})
export class AIReportsModule {}
