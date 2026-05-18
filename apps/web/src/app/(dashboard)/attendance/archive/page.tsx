'use client';

/**
 * Attendance archive — list view.
 *
 * Paginated table of closed daily reports. Gating is server-side
 * (the API returns 403 for non-admin/system_manager); the sidebar
 * already hides this link for other roles. We surface a clear empty
 * state for the common case (no archives yet) and a date-range filter
 * for triage as the archive grows.
 */

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Archive as ArchiveIcon, Eye, Loader2, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { attendanceApi } from '@/lib/api';

interface ArchiveRow {
  id: string;
  uploadId: string;
  archiveDate: string;
  archivedAt: string;
  archivedById: string;
  archivedByName: string;
  totalEmployees: number;
  summary: {
    totals: {
      fullDay: number;
      partial: number;
      absent: number;
      missingCheckout: number;
      missingCheckin: number;
      onCall: number;
    };
  };
  notes: string | null;
}

const LIMIT = 20;

export default function AttendanceArchiveListPage() {
  const [items, setItems] = useState<ArchiveRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await attendanceApi.archiveList({
        page,
        limit: LIMIT,
        from: from || undefined,
        to: to || undefined,
      });
      setItems(data.items);
      setTotal(data.total);
    } catch (e: any) {
      const status = e?.response?.status;
      setError(
        status === 403
          ? 'ليس لديك صلاحية للوصول إلى الأرشيف.'
          : 'تعذّر تحميل قائمة الأرشيف.',
      );
    } finally {
      setLoading(false);
    }
  }, [page, from, to]);

  useEffect(() => {
    load();
  }, [load]);

  const totalPages = Math.max(1, Math.ceil(total / LIMIT));

  return (
    <div dir="rtl" className="space-y-5">
      <header className="flex items-center gap-3">
        <div className="rounded-xl bg-amber-500/20 p-2.5">
          <ArchiveIcon className="w-5 h-5 text-amber-300" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold">أرشيف كشوف الحضور والانصراف</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            الكشوف اليومية المغلقة. للقراءة فقط.
          </p>
        </div>
      </header>

      {/* Filters */}
      <div className="rounded-2xl bg-white/[0.03] backdrop-blur-xl border border-white/10 p-4">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-3 items-end">
          <DateInput label="من" value={from} onChange={setFrom} />
          <DateInput label="إلى" value={to} onChange={setTo} />
          <button
            type="button"
            onClick={() => { setPage(1); setFrom(''); setTo(''); }}
            disabled={!from && !to}
            className="rounded-lg bg-white/5 border border-white/10 text-gray-300 px-4 py-2 text-sm hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            مسح الفلتر
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-2xl bg-white/[0.03] backdrop-blur-xl border border-white/10 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-gray-400 text-sm gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            جارٍ التحميل...
          </div>
        ) : error ? (
          <div className="flex items-center justify-center py-16 text-rose-300 text-sm gap-2">
            <AlertCircle className="w-4 h-4" />
            {error}
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2 text-gray-400 text-sm">
            <ArchiveIcon className="w-10 h-10 text-gray-600" />
            <span>لا توجد كشوف مؤرشفة بعد.</span>
            <Link
              href="/attendance"
              className="text-amber-300 hover:text-amber-200 text-xs mt-1"
            >
              ابدأ بإغلاق كشف يومي من صفحة الحضور →
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-white/[0.04] text-gray-400 text-xs uppercase tracking-wide">
                  <th className="px-4 py-3 text-right font-medium">التاريخ</th>
                  <th className="px-4 py-3 text-right font-medium">الإجمالي</th>
                  <th className="px-4 py-3 text-right font-medium">غياب</th>
                  <th className="px-4 py-3 text-right font-medium">جزئي</th>
                  <th className="px-4 py-3 text-right font-medium">بصمة ناقصة</th>
                  <th className="px-4 py-3 text-right font-medium">On Call</th>
                  <th className="px-4 py-3 text-right font-medium">أرشفه</th>
                  <th className="px-4 py-3 text-right font-medium w-1"></th>
                </tr>
              </thead>
              <tbody>
                {items.map((row) => (
                  <tr key={row.id} className="border-t border-white/5 hover:bg-white/[0.02]">
                    <td className="px-4 py-3 tabular-nums">
                      {fmtDate(row.archiveDate)}
                    </td>
                    <td className="px-4 py-3 tabular-nums">
                      {toArabicIndic(row.totalEmployees)}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-rose-300/90">
                      {toArabicIndic(row.summary.totals.absent)}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-amber-300/90">
                      {toArabicIndic(row.summary.totals.partial)}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-amber-300/90">
                      {toArabicIndic(
                        row.summary.totals.missingCheckout + row.summary.totals.missingCheckin,
                      )}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-sky-300/90">
                      {toArabicIndic(row.summary.totals.onCall)}
                    </td>
                    <td className="px-4 py-3 text-gray-300 text-xs">
                      {row.archivedByName}
                    </td>
                    <td className="px-4 py-3 text-left">
                      <Link
                        href={`/attendance/archive/${row.id}`}
                        className="inline-flex items-center gap-1.5 rounded-md bg-white/5 border border-white/10 px-3 py-1.5 text-xs text-gray-200 hover:bg-white/10"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        عرض
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {!loading && !error && items.length > 0 && (
        <div className="flex items-center justify-between text-xs text-gray-400">
          <span>
            صفحة {toArabicIndic(page)} من {toArabicIndic(totalPages)} · {toArabicIndic(total)} كشف
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="rounded-md bg-white/5 border border-white/10 px-3 py-1.5 text-gray-200 hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              السابق
            </button>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="rounded-md bg-white/5 border border-white/10 px-3 py-1.5 text-gray-200 hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              التالي
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Subcomponents ────────────────────────────────────────────────────

function DateInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="block text-xs text-gray-400 mb-1.5">{label}</label>
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-brand-400/50"
      />
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────

function fmtDate(yyyyMmDd: string): string {
  // Reuse the platform's Arabic-Indic digits for the date label.
  return toArabicIndic(yyyyMmDd.replace(/-/g, '/').split('/').reverse().join('/'));
}

const ARABIC_INDIC_DIGITS = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
function toArabicIndic(value: number | string): string {
  return String(value).replace(/[0-9]/g, (d) => ARABIC_INDIC_DIGITS[Number(d)]);
}
