'use client';

/**
 * Quality-First track performance cards for the executive dashboard.
 *
 * Three cards in one file (they share data + a single API fetch):
 *   1. Top 3 Tracks    — quality-weighted (60%) + lead engagement (40%)
 *   2. Top 3 Engaging  — avg engagement per member (member-fairness)
 *   3. Best Employee   — per track, by report quality (no engagement-only winners)
 *
 * Live numbers come from /api/performance/today; the cards visibly reset
 * at 00:00 Asia/Riyadh and rebuild as the day progresses. Arabic-first
 * RTL, dark theme, no third-party UI deps beyond the project's shared
 * shadcn-style classes.
 */

import { useEffect, useState } from 'react';
import { performanceApi } from '@/lib/api';
import { TopDataEntryPerformersCard } from './TopDataEntryPerformersCard';
import { WeeklyCumulativeCard } from './WeeklyCumulativeCard';

// ─── Types mirror the controller response ───────────────────────────
interface TrackTop {
  rank: number;
  trackId: string;
  trackName: string;
  trackLead: { id: string; name: string; avatar: string | null } | null;
  finalScore: number;
  breakdown: {
    avgReportQuality: { score: number; weight: number; contribution: number };
    trackLeadEngagement: { score: number; weight: number; contribution: number };
  };
  metrics: {
    reportsCount: number;
    validReportsCount: number;
    avgReportQuality: number;
    leadEngagementActions: number;
    qualityDistribution: { excellent: number; good: number; fair: number; poor: number };
  };
  zeroReason: string | null;
}

interface TrackEngaging {
  rank: number;
  trackId: string;
  trackName: string;
  engagementScore: number;
  totalEngagementActions: number;
  membersCount: number;
  avgPerMember: number;
}

interface BestEmployee {
  trackId: string;
  trackName: string;
  bestEmployee: {
    id: string;
    name: string;
    avatar: string | null;
    reportsCount: number;
    avgReportQuality: number;
    engagementScore: number;
    finalScore: number;
  } | null;
  reason?: 'NO_EMPLOYEES' | 'NO_VALID_REPORTS';
}

interface PerformanceData {
  date: string;
  timezone: 'Asia/Riyadh';
  topTracks: TrackTop[];
  topEngagingTracks: TrackEngaging[];
  bestEmployeesPerTrack: BestEmployee[];
}

// ─── Helpers ────────────────────────────────────────────────────────
const qualityCountsLabel = (d: TrackTop['metrics']['qualityDistribution']): string => {
  const parts: string[] = [];
  if (d.excellent) parts.push(`${d.excellent} ممتاز`);
  if (d.good) parts.push(`${d.good} جيد`);
  if (d.fair) parts.push(`${d.fair} مقبول`);
  if (d.poor) parts.push(`${d.poor} ضعيف`);
  return parts.length ? `(${parts.join('، ')})` : '';
};

const fmtPct = (n: number) => `${n.toFixed(1)}%`;

// ─── Public component ──────────────────────────────────────────────
export function QualityFirstCards() {
  const [data, setData] = useState<PerformanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    performanceApi
      .today()
      .then((r) => {
        if (cancelled) return;
        setData(r.data as PerformanceData);
      })
      .catch((e) => {
        if (cancelled) return;
        // eslint-disable-next-line no-console
        console.error('[performance] today failed', e);
        const status = e?.response?.status;
        setError(
          status === 401 ? 'انتهت الجلسة — أعد تسجيل الدخول.' :
          status === 403 ? 'ليس لديك صلاحية لعرض الأداء.' :
          'تعذّر تحميل أداء المسارات. حاول مرة أخرى.',
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
    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="glass p-5 animate-pulse h-72" />
        ))}
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="glass p-5 border border-red-500/30 text-red-300 text-sm">
        {error ?? 'لا توجد بيانات أداء لليوم.'}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4" dir="rtl">
      <TopTracksCard tracks={data.topTracks} />
      <TopEngagingCard tracks={data.topEngagingTracks} />
      <BestEmployeesCard rows={data.bestEmployeesPerTrack} />
      {/* Wraps to a second row on lg+. On mobile/sm, each card stacks
          vertically. The new card visually pairs with BestEmployees
          (both rank individuals by report quality). */}
      <TopDataEntryPerformersCard />
      {/* Weekly cumulative spans the full row on lg+ — its rows carry
          more per-track detail (cumulative + breakdown + days), so the
          extra width pays off. */}
      <div className="lg:col-span-3">
        <WeeklyCumulativeCard />
      </div>
    </div>
  );
}

