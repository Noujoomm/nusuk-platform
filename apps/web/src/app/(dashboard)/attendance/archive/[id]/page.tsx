'use client';

/**
 * Attendance archive — detail view (read-only).
 *
 * Renders the frozen JSON snapshot as a table. The status pill colours
 * mirror the live daily report's so the archive feels visually
 * continuous with `/attendance`; no editing affordances are shown.
 */

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Archive as ArchiveIcon, ArrowRight, Lock, Loader2, AlertCircle } from 'lucide-react';
import { attendanceApi } from '@/lib/api';

type RawStatus =
  | 'present'
  | 'incomplete_hours'
  | 'check_in_only'
  | 'check_out_only'
  | 'absent'
  | 'on_call_present'
  | 'on_call_no_visit'
  | 'on_call_check_in_only'
  | 'on_call_check_out_only'
  | 'online'
  | 'unscheduled'
  | 'exempt';

interface SnapshotRow {
  employeeId: string;
  employeeNumber: string | null;
  employeeName: string;
  department: string;
  shiftType: string;
  checkIn: string | null;
  checkOut: string | null;
  hoursWorked: number | null;
  status: RawStatus;
}

interface ArchiveDetail {
  id: string;
  uploadId: string;
  archiveDate: string;
  archivedAt: string;
  archivedByName: string;
  totalEmployees: number;
  notes: string | null;
  summary: { totals: Record<string, number>; byStatus: Record<string, number> };
  snapshot: { date: string; rows: SnapshotRow[] };
}

