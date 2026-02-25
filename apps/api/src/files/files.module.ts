import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { FilesService } from './files.service';
import { FilesController } from './files.controller';
import { AuditModule } from '../audit/audit.module';
import { OpenAIModule } from '../openai/openai.module';

@Module({
  imports: [AuditModule, OpenAIModule, MulterModule.register({ dest: './uploads' })],
  providers: [FilesService],
  controllers: [FilesController],
  exports: [FilesService],
})
export class FilesModule {}
