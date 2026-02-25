import { Module } from '@nestjs/common';
import { PrismaModule } from '../common/prisma.module';
import { EmbeddingsModule } from '../embeddings/embeddings.module';
import { SearchService } from './search.service';
import { SearchController } from './search.controller';

@Module({
  imports: [PrismaModule, EmbeddingsModule],
  controllers: [SearchController],
  providers: [SearchService],
})
export class SearchModule {}
