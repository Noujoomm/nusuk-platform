'use client';

import { useEffect, useState } from 'react';
import { progressApi, achievementsApi, tracksApi, employeesApi } from '@/lib/api';
import { cn, formatNumber, formatPercent, formatDate, SCOPE_STATUS_LABELS, SCOPE_STATUS_COLORS } from '@/lib/utils';
import { useAuth } from '@/stores/auth';
import {
  TrendingUp,
  Trophy,
  GitBranch,
  Users,
  Target,
  Plus,
  ChevronDown,
  ChevronUp,
  Star,
  BarChart3,
  Layers,
} from 'lucide-react';
import CrudModal, { FieldDef } from '@/components/crud-modal';

type Tab = 'global' | 'tracks' | 'employees' | 'entities';

interface TrackProgress {
  trackId: string;
  overall: number;
  breakdown: { tasks: number; reports: number; scopeBlocks: number; kpis: number };
}

interface Achievement {
  id: string;
  entityType: string;
  entityId: string;
  title: string;
  titleAr: string;
  description?: string;
  descriptionAr?: string;
  impactType?: string;
  createdAt: string;
}

interface Track {
  id: string;
  name: string;
  nameAr: string;
  color: string;
}

interface Employee {
  id: string;
  fullName: string;
  fullNameAr: string;
  positionAr?: string;
  track?: { id: string; nameAr: string; color: string };
}

