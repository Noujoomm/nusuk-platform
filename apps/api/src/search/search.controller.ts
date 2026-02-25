import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { SearchService } from './search.service';
import { EmbeddingsService } from '../embeddings/embeddings.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('search')
@UseGuards(JwtAuthGuard)
export class SearchController {
  constructor(
    private search: SearchService,
    private embeddings: EmbeddingsService,
  ) {}

  @Get()
  async globalSearch(
    @Query('q') q: string,
    @Query('types') types?: string,
    @Query('limit') limit?: string,
    @CurrentUser() user?: any,
  ) {
    if (!q || q.trim().length < 2) {
      return { results: [], total: 0 };
    }

    const parsedTypes = types ? types.split(',').map((t) => t.trim()) : undefined;
    const parsedLimit = limit ? +limit : 20;

    return this.search.globalSearch(q.trim(), user.id, user.role, {
      limit: parsedLimit,
      types: parsedTypes,
    });
  }

  @Get('semantic')
  async semanticSearch(
    @Query('q') q: string,
    @Query('trackId') trackId?: string,
    @Query('types') types?: string,
    @Query('limit') limit?: string,
    @CurrentUser() user?: any,
  ) {
    if (!q || q.trim().length < 2) {
      return { results: [], total: 0 };
    }

    const parsedTypes = types ? types.split(',').map((t) => t.trim()) : undefined;

    return this.embeddings.semanticSearch(q.trim(), {
      trackId,
      types: parsedTypes,
      limit: limit ? +limit : 20,
    });
  }
}
