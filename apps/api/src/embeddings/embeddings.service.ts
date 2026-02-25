import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { OpenAIService } from '../openai/openai.service';

@Injectable()
export class EmbeddingsService {
  private readonly logger = new Logger(EmbeddingsService.name);

  constructor(
    private prisma: PrismaService,
    private openai: OpenAIService,
  ) {}

  async indexEntity(
    entityType: string,
    entityId: string,
    content: string,
    trackId?: string,
    metadata?: Record<string, any>,
  ) {
    try {
      const embedding = await this.openai.generateEmbedding(content);

      await this.prisma.embedding.upsert({
        where: {
          entityType_entityId: { entityType, entityId },
        },
        create: {
          entityType,
          entityId,
          content,
          trackId: trackId || null,
          metadata: { ...metadata, embedding },
        },
        update: {
          content,
          trackId: trackId || null,
          metadata: { ...metadata, embedding },
        },
      });

      return { entityType, entityId, indexed: true };
    } catch (error) {
      this.logger.error(`Failed to index ${entityType}:${entityId}`, error);
      throw error;
    }
  }

  async indexAllEntities(): Promise<{ indexed: number }> {
    let count = 0;

    // 1. Index Scopes
    const scopes = await this.prisma.scope.findMany({
      include: { track: { select: { nameAr: true } } },
    });
    for (let i = 0; i < scopes.length; i += 20) {
      const batch = scopes.slice(i, i + 20);
      await Promise.all(
        batch.map((s) =>
          this.indexEntity(
            'scope',
            s.id,
            `نطاق العمل: ${s.titleAr || s.title}. ${s.description || ''}. المسار: ${s.track?.nameAr || ''}`,
            s.trackId,
            { title: s.titleAr || s.title },
          ),
        ),
      );
      count += batch.length;
      if (i + 20 < scopes.length) await this.delay(200);
    }

    // 2. Index TrackKPIs
    const kpis = await this.prisma.trackKPI.findMany({
      include: { track: { select: { nameAr: true } } },
    });
    for (let i = 0; i < kpis.length; i += 20) {
      const batch = kpis.slice(i, i + 20);
      await Promise.all(
        batch.map((k) =>
          this.indexEntity(
            'kpi',
            k.id,
            `مؤشر أداء: ${k.nameAr || k.name}. المسار: ${k.track?.nameAr || ''}`,
            k.trackId,
            { name: k.nameAr || k.name },
          ),
        ),
      );
      count += batch.length;
      if (i + 20 < kpis.length) await this.delay(200);
    }

    // 3. Index Penalties
    const penalties = await this.prisma.penalty.findMany({
      include: { track: { select: { nameAr: true } } },
    });
    for (let i = 0; i < penalties.length; i += 20) {
      const batch = penalties.slice(i, i + 20);
      await Promise.all(
        batch.map((p) =>
          this.indexEntity(
            'penalty',
            p.id,
            `مخالفة: ${p.violationAr || p.violation}. الشدة: ${p.severity || 'متوسطة'}. المسار: ${p.track?.nameAr || ''}`,
            p.trackId,
            { violation: p.violationAr || p.violation, severity: p.severity },
          ),
        ),
      );
      count += batch.length;
      if (i + 20 < penalties.length) await this.delay(200);
    }

    // 4. Index Deliverables
    const deliverables = await this.prisma.deliverable.findMany({
      include: { track: { select: { nameAr: true } } },
    });
    for (let i = 0; i < deliverables.length; i += 20) {
      const batch = deliverables.slice(i, i + 20);
      await Promise.all(
        batch.map((d) =>
          this.indexEntity(
            'deliverable',
            d.id,
            `مخرج: ${d.nameAr || d.name}. ${d.outputs || ''}. مؤشرات التسليم: ${d.deliveryIndicators || ''}. المسار: ${d.track?.nameAr || ''}`,
            d.trackId,
            { name: d.nameAr || d.name },
          ),
        ),
      );
      count += batch.length;
      if (i + 20 < deliverables.length) await this.delay(200);
    }

    // 5. Index Employees
    const employees = await this.prisma.employee.findMany({
      include: { track: { select: { nameAr: true } } },
    });
    for (let i = 0; i < employees.length; i += 20) {
      const batch = employees.slice(i, i + 20);
      await Promise.all(
        batch.map((e) =>
          this.indexEntity(
            'employee',
            e.id,
            `موظف: ${e.fullNameAr || e.fullName}. المنصب: ${e.positionAr || e.position || ''}. المسار: ${e.track?.nameAr || ''}. نوع العقد: ${e.contractType || ''}`,
            e.trackId || undefined,
            { name: e.fullNameAr || e.fullName, position: e.positionAr || e.position },
          ),
        ),
      );
      count += batch.length;
      if (i + 20 < employees.length) await this.delay(200);
    }

    this.logger.log(`Indexed ${count} entities`);
    return { indexed: count };
  }

  async semanticSearch(
    query: string,
    options: { trackId?: string; types?: string[]; limit?: number },
  ) {
    const { trackId, types, limit = 20 } = options;

    // Generate query embedding
    const queryEmbedding = await this.openai.generateEmbedding(query);

    // Fetch all embeddings (filtered)
    const where: any = {};
    if (trackId) where.trackId = trackId;
    if (types && types.length > 0) where.entityType = { in: types };

    const embeddings = await this.prisma.embedding.findMany({ where });

    // Compute cosine similarity for each embedding
    const results = embeddings
      .map((emb) => {
        const embeddingVector = (emb.metadata as any)?.embedding;
        if (!embeddingVector || !Array.isArray(embeddingVector)) return null;

        const similarity = this.cosineSimilarity(queryEmbedding, embeddingVector);
        return {
          entityType: emb.entityType,
          entityId: emb.entityId,
          content: emb.content,
          trackId: emb.trackId,
          similarity,
          metadata: {
            ...(emb.metadata as any),
            embedding: undefined, // Don't return the raw embedding vector
          },
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null && r.similarity > 0.3)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);

    return {
      results,
      total: results.length,
      query,
    };
  }

  async getStats() {
    const embeddings = await this.prisma.embedding.groupBy({
      by: ['entityType'],
      _count: true,
    });

    const total = embeddings.reduce((sum, e) => sum + e._count, 0);

    return {
      total,
      byType: embeddings.reduce(
        (acc, e) => ({ ...acc, [e.entityType]: e._count }),
        {},
      ),
    };
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    let dot = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    return denominator === 0 ? 0 : dot / denominator;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
