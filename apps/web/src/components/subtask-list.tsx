'use client';

import { useState, useEffect } from 'react';
import { subtasksApi } from '@/lib/api';
import {
  STATUS_LABELS,
  STATUS_COLORS,
  PRIORITY_LABELS,
  PRIORITY_COLORS,
  formatDate,
} from '@/lib/utils';
import { Plus, Pencil, Trash2, ListTodo } from 'lucide-react';
import toast from 'react-hot-toast';

interface Props {
  recordId: string;
  canEdit?: boolean;
}

export default function SubtaskList({ recordId, canEdit = false }: Props) {
  const [subtasks, setSubtasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: '',
    status: 'draft',
    priority: 'medium',
    dueDate: '',
  });

  const fetchSubtasks = async () => {
    try {
      const { data } = await subtasksApi.listByRecord(recordId);
      setSubtasks(data);
    } catch {
      toast.error('فشل تحميل المهام الفرعية');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubtasks();
  }, [recordId]);

  const resetForm = () => {
    setForm({ title: '', status: 'draft', priority: 'medium', dueDate: '' });
    setEditingId(null);
    setShowAddForm(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        ...form,
        recordId,
        dueDate: form.dueDate || undefined,
      };

      if (editingId) {
        await subtasksApi.update(editingId, payload);
        toast.success('تم تحديث المهمة الفرعية');
      } else {
        await subtasksApi.create(payload);
        toast.success('تم إنشاء المهمة الفرعية');
      }
      resetForm();
      fetchSubtasks();
    } catch (err: any) {
      const msg = err.response?.data?.message || 'حدث خطأ';
      toast.error(typeof msg === 'string' ? msg : msg[0]);
    }
  };

  const handleEdit = (subtask: any) => {
    setForm({
      title: subtask.title,
      status: subtask.status,
      priority: subtask.priority,
      dueDate: subtask.dueDate?.split('T')[0] || '',
    });
    setEditingId(subtask.id);
    setShowAddForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('هل أنت متأكد من حذف هذه المهمة الفرعية؟')) return;
    try {
      await subtasksApi.delete(id);
      toast.success('تم حذف المهمة الفرعية');
      fetchSubtasks();
    } catch {
      toast.error('فشل حذف المهمة الفرعية');
    }
  };

  return (
    <div className="glass rounded-xl border border-white/10">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-white">المهام الفرعية</h3>
          <span className="rounded-full bg-white/5 px-2 py-0.5 text-xs text-gray-400">
            {subtasks.length}
          </span>
        </div>
        {canEdit && (
          <button
            onClick={() => {
              if (showAddForm && !editingId) {
                resetForm();
              } else {
                resetForm();
                setShowAddForm(true);
              }
            }}
            className="flex items-center gap-1.5 rounded-lg bg-white/5 px-3 py-1.5 text-xs text-gray-300 transition-colors hover:bg-white/10"
          >
            <Plus className="h-3.5 w-3.5" />
            إضافة
          </button>
        )}
      </div>

      {/* Add / Edit Form */}
      {showAddForm && canEdit && (
        <form onSubmit={handleSubmit} className="border-b border-white/10 p-4 space-y-3">
          <div>
            <label className="block text-sm text-gray-400 mb-1">العنوان</label>
            <input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="input-field"
              placeholder="عنوان المهمة الفرعية"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-gray-400 mb-1">الحالة</label>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
                className="input-field"
              >
                {Object.entries(STATUS_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1">الأولوية</label>
              <select
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: e.target.value })}
                className="input-field"
              >
                {Object.entries(PRIORITY_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">تاريخ الاستحقاق</label>
            <input
              type="date"
              value={form.dueDate}
              onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
              className="input-field"
              dir="ltr"
            />
          </div>

          <div className="flex items-center gap-3 pt-1">
            <button type="submit" className="btn-primary px-4 py-2 text-sm">
              {editingId ? 'تحديث' : 'حفظ'}
            </button>
            <button type="button" onClick={resetForm} className="btn-secondary px-4 py-2 text-sm">
              إلغاء
            </button>
          </div>
        </form>
      )}

      {/* Content */}
      <div className="divide-y divide-white/5">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
          </div>
        ) : subtasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-12 text-gray-400">
            <ListTodo className="h-10 w-10" />
            <p className="text-sm">لا توجد مهام فرعية</p>
          </div>
        ) : (
          subtasks.map((subtask) => (
            <div
              key={subtask.id}
              className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-white/5"
            >
              {/* Status badge */}
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                  STATUS_COLORS[subtask.status] || ''
                }`}
              >
                {STATUS_LABELS[subtask.status] || subtask.status}
              </span>

              {/* Priority badge */}
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                  PRIORITY_COLORS[subtask.priority] || ''
                }`}
              >
                {PRIORITY_LABELS[subtask.priority] || subtask.priority}
              </span>

              {/* Title & meta */}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-white">{subtask.title}</p>
                <div className="mt-0.5 flex items-center gap-2 text-[10px] text-gray-400/70">
                  {subtask.assignee && <span>{subtask.assignee.name || subtask.assignee}</span>}
                  {subtask.dueDate && <span>{formatDate(subtask.dueDate)}</span>}
                </div>
              </div>

              {/* Actions */}
              {canEdit && (
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    onClick={() => handleEdit(subtask)}
                    className="rounded p-1.5 text-gray-400 transition-colors hover:bg-white/10 hover:text-white"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => handleDelete(subtask.id)}
                    className="rounded p-1.5 text-gray-400 transition-colors hover:bg-white/10 hover:text-red-400"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
