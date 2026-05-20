'use client';

/**
 * Track-ranking archive viewer for the executive dashboard.
 *
 * Shows the archived "أفضل ٣ مسارات أداءً" cards exactly as they appeared,
 * with a Daily / Weekly toggle. Each snapshot renders in the same shape
 * as the live card (rank + name + headline % + leader + report count),
 * so the archive feels continuous with the dashboard. Read-only.
 */

import { useCallback, useEffect, useState } from 'react';
import { performanceApi } from '@/lib/api';

type Period = 'DAILY' | 'WEEKLY';

interface ArchiveTrack {
  trackId: string;
  trackNameAr: string;
  leaderNameAr: string | null;
  rank: number;
  qualityPercent: number;
  reportCount: number;
}

interface ArchiveSnapshot {
  period: Period;
  snapshotDate: string;
  weekEndDate: string | null;
  tracks: ArchiveTrack[];
}

const medals = ['🥇', '🥈', '🥉'];

export function TrackRankingArchive() {
  const [period, setPeriod] = useState<Period>('DAILY');
  const [snapshots, setSnapshots] = useState<ArchiveSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (p: Period) => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await performanceApi.rankingArchive(p);
      setSnapshots(data.snapshots ?? []);
    } catch (e: any) {
      const status = e?.response?.status;
      setError(
        status === 403
          ? 'ليس لديك صلاحية لعرض الأرشيف.'
          : 'تعذّر تحميل أرشيف الترتيب.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(period);
  }, [period, load]);

  return (
    <section className="glass p-5 flex flex-col gap-4" dir="rtl">
      <header className="flex items-center justify-between gap-2 flex-wrap">
        <h3 className="text-base font-semibold text-white flex items-center gap-2">
          <span>🗂️</span> أرشيف ترتيب المسارات
        </h3>
        <div className="inline-flex rounded-lg border border-white/10 overflow-hidden text-xs">
          <button
            type="button"
            onClick={() => setPeriod('DAILY')}
            className={`px-3 py-1.5 transition-colors ${period === 'DAILY' ? 'bg-amber-500/25 text-amber-200' : 'text-gray-400 hover:bg-white/5'}`}
          >
            يومي
          </button>
          <button
            type="button"
            onClick={() => setPeriod('WEEKLY')}
            className={`px-3 py-1.5 transition-colors ${period === 'WEEKLY' ? 'bg-amber-500/25 text-amber-200' : 'text-gray-400 hover:bg-white/5'}`}
          >
            أسبوعي
          </button>
        </div>
      </header>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="rounded-xl bg-white/[0.03] border border-white/5 h-44 animate-pulse" />
          ))}
        </div>
      ) : error ? (
        <p className="text-sm text-rose-300">{error}</p>
      ) : snapshots.length === 0 ? (
        <p className="text-sm text-gray-500 py-6 text-center">
          لا توجد لقطات مؤرشفة بعد. تُحفظ تلقائياً عند منتصف الليل بتوقيت مكة.
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {snapshots.map((snap) => (
            <article
              key={`${snap.period}-${snap.snapshotDate}`}
              className="rounded-xl border border-white/10 bg-white/[0.02] p-4 flex flex-col gap-3"
            >
              <header className="flex items-center justify-between">
                <span className="text-xs text-gray-400">
                  {period === 'WEEKLY' ? 'أسبوع' : 'يوم'}
                </span>
                <span className="text-[11px] text-amber-300/90 tabular-nums">
                  {period === 'WEEKLY' && snap.weekEndDate
                    ? `${fmtDate(snap.snapshotDate)} — ${fmtDate(snap.weekEndDate)}`
                    : fmtDate(snap.snapshotDate)}
                </span>
              </header>
              <ol className="flex flex-col gap-2">
                {snap.tracks.map((t, i) => (
                  <li key={t.trackId} className="flex flex-col gap-1">
                    <div className="flex items-baseline justify-between">
                      <span className="text-sm font-medium text-white flex items-center gap-1.5">
                        <span>{medals[i] ?? '•'}</span>
                        <span>{t.rank}. {t.trackNameAr}</span>
                      </span>
                      <span className="text-sm font-semibold text-amber-300 tabular-nums">
                        {fmtPct(t.qualityPercent)}
                      </span>
                    </div>
                    <div className="text-[11px] text-gray-400 flex flex-wrap gap-x-3">
                      {t.leaderNameAr && <span>👤 {t.leaderNameAr}</span>}
                      <span>📄 {toArabicIndic(t.reportCount)} تقرير</span>
                    </div>
                  </li>
                ))}
              </ol>
            </article>
          ))}
        </div>
      )}

      <footer className="text-[10px] text-gray-500 pt-2 border-t border-white/5">
        لقطات لترتيب المسارات كما ظهر في اللوحة — تُحفظ يومياً وأسبوعياً بتوقيت مكة المكرمة. للقراءة فقط.
      </footer>
    </section>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────

const fmtPct = (n: number) => `${toArabicIndic(n.toFixed(1))}%`;

const ARABIC_INDIC_DIGITS = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
function toArabicIndic(value: number | string): string {
  return String(value).replace(/[0-9]/g, (d) => ARABIC_INDIC_DIGITS[Number(d)]);
}

function fmtDate(yyyyMmDd: string): string {
  return toArabicIndic(yyyyMmDd.slice(0, 10).split('-').reverse().join('/'));
}
