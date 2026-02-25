import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { UpdateProgressDto, CreateAchievementDto, UpdateAchievementDto } from './progress.dto';

@Injectable()
export class ProgressService {
  constructor(private prisma: PrismaService) {}

  // ─── PROGRESS ITEMS ───

  async getProgressItem(entityType: string, entityId: string) {
    const item = await this.prisma.progressItem.findUnique({
      where: { entityType_entityId: { entityType, entityId } },
    });
    if (!item) throw new NotFoundException('عنصر التقدم غير موجود');
    return item;
  }

  async upsertProgress(entityType: string, entityId: string, data: UpdateProgressDto) {
    // Fetch existing record to track old value for event
    const existing = await this.prisma.progressItem.findUnique({
      where: { entityType_entityId: { entityType, entityId } },
    });

    const oldPercent = existing?.progressPercent ?? null;

    const upsertData: any = {
      progressPercent: data.progressPercent,
    };
    if (data.status !== undefined) upsertData.status = data.status;
    if (data.startDate !== undefined) upsertData.startDate = new Date(data.startDate);
    if (data.endDate !== undefined) upsertData.endDate = new Date(data.endDate);
    if (data.metadata !== undefined) upsertData.metadata = data.metadata;

    const result = await this.prisma.progressItem.upsert({
      where: { entityType_entityId: { entityType, entityId } },
      update: upsertData,
      create: {
        entityType,
        entityId,
        ...upsertData,
      },
    });

    // Record a ProgressEvent if progressPercent changed
    if (oldPercent === null || oldPercent !== data.progressPercent) {
      await this.prisma.progressEvent.create({
        data: {
          entityType,
          entityId,
          eventType: 'progress_update',
          oldValue: oldPercent,
          newValue: data.progressPercent,
          metadata: data.metadata ?? undefined,
        },
      });
    }

    return result;
  }

