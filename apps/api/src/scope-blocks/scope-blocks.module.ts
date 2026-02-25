import { Module } from '@nestjs/common';
import { ScopeBlocksService } from './scope-blocks.service';
import { ScopeBlocksController } from './scope-blocks.controller';
import { AuditModule } from '../audit/audit.module';
import { WebsocketModule } from '../websocket/websocket.module';

@Module({
  imports: [AuditModule, WebsocketModule],
  controllers: [ScopeBlocksController],
  providers: [ScopeBlocksService],
  exports: [ScopeBlocksService],
})
export class ScopeBlocksModule {}
