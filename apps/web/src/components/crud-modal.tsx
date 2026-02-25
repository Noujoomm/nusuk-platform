'use client';

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';

export interface FieldDef {
  name: string;
  label: string;
  type: 'text' | 'textarea' | 'number' | 'select' | 'date' | 'checkbox';
  required?: boolean;
  options?: Array<{ value: string; label: string }>;
  placeholder?: string;
}

interface CrudModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => Promise<void>;
  title: string;
  fields: FieldDef[];
  initialData?: Record<string, any>;
  loading?: boolean;
}

export default function CrudModal({
  isOpen,
  onClose,
  onSubmit,
  title,
  fields,
  initialData,
  loading,
}: CrudModalProps) {
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const defaults: Record<string, any> = {};
      fields.forEach((f) => {
        if (initialData && initialData[f.name] !== undefined) {
          defaults[f.name] = f.type === 'date' && initialData[f.name]
            ? initialData[f.name].substring(0, 10)
            : initialData[f.name];
        } else {
          defaults[f.name] = f.type === 'checkbox' ? false : f.type === 'number' ? 0 : '';
        }
      });
      setFormData(defaults);
    }
  }, [isOpen, initialData, fields]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await onSubmit(formData);
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const updateField = (name: string, value: any) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="glass relative w-full max-w-lg max-h-[85vh] overflow-hidden rounded-2xl border border-white/10">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
          <h3 className="text-lg font-semibold text-white">{title}</h3>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-gray-400 transition-colors hover:bg-white/10 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="overflow-y-auto max-h-[60vh] p-6 space-y-4">
          {fields.map((field) => (
            <div key={field.name}>
              <label className="mb-1.5 block text-sm font-medium text-gray-300">
                {field.label}
                {field.required && <span className="text-red-400 mr-1">*</span>}
              </label>

              {field.type === 'textarea' ? (
                <textarea
                  value={formData[field.name] || ''}
                  onChange={(e) => updateField(field.name, e.target.value)}
                  required={field.required}
                  placeholder={field.placeholder}
                  rows={3}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:border-brand-500/50 focus:outline-none focus:ring-1 focus:ring-brand-500/50"
                />
              ) : field.type === 'select' ? (
                <select
                  value={formData[field.name] || ''}
                  onChange={(e) => updateField(field.name, e.target.value)}
                  required={field.required}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white focus:border-brand-500/50 focus:outline-none focus:ring-1 focus:ring-brand-500/50"
                >
                  <option value="">اختر...</option>
                  {field.options?.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              ) : field.type === 'checkbox' ? (
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData[field.name] || false}
                    onChange={(e) => updateField(field.name, e.target.checked)}
                    className="rounded border-white/20 bg-white/5 text-brand-500 focus:ring-brand-500/50"
                  />
                  <span className="text-sm text-gray-400">{field.placeholder}</span>
                </label>
              ) : (
                <input
                  type={field.type}
                  value={formData[field.name] ?? ''}
                  onChange={(e) =>
                    updateField(
                      field.name,
                      field.type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value,
                    )
                  }
                  required={field.required}
                  placeholder={field.placeholder}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:border-brand-500/50 focus:outline-none focus:ring-1 focus:ring-brand-500/50"
                />
              )}
            </div>
          ))}
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
            disabled={submitting || loading}
            className="rounded-xl bg-brand-500/20 px-5 py-2.5 text-sm font-medium text-brand-300 transition-colors hover:bg-brand-500/30 disabled:opacity-50"
          >
            {submitting ? 'جاري الحفظ...' : initialData ? 'تحديث' : 'إنشاء'}
          </button>
        </div>
      </div>
    </div>
  );
}
