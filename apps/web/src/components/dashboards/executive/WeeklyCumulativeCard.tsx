'use client';

/**
 * Weekly cumulative track leaderboard (Sun→Sat in Asia/Riyadh).
 *
 * Polls /api/dashboard/weekly-cumulative/top-three every 60s. The number
 * itself updates much faster on the backend (per-minute cron writes the
 * row), so this poll cadence is enough to keep the widget within ~1
 * minute of the truth without being chatty. The page-visible / page-
 * hidden gate skips polls while the tab is in the background to avoid
 * waking the API when nobody's watching.
 */

import { useEffect, useRef, useState } from 'react';
import { weeklyCumulativeApi } from '@/lib/api';

const POLL_MS = 60_000;

interface WeeklyTopTrack {
  rank: number;
  trackId: string;
  trackName: string;
  leaderName: string | null;
  cumulativeScore: number;
  reportQualityScore: number;
  leaderEngagementScore: number;
  daysContributed: number;
}

interface WeeklyCumulativeResponse {
  weekStartDate: string;
  weekEndDate: string;
  currentDayInWeek: string;
  daysElapsedInWeek: number;
  lastUpdatedAt: string | null;
  topTracks: WeeklyTopTrack[];
}

const fmtRiyadhDate = (yyyyMmDd: string): string => {
  const [y, m, d] = yyyyMmDd.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return new Intl.DateTimeFormat('ar-SA-u-ca-gregory', {
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  }).format(date);
};

const fmtUpdated = (iso: string | null): string => {
  if (!iso) return 'لم يُحدَّث بعد';
  try {
    return new Intl.DateTimeFormat('ar-SA', {
      hour: 'numeric',
      minute: '2-digit',
      timeZone: 'Asia/Riyadh',
    }).format(new Date(iso));
  } catch {
    return '';
  }
};

const medals = ['🥇', '🥈', '🥉'];

export function WeeklyCumulativeCard() {
  const [data, setData] = useState<WeeklyCumulativeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const visibleRef = useRef(
    typeof document === 'undefined' ? true : !document.hidden,
  );

  useEffect(() => {
    let cancelled = false;

    const fetchOnce = async () => {
      try {
        const r = await weeklyCumulativeApi.topThree();
        if (cancelled) return;
        setData(r.data as WeeklyCumulativeResponse);
        setError(null);
      } catch (e: any) {
        if (cancelled) return;
        const status = e?.response?.status;
        setError(
          status === 401 ? 'انتهت الجلسة — أعد تسجيل الدخول.' :
          status === 403 ? 'ليس لديك صلاحية لعرض الترتيب التراكمي.' :
          'تعذّر تحميل الترتيب التراكمي.',
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchOnce();
    const interval = window.setInterval(() => {
      if (visibleRef.current) fetchOnce();
    }, POLL_MS);

    const onVisibility = () => {
      visibleRef.current = !document.hidden;
      // Refresh immediately on tab return so a backgrounded tab doesn't
      // stay stale until its next scheduled poll.
      if (!document.hidden) fetchOnce();
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  if (loading) {
    return <section className="glass p-5 animate-pulse h-56" />;
  }
  if (error || !data) {
    return (
      <section className="glass p-5 border border-red-500/30 text-red-300 text-sm">
        {error ?? 'لا توجد بيانات للأسبوع.'}
      </section>
    );
  }

  return (
    <section className="glass p-5 flex flex-col gap-3" dir="rtl">
      <header className="flex items-center justify-between gap-2 flex-wrap">
        <h3 className="text-base font-semibold text-white flex items-center gap-2">
          <span>🏆</span> أفضل ٣ مسارات تراكمياً (الأسبوع الحالي)
        </h3>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 text-[10px] text-emerald-300/90">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
            </span>
            مباشر
          </span>
          <span className="text-[10px] text-amber-300/80">تراكمي أسبوعي</span>
        </div>
      </header>

      <p className="text-[11px] text-gray-400 -mt-1">
        مجموع (جودة التقارير + تفاعل القائد) من الأحد للسبت.
        الأسبوع: من {fmtRiyadhDate(data.weekStartDate)} إلى {fmtRiyadhDate(data.weekEndDate)}
        {data.currentDayInWeek && <> • اليوم: {data.currentDayInWeek}</>}
      </p>

      {data.topTracks.length === 0 && (
        <p className="text-sm text-gray-500 mt-4">
          لم يبدأ التنافس التراكمي بعد. ستظهر النتائج فور تسجيل أول تقرير.
        </p>
      )}

      <ol className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-1">
        {data.topTracks.map((t, i) => (
          <li
            key={t.trackId}
            className="flex flex-col gap-1.5 rounded-lg border border-white/5 bg-white/[0.02] p-3"
          >
            <div className="flex items-baseline justify-between">
              <span className="text-sm font-medium text-white flex items-center gap-1.5">
                <span>{medals[i] ?? '•'}</span>
                <span>{t.rank}. {t.trackName}</span>
              </span>
              <span className="text-base font-semibold text-amber-300 tabular-nums">
                {t.cumulativeScore.toFixed(1)}
              </span>
            </div>
            {t.leaderName && (
              <div className="text-[11px] text-gray-300 flex items-center gap-1">
                <span>👤 القائد:</span>
                <span className="text-white/90 truncate">{t.leaderName}</span>
              </div>
            )}
            <div className="text-[11px] text-gray-400 flex flex-wrap gap-x-3 gap-y-0.5">
              <span>📊 جودة تراكمية: {t.reportQualityScore.toFixed(1)}</span>
              <span>💬 تفاعل تراكمي: {t.leaderEngagementScore.toFixed(1)}</span>
            </div>
            <div className="text-[11px] text-gray-500">
              ساهم في {t.daysContributed} يوم من {data.daysElapsedInWeek}
            </div>
          </li>
        ))}
      </ol>

      <footer className="text-[10px] text-gray-500 mt-2 pt-2 border-t border-white/5 flex items-center justify-between gap-2 flex-wrap">
        <span>⏰ يُحدَّث كل دقيقة بتوقيت مكة المكرمة • يُصفَّر يوم الأحد</span>
        {data.lastUpdatedAt && (
          <span>آخر تحديث: {fmtUpdated(data.lastUpdatedAt)}</span>
        )}
      </footer>
    </section>
  );
}
