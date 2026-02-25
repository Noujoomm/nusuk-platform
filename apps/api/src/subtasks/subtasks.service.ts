import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class SubtasksService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  // ───────────────────── Subtasks ─────────────────────

  async listByRecord(recordId: string) {
    return this.prisma.subtask.findMany({
      where: { recordId },
      include: {
        assignee: { select: { id: true, name: true, nameAr: true } },
      },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async create(data: {
    recordId: string;
    title: string;
    titleAr?: string;
    status?: string;
    priority?: string;
    assigneeId?: string;
    dueDate?: string;
    createdById: string;
  }) {
    const subtask = await this.prisma.subtask.create({
      data: {
        recordId: data.recordId,
        title: data.title,
        titleAr: data.titleAr,
        status: (data.status as any) || 'draft',
        priority: (data.priority as any) || 'medium',
        assigneeId: data.assigneeId,
        dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
        createdById: data.createdById,
      },
      include: {
        assignee: { select: { id: true, name: true, nameAr: true } },
      },
    });

    await this.audit.log({
      actorId: data.createdById,
      actionType: 'create',
      entityType: 'subtask',
      entityId: subtask.id,
      afterData: subtask as any,
    });

    return subtask;
  }

  async update(id: string, data: {
    title?: string;
    titleAr?: string;
    status?: string;
    priority?: string;
    assigneeId?: string;
    dueDate?: string;
    sortOrder?: number;
  }, actorId?: string) {
    const before = await this.prisma.subtask.findUnique({ where: { id } });
    if (!before) throw new NotFoundException('المهمة الفرعية غير موجودة');

    const updateData: any = { ...data };
    if (data.status) updateData.status = data.status as any;
    if (data.priority) updateData.priority = data.priority as any;
    if (data.dueDate) updateData.dueDate = new Date(data.dueDate);

    const subtask = await this.prisma.subtask.update({
      where: { id },
      data: updateData,
      include: {
        assignee: { select: { id: true, name: true, nameAr: true } },
      },
    });

    await this.audit.log({
      actorId,
      actionType: 'update',
      entityType: 'subtask',
      entityId: id,
      beforeData: before as any,
      afterData: subtask as any,
    });

    return subtask;
  }

  async delete(id: string, actorId?: string) {
    const subtask = await this.prisma.subtask.findUnique({ where: { id } });
    if (!subtask) throw new NotFoundException('المهمة الفرعية غير موجودة');

    await this.prisma.subtask.delete({ where: { id } });

    await this.audit.log({
      actorId,
      actionType: 'delete',
      entityType: 'subtask',
      entityId: id,
      beforeData: subtask as any,
    });

    return { message: 'تم حذف المهمة الفرعية' };
  }

  // ───────────────────── Checklist ─────────────────────

  async getChecklist(recordId: string) {
    return this.prisma.checklistItem.findMany({
      where: { recordId },
      include: {
        checkedBy: { select: { id: true, name: true, nameAr: true } },
      },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async createChecklistItem(data: {
    recordId: string;
    text: string;
    textAr?: string;
  }, actorId?: string) {
    const item = await this.prisma.checklistItem.create({
      data: {
        recordId: data.recordId,
        text: data.text,
        textAr: data.textAr,
      },
      include: {
        checkedBy: { select: { id: true, name: true, nameAr: true } },
      },
    });

    await this.audit.log({
      actorId,
      actionType: 'create',
      entityType: 'checklistItem',
      entityId: item.id,
      afterData: item as any,
    });

    return item;
  }

  async updateChecklistItem(id: string, data: {
    text?: string;
    textAr?: string;
    isChecked?: boolean;
    checkedById?: string;
    checkedAt?: Date;
  }, actorId?: string) {
    const before = await this.prisma.checklistItem.findUnique({ where: { id } });
    if (!before) throw new NotFoundException('عنصر القائمة غير موجود');

    const updateData: any = { ...data };

    // When isChecked changes to true, set checkedAt and checkedById
    if (data.isChecked === true && !before.isChecked) {
      updateData.checkedAt = new Date();
      if (actorId) updateData.checkedById = actorId;
    }

    // When unchecking, clear checkedAt and checkedById
    if (data.isChecked === false && before.isChecked) {
      updateData.checkedAt = null;
      updateData.checkedById = null;
    }

    const item = await this.prisma.checklistItem.update({
      where: { id },
      data: updateData,
      include: {
        checkedBy: { select: { id: true, name: true, nameAr: true } },
      },
    });

    await this.audit.log({
      actorId,
      actionType: 'update',
      entityType: 'checklistItem',
      entityId: id,
      beforeData: before as any,
      afterData: item as any,
    });

    return item;
  }

  async deleteChecklistItem(id: string, actorId?: string) {
    const item = await this.prisma.checklistItem.findUnique({ where: { id } });
    if (!item) throw new NotFoundException('عنصر القائمة غير موجود');

    await this.prisma.checklistItem.delete({ where: { id } });

    await this.audit.log({
      actorId,
      actionType: 'delete',
      entityType: 'checklistItem',
      entityId: id,
      beforeData: item as any,
    });

    return { message: 'تم حذف عنصر القائمة' };
  }
}
