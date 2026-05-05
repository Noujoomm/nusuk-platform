'use client';

/**
 * Top 3 Data Entry Performers by Report Quality
 *
 * Platform-wide (across all tracks) ranking of users by the AVG quality
 * of the reports they authored today. Mirrors the visual style of the
 * sibling card `BestEmployeesCard` exactly — same glass background,
 * same paddings/typography, same green "حسب الجودة" tag, same row
 * layout. Uses the existing /api/analytics/top-data-entry-performers
 * endpoint, which reuses the per-report calculateReportQuality
 * function so the metric is 1:1 consistent across both cards.
 */

import { useEffect, useState } from 'react';
import { analyticsApi } from '@/lib/api';

interface Performer {
  rank: number;
  userId: string;
  userName: string;
  qualityScore: number;
  reportCount: number;
}

const RANK_LABELS = ['المركز الأول:', 'المركز الثاني:', 'المركز الثالث:'];

export function TopDataEntryPerformersCard() {
  const [performers, setPerformers] = useState<Performer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    analyticsApi
      .topDataEntryPerformers('daily')
      .then((r) => {
        if (cancelled) return;
        setPerformers(r.data?.performers ?? []);
      })
      .catch((e) => {
        if (cancelled) return;
        // eslint-disable-next-line no-console
        console.error('[performance] topDataEntryPerformers failed', e);
        const status = e?.response?.status;
        setError(
          status === 401 ? 'انتهت الجلسة — أعد تسجيل الدخول.' :
          status === 403 ? 'ليس لديك صلاحية لعرض هذا التقرير.' :
          'تعذّر تحميل أفضل المدخلين.',
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return <section className="glass p-5 h-72 animate-pulse" />;
  }

  if (error) {
    return (
      <section className="glass p-5 border border-red-500/30 text-red-300 text-sm">
        {error}
      </section>
    );
  }

  // Build 3 fixed slots so empty positions render placeholders and the
  // card height matches the sibling whether or not we have data.
  const slots: Array<Performer | null> = [
    performers[0] ?? null,
    performers[1] ?? null,
    performers[2] ?? null,
  ];

  return (
    <section className="glass p-5 flex flex-col gap-3" dir="rtl">
      <header className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-white flex items-center gap-2">
          <span>⭐</span> أفضل ٣ مدخلين بيانات في التقارير (حسب جودة التقرير)
        </h3>
        <span className="text-[10px] text-emerald-300/80">حسب الجودة</span>
      </header>
      <p className="text-[11px] text-gray-400 -mt-1">
        بناءً على متوسط جودة التقارير
      </p>

      <ul className="flex flex-col gap-2 mt-1">
        {slots.map((p, i) => (
          <li
            key={i}
            className="flex items-center justify-between gap-2 text-sm"
          >
            <span className="text-gray-400 truncate max-w-[40%]">
              {RANK_LABELS[i]}
            </span>
            {p ? (
              <span className="text-white/90 flex items-center gap-1.5">
                <span
                  className="truncate max-w-[140px]"
                  title={p.userName}
                >
                  {p.userName}
                </span>
                <span className="text-[11px] text-emerald-300">
                  جودة {Math.round(p.qualityScore)}%
                </span>
              </span>
            ) : (
              <span className="text-[11px] text-gray-500">لا يوجد موظفون</span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
