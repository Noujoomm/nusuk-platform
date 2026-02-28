import { Module } from '@nestjs/common';
import { PrismaModule } from '../common/prisma.module';
import { SystemExportService } from './system-export.service';
import { SystemExportController } from './system-export.controller';

@Module({
  imports: [PrismaModule],
  controllers: [SystemExportController],
  providers: [SystemExportService],
})
export class SystemExportModule {}