// ─── Card 1: Top 3 Tracks (quality-first) ──────────────────────────
function TopTracksCard({ tracks }: { tracks: TrackTop[] }) {
  return (
    <section className="glass p-5 flex flex-col gap-3">
      <header className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-white flex items-center gap-2">
          <span>🏆</span> أفضل ٣ مسارات أداءً (يومي)
        </h3>
        <span className="text-[10px] text-amber-300/80">الجودة أولاً</span>
      </header>
      <p className="text-[11px] text-gray-400 -mt-1">
        التركيز على جودة كل تقرير، لا على عدد التقارير.
      </p>

      {tracks.length === 0 && (
        <p className="text-sm text-gray-500 mt-4">لا توجد بيانات لليوم بعد.</p>
      )}

      <ol className="flex flex-col gap-3 mt-1">
        {tracks.map((t) => (
          <li key={t.trackId} className="flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between">
              <span className="text-sm font-medium text-white">
                {t.rank}. {t.trackName}
              </span>
              <span className="text-sm font-semibold text-amber-300">
                {fmtPct(t.finalScore)}
              </span>
            </div>
            {t.trackLead && (
              <div className="text-[11px] text-gray-300 flex items-center gap-1">
                <span>👤 القائد:</span>
                <span className="text-white/90">{t.trackLead.name}</span>
              </div>
            )}
            <div className="text-[11px] text-gray-400 flex flex-wrap gap-x-3 gap-y-0.5">
              <span>⭐ جودة التقارير: {fmtPct(t.breakdown.avgReportQuality.score)}</span>
              <span>💬 تفاعل القائد: {fmtPct(t.breakdown.trackLeadEngagement.score)}</span>
            </div>
            {/* v2.5: lead with the actual numeric average instead of
                the old fixed-bucket label ("1 جيد، 1 مقبول"). The
                continuous score makes the average meaningful — two
                tracks with different work no longer collapse onto the
                same phrase. The bucket counts stay as a faint trailing
                detail (still real signal, just no longer the headline). */}
            <div className="text-[11px] text-gray-500">
              📄 {t.metrics.validReportsCount} تقرير · متوسط الجودة{' '}
              <span className="text-gray-300">{fmtPct(t.metrics.avgReportQuality)}</span>
              {qualityCountsLabel(t.metrics.qualityDistribution) && (
                <span className="text-gray-600"> {qualityCountsLabel(t.metrics.qualityDistribution)}</span>
              )}
            </div>
            <div className="h-1 rounded-full bg-white/5 overflow-hidden mt-1">
              <div
                className="h-full bg-gradient-to-l from-amber-400 to-amber-300"
                style={{ width: `${Math.min(100, t.finalScore)}%` }}
              />
            </div>
          </li>
        ))}
      </ol>

      <footer className="text-[10px] text-gray-500 mt-2 pt-2 border-t border-white/5">
        ⏰ يُصفَّر يومياً عند منتصف الليل بتوقيت مكة المكرمة.
      </footer>
    </section>
  );
}

// ─── Card 2: Top 3 Engaging Tracks ─────────────────────────────────
function TopEngagingCard({ tracks }: { tracks: TrackEngaging[] }) {
  const medals = ['🥇', '🥈', '🥉'];
  return (
    <section className="glass p-5 flex flex-col gap-3">
      <header className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-white flex items-center gap-2">
          <span>💬</span> أفضل ٣ مسارات تفاعلاً (يومي)
        </h3>
        <span className="text-[10px] text-violet-300/80">متوسط لكل عضو</span>
      </header>

      {tracks.length === 0 && (
        <p className="text-sm text-gray-500 mt-4">لا تفاعل اليوم بعد.</p>
      )}

      <ul className="flex flex-col gap-2.5 mt-1">
        {tracks.map((t, i) => (
          <li key={t.trackId} className="flex items-center justify-between gap-2">
            <span className="text-sm text-white/90 flex items-center gap-2">
              <span>{medals[i] ?? '•'}</span>
              <span>{t.trackName}</span>
            </span>
            <span className="text-[11px] text-gray-400 whitespace-nowrap">
              {t.totalEngagementActions} إجراء (متوسط {t.avgPerMember.toFixed(2)}/عضو)
            </span>
          </li>
        ))}
      </ul>

      <footer className="text-[10px] text-gray-500 mt-auto pt-2 border-t border-white/5">
        الترتيب على متوسط التفاعل لكل عضو لعدالة المسارات بأحجام مختلفة.
      </footer>
    </section>
  );
}

// ─── Card 3: Best Employee Per Track ───────────────────────────────
function BestEmployeesCard({ rows }: { rows: BestEmployee[] }) {
  return (
    <section className="glass p-5 flex flex-col gap-3">
      <header className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-white flex items-center gap-2">
          <span>⭐</span> أفضل موظف في كل مسار (يومي)
        </h3>
        <span className="text-[10px] text-emerald-300/80">حسب الجودة</span>
      </header>
      <p className="text-[11px] text-gray-400 -mt-1">
        بناءً على متوسط جودة التقارير، لا عددها.
      </p>

      {rows.length === 0 && (
        <p className="text-sm text-gray-500 mt-4">لا توجد مسارات نشطة اليوم.</p>
      )}

      <ul className="flex flex-col gap-2 mt-1">
        {rows.map((r) => (
          <li key={r.trackId} className="flex items-center justify-between gap-2 text-sm">
            <span className="text-gray-400 truncate max-w-[55%]" title={r.trackName}>
              {r.trackName}:
            </span>
            {r.bestEmployee ? (
              <span className="text-white/90 flex items-center gap-1.5">
                <span className="truncate max-w-[140px]" title={r.bestEmployee.name}>
                  {r.bestEmployee.name}
                </span>
                <span className="text-[11px] text-emerald-300">
                  جودة {Math.round(r.bestEmployee.avgReportQuality)}%
                </span>
              </span>
            ) : (
              <span className="text-[11px] text-gray-500">
                {r.reason === 'NO_EMPLOYEES'
                  ? 'لا يوجد موظفون'
                  : 'لم يُحدَّد بعد'}
              </span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
