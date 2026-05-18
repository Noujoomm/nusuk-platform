/**
 * Attendance archive service — freezes one daily report into an immutable
 * snapshot row so it can be reviewed later without being affected by edits
 * to the master roster.
 *
 * Storage strategy: the per-row data is persisted as JSON, NOT as a
 * relational table of pointers to PdfAttendanceEmployee / summaries.
 * The whole point of an archive is that future renames, rolloffs, and
 * re-analyses of the SAME upload don't rewrite history. Postgres `jsonb`
 * is the cleanest tool for that.
 *
 * Uniqueness is `@@unique([uploadId])`, not on date — HR routinely re-
 * uploads a day after corrections, producing a new upload row with the
 * same `reportDate`. Each closed upload gets its own archive entry.
 */

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, PdfAttendanceStatus } from '@prisma/client';
import { PrismaService } from '../../common/prisma.service';

/** Allowed roles — mirrored in the controller's @Roles + the sidebar. */
const ALLOWED_ROLES: ReadonlyArray<string> = ['admin', 'system_manager'];

/** One archived employee row inside `snapshot.rows`. */
export interface ArchiveRow {
  employeeId: string;
  employeeNumber: string | null;
  employeeName: string;
  /** "track" + optional "trackDetail" joined for display, captured at archive time. */
  department: string;
  shiftType: string;
  checkIn: string | null;
  checkOut: string | null;
  hoursWorked: number | null;
  /** Raw enum value from PdfAttendanceStatus. The frontend collapses to
   *  display buckets (full_day / partial / absent / missing_checkout /
   *  missing_checkin / on_call) at render time, not here. */
  status: PdfAttendanceStatus;
}

export interface ArchiveSnapshot {
  date: string; // YYYY-MM-DD
  rows: ArchiveRow[];
}

export interface ArchiveSummary {
  /** Counts per raw `PdfAttendanceStatus`. Keys are the enum values. */
  byStatus: Partial<Record<PdfAttendanceStatus, number>>;
  totals: {
    fullDay: number;
    partial: number;
    absent: number;
    missingCheckout: number;
    missingCheckin: number;
    onCall: number;
  };
}

interface ListFilters {
  from?: Date;
  to?: Date;
  page?: number;
  limit?: number;
}

