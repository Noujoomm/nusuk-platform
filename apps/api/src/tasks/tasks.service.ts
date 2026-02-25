import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { AuditService } from '../audit/audit.service';
import { EventsGateway } from '../websocket/events.gateway';
import { CreateTaskDto, UpdateTaskDto } from './tasks.dto';

@Injectable()
export class TasksService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private events: EventsGateway,
  ) {}

  private readonly listIncludes = {
    track: { select: { id: true, nameAr: true, color: true } },
    createdBy: { select: { id: true, name: true, nameAr: true } },
    assignments: {
      include: {
        user: { select: { id: true, name: true, nameAr: true } },
      },
    },
  };

  private readonly detailIncludes = {
    track: { select: { id: true, nameAr: true, color: true } },
    createdBy: { select: { id: true, name: true, nameAr: true } },
    assignments: {
      include: {
        user: { select: { id: true, name: true, nameAr: true } },
      },
    },
    files: {
      include: {
        uploadedBy: { select: { id: true, name: true, nameAr: true } },
      },
    },
  };

  async findAll(params: {
    page?: number;
    pageSize?: number;
    status?: string;
    priority?: string;
    trackId?: string;
    assigneeId?: string;
    search?: string;
    overdue?: boolean;
  }) {
    const { page = 1, pageSize = 25, status, priority, trackId, assigneeId, search, overdue } = params;
    const where: any = {};

    if (status) where.status = status;
    if (priority) where.priority = priority;
    if (trackId) where.trackId = trackId;
    if (assigneeId) {
      where.assignments = { some: { userId: assigneeId } };
    }
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { titleAr: { contains: search } },
        { notes: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (overdue) {
      where.dueDate = { lt: new Date() };
      where.status = { notIn: ['completed', 'cancelled'] };
    }

    const [data, total] = await Promise.all([
      this.prisma.task.findMany({
        where,
        include: this.listIncludes,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.task.count({ where }),
    ]);

    return { data, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  }

  async findByUser(userId: string, params?: {
    page?: number;
    pageSize?: number;
    status?: string;
  }) {
    const { page = 1, pageSize = 25, status } = params || {};
    const where: any = {
      assignments: { some: { userId } },
    };

    if (status) where.status = status;

    const [data, total] = await Promise.all([
      this.prisma.task.findMany({
        where,
        include: this.listIncludes,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.task.count({ where }),
    ]);

    return { data, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  }

  async findByTrack(trackId: string, params?: {
    page?: number;
    pageSize?: number;
    status?: string;
  }) {
    const { page = 1, pageSize = 25, status } = params || {};
    const where: any = { trackId };

    if (status) where.status = status;

    const [data, total] = await Promise.all([
      this.prisma.task.findMany({
        where,
        include: this.listIncludes,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.task.count({ where }),
    ]);

    return { data, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  }

  async findById(id: string) {
    const task = await this.prisma.task.findUnique({
      where: { id },
      include: this.detailIncludes,
    });
    if (!task) throw new NotFoundException('المهمة غير موجودة');
    return task;
  }

  async create(dto: CreateTaskDto, userId: string) {
    const { assigneeIds, ...taskData } = dto;

    const task = await this.prisma.task.create({
      data: {
        ...taskData,
        status: (dto.status as any) || 'pending',
        priority: (dto.priority as any) || 'medium',
        createdById: userId,
        ...(assigneeIds && assigneeIds.length > 0
          ? {
              assignments: {
                create: assigneeIds.map((uid) => ({
                  userId: uid,
                  assignedBy: userId,
                })),
              },
            }
          : {}),
      },
      include: this.detailIncludes,
    });

    // Emit real-time event
    this.events.server.emit('task.created', { task });
    if (task.trackId) {
      this.events.emitToTrack(task.trackId, 'task.created', { task });
    }
    // Notify assigned users
    if (assigneeIds) {
      assigneeIds.forEach((uid) => {
        this.events.emitToUser(uid, 'task.assigned', { task });
      });
    }

    return task;
  }

  async update(id: string, dto: UpdateTaskDto, userId: string) {
    const existing = await this.findById(id);
    const { assigneeIds, ...taskData } = dto;

    // Auto-set status to completed if progress reaches 100
    if (taskData.progress === 100 && existing.status !== 'completed') {
      (taskData as any).status = 'completed';
    }

    const task = await this.prisma.task.update({
      where: { id },
      data: taskData as any,
      include: this.detailIncludes,
    });

    // Handle assignment updates
    if (assigneeIds !== undefined) {
      await this.prisma.taskAssignment.deleteMany({ where: { taskId: id } });
      if (assigneeIds.length > 0) {
        await this.prisma.taskAssignment.createMany({
          data: assigneeIds.map((uid) => ({
            taskId: id,
            userId: uid,
            assignedBy: userId,
          })),
        });
      }
    }

    const updated = assigneeIds !== undefined ? await this.findById(id) : task;

    await this.audit.log({
      actorId: userId,
      actionType: 'update',
      entityType: 'task',
      entityId: id,
      trackId: existing.trackId || undefined,
      beforeData: existing as any,
      afterData: updated as any,
    });

    // Emit real-time event
    this.events.server.emit('task.updated', { task: updated });
    if (updated.trackId) {
      this.events.emitToTrack(updated.trackId, 'task.updated', { task: updated });
    }

    return updated;
  }

  async updateStatus(id: string, status: string, userId: string) {
    const existing = await this.findById(id);

    // Verify user is assigned to this task
    const assignment = await this.prisma.taskAssignment.findFirst({
      where: { taskId: id, userId },
    });
    if (!assignment) {
      throw new ForbiddenException('ليس لديك صلاحية لتحديث هذه المهمة');
    }

    const data: any = { status };
    if (status === 'completed') {
      data.progress = 100;
    }

    const task = await this.prisma.task.update({
      where: { id },
      data,
      include: this.detailIncludes,
    });

    await this.audit.log({
      actorId: userId,
      actionType: 'update',
      entityType: 'task',
      entityId: id,
      trackId: existing.trackId || undefined,
      beforeData: { status: existing.status },
      afterData: { status: task.status },
    });

    // Emit real-time event
    this.events.server.emit('task.updated', { task });
    if (task.trackId) {
      this.events.emitToTrack(task.trackId, 'task.updated', { task });
    }
    // Notify task creator if status changed to completed
    if (status === 'completed' && existing.createdById) {
      this.events.emitToUser(existing.createdById, 'task.completed', { task });
    }

    return task;
  }

  async assign(id: string, userIds: string[], assignedBy: string) {
    await this.findById(id);

    await this.prisma.taskAssignment.createMany({
      data: userIds.map((userId) => ({
        taskId: id,
        userId,
        assignedBy,
      })),
      skipDuplicates: true,
    });

    const task = await this.findById(id);

    await this.audit.log({
      actorId: assignedBy,
      actionType: 'update',
      entityType: 'task',
      entityId: id,
      trackId: task.trackId || undefined,
      afterData: { assignedUserIds: userIds },
    });

    // Notify newly assigned users
    userIds.forEach((uid) => {
      this.events.emitToUser(uid, 'task.assigned', { task });
    });

    return task;
  }

  async delete(id: string, userId: string) {
    const existing = await this.findById(id);

    await this.prisma.task.delete({ where: { id } });

    await this.audit.log({
      actorId: userId,
      actionType: 'delete',
      entityType: 'task',
      entityId: id,
      trackId: existing.trackId || undefined,
      beforeData: existing as any,
    });

    // Emit real-time event
    this.events.server.emit('task.deleted', { taskId: id });
    if (existing.trackId) {
      this.events.emitToTrack(existing.trackId, 'task.deleted', { taskId: id });
    }

    return { message: 'تم حذف المهمة' };
  }

  async getStats(trackId?: string) {
    const where: any = {};
    if (trackId) where.trackId = trackId;

    const overdueWhere: any = {
      ...where,
      dueDate: { lt: new Date() },
      status: { notIn: ['completed', 'cancelled'] },
    };

    const [total, byStatus, byPriority, overdue] = await Promise.all([
      this.prisma.task.count({ where }),
      this.prisma.task.groupBy({
        by: ['status'],
        where,
        _count: true,
      }),
      this.prisma.task.groupBy({
        by: ['priority'],
        where,
        _count: true,
      }),
      this.prisma.task.count({ where: overdueWhere }),
    ]);

    return {
      total,
      byStatus: Object.fromEntries(byStatus.map((s) => [s.status, s._count])),
      byPriority: Object.fromEntries(byPriority.map((p) => [p.priority, p._count])),
      overdue,
    };
  }
}
