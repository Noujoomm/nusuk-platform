import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';

@Injectable()
export class KPIService {
  constructor(private prisma: PrismaService) {}

  async findAll(params: {
    page?: number;
    pageSize?: number;
    trackId?: string;
    status?: string;
    category?: string;
  }) {
    const { page = 1, pageSize = 50, trackId, status, category } = params;
    const where: any = {};
    if (trackId) where.trackId = trackId;
    if (status) where.status = status;
    if (category) where.category = category;

    const [data, total] = await Promise.all([
      this.prisma.kPIEntry.findMany({
        where,
        include: {
          track: { select: { id: true, nameAr: true, color: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.kPIEntry.count({ where }),
    ]);

    return { data, total, page, pageSize };
  }

  async findById(id: string) {
    const kpi = await this.prisma.kPIEntry.findUnique({
      where: { id },
      include: { track: { select: { id: true, nameAr: true, color: true } } },
    });
    if (!kpi) throw new NotFoundException('مؤشر الأداء غير موجود');
    return kpi;
  }

  async create(data: {
    trackId: string;
    name: string;
    nameAr: string;
    category?: string;
    targetValue?: number;
    actualValue?: number;
    unit?: string;
    status?: any;
    dueDate?: string;
    assignedTo?: string;
    notes?: string;
  }) {
    // Auto-detect tahqeeq KPIs
    const category = data.nameAr?.startsWith('تحقيق') ? 'tahqeeq' : (data.category || 'general');

    return this.prisma.kPIEntry.create({
      data: {
        ...data,
        category,
        dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
      },
      include: { track: { select: { id: true, nameAr: true, color: true } } },
    });
  }

  async update(id: string, data: any) {
    await this.findById(id);
    if (data.dueDate) data.dueDate = new Date(data.dueDate);
    // Auto-detect category
    if (data.nameAr?.startsWith('تحقيق')) data.category = 'tahqeeq';
    return this.prisma.kPIEntry.update({
      where: { id },
      data,
      include: { track: { select: { id: true, nameAr: true, color: true } } },
    });
  }

  async delete(id: string) {
    await this.findById(id);
    await this.prisma.kPIEntry.delete({ where: { id } });
    return { message: 'تم حذف مؤشر الأداء' };
  }

  async getStats(trackId?: string) {
    const where: any = trackId ? { trackId } : {};

    const [total, byStatus, byCategory, entries] = await Promise.all([
      this.prisma.kPIEntry.count({ where }),
      this.prisma.kPIEntry.groupBy({ where, by: ['status'], _count: true }),
      this.prisma.kPIEntry.groupBy({ where, by: ['category'], _count: true }),
      this.prisma.kPIEntry.findMany({
        where,
        select: { targetValue: true, actualValue: true, status: true },
      }),
    ]);

    const avgCompletion = entries.length > 0
      ? Math.round(entries.reduce((sum, e) => sum + (e.targetValue > 0 ? (e.actualValue / e.targetValue) * 100 : 0), 0) / entries.length)
      : 0;

    const achieved = entries.filter(e => e.status === 'achieved').length;
    const atRisk = entries.filter(e => e.status === 'at_risk' || e.status === 'behind').length;

    return {
      total,
      achieved,
      atRisk,
      avgCompletion,
      byStatus: byStatus.reduce((acc, r) => ({ ...acc, [r.status]: r._count }), {}),
      byCategory: byCategory.reduce((acc, r) => ({ ...acc, [r.category]: r._count }), {}),
    };
  }

  async seedFromTrackKPIs() {
    // Seed KPIEntry from existing TrackKPI data
    const trackKpis = await this.prisma.trackKPI.findMany({ include: { track: true } });
    let created = 0;

    for (const kpi of trackKpis) {
      const existing = await this.prisma.kPIEntry.findFirst({
        where: { trackId: kpi.trackId, nameAr: kpi.nameAr },
      });
      if (!existing) {
        const category = kpi.nameAr.startsWith('تحقيق') ? 'tahqeeq' : 'general';
        await this.prisma.kPIEntry.create({
          data: {
            trackId: kpi.trackId,
            name: kpi.name,
            nameAr: kpi.nameAr,
            category,
            targetValue: 100,
            actualValue: Math.floor(Math.random() * 80) + 10, // Seed with sample data
            status: 'on_track',
          },
        });
        created++;
      }
    }

    return { message: `تم إنشاء ${created} مؤشر أداء من البيانات الموجودة` };
  }
}
