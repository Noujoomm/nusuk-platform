'use client';

import { useState, useEffect } from 'react';
import { X, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import { tasksApi } from '@/lib/api';
import { PRIORITY_LABELS } from '@/lib/utils';
import { Task } from '@/stores/tasks';

interface Track {
  id: string;
  nameAr: string;
}

interface User {
  id: string;
  name: string;
  nameAr: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  task?: Task | null;
  tracks: Track[];
  users: User[];
  onSuccess: () => void;
}

const EMPTY_FORM = {
  titleAr: '',
  title: '',
  descriptionAr: '',
  priority: 'medium',
  trackId: '',
  dueDate: '',
  assigneeIds: [] as string[],
};

export default function TaskModal({ isOpen, onClose, task, tracks, users, onSuccess }: Props) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);

  const isEdit = !!task;

  useEffect(() => {
    if (isOpen) {
      if (task) {
        setForm({
          titleAr: task.titleAr || '',
          title: task.title || '',
          descriptionAr: task.descriptionAr || '',
          priority: task.priority || 'medium',
          trackId: task.trackId || '',
          dueDate: task.dueDate ? task.dueDate.substring(0, 10) : '',
          assigneeIds: task.assignments?.map((a) => a.userId) || [],
        });
      } else {
        setForm(EMPTY_FORM);
      }
    }
  }, [isOpen, task]);

  if (!isOpen) return null;

  const updateField = (name: string, value: any) => {
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const toggleAssignee = (userId: string) => {
    setForm((prev) => ({
      ...prev,
      assigneeIds: prev.assigneeIds.includes(userId)
        ? prev.assigneeIds.filter((id) => id !== userId)
        : [...prev.assigneeIds, userId],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.titleAr.trim()) {
      toast.error('العنوان بالعربية مطلوب');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        titleAr: form.titleAr,
        title: form.title || form.titleAr,
        descriptionAr: form.descriptionAr,
        priority: form.priority,
        trackId: form.trackId || undefined,
        dueDate: form.dueDate || undefined,
        assigneeIds: form.assigneeIds,
      };

      if (isEdit && task) {
        await tasksApi.update(task.id, payload);
        toast.success('تم تحديث المهمة');
      } else {
        await tasksApi.create(payload);
        toast.success('تم إنشاء المهمة');
      }

      onSuccess();
      onClose();
    } catch {
      toast.error(isEdit ? 'فشل تحديث المهمة' : 'فشل إنشاء المهمة');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="glass relative w-full max-w-lg max-h-[85vh] overflow-hidden rounded-2xl border border-white/10">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
          <h3 className="text-lg font-semibold text-white">
            {isEdit ? 'تعديل المهمة' : 'إضافة مهمة'}
          </h3>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-gray-400 transition-colors hover:bg-white/10 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="overflow-y-auto max-h-[60vh] p-6 space-y-4">
          {/* Title Arabic */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-300">
              العنوان بالعربية <span className="text-red-400 mr-1">*</span>
            </label>
            <input
              type="text"
              value={form.titleAr}
              onChange={(e) => updateField('titleAr', e.target.value)}
              placeholder="عنوان المهمة بالعربية"
              required
              className="input-field"
            />
          </div>

          {/* Title English */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-300">
              العنوان بالإنجليزية
            </label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => updateField('title', e.target.value)}
              placeholder="Task title in English"
              dir="ltr"
              className="input-field text-left"
            />
          </div>

          {/* Description Arabic */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-300">الوصف</label>
            <textarea
              value={form.descriptionAr}
              onChange={(e) => updateField('descriptionAr', e.target.value)}
              placeholder="وصف المهمة..."
              rows={3}
              className="input-field resize-none"
            />
          </div>

          {/* Priority */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-300">الأولوية</label>
            <select
              value={form.priority}
              onChange={(e) => updateField('priority', e.target.value)}
              className="input-field"
            >
              {Object.entries(PRIORITY_LABELS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          {/* Track */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-300">المسار</label>
            <select
              value={form.trackId}
              onChange={(e) => updateField('trackId', e.target.value)}
              className="input-field"
            >
              <option value="">بدون مسار</option>
              {tracks.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nameAr}
                </option>
              ))}
            </select>
          </div>

          {/* Due Date */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-300">
              تاريخ الاستحقاق
            </label>
            <input
              type="date"
              value={form.dueDate}
              onChange={(e) => updateField('dueDate', e.target.value)}
              className="input-field"
            />
          </div>

          {/* Assignees */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-300">المسؤولون</label>
            <div className="max-h-40 overflow-y-auto rounded-xl border border-white/10 bg-white/5 p-3 space-y-1">
              {users.length === 0 ? (
                <p className="text-xs text-gray-500 text-center py-2">لا يوجد مستخدمون</p>
              ) : (
                users.map((u) => {
                  const selected = form.assigneeIds.includes(u.id);
                  return (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => toggleAssignee(u.id)}
                      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                        selected
                          ? 'bg-brand-500/20 text-brand-300'
                          : 'text-gray-300 hover:bg-white/5'
                      }`}
                    >
                      <div
                        className={`flex h-5 w-5 items-center justify-center rounded border transition-colors ${
                          selected
                            ? 'border-brand-400 bg-brand-500/30'
                            : 'border-white/20 bg-white/5'
                        }`}
                      >
                        {selected && <Check className="h-3 w-3 text-brand-300" />}
                      </div>
                      <span>{u.nameAr || u.name}</span>
                    </button>
                  );
                })
              )}
            </div>
            {form.assigneeIds.length > 0 && (
              <p className="mt-1.5 text-xs text-gray-500">
                {form.assigneeIds.length} مستخدم محدد
              </p>
            )}
          </div>
        </form>

        {/* Footer */}
        <div className="flex justify-end gap-3 border-t border-white/10 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-white/10 px-5 py-2.5 text-sm font-medium text-gray-300 transition-colors hover:bg-white/5"
          >
            إلغاء
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="rounded-xl bg-brand-500/20 px-5 py-2.5 text-sm font-medium text-brand-300 transition-colors hover:bg-brand-500/30 disabled:opacity-50"
          >
            {submitting ? 'جاري الحفظ...' : isEdit ? 'تحديث' : 'إنشاء'}
          </button>
        </div>
      </div>
    </div>
  );
}
