import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
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
    assigneeTrack: { select: { id: true, nameAr: true, color: true } },
    assigneeUser: { select: { id: true, name: true, nameAr: true } },
    assignments: {
      include: {
        user: { select: { id: true, name: true, nameAr: true } },
      },
    },
  };

  private readonly detailIncludes = {
    track: { select: { id: true, nameAr: true, color: true } },
    createdBy: { select: { id: true, name: true, nameAr: true } },
    assigneeTrack: { select: { id: true, nameAr: true, color: true } },
    assigneeUser: { select: { id: true, name: true, nameAr: true } },
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
    auditLogs: {
      include: {
        actor: { select: { id: true, name: true, nameAr: true } },
      },
      orderBy: { createdAt: 'desc' as const },
      take: 20,
    },
  };

  /**
   * Validate polymorphic assignment rules:
   * - TRACK => assigneeTrackId required, assigneeUserId null
   * - USER  => assigneeUserId required, assigneeTrackId null
   * - HR    => both null
   * - GLOBAL => both null
   */
  private validateAssignment(assigneeType: string, assigneeTrackId?: string, assigneeUserId?: string) {
    switch (assigneeType) {
      case 'TRACK':
        if (!assigneeTrackId) throw new BadRequestException('معرف المسار مطلوب عند التعيين لمسار');
        if (assigneeUserId) throw new BadRequestException('لا يمكن تحديد موظف عند التعيين لمسار');
        break;
      case 'USER':
        if (!assigneeUserId) throw new BadRequestException('معرف الموظف مطلوب عند التعيين لموظف');
        if (assigneeTrackId) throw new BadRequestException('لا يمكن تحديد مسار عند التعيين لموظف');
        break;
      case 'HR':
      case 'GLOBAL':
        if (assigneeTrackId) throw new BadRequestException('لا يمكن تحديد مسار لهذا النوع من التعيين');
        if (assigneeUserId) throw new BadRequestException('لا يمكن تحديد موظف لهذا النوع من التعيين');
        break;
      default:
        throw new BadRequestException('نوع التعيين غير صالح');
    }
  }

  /**
   * Build visibility filter based on user role and track permissions.
   * - Admin/PM: see all tasks
   * - HR: GLOBAL + HR + own USER tasks + own track tasks
   * - Regular users: GLOBAL + own USER tasks + tasks assigned to their tracks
   */
  private buildVisibilityFilter(user: { id: string; role: string; trackPermissions?: Array<{ trackId: string }> }) {
    if (user.role === 'admin' || user.role === 'pm') {
      return { isDeleted: false };
    }

    const userTrackIds = (user.trackPermissions || []).map((tp) => tp.trackId);

    const orConditions: any[] = [
      // GLOBAL tasks visible to everyone
      { assigneeType: 'GLOBAL' },
      // Tasks assigned directly to this user
      { assigneeType: 'USER', assigneeUserId: user.id },
      // Tasks created by this user
      { createdById: user.id },
    ];

    // Tasks assigned to user's tracks
    if (userTrackIds.length > 0) {
      orConditions.push({ assigneeType: 'TRACK', assigneeTrackId: { in: userTrackIds } });
    }

    // HR users can also see HR-assigned tasks
    if (user.role === 'hr') {
      orConditions.push({ assigneeType: 'HR' });
    }

    return {
      isDeleted: false,
      OR: orConditions,
    };
  }

  /**
   * GET /tasks - returns tasks visible to the current user with filters.
   */
  async findVisible(user: { id: string; role: string; trackPermissions?: Array<{ trackId: string }> }, params: {
    page?: number;
    pageSize?: number;
    status?: string;
    priority?: string;
    trackId?: string;
    assigneeType?: string;
    assigneeId?: string;
    search?: string;
    overdue?: boolean;
    dueDateFrom?: string;
    dueDateTo?: string;
    tab?: string; // 'my' | 'track' | 'hr' | 'all'
  }) {
    const { page = 1, pageSize = 25, status, priority, trackId, assigneeType, assigneeId, search, overdue, dueDateFrom, dueDateTo, tab } = params;

    const baseWhere = this.buildVisibilityFilter(user);
    const where: any = { ...baseWhere };

    // Tab-specific filtering
    if (tab === 'my') {
      where.OR = [
        { assigneeType: 'USER', assigneeUserId: user.id },
        { assignments: { some: { userId: user.id } } },
      ];
    } else if (tab === 'track') {
      const userTrackIds = (user.trackPermissions || []).map((tp) => tp.trackId);
      if (userTrackIds.length > 0) {
        where.assigneeType = 'TRACK';
        where.assigneeTrackId = { in: userTrackIds };
      } else {
        // User has no tracks, return empty
        return { data: [], total: 0, page, pageSize, totalPages: 0 };
      }
    } else if (tab === 'hr') {
      where.assigneeType = 'HR';
    }

    // Additional filters
    if (status) where.status = status;
    if (priority) where.priority = priority;
    if (trackId) where.trackId = trackId;
    if (assigneeType && !tab) where.assigneeType = assigneeType;
    if (assigneeId) {
      where.assignments = { some: { userId: assigneeId } };
    }
    if (search) {
      where.AND = [
        ...(where.AND || []),
        {
          OR: [
            { title: { contains: search, mode: 'insensitive' } },
            { titleAr: { contains: search } },
            { notes: { contains: search, mode: 'insensitive' } },
          ],
        },
      ];
    }
    if (overdue) {
      where.dueDate = { lt: new Date() };
      where.status = { notIn: ['completed', 'cancelled'] };
    }
    if (dueDateFrom || dueDateTo) {
      where.dueDate = {
        ...(dueDateFrom ? { gte: new Date(dueDateFrom) } : {}),
        ...(dueDateTo ? { lte: new Date(dueDateTo) } : {}),
      };
    }

    const [data, total] = await Promise.all([
      this.prisma.task.findMany({
        where,
        include: this.listIncludes,
        orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.task.count({ where }),
    ]);

    return { data, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  }

  /**
   * Legacy: findAll for admin/pm only (backward compat)
   */
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
    const where: any = { isDeleted: false };

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
        orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
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
      isDeleted: false,
      OR: [
        { assigneeType: 'USER', assigneeUserId: userId },
        { assignments: { some: { userId } } },
      ],
    };

    if (status) where.status = status;

    const [data, total] = await Promise.all([
      this.prisma.task.findMany({
        where,
        include: this.listIncludes,
        orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
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
    const where: any = {
      isDeleted: false,
      OR: [
        { trackId },
        { assigneeType: 'TRACK', assigneeTrackId: trackId },
      ],
    };

    if (status) where.status = status;

    const [data, total] = await Promise.all([
      this.prisma.task.findMany({
        where,
        include: this.listIncludes,
        orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
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
    if (!task || task.isDeleted) throw new NotFoundException('المهمة غير موجودة');
    return task;
  }

  async create(dto: CreateTaskDto, userId: string) {
    const { assigneeIds, assigneeType, assigneeTrackId, assigneeUserId, ...taskData } = dto;

    // Validate polymorphic assignment
    this.validateAssignment(assigneeType, assigneeTrackId, assigneeUserId);

    // Validate referenced entities exist
    if (assigneeType === 'TRACK' && assigneeTrackId) {
      const track = await this.prisma.track.findUnique({ where: { id: assigneeTrackId } });
      if (!track) throw new BadRequestException('المسار المحدد غير موجود');
    }
    if (assigneeType === 'USER' && assigneeUserId) {
      const user = await this.prisma.user.findUnique({ where: { id: assigneeUserId } });
      if (!user) throw new BadRequestException('المستخدم المحدد غير موجود');
    }

    const task = await this.prisma.task.create({
      data: {
        ...taskData,
        status: (dto.status as any) || 'pending',
        priority: (dto.priority as any) || 'medium',
        createdById: userId,
        assigneeType: assigneeType as any,
        assigneeTrackId: assigneeType === 'TRACK' ? assigneeTrackId : null,
        assigneeUserId: assigneeType === 'USER' ? assigneeUserId : null,
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

    // Write task audit log
    await this.writeTaskAudit(task.id, 'CREATED', null, task, userId);

    // Emit real-time event
    this.events.server.emit('task.created', { task });
    if (task.trackId) {
      this.events.emitToTrack(task.trackId, 'task.created', { task });
    }
    if (task.assigneeTrackId) {
      this.events.emitToTrack(task.assigneeTrackId, 'task.created', { task });
    }
    // Notify assigned user
    if (task.assigneeUserId) {
      this.events.emitToUser(task.assigneeUserId, 'task.assigned', { task });
    }
    // Notify legacy assignees
    if (assigneeIds) {
      assigneeIds.forEach((uid) => {
        this.events.emitToUser(uid, 'task.assigned', { task });
      });
    }

    return task;
  }

  async update(id: string, dto: UpdateTaskDto, userId: string) {
    const existing = await this.findById(id);
    const { assigneeIds, assigneeType, assigneeTrackId, assigneeUserId, ...taskData } = dto;

    // If reassignment is requested, validate it
    if (assigneeType) {
      this.validateAssignment(assigneeType, assigneeTrackId, assigneeUserId);

      if (assigneeType === 'TRACK' && assigneeTrackId) {
        const track = await this.prisma.track.findUnique({ where: { id: assigneeTrackId } });
        if (!track) throw new BadRequestException('المسار المحدد غير موجود');
      }
      if (assigneeType === 'USER' && assigneeUserId) {
        const user = await this.prisma.user.findUnique({ where: { id: assigneeUserId } });
        if (!user) throw new BadRequestException('المستخدم المحدد غير موجود');
      }
    }

    // Auto-set status to completed if progress reaches 100
    if (taskData.progress === 100 && existing.status !== 'completed') {
      (taskData as any).status = 'completed';
    }

    const updateData: any = { ...taskData };

    // Apply reassignment
    if (assigneeType) {
      updateData.assigneeType = assigneeType;
      updateData.assigneeTrackId = assigneeType === 'TRACK' ? assigneeTrackId : null;
      updateData.assigneeUserId = assigneeType === 'USER' ? assigneeUserId : null;
    }

    const task = await this.prisma.task.update({
      where: { id },
      data: updateData,
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

    // Determine audit action
    const action = assigneeType && assigneeType !== existing.assigneeType ? 'REASSIGNED' : 'UPDATED';
    await this.writeTaskAudit(id, action, existing, updated, userId);

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

    // Verify user is assigned to this task OR is the assignee user OR admin/pm
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    const isAdminOrPm = user?.role === 'admin' || user?.role === 'pm';

    if (!isAdminOrPm) {
      const assignment = await this.prisma.taskAssignment.findFirst({
        where: { taskId: id, userId },
      });
      const isDirectAssignee = existing.assigneeType === 'USER' && existing.assigneeUserId === userId;
      if (!assignment && !isDirectAssignee) {
        throw new ForbiddenException('ليس لديك صلاحية لتحديث هذه المهمة');
      }
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

    await this.writeTaskAudit(id, 'STATUS_CHANGED', { status: existing.status }, { status: task.status }, userId);

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

    await this.writeTaskAudit(id, 'REASSIGNED', null, { assignedUserIds: userIds }, assignedBy);

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

    // Soft delete
    await this.prisma.task.update({
      where: { id },
      data: { isDeleted: true, deletedAt: new Date() },
    });

    await this.writeTaskAudit(id, 'DELETED', existing, null, userId);

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
    const where: any = { isDeleted: false };
    if (trackId) where.trackId = trackId;

    const overdueWhere: any = {
      ...where,
      dueDate: { lt: new Date() },
      status: { notIn: ['completed', 'cancelled'] },
    };

    const [total, byStatus, byPriority, overdue, byAssigneeType] = await Promise.all([
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
      this.prisma.task.groupBy({
        by: ['assigneeType'],
        where,
        _count: true,
      }),
    ]);

    return {
      total,
      byStatus: Object.fromEntries(byStatus.map((s) => [s.status, s._count])),
      byPriority: Object.fromEntries(byPriority.map((p) => [p.priority, p._count])),
      byAssigneeType: Object.fromEntries(byAssigneeType.map((a) => [a.assigneeType, a._count])),
      overdue,
    };
  }

  async getTaskAuditLog(taskId: string, params?: { page?: number; pageSize?: number }) {
    const { page = 1, pageSize = 25 } = params || {};
    const [data, total] = await Promise.all([
      this.prisma.taskAuditLog.findMany({
        where: { taskId },
        include: {
          actor: { select: { id: true, name: true, nameAr: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.taskAuditLog.count({ where: { taskId } }),
    ]);
    return { data, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  }

  private async writeTaskAudit(taskId: string, action: string, before: any, after: any, actorUserId: string) {
    try {
      await this.prisma.taskAuditLog.create({
        data: {
          taskId,
          action,
          beforeJson: before ? JSON.parse(JSON.stringify(before)) : undefined,
          afterJson: after ? JSON.parse(JSON.stringify(after)) : undefined,
          actorUserId,
        },
      });
    } catch {
      // Silent fail - don't block task operations if audit log fails
    }
  }
}
