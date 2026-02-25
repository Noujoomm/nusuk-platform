'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/stores/auth';
import { tracksApi, tasksApi, kpisApi } from '@/lib/api';
import { cn, formatDate, formatNumber, TASK_STATUS_LABELS, TASK_STATUS_COLORS } from '@/lib/utils';
import {
  GitBranch,
  FileText,
  Users,
  Target,
  CheckSquare,
  Clock,
  TrendingUp,
  Activity,
  BarChart3,
} from 'lucide-react';
import Link from 'next/link';

interface Track {
  id: string;
  name: string;
  nameAr: string;
  color: string;
  _count: { records: number; employees: number; deliverables: number };
}

interface KPIStat {
  id: string;
  name: string;
  nameAr: string;
  target: number;
  current: number;
  unit: string;
  trackId: string;
}

export default function TrackLeadDashboard() {
  const { user } = useAuth();
  const [tracks, setTracks] = useState<Track[]>([]);
  const [trackTasks, setTrackTasks] = useState<Record<string, any[]>>({});
  const [kpiStats, setKpiStats] = useState<KPIStat[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        // Get tracks the user has permissions on
        const userTrackIds = user?.trackPermissions?.map((tp) => tp.trackId) || [];

        const [tracksRes] = await Promise.all([
          tracksApi.list(),
        ]);

        // Filter tracks to those the user leads
        const userTracks = userTrackIds.length > 0
          ? tracksRes.data.filter((t: Track) => userTrackIds.includes(t.id))
          : tracksRes.data;

        setTracks(userTracks);

        // Fetch tasks and KPIs for each track in parallel
        const [taskResults, kpiResults] = await Promise.all([
          Promise.all(
            userTracks.map(async (t: Track) => {
              try {
                const { data } = await tasksApi.byTrack(t.id);
                return { trackId: t.id, tasks: data.data || [] };
              } catch {
                return { trackId: t.id, tasks: [] };
              }
            })
          ),
          Promise.all(
            userTracks.map(async (t: Track) => {
              try {
                const { data } = await kpisApi.stats(t.id);
                return data.data || data || [];
              } catch {
                return [];
              }
            })
          ),
        ]);

        const tasksMap: Record<string, any[]> = {};
        taskResults.forEach((r) => { tasksMap[r.trackId] = r.tasks; });
        setTrackTasks(tasksMap);

        const allKpis = kpiResults.flat().filter(Boolean);
        setKpiStats(allKpis);
      } catch {}
      setLoading(false);
    };

    loadData();
  }, [user]);

  // Aggregate all tasks across tracks
  const allTasks = Object.values(trackTasks).flat();
  const recentTasks = [...allTasks]
    .sort((a, b) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime())
    .slice(0, 8);

  // Team task summary
  const teamPending = allTasks.filter((t) => t.status === 'pending').length;
  const teamInProgress = allTasks.filter((t) => t.status === 'in_progress').length;
  const teamCompleted = allTasks.filter((t) => t.status === 'completed').length;
  const teamOverdue = allTasks.filter(
    (t) => t.dueDate && new Date(t.dueDate) < new Date() && t.status !== 'completed'
  ).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Greeting */}
      <div>
        <h1 className="text-2xl font-bold">مرحبا {user?.nameAr || user?.name}</h1>
        <p className="text-gray-400 mt-1">نظرة عامة على مساراتك وفريقك</p>
      </div>

      {/* Track Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {tracks.map((track) => {
          const tasks = trackTasks[track.id] || [];
          const completed = tasks.filter((t) => t.status === 'completed').length;
          const total = tasks.length;
          const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
          return (
            <Link key={track.id} href={`/tracks/${track.id}`}>
              <div className="glass rounded-2xl border border-white/10 p-5 hover:bg-white/[0.03] transition-colors">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: track.color }} />
                  <h3 className="font-semibold truncate">{track.nameAr}</h3>
                </div>

                <div className="grid grid-cols-3 gap-2 mb-4 text-center">
                  <div className="bg-white/5 rounded-lg p-2">
                    <p className="text-lg font-bold text-blue-400">{formatNumber(track._count?.records || 0)}</p>
                    <p className="text-[10px] text-gray-500">سجل</p>
                  </div>
                  <div className="bg-white/5 rounded-lg p-2">
                    <p className="text-lg font-bold text-violet-400">{formatNumber(track._count?.employees || 0)}</p>
                    <p className="text-[10px] text-gray-500">موظف</p>
                  </div>
                  <div className="bg-white/5 rounded-lg p-2">
                    <p className="text-lg font-bold text-cyan-400">{formatNumber(track._count?.deliverables || 0)}</p>
                    <p className="text-[10px] text-gray-500">مخرج</p>
                  </div>
                </div>

                {/* Completion progress */}
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-xs text-gray-400">{pct}%</span>
                </div>
              </div>
            </Link>
          );
        })}
        {tracks.length === 0 && (
          <div className="col-span-full glass rounded-2xl border border-white/10 p-8 text-center text-gray-500">
            <GitBranch className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p>لا توجد مسارات مسندة إليك</p>
          </div>
        )}
      </div>

      {/* Team Tasks Summary */}
      <div className="glass rounded-2xl border border-white/10 p-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <CheckSquare className="w-5 h-5 text-brand-400" />
          ملخص مهام الفريق
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'قيد الانتظار', value: teamPending, color: 'text-gray-300', bg: 'bg-gray-500/20' },
            { label: 'قيد التنفيذ', value: teamInProgress, color: 'text-amber-300', bg: 'bg-amber-500/20' },
            { label: 'مكتملة', value: teamCompleted, color: 'text-emerald-300', bg: 'bg-emerald-500/20' },
            { label: 'متأخرة', value: teamOverdue, color: 'text-red-300', bg: 'bg-red-500/20' },
          ].map((s) => (
            <div key={s.label} className={cn('rounded-xl p-4 text-center', s.bg)}>
              <p className={cn('text-2xl font-bold', s.color)}>{formatNumber(s.value)}</p>
              <p className="text-xs text-gray-400 mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* KPI Progress */}
      {kpiStats.length > 0 && (
        <div className="glass rounded-2xl border border-white/10 p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Target className="w-5 h-5 text-teal-400" />
            مؤشرات الاداء
          </h2>
          <div className="space-y-4">
            {kpiStats.slice(0, 6).map((kpi, i) => {
              const pct = kpi.target > 0 ? Math.min(Math.round((kpi.current / kpi.target) * 100), 100) : 0;
              return (
                <div key={kpi.id || i}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm font-medium">{kpi.nameAr || kpi.name}</span>
                    <span className="text-xs text-gray-400">
                      {formatNumber(kpi.current)} / {formatNumber(kpi.target)} {kpi.unit || ''}
                    </span>
                  </div>
                  <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className={cn(
                        'h-full rounded-full transition-all duration-500',
                        pct >= 80 ? 'bg-emerald-500' : pct >= 50 ? 'bg-amber-500' : 'bg-red-500'
                      )}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Recent Activity Feed */}
      <div className="glass rounded-2xl border border-white/10 p-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Activity className="w-5 h-5 text-violet-400" />
          النشاط الاخير
        </h2>
        {recentTasks.length > 0 ? (
          <div className="space-y-3">
            {recentTasks.map((task) => (
              <div
                key={task.id}
                className="flex items-center justify-between bg-white/5 rounded-xl p-3 hover:bg-white/[0.07] transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{task.titleAr || task.title}</p>
                  <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                    {task.track && (
                      <span className="flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: task.track.color }} />
                        {task.track.nameAr}
                      </span>
                    )}
                    {task.assignments?.[0]?.user && (
                      <span>{task.assignments[0].user.nameAr}</span>
                    )}
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatDate(task.updatedAt || task.createdAt)}
                    </span>
                  </div>
                </div>
                <span className={cn('text-xs px-2.5 py-1 rounded-full shrink-0', TASK_STATUS_COLORS[task.status] || 'bg-gray-500/20 text-gray-300')}>
                  {TASK_STATUS_LABELS[task.status] || task.status}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center text-gray-500 py-8">
            <Activity className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm">لا يوجد نشاط حديث</p>
          </div>
        )}
      </div>
    </div>
  );
}
