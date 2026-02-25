import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CreateDailyUpdateDto, UpdateDailyUpdateDto } from './daily-updates.dto';

@Injectable()
export class DailyUpdatesService {
  constructor(private prisma: PrismaService) {}

  async findAll(params: {
    page?: number;
    pageSize?: number;
    type?: string;
    trackId?: string;
    search?: string;
    pinned?: string;
    priority?: string;
  }) {
    const { page = 1, pageSize = 20, type, trackId, search, pinned, priority } = params;
    const where: any = { isDeleted: false };
    if (type) where.type = type;
    if (trackId) where.trackId = trackId;
    if (pinned === 'true') where.pinned = true;
    if (priority) where.priority = priority;
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { titleAr: { contains: search, mode: 'insensitive' } },
        { content: { contains: search, mode: 'insensitive' } },
        { contentAr: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.dailyUpdate.findMany({
        where,
        include: {
          author: { select: { id: true, name: true, nameAr: true, role: true } },
          track: { select: { id: true, name: true, nameAr: true, color: true } },
        },
        orderBy: [{ pinned: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.dailyUpdate.count({ where }),
    ]);

    return { data, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  }

  async findById(id: string) {
    const update = await this.prisma.dailyUpdate.findUnique({
      where: { id },
      include: {
        author: { select: { id: true, name: true, nameAr: true, role: true } },
        track: { select: { id: true, name: true, nameAr: true, color: true } },
      },
    });
    if (!update || update.isDeleted) throw new NotFoundException('التحديث غير موجود');
    return update;
  }

  async create(dto: CreateDailyUpdateDto, authorId: string) {
    return this.prisma.dailyUpdate.create({
      data: {
        ...dto,
        authorId,
      } as any,
      include: {
        author: { select: { id: true, name: true, nameAr: true, role: true } },
        track: { select: { id: true, name: true, nameAr: true, color: true } },
      },
    });
  }

  async update(id: string, dto: UpdateDailyUpdateDto, userId: string, userRole: string) {
    const existing = await this.prisma.dailyUpdate.findUnique({ where: { id } });
    if (!existing || existing.isDeleted) throw new NotFoundException('التحديث غير موجود');

    // Only author or admin/pm can edit
    if (existing.authorId !== userId && !['admin', 'pm'].includes(userRole)) {
      throw new ForbiddenException('لا يمكنك تعديل هذا التحديث');
    }

    // Track edit history
    const editHistory = (existing.editHistory as any[]) || [];
    editHistory.push({
      editedBy: userId,
      editedAt: new Date().toISOString(),
      previousTitle: existing.titleAr,
      previousContent: existing.contentAr || existing.content,
    });

    return this.prisma.dailyUpdate.update({
      where: { id },
      data: {
        ...dto,
        editHistory,
      } as any,
      include: {
        author: { select: { id: true, name: true, nameAr: true, role: true } },
        track: { select: { id: true, name: true, nameAr: true, color: true } },
      },
    });
  }

  async delete(id: string, userId: string, userRole: string) {
    const existing = await this.prisma.dailyUpdate.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('التحديث غير موجود');

    if (existing.authorId !== userId && !['admin', 'pm'].includes(userRole)) {
      throw new ForbiddenException('لا يمكنك حذف هذا التحديث');
    }

    // Soft delete
    await this.prisma.dailyUpdate.update({
      where: { id },
      data: { isDeleted: true },
    });
    return { message: 'تم حذف التحديث' };
  }

  async togglePin(id: string) {
    const existing = await this.prisma.dailyUpdate.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('التحديث غير موجود');

    return this.prisma.dailyUpdate.update({
      where: { id },
      data: { pinned: !existing.pinned },
      include: {
        author: { select: { id: true, name: true, nameAr: true, role: true } },
        track: { select: { id: true, name: true, nameAr: true, color: true } },
      },
    });
  }
}