  async getProgressByType(entityType: string) {
    return this.prisma.progressItem.findMany({
      where: { entityType },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async getGlobalStats() {
    const [countByType, avgByType, countByStatus] = await Promise.all([
      this.prisma.progressItem.groupBy({
        by: ['entityType'],
        _count: true,
      }),
      this.prisma.progressItem.groupBy({
        by: ['entityType'],
        _avg: { progressPercent: true },
      }),
      this.prisma.progressItem.groupBy({
        by: ['status'],
        _count: true,
      }),
    ]);

    return {
      countByType: Object.fromEntries(
        countByType.map((item) => [item.entityType, item._count]),
      ),
      avgProgressByType: Object.fromEntries(
        avgByType.map((item) => [
          item.entityType,
          Math.round((item._avg.progressPercent ?? 0) * 100) / 100,
        ]),
      ),
      countByStatus: Object.fromEntries(
        countByStatus.map((item) => [item.status, item._count]),
      ),
    };
  }

  // ─── TRACK PROGRESS (WEIGHTED COMPOSITE) ───

  async getTrackProgress(trackId: string) {
    // 1. Tasks for this track -> average progress (weight: 0.4)
    const taskAgg = await this.prisma.task.aggregate({
      where: { trackId },
      _avg: { progress: true },
      _count: true,
    });
    const taskAvg = taskAgg._avg.progress ?? 0;

    // 2. Reports for this track -> count (weight: 0.1)
    const reportCount = await this.prisma.report.count({
      where: { trackId },
    });

    // 3. Scope blocks for this track -> average progress (weight: 0.3)
    const scopeAgg = await this.prisma.scopeBlock.aggregate({
      where: { trackId },
      _avg: { progress: true },
      _count: true,
    });
    const scopeAvg = scopeAgg._avg.progress ?? 0;

    // 4. KPI entries for this track -> average (actualValue/targetValue*100) (weight: 0.2)
    const kpiEntries = await this.prisma.kPIEntry.findMany({
      where: { trackId },
      select: { actualValue: true, targetValue: true },
    });

    let kpiAvg = 0;
    if (kpiEntries.length > 0) {
      const kpiSum = kpiEntries.reduce((sum, kpi) => {
        const pct = kpi.targetValue > 0 ? (kpi.actualValue / kpi.targetValue) * 100 : 0;
        return sum + Math.min(pct, 100); // Cap at 100%
      }, 0);
      kpiAvg = kpiSum / kpiEntries.length;
    }

    // Reports component: normalize to 0-100 scale
    // Use a simple heuristic: 10+ reports = 100%, scale linearly
    const reportsScore = Math.min((reportCount / 10) * 100, 100);

    // Weighted overall
    const overall =
      taskAvg * 0.4 +
      reportsScore * 0.1 +
      scopeAvg * 0.3 +
      kpiAvg * 0.2;

    return {
      trackId,
      overall: Math.round(overall * 100) / 100,
      breakdown: {
        tasks: {
          average: Math.round(taskAvg * 100) / 100,
          count: taskAgg._count,
          weight: 0.4,
        },
        reports: {
          count: reportCount,
          score: Math.round(reportsScore * 100) / 100,
          weight: 0.1,
        },
        scopeBlocks: {
          average: Math.round(scopeAvg * 100) / 100,
          count: scopeAgg._count,
          weight: 0.3,
        },
        kpis: {
          average: Math.round(kpiAvg * 100) / 100,
          count: kpiEntries.length,
          weight: 0.2,
        },
      },
    };
  }

  // ─── EMPLOYEE PROGRESS ───

  async getEmployeeProgress(employeeId: string) {
    // Get tasks assigned to this employee (via TaskAssignment user relation)
    // Note: employeeId here could be a userId for task assignments
    const assignedTasks = await this.prisma.task.findMany({
      where: {
        assignments: { some: { userId: employeeId } },
      },
      select: { id: true, progress: true, status: true, trackId: true },
    });

    const taskAvg =
      assignedTasks.length > 0
        ? assignedTasks.reduce((sum, t) => sum + t.progress, 0) / assignedTasks.length
        : 0;

    // Get scope blocks progress for tracks the employee is involved in
    const trackIds = [...new Set(assignedTasks.map((t) => t.trackId).filter(Boolean))] as string[];
    let scopeAvg = 0;
    let scopeCount = 0;

    if (trackIds.length > 0) {
      const scopeAgg = await this.prisma.scopeBlock.aggregate({
        where: { trackId: { in: trackIds } },
        _avg: { progress: true },
        _count: true,
      });
      scopeAvg = scopeAgg._avg.progress ?? 0;
      scopeCount = scopeAgg._count;
    }

    // Combined score: tasks (70%) + scope blocks (30%)
    const overall =
      assignedTasks.length > 0 || scopeCount > 0
        ? taskAvg * 0.7 + scopeAvg * 0.3
        : 0;

    return {
      employeeId,
      overall: Math.round(overall * 100) / 100,
      breakdown: {
        tasks: {
          average: Math.round(taskAvg * 100) / 100,
          count: assignedTasks.length,
          completed: assignedTasks.filter((t) => t.status === 'completed').length,
        },
        scopeBlocks: {
          average: Math.round(scopeAvg * 100) / 100,
          count: scopeCount,
        },
      },
    };
  }

  // ─── ACHIEVEMENTS ───

  async createAchievement(data: CreateAchievementDto) {
    return this.prisma.achievement.create({
      data: {
        entityType: data.entityType,
        entityId: data.entityId,
        title: data.title,
        titleAr: data.titleAr,
        description: data.description,
        descriptionAr: data.descriptionAr,
        impactType: data.impactType,
        evidenceLinks: data.evidenceLinks ?? [],
      },
    });
  }

  async getAchievements(params: {
    entityType?: string;
    entityId?: string;
    page?: number;
    pageSize?: number;
  }) {
    const { entityType, entityId, page = 1, pageSize = 25 } = params;
    const where: any = {};
    if (entityType) where.entityType = entityType;
    if (entityId) where.entityId = entityId;

    const [data, total] = await Promise.all([
      this.prisma.achievement.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.achievement.count({ where }),
    ]);

    return { data, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  }

  async updateAchievement(id: string, data: UpdateAchievementDto) {
    const existing = await this.prisma.achievement.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('الإنجاز غير موجود');
    return this.prisma.achievement.update({
      where: { id },
      data: data as any,
    });
  }

  async deleteAchievement(id: string) {
    const existing = await this.prisma.achievement.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('الإنجاز غير موجود');
    await this.prisma.achievement.delete({ where: { id } });
    return { message: 'تم حذف الإنجاز' };
  }

  // ─── PROGRESS EVENTS ───

  async getProgressEvents(entityType: string, entityId: string, limit?: number) {
    return this.prisma.progressEvent.findMany({
      where: { entityType, entityId },
      orderBy: { createdAt: 'desc' },
      ...(limit ? { take: limit } : {}),
    });
  }

  // ─── PROGRESS BY TRACK / EMPLOYEE ───

  async getProgressByTrack(trackId: string) {
    // Get all tasks for the track and their progress items
    const tasks = await this.prisma.task.findMany({
      where: { trackId },
      select: { id: true, title: true, titleAr: true, progress: true, status: true },
    });

    const scopeBlocks = await this.prisma.scopeBlock.findMany({
      where: { trackId },
      select: { id: true, code: true, title: true, progress: true, status: true },
    });

    const kpiEntries = await this.prisma.kPIEntry.findMany({
      where: { trackId },
      select: { id: true, name: true, nameAr: true, actualValue: true, targetValue: true, status: true },
    });

    // Also fetch any ProgressItem records that belong to entities in this track
    const entityIds = [
      ...tasks.map((t) => t.id),
      ...scopeBlocks.map((s) => s.id),
      ...kpiEntries.map((k) => k.id),
    ];

    const progressItems = entityIds.length > 0
      ? await this.prisma.progressItem.findMany({
          where: { entityId: { in: entityIds } },
        })
      : [];

    return {
      trackId,
      tasks,
      scopeBlocks,
      kpiEntries,
      progressItems,
    };
  }

  async getProgressByEmployee(employeeId: string) {
    // Get tasks assigned to this employee
    const assignedTasks = await this.prisma.task.findMany({
      where: {
        assignments: { some: { userId: employeeId } },
      },
      select: { id: true, title: true, titleAr: true, progress: true, status: true, trackId: true },
    });

    // Fetch matching progress items
    const taskIds = assignedTasks.map((t) => t.id);
    const progressItems = taskIds.length > 0
      ? await this.prisma.progressItem.findMany({
          where: { entityType: 'task', entityId: { in: taskIds } },
        })
      : [];

    return {
      employeeId,
      tasks: assignedTasks,
      progressItems,
    };
  }
}
