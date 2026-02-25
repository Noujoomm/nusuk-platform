import { Module } from '@nestjs/common';
import { OpenAIModule } from '../openai/openai.module';
import { AIAnalysisService } from './ai-analysis.service';
import { AIAnalysisController } from './ai-analysis.controller';

@Module({
  imports: [OpenAIModule],
  providers: [AIAnalysisService],
  controllers: [AIAnalysisController],
  exports: [AIAnalysisService],
})
export class AIAnalysisModule {}
