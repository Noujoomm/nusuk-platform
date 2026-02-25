'use client';

import { useEffect, useState, useCallback } from 'react';
import { filesApi, tracksApi } from '@/lib/api';
import { formatDateTime } from '@/lib/utils';
import { File, Search, Plus, CheckCircle, Clock, XCircle, Eye, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';

// ─── Types ───

interface Track {
  id: string;
  name: string;
  nameAr: string;
}

interface FileItem {
  id: string;
  fileName: string;
  category: string;
  status: string;
  notes: string | null;
  createdAt: string;
  uploadedBy: { id: string; name: string; nameAr: string } | null;
  track: { id: string; name: string; nameAr: string } | null;
}

type FileStatus = 'uploaded' | 'reviewed' | 'approved' | 'rejected';
type FileCategory = 'general' | 'report' | 'deliverable' | 'contract';

// ─── Constants ───

const STATUS_LABELS: Record<string, string> = {
  uploaded: 'مرفوع',
  reviewed: 'تمت المراجعة',
  approved: 'معتمد',
  rejected: 'مرفوض',
};

const STATUS_COLORS: Record<string, string> = {
  uploaded: 'bg-blue-500/20 text-blue-300',
  reviewed: 'bg-amber-500/20 text-amber-300',
  approved: 'bg-emerald-500/20 text-emerald-300',
  rejected: 'bg-red-500/20 text-red-300',
};

const CATEGORY_LABELS: Record<string, string> = {
  general: 'عام',
  report: 'تقرير',
  deliverable: 'مخرج',
  contract: 'عقد',
};

const PAGE_SIZE = 20;

// ─── Component ───

export default function FilesPage() {
  // Data state
  const [files, setFiles] = useState<FileItem[]>([]);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  // Filter state
  const [filterTrackId, setFilterTrackId] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Form state
  const [showRegister, setShowRegister] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    trackId: '',
    fileName: '',
    category: 'general' as FileCategory,
    notes: '',
  });

  // Stats
  const [stats, setStats] = useState({
    total: 0,
    byStatus: {} as Record<string, number>,
    byCategory: {} as Record<string, number>,
  });

  // ─── Data Loading ───

  const loadFiles = useCallback(async () => {
    try {
      const params: Record<string, any> = { page, pageSize: PAGE_SIZE };
      if (filterTrackId) params.trackId = filterTrackId;
      if (filterCategory) params.category = filterCategory;
      if (filterStatus) params.status = filterStatus;

      const { data } = await filesApi.list(params);
      setFiles(data.data);
      setTotal(data.total);
    } catch {
      toast.error('فشل تحميل الملفات');
    }
    setLoading(false);
  }, [page, filterTrackId, filterCategory, filterStatus]);

  const loadTracks = async () => {
    try {
      const { data } = await tracksApi.list();
      setTracks(data.data ?? data);
    } catch {}
  };

  const loadStats = async () => {
    try {
      const { data } = await filesApi.stats();
      setStats(data);
    } catch {}
  };

  useEffect(() => {
    loadTracks();
    loadStats();
  }, []);

  useEffect(() => {
    setLoading(true);
    loadFiles();
  }, [loadFiles]);

  // ─── Handlers ───

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.trackId || !form.fileName) {
      toast.error('يرجى تعبئة الحقول المطلوبة');
      return;
    }
    setSaving(true);
    try {
      await filesApi.register(form);
      toast.success('تم تسجيل الملف بنجاح');
      setShowRegister(false);
      setForm({ trackId: '', fileName: '', category: 'general', notes: '' });
      loadFiles();
      loadStats();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'فشل تسجيل الملف');
    }
    setSaving(false);
  };

  const handleUpdateStatus = async (id: string, newStatus: FileStatus) => {
    try {
      await filesApi.updateStatus(id, newStatus);
      toast.success(`تم تحديث الحالة إلى: ${STATUS_LABELS[newStatus]}`);
      loadFiles();
      loadStats();
    } catch {
      toast.error('فشل تحديث الحالة');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('هل أنت متأكد من حذف هذا الملف؟')) return;
    try {
      await filesApi.delete(id);
      toast.success('تم حذف الملف');
      loadFiles();
      loadStats();
    } catch {
      toast.error('فشل حذف الملف');
    }
  };

  // ─── Filtered files (client-side search on top of server filters) ───

  const filtered = files.filter((f) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      f.fileName?.toLowerCase().includes(q) ||
      f.uploadedBy?.nameAr?.includes(searchQuery) ||
      f.track?.nameAr?.includes(searchQuery)
    );
  });

  // ─── Pagination ───

  const totalPages = Math.ceil(total / PAGE_SIZE);

  // ─── Loading State ───

  if (loading && files.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // ─── Render ───

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">إدارة الملفات</h1>
          <p className="text-gray-400 mt-1">{total} ملف</p>
        </div>
        <button
          onClick={() => setShowRegister(!showRegister)}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          تسجيل ملف جديد
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="glass p-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-violet-500/20">
              <File className="w-5 h-5 text-violet-400" />
            </div>
            <div className="min-w-0">
              <p className="text-lg font-bold">{stats.total || total}</p>
              <p className="text-xs text-gray-400">إجمالي الملفات</p>
            </div>
          </div>
        </div>

        {([
          { key: 'uploaded', icon: Clock, color: 'text-blue-400', bg: 'bg-blue-500/20' },
          { key: 'approved', icon: CheckCircle, color: 'text-emerald-400', bg: 'bg-emerald-500/20' },
          { key: 'rejected', icon: XCircle, color: 'text-red-400', bg: 'bg-red-500/20' },
        ] as const).map((item) => (
          <div key={item.key} className="glass p-4">
            <div className="flex items-center gap-3">
              <div className={`p-2.5 rounded-xl ${item.bg}`}>
                <item.icon className={`w-5 h-5 ${item.color}`} />
              </div>
              <div className="min-w-0">
                <p className="text-lg font-bold">{stats.byStatus?.[item.key] || 0}</p>
                <p className="text-xs text-gray-400">{STATUS_LABELS[item.key]}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Category Stats */}
      {stats.byCategory && Object.keys(stats.byCategory).length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
            <div key={key} className="glass p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-400">{label}</span>
                <span className="text-lg font-bold">{stats.byCategory?.[key] || 0}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Register Form */}
      {showRegister && (
        <div className="glass p-5">
          <h3 className="font-semibold mb-4">تسجيل ملف جديد</h3>
          <form onSubmit={handleRegister} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs text-gray-400 mb-1">المسار *</label>
              <select
                value={form.trackId}
                onChange={(e) => setForm({ ...form, trackId: e.target.value })}
                className="input-field w-full"
                required
              >
                <option value="">اختر المسار</option>
                {tracks.map((t) => (
                  <option key={t.id} value={t.id}>{t.nameAr}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs text-gray-400 mb-1">اسم الملف *</label>
              <input
                type="text"
                placeholder="اسم الملف"
                value={form.fileName}
                onChange={(e) => setForm({ ...form, fileName: e.target.value })}
                className="input-field w-full"
                required
              />
            </div>

            <div>
              <label className="block text-xs text-gray-400 mb-1">التصنيف</label>
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value as FileCategory })}
                className="input-field w-full"
              >
                {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs text-gray-400 mb-1">ملاحظات</label>
              <textarea
                placeholder="ملاحظات إضافية..."
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                className="input-field w-full resize-none"
                rows={1}
              />
            </div>

            <div className="md:col-span-2 lg:col-span-4 flex gap-2 justify-end">
              <button type="submit" disabled={saving} className="btn-primary">
                {saving ? 'جاري التسجيل...' : 'تسجيل الملف'}
              </button>
              <button
                type="button"
                onClick={() => setShowRegister(false)}
                className="btn-secondary"
              >
                إلغاء
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder="بحث باسم الملف أو الرافع..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input-field pr-10"
          />
        </div>

        <select
          value={filterTrackId}
          onChange={(e) => { setFilterTrackId(e.target.value); setPage(1); }}
          className="input-field w-auto"
        >
          <option value="">كل المسارات</option>
          {tracks.map((t) => (
            <option key={t.id} value={t.id}>{t.nameAr}</option>
          ))}
        </select>

        <select
          value={filterCategory}
          onChange={(e) => { setFilterCategory(e.target.value); setPage(1); }}
          className="input-field w-auto"
        >
          <option value="">كل التصنيفات</option>
          {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>

        <select
          value={filterStatus}
          onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }}
          className="input-field w-auto"
        >
          <option value="">كل الحالات</option>
          {Object.entries(STATUS_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="glass overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-right p-4 text-sm font-medium text-gray-400">اسم الملف</th>
                <th className="text-right p-4 text-sm font-medium text-gray-400">رفع بواسطة</th>
                <th className="text-right p-4 text-sm font-medium text-gray-400">المسار</th>
                <th className="text-right p-4 text-sm font-medium text-gray-400">التصنيف</th>
                <th className="text-right p-4 text-sm font-medium text-gray-400">الحالة</th>
                <th className="text-right p-4 text-sm font-medium text-gray-400">التاريخ</th>
                <th className="text-right p-4 text-sm font-medium text-gray-400">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((file) => (
                <tr key={file.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                  {/* File Name */}
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <File className="w-4 h-4 text-gray-500 flex-shrink-0" />
                      <span className="font-medium text-sm">{file.fileName}</span>
                    </div>
                  </td>

                  {/* Uploaded By */}
                  <td className="p-4 text-sm text-gray-300">
                    {file.uploadedBy?.nameAr || '-'}
                  </td>

                  {/* Track */}
                  <td className="p-4">
                    {file.track ? (
                      <span className="badge bg-brand-500/20 text-brand-300 text-xs">
                        {file.track.nameAr}
                      </span>
                    ) : (
                      <span className="text-sm text-gray-500">-</span>
                    )}
                  </td>

                  {/* Category */}
                  <td className="p-4">
                    <span className="badge bg-violet-500/20 text-violet-300 text-xs">
                      {CATEGORY_LABELS[file.category] || file.category}
                    </span>
                  </td>

                  {/* Status */}
                  <td className="p-4">
                    <span className={`badge text-xs ${STATUS_COLORS[file.status] || 'bg-gray-500/20 text-gray-300'}`}>
                      {STATUS_LABELS[file.status] || file.status}
                    </span>
                  </td>

                  {/* Date */}
                  <td className="p-4 text-sm text-gray-400">
                    {formatDateTime(file.createdAt)}
                  </td>

                  {/* Actions */}
                  <td className="p-4">
                    <div className="flex items-center gap-1">
                      {file.status !== 'approved' && (
                        <button
                          onClick={() => handleUpdateStatus(file.id, 'approved')}
                          className="p-1.5 rounded-lg hover:bg-emerald-500/10 text-gray-400 hover:text-emerald-400 transition-colors"
                          title="اعتماد"
                        >
                          <CheckCircle className="w-4 h-4" />
                        </button>
                      )}

                      {file.status !== 'rejected' && (
                        <button
                          onClick={() => handleUpdateStatus(file.id, 'rejected')}
                          className="p-1.5 rounded-lg hover:bg-red-500/10 text-gray-400 hover:text-red-400 transition-colors"
                          title="رفض"
                        >
                          <XCircle className="w-4 h-4" />
                        </button>
                      )}

                      {file.status === 'uploaded' && (
                        <button
                          onClick={() => handleUpdateStatus(file.id, 'reviewed')}
                          className="p-1.5 rounded-lg hover:bg-amber-500/10 text-gray-400 hover:text-amber-400 transition-colors"
                          title="تمت المراجعة"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      )}

                      <button
                        onClick={() => handleDelete(file.id)}
                        className="p-1.5 rounded-lg hover:bg-red-500/10 text-gray-400 hover:text-red-400 transition-colors"
                        title="حذف"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-gray-500">
                    لا توجد ملفات
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="btn-secondary text-sm disabled:opacity-40"
          >
            السابق
          </button>
          <span className="text-sm text-gray-400">
            صفحة {page} من {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="btn-secondary text-sm disabled:opacity-40"
          >
            التالي
          </button>
        </div>
      )}
    </div>
  );
}
