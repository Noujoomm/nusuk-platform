'use client';

import { useEffect, useState } from 'react';
import { tracksApi, recordsApi } from '@/lib/api';
import { useAuth } from '@/stores/auth';
import { getSocket } from '@/lib/socket';
import {
  GitBranch,
  FileText,
  CheckCircle,
  Clock,
  Users,
  TrendingUp,
} from 'lucide-react';

interface TrackWithCount {
  id: string;
  name: string;
  nameAr: string;
  color: string;
  _count: { records: number };
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [tracks, setTracks] = useState<TrackWithCount[]>([]);
  const [onlineCount, setOnlineCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const { data } = await tracksApi.list();
        setTracks(data);
      } catch {}
      setLoading(false);
    };
    loadData();

    const socket = getSocket();
    socket.on('user.online', (d: { count: number }) => setOnlineCount(d.count));
    socket.on('user.offline', (d: { count: number }) => setOnlineCount(d.count));
    return () => {
      socket.off('user.online');
      socket.off('user.offline');
    };
  }, []);

  const totalRecords = tracks.reduce((sum, t) => sum + (t._count?.records || 0), 0);

  const stats = [
    { label: 'المسارات', value: tracks.length, icon: GitBranch, color: 'text-emerald-400', bg: 'bg-emerald-500/20' },
    { label: 'إجمالي السجلات', value: totalRecords, icon: FileText, color: 'text-blue-400', bg: 'bg-blue-500/20' },
    { label: 'المتصلون الآن', value: onlineCount, icon: Users, color: 'text-violet-400', bg: 'bg-violet-500/20' },
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
        <h1 className="text-2xl font-bold">مرحبًا {user?.nameAr || user?.name}</h1>
        <p className="text-gray-400 mt-1">لوحة تحكم نظام نسك لإدارة المشاريع</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {stats.map((stat) => (
          <div key={stat.label} className="glass p-5">
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-xl ${stat.bg}`}>
                <stat.icon className={`w-6 h-6 ${stat.color}`} />
              </div>
              <div>
                <p className="text-2xl font-bold">{stat.value}</p>
                <p className="text-sm text-gray-400">{stat.label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Tracks Grid */}
      <div>
        <h2 className="text-lg font-semibold mb-4">المسارات</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {tracks.map((track) => (
            <a
              key={track.id}
              href={`/tracks/${track.id}`}
              className="glass glass-hover p-5 block"
            >
              <div className="flex items-center gap-3 mb-3">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: track.color }}
                />
                <h3 className="font-semibold">{track.nameAr}</h3>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-400">{track._count?.records || 0} سجل</span>
                <TrendingUp className="w-4 h-4 text-gray-500" />
              </div>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
