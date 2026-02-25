import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  async findAll(params: {
    page?: number;
    pageSize?: number;
    trackId?: string;
    type?: string;
    authorId?: string;
  }) {
    const { page = 1, pageSize = 25, trackId, type, authorId } = params;
    const where: any = {};
    if (trackId) where.trackId = trackId;
    if (type) where.type = type;
    if (authorId) where.authorId = authorId;

    const [data, total] = await Promise.all([
      this.prisma.report.findMany({
        where,
        include: {
          author: { select: { id: true, name: true, nameAr: true } },
          track: { select: { id: true, nameAr: true, color: true } },
        },
        orderBy: { reportDate: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.report.count({ where }),
    ]);

    return { data, total, page, pageSize };
  }

  async findById(id: string) {
    const report = await this.prisma.report.findUnique({
      where: { id },
      include: {
        author: { select: { id: true, name: true, nameAr: true } },
        track: { select: { id: true, nameAr: true, color: true } },
      },
    });
    if (!report) throw new NotFoundException('التقرير غير موجود');
    return report;
  }

  async create(data: {
    trackId: string;
    authorId: string;
    type: any;
    title: string;
    achievements?: string;
    kpiUpdates?: string;
    challenges?: string;
    supportNeeded?: string;
    notes?: string;
    reportDate?: string;
  }) {
    // Generate AI summary
    const aiSummary = this.generateAISummary(data);

    return this.prisma.report.create({
      data: {
        ...data,
        reportDate: data.reportDate ? new Date(data.reportDate) : new Date(),
        aiSummary,
      },
      include: {
        author: { select: { id: true, name: true, nameAr: true } },
        track: { select: { id: true, nameAr: true, color: true } },
      },
    });
  }

  async update(id: string, data: any) {
    await this.findById(id);
    const aiSummary = this.generateAISummary(data);
    return this.prisma.report.update({
      where: { id },
      data: { ...data, aiSummary },
    });
  }

  async delete(id: string) {
    await this.findById(id);
    await this.prisma.report.delete({ where: { id } });
    return { message: 'تم حذف التقرير' };
  }

  async getStats() {
    const [total, byType, byTrack] = await Promise.all([
      this.prisma.report.count(),
      this.prisma.report.groupBy({ by: ['type'], _count: true }),
      this.prisma.report.groupBy({ by: ['trackId'], _count: true }),
    ]);

    return {
      total,
      byType: byType.reduce((acc, r) => ({ ...acc, [r.type]: r._count }), {}),
      trackCount: byTrack.length,
    };
  }

  private generateAISummary(data: any): string {
    const parts: string[] = [];
    if (data.achievements) {
      const achievementCount = data.achievements.split('\n').filter((l: string) => l.trim()).length;
      parts.push(`تم تسجيل ${achievementCount} إنجاز`);
    }
    if (data.challenges) {
      const challengeCount = data.challenges.split('\n').filter((l: string) => l.trim()).length;
      parts.push(`${challengeCount} تحدي مسجل يحتاج متابعة`);
    }
    if (data.supportNeeded) {
      parts.push('يوجد طلبات دعم تحتاج مراجعة');
    }
    if (data.kpiUpdates) {
      parts.push('تم تحديث مؤشرات الأداء');
    }
    return parts.length > 0
      ? `ملخص تلقائي: ${parts.join(' · ')}`
      : 'لا يوجد ملخص متاح';
  }
}
