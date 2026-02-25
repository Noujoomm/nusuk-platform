import { Module } from '@nestjs/common';
import { PrismaModule } from '../common/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { CommentsService } from './comments.service';
import { CommentsController } from './comments.controller';

@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [CommentsController],
  providers: [CommentsService],
  exports: [CommentsService],
})
export class CommentsModule {}
