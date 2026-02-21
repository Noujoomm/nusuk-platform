'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { tracksApi, recordsApi } from '@/lib/api';
import { useAuth } from '@/stores/auth';
import { getSocket, joinTrack, leaveTrack } from '@/lib/socket';
import { STATUS_LABELS, PRIORITY_LABELS, STATUS_COLORS, PRIORITY_COLORS, formatDate } from '@/lib/utils';
import { Plus, Search, Filter, Edit3, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import RecordModal from '@/components/record-modal';
import toast from 'react-hot-toast';

interface Track {
  id: string;
  name: string;
  nameAr: string;
  color: string;
  fieldSchema: any;
}

interface RecordItem {
  id: string;
  title: string;
  titleAr: string;
  status: string;
  priority: string;
  owner: string;
  progress: number;
  version: number;
  dueDate: string;
  extraFields: any;
  createdBy: { id: string; name: string; nameAr: string };
  createdAt: string;
}

export default function TrackDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user, hasPermission } = useAuth();
  const [track, setTrack] = useState<Track | null>(null);
  const [records, setRecords] = useState<RecordItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editRecord, setEditRecord] = useState<RecordItem | null>(null);

  const canEdit = hasPermission(id, 'edit');
  const canCreate = hasPermission(id, 'create');
  const canDelete = hasPermission(id, 'delete');
  const pageSize = 20;

  const loadRecords = useCallback(async () => {
    try {
      const { data } = await recordsApi.listByTrack(id, {
        page,
        pageSize,
        search: search || undefined,
        status: statusFilter || undefined,
      });
      setRecords(data.data);
      setTotal(data.total);
    } catch {}
  }, [id, page, search, statusFilter]);

  useEffect(() => {
    const loadTrack = async () => {
      try {
        const { data } = await tracksApi.get(id);
        setTrack(data);
      } catch {
        toast.error('فشل تحميل المسار');
      }
      setLoading(false);
    };
    loadTrack();
    loadRecords();

    // Join real-time track room
    joinTrack(id);
    const socket = getSocket();
    socket.on('track.record.created', () => loadRecords());
    socket.on('track.record.updated', () => loadRecords());
    socket.on('track.record.deleted', () => loadRecords());

    return () => {
      leaveTrack(id);
      socket.off('track.record.created');
      socket.off('track.record.updated');
      socket.off('track.record.deleted');
    };
  }, [id, loadRecords]);

  useEffect(() => {
    loadRecords();
  }, [loadRecords]);

  const handleDelete = async (recordId: string) => {
    if (!confirm('هل أنت متأكد من حذف هذا السجل؟')) return;
    try {
      await recordsApi.delete(recordId);
      toast.success('تم حذف السجل');
      loadRecords();
    } catch {
      toast.error('فشل حذف السجل');
    }
  };

  const totalPages = Math.ceil(total / pageSize);

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
        <div className="flex items-center gap-3">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center"
            style={{ backgroundColor: `${track?.color}20` }}
          >
            <div className="w-4 h-4 rounded-full" style={{ backgroundColor: track?.color }} />
          </div>
          <div>
            <h1 className="text-2xl font-bold">{track?.nameAr}</h1>
            <p className="text-gray-400 text-sm">{total} سجل</p>
          </div>
        </div>
        {canCreate && (
          <button
            onClick={() => { setEditRecord(null); setModalOpen(true); }}
            className="btn-primary flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            سجل جديد
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder="بحث..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="input-field pr-10"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="input-field w-auto"
        >
          <option value="">كل الحالات</option>
          {Object.entries(STATUS_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </div>

      {/* Records Table */}
      <div className="glass overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-right p-4 text-sm font-medium text-gray-400">العنوان</th>
                <th className="text-right p-4 text-sm font-medium text-gray-400">الحالة</th>
                <th className="text-right p-4 text-sm font-medium text-gray-400">الأولوية</th>
                <th className="text-right p-4 text-sm font-medium text-gray-400">المسؤول</th>
                <th className="text-right p-4 text-sm font-medium text-gray-400">التقدم</th>
                <th className="text-right p-4 text-sm font-medium text-gray-400">التاريخ</th>
                {(canEdit || canDelete) && (
                  <th className="text-right p-4 text-sm font-medium text-gray-400">إجراءات</th>
                )}
              </tr>
            </thead>
            <tbody>
              {records.map((record) => (
                <tr key={record.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                  <td className="p-4">
                    <p className="font-medium">{record.titleAr || record.title}</p>
                    <p className="text-xs text-gray-500">{record.createdBy?.nameAr}</p>
                  </td>
                  <td className="p-4">
                    <span className={`badge ${STATUS_COLORS[record.status] || ''}`}>
                      {STATUS_LABELS[record.status] || record.status}
                    </span>
                  </td>
                  <td className="p-4">
                    <span className={`badge ${PRIORITY_COLORS[record.priority] || ''}`}>
                      {PRIORITY_LABELS[record.priority] || record.priority}
                    </span>
                  </td>
                  <td className="p-4 text-sm text-gray-300">{record.owner || '-'}</td>
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 bg-white/10 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-brand-500 rounded-full"
                          style={{ width: `${record.progress}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-400">{record.progress}%</span>
                    </div>
                  </td>
                  <td className="p-4 text-sm text-gray-400">{formatDate(record.createdAt)}</td>
                  {(canEdit || canDelete) && (
                    <td className="p-4">
                      <div className="flex items-center gap-1">
                        {canEdit && (
                          <button
                            onClick={() => { setEditRecord(record); setModalOpen(true); }}
                            className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                        )}
                        {canDelete && (
                          <button
                            onClick={() => handleDelete(record.id)}
                            className="p-1.5 rounded-lg hover:bg-red-500/10 text-gray-400 hover:text-red-400 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
              {records.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-gray-500">
                    لا توجد سجلات
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between p-4 border-t border-white/10">
            <span className="text-sm text-gray-400">
              صفحة {page} من {totalPages}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
                className="p-1.5 rounded-lg hover:bg-white/10 disabled:opacity-30"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page === totalPages}
                className="p-1.5 rounded-lg hover:bg-white/10 disabled:opacity-30"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Record Modal */}
      {modalOpen && (
        <RecordModal
          trackId={id}
          record={editRecord}
          fieldSchema={track?.fieldSchema}
          onClose={() => { setModalOpen(false); setEditRecord(null); }}
          onSave={() => { setModalOpen(false); setEditRecord(null); loadRecords(); }}
        />
      )}
    </div>
  );
}
