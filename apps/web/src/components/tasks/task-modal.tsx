'use client';

import { useState, useEffect, useMemo } from 'react';
import { X, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import { tasksApi } from '@/lib/api';
import { PRIORITY_LABELS, ASSIGNEE_TYPE_LABELS, cn } from '@/lib/utils';
import { Task } from '@/stores/tasks';

interface Track {
  id: string;
  nameAr: string;
  color?: string;
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

type AssigneeType = 'TRACK' | 'USER' | 'HR' | 'GLOBAL';

const EMPTY_FORM = {
  titleAr: '',
  title: '',
  descriptionAr: '',
  priority: 'medium',
  dueDate: '',
  assigneeType: 'GLOBAL' as AssigneeType,
  assigneeTrackId: '',
  assigneeUserId: '',
};

const ASSIGNEE_OPTIONS: { value: AssigneeType; label: string; icon: string }[] = [
  { value: 'TRACK', label: 'مسار', icon: '📁' },
  { value: 'USER', label: 'موظف', icon: '👤' },
  { value: 'HR', label: 'الموارد البشرية', icon: '🏢' },
  { value: 'GLOBAL', label: 'عام', icon: '🌐' },
];

export default function TaskModal({ isOpen, onClose, task, tracks, users, onSuccess }: Props) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [trackSearch, setTrackSearch] = useState('');
  const [userSearch, setUserSearch] = useState('');

  const isEdit = !!task;

  useEffect(() => {
    if (isOpen) {
      if (task) {
        setForm({
          titleAr: task.titleAr || '',
          title: task.title || '',
          descriptionAr: task.descriptionAr || '',
          priority: task.priority || 'medium',
          dueDate: task.dueDate ? task.dueDate.substring(0, 10) : '',
          assigneeType: task.assigneeType || 'GLOBAL',
          assigneeTrackId: task.assigneeTrackId || '',
          assigneeUserId: task.assigneeUserId || '',
        });
      } else {
        setForm(EMPTY_FORM);
      }
      setTrackSearch('');
      setUserSearch('');
    }
  }, [isOpen, task]);

  const filteredTracks = useMemo(() => {
    if (!trackSearch) return tracks;
    return tracks.filter((t) => t.nameAr.includes(trackSearch));
  }, [tracks, trackSearch]);

  const filteredUsers = useMemo(() => {
    if (!userSearch) return users;
    const q = userSearch.toLowerCase();
    return users.filter(
      (u) => u.nameAr?.includes(userSearch) || u.name?.toLowerCase().includes(q),
    );
  }, [users, userSearch]);

  if (!isOpen) return null;

  const updateField = (name: string, value: any) => {
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleAssigneeTypeChange = (type: AssigneeType) => {
    setForm((prev) => ({
      ...prev,
      assigneeType: type,
      assigneeTrackId: '',
      assigneeUserId: '',
    }));
    setTrackSearch('');
    setUserSearch('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.titleAr.trim()) {
      toast.error('العنوان بالعربية مطلوب');
      return;
    }

    // Validate assignment
    if (form.assigneeType === 'TRACK' && !form.assigneeTrackId) {
      toast.error('يجب تحديد المسار');
      return;
    }
    if (form.assigneeType === 'USER' && !form.assigneeUserId) {
      toast.error('يجب تحديد الموظف');
      return;
    }

    setSubmitting(true);
    try {
      const payload: any = {
        titleAr: form.titleAr,
        title: form.title || form.titleAr,
        descriptionAr: form.descriptionAr,
        priority: form.priority,
        dueDate: form.dueDate || undefined,
        assigneeType: form.assigneeType,
        assigneeTrackId: form.assigneeType === 'TRACK' ? form.assigneeTrackId : undefined,
        assigneeUserId: form.assigneeType === 'USER' ? form.assigneeUserId : undefined,
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

          {/* ─── Assign To ─── */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-300">
              تعيين إلى <span className="text-red-400 mr-1">*</span>
            </label>

            {/* Assignee type selector */}
            <div className="grid grid-cols-4 gap-2 mb-3">
              {ASSIGNEE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => handleAssigneeTypeChange(opt.value)}
                  className={cn(
                    'rounded-xl px-2 py-2.5 text-xs font-medium transition-all border text-center',
                    form.assigneeType === opt.value
                      ? 'bg-brand-500/20 border-brand-400/50 text-brand-300'
                      : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10',
                  )}
                >
                  <span className="block text-base mb-0.5">{opt.icon}</span>
                  {opt.label}
                </button>
              ))}
            </div>

            {/* Track selector (searchable) */}
            {form.assigneeType === 'TRACK' && (
              <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                <div className="relative mb-2">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
                  <input
                    type="text"
                    value={trackSearch}
                    onChange={(e) => setTrackSearch(e.target.value)}
                    placeholder="بحث في المسارات..."
                    className="input-field pr-9 text-sm"
                  />
                </div>
                <div className="max-h-36 overflow-y-auto space-y-1">
                  {filteredTracks.length === 0 ? (
                    <p className="text-xs text-gray-500 text-center py-2">لا توجد مسارات</p>
                  ) : (
                    filteredTracks.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => updateField('assigneeTrackId', t.id)}
                        className={cn(
                          'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                          form.assigneeTrackId === t.id
                            ? 'bg-brand-500/20 text-brand-300'
                            : 'text-gray-300 hover:bg-white/5',
                        )}
                      >
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: t.color || '#6366f1' }}
                        />
                        <span>{t.nameAr}</span>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* User/Employee selector (searchable) */}
            {form.assigneeType === 'USER' && (
              <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                <div className="relative mb-2">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
                  <input
                    type="text"
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    placeholder="بحث في الموظفين..."
                    className="input-field pr-9 text-sm"
                  />
                </div>
                <div className="max-h-36 overflow-y-auto space-y-1">
                  {filteredUsers.length === 0 ? (
                    <p className="text-xs text-gray-500 text-center py-2">لا يوجد موظفون</p>
                  ) : (
                    filteredUsers.map((u) => {
                      const initial = u.nameAr?.charAt(0) || u.name?.charAt(0) || '?';
                      return (
                        <button
                          key={u.id}
                          type="button"
                          onClick={() => updateField('assigneeUserId', u.id)}
                          className={cn(
                            'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                            form.assigneeUserId === u.id
                              ? 'bg-brand-500/20 text-brand-300'
                              : 'text-gray-300 hover:bg-white/5',
                          )}
                        >
                          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-500/30 text-[10px] font-bold text-brand-200 shrink-0">
                            {initial}
                          </div>
                          <span>{u.nameAr || u.name}</span>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {/* HR / GLOBAL info */}
            {form.assigneeType === 'HR' && (
              <div className="rounded-xl bg-purple-500/10 border border-purple-500/20 p-3">
                <p className="text-xs text-purple-300">
                  سيتم تعيين المهمة لقسم الموارد البشرية. جميع مستخدمي HR سيتمكنون من رؤيتها.
                </p>
              </div>
            )}
            {form.assigneeType === 'GLOBAL' && (
              <div className="rounded-xl bg-teal-500/10 border border-teal-500/20 p-3">
                <p className="text-xs text-teal-300">
                  مهمة عامة مرئية لجميع المستخدمين في النظام.
                </p>
              </div>
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
