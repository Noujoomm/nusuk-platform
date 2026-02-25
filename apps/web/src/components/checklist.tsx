'use client';

import { useState, useEffect } from 'react';
import { subtasksApi } from '@/lib/api';
import { formatDateTime } from '@/lib/utils';
import { X, CheckSquare } from 'lucide-react';
import toast from 'react-hot-toast';

interface Props {
  recordId: string;
  canEdit?: boolean;
}

export default function Checklist({ recordId, canEdit = false }: Props) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newItemText, setNewItemText] = useState('');

  const fetchChecklist = async () => {
    try {
      const { data } = await subtasksApi.getChecklist(recordId);
      setItems(data);
    } catch {
      toast.error('فشل تحميل قائمة المهام');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchChecklist();
  }, [recordId]);

  const checkedCount = items.filter((item) => item.isChecked).length;
  const totalCount = items.length;
  const percentage = totalCount > 0 ? Math.round((checkedCount / totalCount) * 100) : 0;

  const handleAddItem = async () => {
    const text = newItemText.trim();
    if (!text) return;
    try {
      await subtasksApi.createChecklistItem({ recordId, text });
      setNewItemText('');
      toast.success('تم إضافة العنصر');
      fetchChecklist();
    } catch (err: any) {
      const msg = err.response?.data?.message || 'حدث خطأ';
      toast.error(typeof msg === 'string' ? msg : msg[0]);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddItem();
    }
  };

  const handleToggle = async (item: any) => {
    try {
      await subtasksApi.updateChecklistItem(item.id, { isChecked: !item.isChecked });
      fetchChecklist();
    } catch {
      toast.error('فشل تحديث العنصر');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await subtasksApi.deleteChecklistItem(id);
      toast.success('تم حذف العنصر');
      fetchChecklist();
    } catch {
      toast.error('فشل حذف العنصر');
    }
  };

  return (
    <div className="glass rounded-xl border border-white/10">
      {/* Header */}
      <div className="border-b border-white/10 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-white">قائمة المهام</h3>
            <span className="rounded-full bg-white/5 px-2 py-0.5 text-xs text-gray-400">
              {checkedCount}/{totalCount}
            </span>
          </div>
          {totalCount > 0 && (
            <span className="text-xs text-gray-400">{percentage}%</span>
          )}
        </div>

        {/* Progress bar */}
        {totalCount > 0 && (
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/5">
            <div
              className="h-full rounded-full bg-brand-500 transition-all duration-300"
              style={{ width: `${percentage}%` }}
            />
          </div>
        )}
      </div>

      {/* Content */}
      <div className="divide-y divide-white/5">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
          </div>
        ) : items.length === 0 && !canEdit ? (
          <div className="flex flex-col items-center justify-center gap-3 py-12 text-gray-400">
            <CheckSquare className="h-10 w-10" />
            <p className="text-sm">لا توجد عناصر في القائمة</p>
          </div>
        ) : (
          <>
            {items.length === 0 && canEdit && (
              <div className="flex flex-col items-center justify-center gap-3 py-8 text-gray-400">
                <CheckSquare className="h-10 w-10" />
                <p className="text-sm">لا توجد عناصر في القائمة</p>
              </div>
            )}

            {items.map((item) => (
              <div
                key={item.id}
                className="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-white/5"
              >
                {/* Checkbox */}
                <button
                  onClick={() => handleToggle(item)}
                  className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors ${
                    item.isChecked
                      ? 'border-brand-500 bg-brand-500 text-white'
                      : 'border-white/20 bg-transparent hover:border-white/40'
                  }`}
                >
                  {item.isChecked && (
                    <svg className="h-3 w-3" viewBox="0 0 12 12" fill="none">
                      <path
                        d="M2 6l3 3 5-5"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                </button>

                {/* Text & meta */}
                <div className="min-w-0 flex-1">
                  <p
                    className={`text-sm ${
                      item.isChecked ? 'text-gray-500 line-through' : 'text-white'
                    }`}
                  >
                    {item.text}
                  </p>
                  {item.isChecked && item.checkedBy && (
                    <p className="mt-0.5 text-[10px] text-gray-400/60">
                      {item.checkedBy.name || item.checkedBy} &middot;{' '}
                      {item.checkedAt && formatDateTime(item.checkedAt)}
                    </p>
                  )}
                </div>

                {/* Delete button */}
                {canEdit && (
                  <button
                    onClick={() => handleDelete(item.id)}
                    className="mt-0.5 shrink-0 rounded p-1 text-gray-400 transition-colors hover:bg-white/10 hover:text-red-400"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            ))}
          </>
        )}
      </div>

      {/* Add new item input */}
      {canEdit && (
        <div className="border-t border-white/10 px-4 py-3">
          <input
            value={newItemText}
            onChange={(e) => setNewItemText(e.target.value)}
            onKeyDown={handleKeyDown}
            className="input-field"
            placeholder="أضف عنصر"
          />
        </div>
      )}
    </div>
  );
}
