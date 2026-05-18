/**
 * Tests for the pure pieces of the archive service: the status →
 * display-bucket classifier and the summary aggregator. The DB-touching
 * paths (archive, list, getById) are integration territory and not
 * unit-tested here — they're a thin wrapper around Prisma.
 *
 * jest in this repo runs with rootDir=src and doesn't resolve the
 * workspace-hoisted @prisma/client by default, so we mock the package
 * before importing the service. Only the enum and types are needed at
 * runtime for these tests.
 */

jest.mock(
  '@prisma/client',
  () => ({
    PrismaClient: class {},
    Prisma: {},
    PdfAttendanceStatus: {
      present: 'present',
      incomplete_hours: 'incomplete_hours',
      check_in_only: 'check_in_only',
      check_out_only: 'check_out_only',
      absent: 'absent',
      on_call_present: 'on_call_present',
      on_call_no_visit: 'on_call_no_visit',
      on_call_check_in_only: 'on_call_check_in_only',
      on_call_check_out_only: 'on_call_check_out_only',
      online: 'online',
      unscheduled: 'unscheduled',
      exempt: 'exempt',
    },
  }),
  { virtual: true },
);

import { ArchiveRow, bucketStatus, buildSummary } from './attendance-archive.service';

const row = (status: ArchiveRow['status']): ArchiveRow => ({
  employeeId: 'e' + status,
  employeeNumber: '1',
  employeeName: 'فلان',
  department: 'A',
  shiftType: 'morning',
  checkIn: null,
  checkOut: null,
  hoursWorked: null,
  status,
});

describe('bucketStatus', () => {
  it.each<[ArchiveRow['status'], string | null]>([
    ['present', 'fullDay'],
    ['incomplete_hours', 'partial'],
    ['absent', 'absent'],
    ['check_in_only', 'missingCheckout'],
    ['check_out_only', 'missingCheckin'],
    ['on_call_present', 'onCall'],
    ['on_call_no_visit', 'onCall'],
    ['on_call_check_in_only', 'onCall'],
    ['on_call_check_out_only', 'onCall'],
    // Not counted in the headline totals — bucketStatus returns null:
    ['online', null],
    ['unscheduled', null],
    ['exempt', null],
  ])('%s → %s', (status, bucket) => {
    expect(bucketStatus(status)).toBe(bucket);
  });
});

describe('buildSummary', () => {
  it('returns all-zero totals + empty byStatus for an empty roster', () => {
    const s = buildSummary([]);
    expect(s.totals).toEqual({
      fullDay: 0,
      partial: 0,
      absent: 0,
      missingCheckout: 0,
      missingCheckin: 0,
      onCall: 0,
    });
    expect(s.byStatus).toEqual({});
  });

  it('counts every raw status in byStatus AND rolls up to display totals', () => {
    const rows: ArchiveRow[] = [
      row('present'),
      row('present'),
      row('absent'),
      row('incomplete_hours'),
      row('check_in_only'),
      row('check_out_only'),
      row('on_call_present'),
      row('on_call_no_visit'),
      row('online'), // doesn't roll into headline totals
    ];
    const s = buildSummary(rows);
    expect(s.byStatus).toEqual({
      present: 2,
      absent: 1,
      incomplete_hours: 1,
      check_in_only: 1,
      check_out_only: 1,
      on_call_present: 1,
      on_call_no_visit: 1,
      online: 1,
    });
    expect(s.totals).toEqual({
      fullDay: 2,
      partial: 1,
      absent: 1,
      missingCheckout: 1,
      missingCheckin: 1,
      onCall: 2,
    });
  });

  it('rolls all four on_call_* variants under a single `onCall` total', () => {
    const rows: ArchiveRow[] = [
      row('on_call_present'),
      row('on_call_no_visit'),
      row('on_call_check_in_only'),
      row('on_call_check_out_only'),
    ];
    const s = buildSummary(rows);
    expect(s.totals.onCall).toBe(4);
    // …while keeping the granular breakdown in byStatus.
    expect(s.byStatus.on_call_present).toBe(1);
    expect(s.byStatus.on_call_no_visit).toBe(1);
    expect(s.byStatus.on_call_check_in_only).toBe(1);
    expect(s.byStatus.on_call_check_out_only).toBe(1);
  });

  it('does NOT count `online` / `unscheduled` / `exempt` in any headline total', () => {
    const rows: ArchiveRow[] = [row('online'), row('unscheduled'), row('exempt')];
    const s = buildSummary(rows);
    expect(s.totals.fullDay + s.totals.partial + s.totals.absent + s.totals.missingCheckout + s.totals.missingCheckin + s.totals.onCall).toBe(0);
    // …but they ARE preserved in byStatus.
    expect(s.byStatus.online).toBe(1);
    expect(s.byStatus.unscheduled).toBe(1);
    expect(s.byStatus.exempt).toBe(1);
  });
});