export default function AchievementsProgressPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>('global');
  const [tracks, setTracks] = useState<Track[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [trackProgressList, setTrackProgressList] = useState<TrackProgress[]>([]);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [globalStats, setGlobalStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [achievementModalOpen, setAchievementModalOpen] = useState(false);
  const [expandedTrack, setExpandedTrack] = useState<string | null>(null);

  const canEdit = user?.role === 'admin' || user?.role === 'pm';

  useEffect(() => {
    const loadAll = async () => {
      setLoading(true);
      try {
        const [tracksRes, employeesRes, achievementsRes, statsRes] = await Promise.all([
          tracksApi.list().catch(() => ({ data: [] })),
          employeesApi.list({}).catch(() => ({ data: [] })),
          achievementsApi.list({ pageSize: 50 }).catch(() => ({ data: { data: [] } })),
          progressApi.globalStats().catch(() => ({ data: null })),
        ]);

        const trackList = tracksRes.data.data || tracksRes.data || [];
        setTracks(trackList);
        setEmployees(employeesRes.data.data || employeesRes.data || []);
        setAchievements(achievementsRes.data.data || achievementsRes.data || []);
        setGlobalStats(statsRes.data);

        // Fetch progress for each track
        const progressPromises = trackList.map((t: Track) =>
          progressApi.trackProgress(t.id).catch(() => ({ data: { trackId: t.id, overall: 0, breakdown: { tasks: 0, reports: 0, scopeBlocks: 0, kpis: 0 } } }))
        );
        const progressResults = await Promise.all(progressPromises);
        setTrackProgressList(progressResults.map((r: any) => r.data));
      } catch {}
      setLoading(false);
    };
    loadAll();
  }, []);

  const handleCreateAchievement = async (data: any) => {
    await achievementsApi.create(data);
    const res = await achievementsApi.list({ pageSize: 50 });
    setAchievements(res.data.data || res.data || []);
  };

  const achievementFields: FieldDef[] = [
    { name: 'title', label: 'العنوان بالإنجليزي', type: 'text', required: true },
    { name: 'titleAr', label: 'العنوان بالعربي', type: 'text', required: true },
    { name: 'entityType', label: 'نوع الكيان', type: 'select', required: true, options: [
      { value: 'track', label: 'مسار' },
      { value: 'employee', label: 'موظف' },
      { value: 'task', label: 'مهمة' },
      { value: 'scope_block', label: 'نطاق عمل' },
    ]},
    { name: 'entityId', label: 'معرف الكيان', type: 'text', required: true },
    { name: 'descriptionAr', label: 'الوصف', type: 'textarea' },
    { name: 'impactType', label: 'مستوى التأثير', type: 'select', options: [
      { value: 'high', label: 'تأثير عالي' },
      { value: 'medium', label: 'تأثير متوسط' },
      { value: 'low', label: 'تأثير منخفض' },
    ]},
  ];

  // Overall average progress across all tracks
  const overallProgress = trackProgressList.length > 0
    ? Math.round(trackProgressList.reduce((sum, t) => sum + t.overall, 0) / trackProgressList.length)
    : 0;

  const tabs: Array<{ key: Tab; label: string; icon: any }> = [
    { key: 'global', label: 'نظرة عامة', icon: BarChart3 },
    { key: 'tracks', label: 'حسب المسار', icon: GitBranch },
    { key: 'employees', label: 'حسب الموظف', icon: Users },
    { key: 'entities', label: 'الإنجازات', icon: Trophy },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">التقدم والإنجازات</h1>
          <p className="text-gray-400 mt-1">متابعة تقدم العمل والإنجازات عبر المنصة</p>
        </div>
        {canEdit && (
          <button
            onClick={() => setAchievementModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand-500/20 text-brand-300 text-sm font-medium hover:bg-brand-500/30 transition-colors"
          >
            <Plus className="w-4 h-4" />
            إضافة إنجاز
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              'flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all whitespace-nowrap',
              tab === t.key
                ? 'bg-brand-500/20 text-brand-300'
                : 'text-gray-400 hover:bg-white/5 hover:text-white'
            )}
          >
            <t.icon className="w-4 h-4" />
            {t.label}
          </button>
        ))}
      </div>

      {/* Global Overview Tab */}
      {tab === 'global' && (
        <div className="space-y-6">
          {/* Main Progress Ring */}
          <div className="glass rounded-2xl border border-white/10 p-8 flex flex-col items-center">
            <div className="relative w-40 h-40 mb-4">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 120 120">
                <circle cx="60" cy="60" r="54" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="8" />
                <circle
                  cx="60" cy="60" r="54" fill="none"
                  stroke="url(#progressGradient)" strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={`${(overallProgress / 100) * 339.3} 339.3`}
                />
                <defs>
                  <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#06b6d4" />
                    <stop offset="100%" stopColor="#8b5cf6" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-3xl font-bold">{overallProgress}%</span>
                <span className="text-xs text-gray-400">التقدم الكلي</span>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full mt-4">
              <div className="text-center">
                <p className="text-lg font-bold text-brand-300">{tracks.length}</p>
                <p className="text-xs text-gray-400">المسارات</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold text-emerald-300">{achievements.length}</p>
                <p className="text-xs text-gray-400">الإنجازات</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold text-amber-300">{employees.length}</p>
                <p className="text-xs text-gray-400">الموظفون</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold text-violet-300">{formatPercent(overallProgress)}</p>
                <p className="text-xs text-gray-400">متوسط التقدم</p>
              </div>
            </div>
          </div>

          {/* Track Progress Bars */}
          <div className="glass rounded-2xl border border-white/10 p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <GitBranch className="w-5 h-5 text-brand-400" />
              تقدم المسارات
            </h2>
            <div className="space-y-4">
              {tracks.map((track) => {
                const tp = trackProgressList.find((p) => p.trackId === track.id);
                const progress = tp?.overall || 0;
                return (
                  <div key={track.id}>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: track.color }} />
                        <span className="text-sm font-medium">{track.nameAr}</span>
                      </div>
                      <span className="text-sm font-bold" style={{ color: track.color }}>{formatPercent(progress)}</span>
                    </div>
                    <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${progress}%`, backgroundColor: track.color }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Recent Achievements */}
          <div className="glass rounded-2xl border border-white/10 p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Trophy className="w-5 h-5 text-amber-400" />
              أحدث الإنجازات
            </h2>
            {achievements.length > 0 ? (
              <div className="space-y-3">
                {achievements.slice(0, 5).map((a) => (
                  <div key={a.id} className="flex items-start gap-3 bg-white/5 rounded-xl p-4">
                    <div className="p-2 rounded-lg bg-amber-500/20 shrink-0">
                      <Star className="w-4 h-4 text-amber-400" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm">{a.titleAr || a.title}</p>
                      {a.descriptionAr && <p className="text-xs text-gray-400 mt-1">{a.descriptionAr}</p>}
                      <div className="flex items-center gap-3 mt-2">
                        <span className="text-xs text-gray-500">{a.entityType}</span>
                        {a.impactType && (
                          <span className={cn('text-xs px-2 py-0.5 rounded-full',
                            a.impactType === 'high' ? 'bg-emerald-500/20 text-emerald-300' :
                            a.impactType === 'medium' ? 'bg-amber-500/20 text-amber-300' :
                            'bg-gray-500/20 text-gray-300'
                          )}>
                            {a.impactType === 'high' ? 'تأثير عالي' : a.impactType === 'medium' ? 'تأثير متوسط' : 'تأثير منخفض'}
                          </span>
                        )}
                        <span className="text-xs text-gray-600">{formatDate(a.createdAt)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center text-gray-500 py-8">
                <Trophy className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm">لا توجد إنجازات مسجلة بعد</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* By Track Tab */}
      {tab === 'tracks' && (
        <div className="space-y-4">
          {tracks.map((track) => {
            const tp = trackProgressList.find((p) => p.trackId === track.id);
            const isExpanded = expandedTrack === track.id;
            const breakdown = tp?.breakdown || { tasks: 0, reports: 0, scopeBlocks: 0, kpis: 0 };
            const trackAchievements = achievements.filter((a) => a.entityType === 'track' && a.entityId === track.id);

            return (
              <div key={track.id} className="glass rounded-2xl border border-white/10 overflow-hidden">
                <button
                  onClick={() => setExpandedTrack(isExpanded ? null : track.id)}
                  className="w-full p-5 flex items-center justify-between hover:bg-white/5 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${track.color}20` }}>
                      <GitBranch className="w-5 h-5" style={{ color: track.color }} />
                    </div>
                    <div className="text-right">
                      <h3 className="font-semibold">{track.nameAr}</h3>
                      <p className="text-xs text-gray-400">التقدم: {formatPercent(tp?.overall || 0)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="w-32 h-2 bg-white/10 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${tp?.overall || 0}%`, backgroundColor: track.color }} />
                    </div>
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t border-white/10 p-5 space-y-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {[
                        { label: 'المهام', value: breakdown.tasks, color: 'text-blue-300' },
                        { label: 'التقارير', value: breakdown.reports, color: 'text-emerald-300' },
                        { label: 'نطاق العمل', value: breakdown.scopeBlocks, color: 'text-amber-300' },
                        { label: 'مؤشرات الأداء', value: breakdown.kpis, color: 'text-violet-300' },
                      ].map((item) => (
                        <div key={item.label} className="bg-white/5 rounded-xl p-3 text-center">
                          <p className={cn('text-lg font-bold', item.color)}>{formatPercent(item.value)}</p>
                          <p className="text-xs text-gray-400 mt-0.5">{item.label}</p>
                        </div>
                      ))}
                    </div>

                    {trackAchievements.length > 0 && (
                      <div>
                        <h4 className="text-sm font-semibold text-gray-300 mb-2">الإنجازات</h4>
                        <div className="space-y-2">
                          {trackAchievements.map((a) => (
                            <div key={a.id} className="flex items-center gap-2 bg-white/5 rounded-lg p-2.5">
                              <Star className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                              <span className="text-sm">{a.titleAr || a.title}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* By Employee Tab */}
      {tab === 'employees' && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {employees.map((emp) => {
            const empAchievements = achievements.filter((a) => a.entityType === 'employee' && a.entityId === emp.id);
            return (
              <div key={emp.id} className="glass glass-hover rounded-2xl border border-white/10 p-5">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-brand-500/20 flex items-center justify-center text-sm font-bold text-brand-300">
                    {emp.fullNameAr?.charAt(0) || '?'}
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-semibold text-sm truncate">{emp.fullNameAr}</h3>
                    <p className="text-xs text-gray-400 truncate">{emp.positionAr || '-'}</p>
                  </div>
                </div>
                {emp.track && (
                  <div className="flex items-center gap-2 mb-3">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: emp.track.color }} />
                    <span className="text-xs text-gray-400">{emp.track.nameAr}</span>
                  </div>
                )}
                {empAchievements.length > 0 ? (
                  <div className="space-y-1.5">
                    {empAchievements.slice(0, 3).map((a) => (
                      <div key={a.id} className="flex items-center gap-2 text-xs bg-amber-500/10 rounded-lg px-2.5 py-1.5">
                        <Star className="w-3 h-3 text-amber-400 shrink-0" />
                        <span className="truncate">{a.titleAr || a.title}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-600 text-center py-2">لا توجد إنجازات</p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Achievements Tab (full list) */}
      {tab === 'entities' && (
        <div className="space-y-4">
          {achievements.length > 0 ? (
            achievements.map((a) => (
              <div key={a.id} className="glass rounded-2xl border border-white/10 p-5">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className="p-2.5 rounded-xl bg-amber-500/20 shrink-0">
                      <Trophy className="w-5 h-5 text-amber-400" />
                    </div>
                    <div>
                      <h3 className="font-semibold">{a.titleAr || a.title}</h3>
                      {a.descriptionAr && <p className="text-sm text-gray-400 mt-1">{a.descriptionAr}</p>}
                      <div className="flex items-center gap-3 mt-2">
                        <span className="badge bg-white/10 text-gray-300 text-xs">{a.entityType}</span>
                        {a.impactType && (
                          <span className={cn('badge text-xs',
                            a.impactType === 'high' ? 'bg-emerald-500/20 text-emerald-300' :
                            a.impactType === 'medium' ? 'bg-amber-500/20 text-amber-300' :
                            'bg-gray-500/20 text-gray-300'
                          )}>
                            {a.impactType === 'high' ? 'تأثير عالي' : a.impactType === 'medium' ? 'تأثير متوسط' : 'تأثير منخفض'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <span className="text-xs text-gray-500">{formatDate(a.createdAt)}</span>
                </div>
              </div>
            ))
          ) : (
            <div className="glass rounded-2xl border border-white/10 p-12 text-center">
              <Trophy className="w-12 h-12 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-400">لا توجد إنجازات مسجلة بعد</p>
              <p className="text-xs text-gray-500 mt-1">ابدأ بإضافة إنجازات لتتبع التقدم</p>
            </div>
          )}
        </div>
      )}

      <CrudModal
        isOpen={achievementModalOpen}
        onClose={() => setAchievementModalOpen(false)}
        onSubmit={handleCreateAchievement}
        title="إضافة إنجاز جديد"
        fields={achievementFields}
      />
    </div>
  );
}
