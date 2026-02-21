import { Module } from '@nestjs/common';
import { RecordsService } from './records.service';
import { RecordsController } from './records.controller';
import { TracksModule } from '../tracks/tracks.module';
import { AuditModule } from '../audit/audit.module';
import { WebsocketModule } from '../websocket/websocket.module';

@Module({
  imports: [TracksModule, AuditModule, WebsocketModule],
  providers: [RecordsService],
  controllers: [RecordsController],
})
export class RecordsModule {}