export default function AttendanceArchiveDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [archive, setArchive] = useState<ArchiveDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    attendanceApi
      .archiveGet(id)
      .then((r) => {
        if (cancelled) return;
        setArchive(r.data as ArchiveDetail);
      })
      .catch((e) => {
        if (cancelled) return;
        const status = e?.response?.status;
        setError(
          status === 403
            ? 'ليس لديك صلاحية لعرض هذا الأرشيف.'
            : status === 404
              ? 'الأرشيف غير موجود.'
              : 'تعذّر تحميل الأرشيف.',
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) {
    return (
      <div dir="rtl" className="flex items-center justify-center py-16 text-gray-400 text-sm gap-2">
        <Loader2 className="w-4 h-4 animate-spin" />
        جارٍ التحميل...
      </div>
    );
  }
  if (error || !archive) {
    return (
      <div dir="rtl" className="space-y-4">
        <Link
          href="/attendance/archive"
          className="inline-flex items-center gap-1.5 text-sm text-gray-300 hover:text-white"
        >
          <ArrowRight className="w-4 h-4" />
          عودة للأرشيف
        </Link>
        <div className="rounded-2xl bg-white/[0.03] border border-rose-500/30 p-6 text-rose-300 text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          {error ?? 'الأرشيف غير موجود.'}
        </div>
      </div>
    );
  }

  const rows = archive.snapshot.rows;

  return (
    <div dir="rtl" className="space-y-5">
      <Link
        href="/attendance/archive"
        className="inline-flex items-center gap-1.5 text-sm text-gray-300 hover:text-white"
      >
        <ArrowRight className="w-4 h-4" />
        عودة للأرشيف
      </Link>

      {/* Header */}
      <div className="rounded-2xl bg-white/[0.03] backdrop-blur-xl border border-white/10 p-5">
        <div className="flex items-start gap-3 mb-3 flex-wrap">
          <div className="rounded-xl bg-amber-500/20 p-2.5">
            <ArchiveIcon className="w-5 h-5 text-amber-300" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-semibold">
              كشف مؤرشف — {fmtDate(archive.archiveDate)}
            </h1>
            <p className="text-sm text-gray-400 mt-1">
              أرشفه {archive.archivedByName} في {fmtDateTime(archive.archivedAt)}
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-gray-500/40 bg-gray-500/15 px-2.5 py-1 text-xs text-gray-200">
            <Lock className="w-3.5 h-3.5" />
            للقراءة فقط
          </span>
        </div>
        {archive.notes && (
          <p className="text-xs text-gray-400 bg-white/[0.02] border border-white/5 rounded-lg p-3 whitespace-pre-wrap">
            {archive.notes}
          </p>
        )}
      </div>

      {/* Summary chips */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
        <SummaryChip label="إجمالي" value={archive.totalEmployees} tone="neutral" />
        <SummaryChip label="كامل" value={archive.summary.totals.fullDay ?? 0} tone="emerald" />
        <SummaryChip label="جزئي" value={archive.summary.totals.partial ?? 0} tone="amber" />
        <SummaryChip label="غياب" value={archive.summary.totals.absent ?? 0} tone="rose" />
        <SummaryChip
          label="بصمة ناقصة"
          value={(archive.summary.totals.missingCheckout ?? 0) + (archive.summary.totals.missingCheckin ?? 0)}
          tone="amber"
        />
        <SummaryChip label="On Call" value={archive.summary.totals.onCall ?? 0} tone="sky" />
      </div>

      {/* Table */}
      <div className="rounded-2xl bg-white/[0.03] backdrop-blur-xl border border-white/10 overflow-hidden">
        {rows.length === 0 ? (
          <div className="py-12 text-center text-sm text-gray-400">
            لا توجد بيانات في هذا الكشف.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-white/[0.04] text-gray-400 text-xs uppercase tracking-wide">
                  <th className="px-3 py-3 text-right font-medium">#</th>
                  <th className="px-3 py-3 text-right font-medium">الاسم</th>
                  <th className="px-3 py-3 text-right font-medium">القسم</th>
                  <th className="px-3 py-3 text-right font-medium">الوردية</th>
                  <th className="px-3 py-3 text-right font-medium">دخول</th>
                  <th className="px-3 py-3 text-right font-medium">خروج</th>
                  <th className="px-3 py-3 text-right font-medium">الساعات</th>
                  <th className="px-3 py-3 text-right font-medium">الحالة</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.employeeId} className="border-t border-white/5">
                    <td className="px-3 py-2.5 text-xs text-gray-500 tabular-nums">
                      {r.employeeNumber ? toArabicIndic(r.employeeNumber) : '—'}
                    </td>
                    <td className="px-3 py-2.5 text-white/90">{r.employeeName}</td>
                    <td className="px-3 py-2.5 text-xs text-gray-400">{r.department}</td>
                    <td className="px-3 py-2.5 text-xs text-gray-400">
                      {SHIFT_LABEL[r.shiftType] ?? r.shiftType}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-gray-300 tabular-nums">
                      {r.checkIn ? toArabicIndic(r.checkIn) : '—'}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-gray-300 tabular-nums">
                      {r.checkOut ? toArabicIndic(r.checkOut) : '—'}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-gray-300 tabular-nums">
                      {r.hoursWorked != null
                        ? toArabicIndic(r.hoursWorked.toFixed(1))
                        : '—'}
                    </td>
                    <td className="px-3 py-2.5">
                      <StatusBadge status={r.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Status presentation (mirrors the live report) ────────────────────

const STATUS_LABEL: Record<RawStatus, string> = {
  present: 'كامل',
  incomplete_hours: 'أقل من ٨ ساعات',
  check_in_only: 'دخول بدون خروج',
  check_out_only: 'خروج بدون دخول',
  absent: 'غائب',
  on_call_present: 'On Call - حضر',
  on_call_no_visit: 'On Call - لم يحضر',
  on_call_check_in_only: 'On Call - دخول بلا خروج',
  on_call_check_out_only: 'On Call - خروج بلا دخول',
  online: 'أونلاين',
  unscheduled: 'بدون جدول',
  exempt: 'معفي',
};

const STATUS_TONE: Record<RawStatus, string> = {
  present: 'border-emerald-500/40 bg-emerald-500/15 text-emerald-200',
  incomplete_hours: 'border-amber-500/40 bg-amber-500/15 text-amber-200',
  check_in_only: 'border-amber-500/40 bg-amber-500/15 text-amber-200',
  check_out_only: 'border-amber-500/40 bg-amber-500/15 text-amber-200',
  absent: 'border-rose-500/40 bg-rose-500/15 text-rose-200',
  on_call_present: 'border-sky-500/40 bg-sky-500/15 text-sky-200',
  on_call_no_visit: 'border-gray-500/40 bg-gray-500/15 text-gray-200',
  on_call_check_in_only: 'border-sky-500/40 bg-sky-500/15 text-sky-200',
  on_call_check_out_only: 'border-sky-500/40 bg-sky-500/15 text-sky-200',
  online: 'border-violet-500/40 bg-violet-500/15 text-violet-200',
  unscheduled: 'border-gray-500/40 bg-gray-500/15 text-gray-300',
  exempt: 'border-gray-500/40 bg-gray-500/15 text-gray-300',
};

const SHIFT_LABEL: Record<string, string> = {
  morning: 'صباحي',
  evening: 'مسائي',
  night: 'ليلي',
  on_call: 'On Call',
  online: 'أونلاين',
  unscheduled: 'بدون جدول',
  rotating: 'بالتناوب',
};

function StatusBadge({ status }: { status: RawStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] ${STATUS_TONE[status] ?? STATUS_TONE.unscheduled}`}
    >
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}

function SummaryChip({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: 'neutral' | 'emerald' | 'amber' | 'rose' | 'sky';
}) {
  const toneClass =
    tone === 'emerald' ? 'text-emerald-300' :
    tone === 'amber' ? 'text-amber-300' :
    tone === 'rose' ? 'text-rose-300' :
    tone === 'sky' ? 'text-sky-300' :
    'text-white/90';
  return (
    <div className="rounded-xl bg-white/[0.04] border border-white/10 px-3 py-2.5">
      <div className="text-xs text-gray-400 mb-0.5">{label}</div>
      <div className={`text-lg font-semibold tabular-nums ${toneClass}`}>
        {toArabicIndic(value)}
      </div>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────

const ARABIC_INDIC_DIGITS = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
function toArabicIndic(value: number | string): string {
  return String(value).replace(/[0-9]/g, (d) => ARABIC_INDIC_DIGITS[Number(d)]);
}

function fmtDate(input: string): string {
  // Accept ISO or YYYY-MM-DD; the schema stores @db.Date so the API returns
  // either `2026-05-10` or `2026-05-10T00:00:00.000Z`. Strip the time half
  // and convert digits to Arabic-Indic.
  const dateOnly = input.slice(0, 10);
  return toArabicIndic(dateOnly.split('-').reverse().join('/'));
}

function fmtDateTime(iso: string): string {
  try {
    return toArabicIndic(
      new Intl.DateTimeFormat('ar-SA-u-ca-gregory', {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: 'Asia/Riyadh',
      }).format(new Date(iso)),
    );
  } catch {
    return iso;
  }
}
