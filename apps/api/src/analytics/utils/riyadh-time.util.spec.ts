/**
 * Tests focus on `riyadhWeekBounds` since the daily helpers
 * (`riyadhDateString`, `addDaysRiyadh`, `riyadhDateBoundaries`) are
 * already exercised in production by the daily snapshot flow.
 *
 * KSA never observes DST, so we don't bother with cross-DST cases —
 * the +3h offset is fixed.
 */

import {
  addDaysRiyadh,
  riyadhDateString,
  riyadhWeekBounds,
} from './riyadh-time.util';

describe('riyadhWeekBounds', () => {
  it('treats Sunday in Riyadh as the start of the week', () => {
    // 2026-05-03 12:00 UTC → 2026-05-03 15:00 Riyadh, which is a Sunday.
    const now = new Date('2026-05-03T12:00:00Z');
    const w = riyadhWeekBounds(now);
    expect(w.startDateStr).toBe('2026-05-03');
    expect(w.endDateStr).toBe('2026-05-09');
  });

  it('rolls back to the previous Sunday when today is mid-week', () => {
    // 2026-05-06 (Wednesday in Riyadh)
    const now = new Date('2026-05-06T08:00:00Z');
    const w = riyadhWeekBounds(now);
    expect(w.startDateStr).toBe('2026-05-03');
    expect(w.endDateStr).toBe('2026-05-09');
  });

  it('treats Saturday as the last day of the same week, not the next', () => {
    // 2026-05-09 is a Saturday in Riyadh. The week should still be
    // 2026-05-03 → 2026-05-09.
    const now = new Date('2026-05-09T20:00:00Z'); // 23:00 Riyadh
    const w = riyadhWeekBounds(now);
    expect(w.startDateStr).toBe('2026-05-03');
    expect(w.endDateStr).toBe('2026-05-09');
  });

  it('flips to a new week the moment Sunday 00:00 Riyadh arrives', () => {
    // 2026-05-09 21:00 UTC = 2026-05-10 00:00 Riyadh, the boundary.
    const now = new Date('2026-05-09T21:00:00Z');
    const w = riyadhWeekBounds(now);
    expect(w.startDateStr).toBe('2026-05-10');
    expect(w.endDateStr).toBe('2026-05-16');
  });

  it('respects the late-night Saturday Riyadh window (UTC still Saturday morning)', () => {
    // 2026-05-09 00:30 UTC = 2026-05-09 03:30 Riyadh — Saturday.
    const now = new Date('2026-05-09T00:30:00Z');
    const w = riyadhWeekBounds(now);
    expect(w.startDateStr).toBe('2026-05-03');
    expect(w.endDateStr).toBe('2026-05-09');
  });

  it('returns a `start` instant exactly equal to Sunday 00:00 Riyadh in UTC', () => {
    const now = new Date('2026-05-06T08:00:00Z');
    const w = riyadhWeekBounds(now);
    // 00:00 Riyadh on 2026-05-03 = 21:00 UTC on 2026-05-02.
    expect(w.start.toISOString()).toBe('2026-05-02T21:00:00.000Z');
    // endExclusive = Sunday 00:00 Riyadh of the *next* week.
    expect(w.endExclusive.toISOString()).toBe('2026-05-09T21:00:00.000Z');
  });

  it('returns a `dateOnly` keyed on the week start (date-only, midnight UTC)', () => {
    const w = riyadhWeekBounds(new Date('2026-05-06T08:00:00Z'));
    expect(w.dateOnly.toISOString()).toBe('2026-05-03T00:00:00.000Z');
  });
});

describe('integration: week bounds round-trip with date helpers', () => {
  it('endDateStr is exactly weekStart + 6 days', () => {
    const now = new Date('2026-05-06T08:00:00Z');
    const w = riyadhWeekBounds(now);
    expect(addDaysRiyadh(w.startDateStr, 6)).toBe(w.endDateStr);
  });

  it('riyadhDateString of `now` is in [startDateStr, endDateStr]', () => {
    const now = new Date('2026-05-07T14:00:00Z');
    const w = riyadhWeekBounds(now);
    const today = riyadhDateString(now);
    expect(today >= w.startDateStr && today <= w.endDateStr).toBe(true);
  });
});
