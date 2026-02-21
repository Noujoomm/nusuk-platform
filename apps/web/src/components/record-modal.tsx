'use client';

import { useState } from 'react';
import { recordsApi } from '@/lib/api';
import { STATUS_LABELS, PRIORITY_LABELS } from '@/lib/utils';
import { X } from 'lucide-react';
import toast from 'react-hot-toast';

interface Props {
  trackId: string;
  record: any | null;
  fieldSchema: any;
  onClose: () => void;
  onSave: () => void;
}

export default function RecordModal({ trackId, record, fieldSchema, onClose, onSave }: Props) {
  const isEdit = !!record;
  const [form, setForm] = useState({
    title: record?.title || '',
    titleAr: record?.titleAr || '',
    status: record?.status || 'draft',
    priority: record?.priority || 'medium',
    owner: record?.owner || '',
    progress: record?.progress || 0,
    notes: record?.notes || '',
    dueDate: record?.dueDate?.split('T')[0] || '',
    extraFields: record?.extraFields || {},
  });
  const [saving, setSaving] = useState(false);

  const extraFieldDefs = fieldSchema?.fields || [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...form,
        trackId,
        dueDate: form.dueDate || undefined,
        progress: Number(form.progress),
      };

      if (isEdit) {
        await recordsApi.update(record.id, { ...payload, version: record.version });
        toast.success('تم تحديث السجل');
      } else {
        await recordsApi.create(payload);
        toast.success('تم إنشاء السجل');
      }
      onSave();
    } catch (err: any) {
      const msg = err.response?.data?.message || 'حدث خطأ';
      toast.error(typeof msg === 'string' ? msg : msg[0]);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="glass w-full max-w-lg max-h-[90vh] overflow-auto">
        <div className="flex items-center justify-between p-5 border-b border-white/10">
          <h2 className="text-lg font-semibold">{isEdit ? 'تعديل السجل' : 'سجل جديد'}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm text-gray-400 mb-1">العنوان</label>
              <input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="input-field"
                required
              />
            </div>

            <div className="col-span-2">
              <label className="block text-sm text-gray-400 mb-1">العنوان بالعربي</label>
              <input
                value={form.titleAr}
                onChange={(e) => setForm({ ...form, titleAr: e.target.value })}
                className="input-field"
              />
            </div>

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

            <div>
              <label className="block text-sm text-gray-400 mb-1">المسؤول</label>
              <input
                value={form.owner}
                onChange={(e) => setForm({ ...form, owner: e.target.value })}
                className="input-field"
              />
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

            <div className="col-span-2">
              <label className="block text-sm text-gray-400 mb-1">التقدم ({form.progress}%)</label>
              <input
                type="range"
                min={0}
                max={100}
                value={form.progress}
                onChange={(e) => setForm({ ...form, progress: Number(e.target.value) })}
                className="w-full accent-brand-500"
              />
            </div>

            <div className="col-span-2">
              <label className="block text-sm text-gray-400 mb-1">ملاحظات</label>
              <textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                className="input-field min-h-[80px]"
                rows={3}
              />
            </div>
          </div>

          {/* Extra Fields from track schema */}
          {extraFieldDefs.length > 0 && (
            <div className="border-t border-white/10 pt-4">
              <p className="text-sm font-medium text-gray-400 mb-3">حقول إضافية</p>
              <div className="grid grid-cols-2 gap-4">
                {extraFieldDefs.map((field: any) => (
                  <div key={field.key}>
                    <label className="block text-sm text-gray-400 mb-1">{field.label}</label>
                    <input
                      type={field.type === 'number' ? 'number' : 'text'}
                      value={form.extraFields[field.key] || ''}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          extraFields: { ...form.extraFields, [field.key]: e.target.value },
                        })
                      }
                      className="input-field"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center gap-3 pt-2">
            <button type="submit" disabled={saving} className="btn-primary flex-1 py-2.5 disabled:opacity-50">
              {saving ? 'جاري الحفظ...' : isEdit ? 'تحديث' : 'إنشاء'}
            </button>
            <button type="button" onClick={onClose} className="btn-secondary flex-1 py-2.5">
              إلغاء
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
