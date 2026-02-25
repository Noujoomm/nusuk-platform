import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { EmbeddingsService } from './embeddings.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@Controller('ai/embeddings')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class EmbeddingsController {
  constructor(private embeddings: EmbeddingsService) {}

  @Post('index-all')
  async indexAll() {
    return this.embeddings.indexAllEntities();
  }

  @Get('stats')
  async getStats() {
    return this.embeddings.getStats();
  }
}
