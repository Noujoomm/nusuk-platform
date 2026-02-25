import { Module } from '@nestjs/common';
import { KPIService } from './kpi.service';
import { KPIController } from './kpi.controller';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [AuditModule],
  providers: [KPIService],
  controllers: [KPIController],
  exports: [KPIService],
})
export class KPIModule {}
