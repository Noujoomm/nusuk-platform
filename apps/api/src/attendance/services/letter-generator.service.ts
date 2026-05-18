import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import {
  buildLetter,
  deriveShortName,
  AbsenceEntry,
  MissingCheckoutEntry,
  PartialEntry,
  GeneratedLetter,
  DEFAULT_RECIPIENT,
} from '../utils/letter-formatter';

/**
 * Generates the official Arabic absence letter from stored attendance data.
 *
 * Daily letter (v2): renders THREE categories — fully absent, partial
 * attendance (< 8h), and missed checkout. The `on_call_*` statuses are
 * inherently excluded because the query only selects the three regular-
 * employee statuses; they live under separate enum values and never get
 * counted as absence. `check_out_only`, `online`, and `unscheduled` are
 * also deliberately excluded — they describe other states and would
 * mislead the recipient.
 *
 * Range letter still renders only `status='absent'` (the legacy v1
 * layout). Extending range to 3 categories was out of scope for this PR.
 */
@Injectable()
export class LetterGeneratorService {
  private readonly logger = new Logger(LetterGeneratorService.name);

  constructor(private prisma: PrismaService) {}

  /** Daily letter — three categories, v2. */
  async generateDailyLetter(uploadId: string, recipientName?: string): Promise<GeneratedLetter> {
    const upload = await this.prisma.pdfAttendanceUpload.findUnique({
      where: { id: uploadId },
      select: { reportDate: true },
    });
    if (!upload) throw new NotFoundException('الرفعة غير موجودة');

    // Single query for all three categories. The `in` filter is what
    // excludes the on_call_* statuses (they have their own enum values
    // and never appear here). Sorted globally so consistent ordering
    // applies inside each category after the partition below.
    const summaries = await this.prisma.pdfDailyAttendanceSummary.findMany({
      where: {
        uploadId,
        status: { in: ['absent', 'incomplete_hours', 'check_in_only'] },
      },
      include: { employee: { select: { id: true, fullName: true, track: true } } },
      orderBy: [{ employee: { track: 'asc' } }, { employee: { fullName: 'asc' } }],
    });

    const absent: AbsenceEntry[] = [];
    const partial: PartialEntry[] = [];
    const missingCheckout: MissingCheckoutEntry[] = [];

    for (const s of summaries) {
      const base = {
        employeeId: s.employeeId,
        fullName: s.employee.fullName,
        shortName: deriveShortName(s.employee.fullName),
        track: s.employee.track,
      };
      if (s.status === 'absent') {
        absent.push({ ...base, absenceDates: [s.reportDate] });
      } else if (s.status === 'incomplete_hours') {
        // `totalHours` should always be present for this status (the
        // analyzer computes it before assigning the status), but guard
        // anyway — a missing value falls back to 0 so the line still
        // renders rather than crashing.
        partial.push({ ...base, hoursWorked: s.totalHours ?? 0 });
      } else if (s.status === 'check_in_only') {
        missingCheckout.push(base);
      }
    }

    const letter = buildLetter({
      recipientName: recipientName?.trim() || DEFAULT_RECIPIENT,
      reportType: 'daily',
      reportDate: upload.reportDate,
      absences: absent,
      partial,
      missingCheckout,
    });

    this.logger.log(
      `Daily letter upload=${uploadId} date=${upload.reportDate.toISOString().slice(0, 10)} ` +
        `absent=${absent.length} partial=${partial.length} missingCheckout=${missingCheckout.length}`,
    );
    return letter;
  }

  /**
   * Letter for a date range. Groups every employee's absences across the
   * range so each employee appears once with the right form (single day /
   * continuous / scattered).
   */
  async generateRangeLetter(
    rangeStart: Date,
    rangeEnd: Date,
    recipientName?: string,
    options?: { noteAboutLastDay?: boolean },
  ): Promise<GeneratedLetter> {
    if (isNaN(rangeStart.getTime()) || isNaN(rangeEnd.getTime())) {
      throw new NotFoundException('تواريخ غير صحيحة');
    }
    if (rangeEnd.getTime() < rangeStart.getTime()) {
      throw new NotFoundException('تاريخ النهاية قبل تاريخ البداية');
    }

    const summaries = await this.prisma.pdfDailyAttendanceSummary.findMany({
      where: {
        reportDate: { gte: rangeStart, lte: rangeEnd },
        status: 'absent',
      },
      include: { employee: { select: { id: true, fullName: true, track: true } } },
      orderBy: [{ employee: { track: 'asc' } }, { employee: { fullName: 'asc' } }, { reportDate: 'asc' }],
    });

    // Group by employee — one AbsenceEntry per person with all their dates.
    const byEmployee = new Map<string, AbsenceEntry>();
    for (const s of summaries) {
      const existing = byEmployee.get(s.employeeId);
      if (existing) {
        existing.absenceDates.push(s.reportDate);
      } else {
        byEmployee.set(s.employeeId, {
          employeeId: s.employeeId,
          fullName: s.employee.fullName,
          shortName: deriveShortName(s.employee.fullName),
          track: s.employee.track,
          absenceDates: [s.reportDate],
        });
      }
    }

    // Note about last day: only meaningful when caller asked AND no absence
    // landed on the rangeEnd day.
    let noteAboutLastDay = false;
    if (options?.noteAboutLastDay) {
      const lastDayHasAbsence = summaries.some((s) => isSameDayUtc(s.reportDate, rangeEnd));
      noteAboutLastDay = !lastDayHasAbsence;
    }

    const letter = buildLetter({
      recipientName: recipientName?.trim() || DEFAULT_RECIPIENT,
      reportType: 'range',
      rangeStart,
      rangeEnd,
      absences: Array.from(byEmployee.values()),
      noteAboutLastDay,
    });

    this.logger.log(
      `Range letter ${rangeStart.toISOString().slice(0, 10)}→${rangeEnd.toISOString().slice(0, 10)} absences=${letter.metadata.uniqueEmployees} totalDays=${letter.metadata.totalAbsences}`,
    );
    return letter;
  }
}

function isSameDayUtc(a: Date, b: Date): boolean {
  return (
    a.getUTCFullYear() === b.getUTCFullYear() &&
    a.getUTCMonth() === b.getUTCMonth() &&
    a.getUTCDate() === b.getUTCDate()
  );
}