@Injectable()
export class AttendanceArchiveService {
  private readonly logger = new Logger(AttendanceArchiveService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ─── Permission guard ────────────────────────────────────────────────
  /** Re-checks the role on every entrypoint — Roles decorator is the
   *  primary gate; this is belt-and-braces for non-HTTP callers. */
  private assertAllowed(role: string | null | undefined): void {
    if (!role || !ALLOWED_ROLES.includes(role)) {
      throw new ForbiddenException('غير مصرّح بالوصول إلى الأرشيف');
    }
  }

  // ─── Public API ───────────────────────────────────────────────────────

  async archiveDailyAttendance(params: {
    uploadId: string;
    userId: string;
    userName: string;
    userRole: string;
    notes?: string;
  }) {
    this.assertAllowed(params.userRole);

    const upload = await this.prisma.pdfAttendanceUpload.findUnique({
      where: { id: params.uploadId },
      select: { id: true, reportDate: true },
    });
    if (!upload) throw new NotFoundException('الرفعة غير موجودة');

    // Refuse future-dated archives — they don't represent a closed day,
    // just an admin who picked the wrong upload.
    const today = startOfUtcDay(new Date());
    if (startOfUtcDay(upload.reportDate).getTime() > today.getTime()) {
      throw new BadRequestException(
        'لا يمكن أرشفة كشف بتاريخ مستقبلي. أرشف بعد انتهاء يوم الكشف.',
      );
    }

    const summaries = await this.prisma.pdfDailyAttendanceSummary.findMany({
      where: { uploadId: params.uploadId },
      include: {
        employee: {
          select: {
            id: true,
            employeeNumber: true,
            fullName: true,
            track: true,
            trackDetail: true,
            shiftType: true,
          },
        },
      },
      orderBy: [{ employee: { track: 'asc' } }, { employee: { fullName: 'asc' } }],
    });

    const rows: ArchiveRow[] = summaries.map((s) => ({
      employeeId: s.employeeId,
      employeeNumber: s.employee.employeeNumber ?? null,
      employeeName: s.employee.fullName,
      department: s.employee.trackDetail
        ? `${s.employee.track} — ${s.employee.trackDetail}`
        : s.employee.track,
      shiftType: s.employee.shiftType,
      checkIn: s.firstCheckIn,
      checkOut: s.lastCheckOut,
      hoursWorked: s.totalHours,
      status: s.status,
    }));

    const summary = buildSummary(rows);
    const snapshot: ArchiveSnapshot = {
      date: upload.reportDate.toISOString().slice(0, 10),
      rows,
    };

    try {
      const archive = await this.prisma.attendanceArchive.create({
        data: {
          uploadId: upload.id,
          archiveDate: upload.reportDate,
          archivedById: params.userId,
          archivedByName: params.userName,
          totalEmployees: rows.length,
          summary: summary as unknown as Prisma.InputJsonValue,
          snapshot: snapshot as unknown as Prisma.InputJsonValue,
          notes: params.notes?.trim() || null,
        },
      });
      this.logger.log(
        `archived upload=${upload.id} date=${snapshot.date} rows=${rows.length} by=${params.userId}`,
      );
      return archive;
    } catch (e: any) {
      // P2002 = unique constraint violation on uploadId.
      if (e?.code === 'P2002') {
        throw new ConflictException('هذه الرفعة مؤرشفة مسبقاً.');
      }
      throw e;
    }
  }

  async listArchives(role: string, filters: ListFilters = {}) {
    this.assertAllowed(role);
    const page = Math.max(1, filters.page ?? 1);
    const limit = Math.min(100, Math.max(1, filters.limit ?? 20));
    const where: Prisma.AttendanceArchiveWhereInput = {};
    if (filters.from || filters.to) {
      where.archiveDate = {};
      if (filters.from) where.archiveDate.gte = filters.from;
      if (filters.to) where.archiveDate.lte = filters.to;
    }
    const [items, total] = await Promise.all([
      this.prisma.attendanceArchive.findMany({
        where,
        orderBy: [{ archiveDate: 'desc' }, { archivedAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          uploadId: true,
          archiveDate: true,
          archivedAt: true,
          archivedById: true,
          archivedByName: true,
          totalEmployees: true,
          summary: true,
          notes: true,
        },
      }),
      this.prisma.attendanceArchive.count({ where }),
    ]);
    return { items, total, page, limit };
  }

  async getArchiveById(role: string, id: string) {
    this.assertAllowed(role);
    const archive = await this.prisma.attendanceArchive.findUnique({
      where: { id },
    });
    if (!archive) throw new NotFoundException('الأرشيف غير موجود');
    return archive;
  }

  async getArchiveByDate(role: string, date: Date) {
    this.assertAllowed(role);
    // `archiveDate` is `@db.Date` — match the day at UTC midnight.
    const day = startOfUtcDay(date);
    const archive = await this.prisma.attendanceArchive.findFirst({
      where: { archiveDate: day },
      orderBy: { archivedAt: 'desc' },
    });
    return archive ?? null;
  }
}

// ─── Pure helpers (exported for tests) ──────────────────────────────────

/**
 * Collapses 12-value `PdfAttendanceStatus` into the 6 display buckets the
 * archive UI cares about. `byStatus` keeps every raw count so no data is
 * lost; `totals` is the rolled-up summary the list page renders.
 */
export function buildSummary(rows: ArchiveRow[]): ArchiveSummary {
  const byStatus: Partial<Record<PdfAttendanceStatus, number>> = {};
  const totals = { fullDay: 0, partial: 0, absent: 0, missingCheckout: 0, missingCheckin: 0, onCall: 0 };
  for (const r of rows) {
    byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;
    const bucket = bucketStatus(r.status);
    if (bucket) totals[bucket] += 1;
  }
  return { byStatus, totals };
}

/**
 * Returns the display-bucket key for one raw status, or null when the
 * status doesn't belong on the headline list (e.g. `online`, `unscheduled`,
 * deprecated `exempt`). Centralised here so the frontend doesn't
 * re-implement it.
 */
export function bucketStatus(
  s: PdfAttendanceStatus,
): keyof ArchiveSummary['totals'] | null {
  switch (s) {
    case 'present':
      return 'fullDay';
    case 'incomplete_hours':
      return 'partial';
    case 'absent':
      return 'absent';
    case 'check_in_only':
      return 'missingCheckout';
    case 'check_out_only':
      return 'missingCheckin';
    case 'on_call_present':
    case 'on_call_no_visit':
    case 'on_call_check_in_only':
    case 'on_call_check_out_only':
      return 'onCall';
    default:
      // online / unscheduled / exempt — not counted in headline totals.
      return null;
  }
}

function startOfUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}
