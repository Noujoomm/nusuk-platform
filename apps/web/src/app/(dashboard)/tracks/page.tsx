'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { tracksApi } from '@/lib/api';
import { useAuth } from '@/stores/auth';
import { GitBranch, Plus, Settings } from 'lucide-react';
import toast from 'react-hot-toast';

interface Track {
  id: string;
  name: string;
  nameAr: string;
  color: string;
  isActive: boolean;
  _count: { records: number };
}

export default function TracksPage() {
  const { user } = useAuth();
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const isAdmin = user?.role === 'admin' || user?.role === 'pm';

  useEffect(() => {
    loadTracks();
  }, []);

  const loadTracks = async () => {
    try {
      const { data } = await tracksApi.list();
      setTracks(data);
    } catch {
      toast.error('فشل تحميل المسارات');
    }
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">المسارات</h1>
          <p className="text-gray-400 mt-1">{tracks.length} مسار</p>
        </div>
        {isAdmin && (
          <Link href="/tracks/new" className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" />
            مسار جديد
          </Link>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {tracks.map((track) => (
          <Link
            key={track.id}
            href={`/tracks/${track.id}`}
            className="glass glass-hover p-6 block group"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ backgroundColor: `${track.color}20` }}
                >
                  <GitBranch className="w-5 h-5" style={{ color: track.color }} />
                </div>
                <div>
                  <h3 className="font-semibold text-white">{track.nameAr}</h3>
                  <p className="text-xs text-gray-500">{track.name}</p>
                </div>
              </div>
              {isAdmin && (
                <Settings className="w-4 h-4 text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity" />
              )}
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-400">
                {track._count?.records || 0} سجل
              </span>
              <span className={`badge ${track.isActive ? 'bg-emerald-500/20 text-emerald-300' : 'bg-red-500/20 text-red-300'}`}>
                {track.isActive ? 'نشط' : 'معطل'}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
