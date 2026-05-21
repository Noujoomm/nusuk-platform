'use client';

import {
  ListChecks, CheckCircle, TrendingUp, FileBarChart,
  CalendarCheck, Users, Paperclip, AlertTriangle,
} from 'lucide-react';
import { cn, formatNumber, formatPercent } from '@/lib/utils';
import { StaggerContainer, StaggerItem } from '@/components/motion/Stagger';
import { CountUp } from '@/components/motion/CountUp';
import type { Analytics } from './types';

function StatCard({ label, value, countUp, format, icon: Icon, color, bg, subtitle, accent }: {
  label: string;
  /** Static fallback (used when `countUp` is not provided). */
  value?: string | number;
  /** Raw number to animate up. Takes precedence over `value`. */
  countUp?: number;
  /** Formats the animated number (e.g. formatNumber / formatPercent). */
  format?: (n: number) => string;
  icon: React.ElementType;
  color: string; bg: string; subtitle?: string; accent?: string;
}) {
  return (
    // The card IS the stagger item — entrance animation, no extra nesting.
    <StaggerItem className="analytics-card group" style={accent ? { borderBottom: `2px solid ${accent}` } : undefined}>
      <div className="flex items-center gap-3">
        <div className={cn('p-2.5 rounded-xl transition-transform group-hover:scale-110', bg)}>
          <Icon className={cn('w-5 h-5', color)} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xl font-bold truncate tabular-nums">
            {countUp != null ? <CountUp value={countUp} format={format} /> : value}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">{label}</p>
          {subtitle && <p className="text-[10px] text-gray-500 mt-0.5">{subtitle}</p>}
        </div>
      </div>
    </StaggerItem>
  );
}

export default function DashboardCards({ data }: { data: Analytics }) {
  const p = data.performance;
  return (
    <StaggerContainer className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-8 gap-3">
      <StatCard label="إجمالي المهام" countUp={p.total_tasks} format={formatNumber}
        icon={ListChecks} color="text-blue-400" bg="bg-blue-500/20" accent="#3b82f6" />
      <StatCard label="المهام المكتملة" countUp={p.completed_tasks} format={formatNumber}
        icon={CheckCircle} color="text-emerald-400" bg="bg-emerald-500/20" accent="#10b981" />
      <StatCard label="نسبة الإنجاز" countUp={p.task_completion_rate} format={formatPercent}
        icon={TrendingUp} color="text-brand-400" bg="bg-brand-500/20" accent="#0D47A1" />
      <StatCard label="مهام متأخرة" countUp={p.overdue_tasks} format={formatNumber}
        icon={AlertTriangle} color="text-red-400" bg="bg-red-500/20" accent="#ef4444" />
      <StatCard label="التقارير" countUp={data.reports.total_reports} format={formatNumber}
        icon={FileBarChart} color="text-sky-400" bg="bg-sky-500/20" accent="#0ea5e9" />
      <StatCard label="التحديثات اليومية" countUp={data.summary.total_daily_updates} format={formatNumber}
        icon={CalendarCheck} color="text-violet-400" bg="bg-violet-500/20" accent="#8b5cf6" />
      <StatCard label="المستخدمون النشطون" countUp={p.active_users} format={formatNumber}
        icon={Users} color="text-amber-400" bg="bg-amber-500/20"
        subtitle={`من ${formatNumber(p.total_users)}`} accent="#f59e0b" />
      <StatCard label="المرفقات" countUp={data.summary.total_files} format={formatNumber}
        icon={Paperclip} color="text-teal-400" bg="bg-teal-500/20" accent="#14b8a6" />
    </StaggerContainer>
  );
}
