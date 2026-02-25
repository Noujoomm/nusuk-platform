'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/stores/auth';
import { employeesApi, tracksApi } from '@/lib/api';
import { cn, formatDate, formatNumber } from '@/lib/utils';
import {
  Users,
  Briefcase,
  UserCheck,
  Clock,
  GitBranch,
} from 'lucide-react';

interface Employee {
  id: string;
  fullName: string;
  fullNameAr: string;
  position?: string;
  positionAr?: string;
  contractType?: string;
  track?: { id: string; nameAr: string; color: string };
  createdAt: string;
}

export default function HRDashboard() {
  const { user } = useAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const empRes = await employeesApi.list({}).catch(() => ({ data: [] }));
        setEmployees(empRes.data.data || empRes.data || []);
      } catch {}
      setLoading(false);
    };
    loadData();
  }, []);

  const totalEmployees = employees.length;

  // Distribution by track
  const byTrack: Record<string, { count: number; color: string }> = {};
  employees.forEach((e) => {
    const name = e.track?.nameAr || 'غير محدد';
    if (!byTrack[name]) byTrack[name] = { count: 0, color: e.track?.color || '#6b7280' };
    byTrack[name].count++;
  });
  const trackDistribution = Object.entries(byTrack).sort((a, b) => b[1].count - a[1].count);

  // Distribution by contract type
  const byContract: Record<string, number> = {};
  employees.forEach((e) => {
    const type = e.contractType || 'غير محدد';
    byContract[type] = (byContract[type] || 0) + 1;
  });

  // Recent employees
  const recentEmployees = [...employees]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 6);

  const stats = [
    { label: 'إجمالي الموظفين', value: totalEmployees, icon: Users, color: 'text-blue-400', bg: 'bg-blue-500/20' },
    { label: 'المسارات', value: trackDistribution.length, icon: GitBranch, color: 'text-emerald-400', bg: 'bg-emerald-500/20' },
    { label: 'أنواع العقود', value: Object.keys(byContract).length, icon: Briefcase, color: 'text-amber-400', bg: 'bg-amber-500/20' },
    { label: 'إضافات حديثة', value: recentEmployees.length, icon: UserCheck, color: 'text-violet-400', bg: 'bg-violet-500/20' },
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
      <div>
        <h1 className="text-2xl font-bold">مرحبا {user?.nameAr || user?.name}</h1>
        <p className="text-gray-400 mt-1">لوحة تحكم الموارد البشرية</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <div key={stat.label} className="glass rounded-2xl border border-white/10 p-4">
            <div className="flex items-center gap-3">
              <div className={cn('p-2.5 rounded-xl', stat.bg)}>
                <stat.icon className={cn('w-5 h-5', stat.color)} />
              </div>
              <div className="min-w-0">
                <p className="text-xl font-bold">{formatNumber(stat.value)}</p>
                <p className="text-xs text-gray-400">{stat.label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Track Distribution */}
        <div className="glass rounded-2xl border border-white/10 p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <GitBranch className="w-5 h-5 text-emerald-400" />
            توزيع الموظفين حسب المسار
          </h2>
          {trackDistribution.length > 0 ? (
            <div className="space-y-3">
              {trackDistribution.map(([track, { count, color }]) => {
                const pct = totalEmployees > 0 ? Math.round((count / totalEmployees) * 100) : 0;
                return (
                  <div key={track}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                        <span className="text-sm">{track}</span>
                      </div>
                      <span className="text-xs text-gray-400">{formatNumber(count)} ({pct}%)</span>
                    </div>
                    <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: color }} />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center text-gray-500 py-8">
              <Users className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">لا توجد بيانات</p>
            </div>
          )}
        </div>

        {/* Contract Type Distribution */}
        <div className="glass rounded-2xl border border-white/10 p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Briefcase className="w-5 h-5 text-amber-400" />
            توزيع أنواع العقود
          </h2>
          {Object.keys(byContract).length > 0 ? (
            <div className="space-y-3">
              {Object.entries(byContract).sort((a, b) => b[1] - a[1]).map(([type, count]) => {
                const pct = totalEmployees > 0 ? Math.round((count / totalEmployees) * 100) : 0;
                return (
                  <div key={type}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm">{type}</span>
                      <span className="text-xs text-gray-400">{formatNumber(count)} ({pct}%)</span>
                    </div>
                    <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <div className="h-full bg-amber-500 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center text-gray-500 py-8">
              <Briefcase className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">لا توجد بيانات</p>
            </div>
          )}
        </div>
      </div>

      {/* Recent Employees */}
      <div className="glass rounded-2xl border border-white/10 p-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Clock className="w-5 h-5 text-gray-400" />
          أحدث الموظفين
        </h2>
        {recentEmployees.length > 0 ? (
          <div className="space-y-3">
            {recentEmployees.map((emp) => (
              <div key={emp.id} className="flex items-center justify-between bg-white/5 rounded-xl p-3 hover:bg-white/[0.07] transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-brand-500/20 flex items-center justify-center text-sm font-bold text-brand-300">
                    {emp.fullNameAr?.charAt(0) || '?'}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{emp.fullNameAr}</p>
                    <p className="text-xs text-gray-500">{emp.positionAr || emp.position || '-'}</p>
                  </div>
                </div>
                <div className="text-left">
                  <p className="text-xs text-gray-500">{emp.track?.nameAr || 'غير محدد'}</p>
                  <p className="text-xs text-gray-600">{formatDate(emp.createdAt)}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center text-gray-500 py-8">
            <UserCheck className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm">لا توجد بيانات</p>
          </div>
        )}
      </div>
    </div>
  );
}
