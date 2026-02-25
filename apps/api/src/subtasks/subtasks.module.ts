import { Module } from '@nestjs/common';
import { PrismaModule } from '../common/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { SubtasksService } from './subtasks.service';
import { SubtasksController } from './subtasks.controller';

@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [SubtasksController],
  providers: [SubtasksService],
  exports: [SubtasksService],
})
export class SubtasksModule {}
