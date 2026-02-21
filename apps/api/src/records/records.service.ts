import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CreateRecordDto, UpdateRecordDto } from './records.dto';

@Injectable()
export class RecordsService {
  constructor(private prisma: PrismaService) {}

  async findByTrack(trackId: string, params: {
    page?: number;
    pageSize?: number;
    status?: string;
    priority?: string;
    search?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }) {
    const { page = 1, pageSize = 25, status, priority, search, sortBy = 'createdAt', sortOrder = 'desc' } = params;
    const where: any = { trackId };

    if (status) where.status = status;
    if (priority) where.priority = priority;
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { titleAr: { contains: search } },
        { owner: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.record.findMany({
        where,
        include: {
          createdBy: { select: { id: true, name: true, nameAr: true } },
        },
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.record.count({ where }),
    ]);

    return { data, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  }

  async findById(id: string) {
    const record = await this.prisma.record.findUnique({
      where: { id },
      include: {
        createdBy: { select: { id: true, name: true, nameAr: true } },
        track: { select: { id: true, name: true, nameAr: true, fieldSchema: true } },
      },
    });
    if (!record) throw new NotFoundException('السجل غير موجود');
    return record;
  }

  async create(dto: CreateRecordDto, userId: string) {
    return this.prisma.record.create({
      data: {
        ...dto,
        status: (dto.status as any) || 'draft',
        priority: (dto.priority as any) || 'medium',
        createdById: userId,
      },
      include: {
        createdBy: { select: { id: true, name: true, nameAr: true } },
      },
    });
  }

  async update(id: string, dto: UpdateRecordDto) {
    const existing = await this.findById(id);

    // Optimistic concurrency check
    if (existing.version !== dto.version) {
      throw new ConflictException(
        'تم تعديل هذا السجل من قبل مستخدم آخر. يرجى تحديث الصفحة والمحاولة مرة أخرى'
      );
    }

    const { version, ...data } = dto;
    return this.prisma.record.update({
      where: { id },
      data: { ...data as any, version: { increment: 1 } },
      include: {
        createdBy: { select: { id: true, name: true, nameAr: true } },
      },
    });
  }

  async delete(id: string) {
    const record = await this.findById(id);
    await this.prisma.record.delete({ where: { id } });
    return record;
  }

  async getTrackStats(trackId: string) {
    const [total, byStatus, byPriority] = await Promise.all([
      this.prisma.record.count({ where: { trackId } }),
      this.prisma.record.groupBy({
        by: ['status'],
        where: { trackId },
        _count: true,
      }),
      this.prisma.record.groupBy({
        by: ['priority'],
        where: { trackId },
        _count: true,
      }),
    ]);

    return {
      total,
      byStatus: Object.fromEntries(byStatus.map((s) => [s.status, s._count])),
      byPriority: Object.fromEntries(byPriority.map((p) => [p.priority, p._count])),
    };
  }
}
