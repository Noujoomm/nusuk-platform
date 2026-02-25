'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { tracksApi } from '@/lib/api';
import { useAuth } from '@/stores/auth';
import { GitBranch, Plus, Trash2, Edit3, X } from 'lucide-react';
import toast from 'react-hot-toast';

interface Track {
  id: string;
  name: string;
  nameAr: string;
  color: string;
  isActive: boolean;
  _count: { records: number; employees: number; deliverables: number };
}

const TRACK_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981',
  '#3b82f6', '#14b8a6', '#ef4444', '#0ea5e9', '#f97316',
];

export default function TracksPage() {
  const { user } = useAuth();
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Track | null>(null);
  const [editTarget, setEditTarget] = useState<Track | null>(null);
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

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await tracksApi.delete(deleteTarget.id);
      toast.success(`تم حذف المسار: ${deleteTarget.nameAr}`);
      setDeleteTarget(null);
      loadTracks();
    } catch {
      toast.error('فشل حذف المسار');
    }
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
          <button
            onClick={() => setShowCreateModal(true)}
            className="btn-primary flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            مسار جديد
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {tracks.map((track) => (
          <div key={track.id} className="glass glass-hover p-6 group relative">
            <Link href={`/tracks/${track.id}`} className="block">
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
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 text-sm text-gray-400">
                  <span>{track._count?.records || 0} سجل</span>
                  <span className="text-gray-600">·</span>
                  <span>{track._count?.employees || 0} موظف</span>
                </div>
                <span className={`badge ${track.isActive ? 'bg-emerald-500/20 text-emerald-300' : 'bg-red-500/20 text-red-300'}`}>
                  {track.isActive ? 'نشط' : 'معطل'}
                </span>
              </div>
            </Link>

            {/* Edit & Delete buttons */}
            {isAdmin && (
              <div className="absolute top-3 left-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                <button
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); setEditTarget(track); }}
                  className="p-1.5 rounded-lg hover:bg-white/10 text-gray-500 hover:text-white transition-colors"
                  title="تعديل المسار"
                >
                  <Edit3 className="w-4 h-4" />
                </button>
                <button
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); setDeleteTarget(track); }}
                  className="p-1.5 rounded-lg hover:bg-red-500/10 text-gray-500 hover:text-red-400 transition-colors"
                  title="حذف المسار"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <CreateTrackModal
          onClose={() => setShowCreateModal(false)}
          onCreated={() => { setShowCreateModal(false); loadTracks(); }}
        />
      )}

      {/* Edit/Rename Modal */}
      {editTarget && (
        <RenameTrackModal
          track={editTarget}
          onClose={() => setEditTarget(null)}
          onSaved={() => { setEditTarget(null); loadTracks(); }}
        />
      )}

      {/* Delete Confirmation */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setDeleteTarget(null)}>
          <div className="glass p-6 w-full max-w-sm mx-4 space-y-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-red-400">حذف المسار</h3>
            <p className="text-sm text-gray-300">
              هل أنت متأكد من حذف المسار <strong>{deleteTarget.nameAr}</strong>؟
            </p>
            <p className="text-xs text-gray-500">
              سيتم حذف جميع البيانات المرتبطة بهذا المسار (السجلات، الموظفين، المخرجات، إلخ).
            </p>
            <div className="flex gap-3 pt-2">
              <button
                onClick={handleDelete}
                className="flex-1 py-2 px-4 rounded-xl bg-red-500/20 text-red-300 hover:bg-red-500/30 text-sm font-medium transition-colors"
              >
                نعم، احذف
              </button>
              <button
                onClick={() => setDeleteTarget(null)}
                className="flex-1 py-2 px-4 rounded-xl bg-white/5 text-gray-400 hover:bg-white/10 text-sm font-medium transition-colors"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CreateTrackModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState('');
  const [nameAr, setNameAr] = useState('');
  const [color, setColor] = useState(TRACK_COLORS[0]);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !nameAr.trim()) {
      toast.error('يرجى تعبئة جميع الحقول المطلوبة');
      return;
    }
    setSaving(true);
    try {
      await tracksApi.create({ name: name.trim(), nameAr: nameAr.trim(), color });
      toast.success('تم إنشاء المسار بنجاح');
      onCreated();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'فشل إنشاء المسار');
    }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="glass p-6 w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-bold">مسار جديد</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1.5">اسم المسار (عربي) *</label>
            <input
              type="text"
              value={nameAr}
              onChange={(e) => setNameAr(e.target.value)}
              placeholder="مثال: إدارة المشروع"
              className="input-field"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1.5">اسم المسار (إنجليزي) *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Project Management"
              className="input-field"
              dir="ltr"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1.5">لون المسار</label>
            <div className="flex flex-wrap gap-2">
              {TRACK_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`w-8 h-8 rounded-lg transition-all ${color === c ? 'ring-2 ring-white ring-offset-2 ring-offset-gray-900 scale-110' : 'hover:scale-105'}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          {/* Preview */}
          <div className="p-4 rounded-xl border border-white/10 bg-white/[0.02]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${color}20` }}>
                <GitBranch className="w-5 h-5" style={{ color }} />
              </div>
              <div>
                <p className="font-semibold text-sm">{nameAr || 'اسم المسار'}</p>
                <p className="text-xs text-gray-500">{name || 'Track Name'}</p>
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 btn-primary disabled:opacity-50"
            >
              {saving ? 'جاري الإنشاء...' : 'إنشاء المسار'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 rounded-xl bg-white/5 text-gray-400 hover:bg-white/10 text-sm font-medium transition-colors"
            >
              إلغاء
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function RenameTrackModal({ track, onClose, onSaved }: { track: Track; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(track.name);
  const [nameAr, setNameAr] = useState(track.nameAr);
  const [color, setColor] = useState(track.color);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !nameAr.trim()) {
      toast.error('يرجى تعبئة جميع الحقول المطلوبة');
      return;
    }
    setSaving(true);
    try {
      await tracksApi.update(track.id, { name: name.trim(), nameAr: nameAr.trim(), color });
      toast.success('تم تعديل المسار بنجاح');
      onSaved();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'فشل تعديل المسار');
    }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="glass p-6 w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-bold">تعديل المسار</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1.5">اسم المسار (عربي) *</label>
            <input
              type="text"
              value={nameAr}
              onChange={(e) => setNameAr(e.target.value)}
              className="input-field"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1.5">اسم المسار (إنجليزي) *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input-field"
              dir="ltr"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1.5">لون المسار</label>
            <div className="flex flex-wrap gap-2">
              {TRACK_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`w-8 h-8 rounded-lg transition-all ${color === c ? 'ring-2 ring-white ring-offset-2 ring-offset-gray-900 scale-110' : 'hover:scale-105'}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          {/* Preview */}
          <div className="p-4 rounded-xl border border-white/10 bg-white/[0.02]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${color}20` }}>
                <GitBranch className="w-5 h-5" style={{ color }} />
              </div>
              <div>
                <p className="font-semibold text-sm">{nameAr || 'اسم المسار'}</p>
                <p className="text-xs text-gray-500">{name || 'Track Name'}</p>
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 btn-primary disabled:opacity-50"
            >
              {saving ? 'جاري الحفظ...' : 'حفظ التعديلات'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 rounded-xl bg-white/5 text-gray-400 hover:bg-white/10 text-sm font-medium transition-colors"
            >
              إلغاء
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
