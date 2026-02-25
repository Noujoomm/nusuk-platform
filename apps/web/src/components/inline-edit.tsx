'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Check, X, Pencil } from 'lucide-react';

interface InlineEditProps {
  value: string;
  onSave: (value: string) => Promise<void>;
  type?: 'text' | 'textarea' | 'number' | 'select';
  options?: Array<{ value: string; label: string }>;
  className?: string;
  canEdit?: boolean;
  placeholder?: string;
  autoSave?: boolean;
  autoSaveDelay?: number;
}

export default function InlineEdit({
  value,
  onSave,
  type = 'text',
  options,
  className = '',
  canEdit = true,
  placeholder = 'انقر للتعديل...',
  autoSave = false,
  autoSaveDelay = 1200,
}: InlineEditProps) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(null);
  const autoSaveTimer = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setEditValue(value);
  }, [value]);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      if (type !== 'select' && 'select' in inputRef.current) {
        (inputRef.current as HTMLInputElement).select();
      }
    }
  }, [editing, type]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => { if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current); };
  }, []);

  const doSave = useCallback(async (val: string) => {
    if (val === value) return;
    setSaving(true);
    try {
      await onSave(val);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      setEditValue(value); // rollback
    }
    setSaving(false);
  }, [value, onSave]);

  const handleSave = async () => {
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    if (editValue === value) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      await onSave(editValue);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      setEditing(false);
    } catch {
      setEditValue(value);
    }
    setSaving(false);
  };

  const handleCancel = () => {
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    setEditValue(value);
    setEditing(false);
  };

  const handleChange = (newValue: string) => {
    setEditValue(newValue);

    if (autoSave) {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
      autoSaveTimer.current = setTimeout(() => doSave(newValue), autoSaveDelay);
    }

    // For select, save immediately
    if (type === 'select') {
      doSave(newValue).then(() => setEditing(false));
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && type !== 'textarea') {
      handleSave();
    }
    if (e.key === 'Escape') {
      handleCancel();
    }
  };

  if (!canEdit) {
    return <span className={className}>{value || <span className="text-gray-600">{placeholder}</span>}</span>;
  }

  if (editing) {
    const inputCls = 'flex-1 rounded-lg border border-brand-500/50 bg-white/5 px-2.5 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-brand-500/50';

    return (
      <div className="flex items-center gap-1.5">
        {type === 'textarea' ? (
          <textarea
            ref={inputRef as any}
            value={editValue}
            onChange={(e) => handleChange(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={() => { if (!autoSave) return; if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current); handleSave(); }}
            rows={2}
            className={inputCls}
          />
        ) : type === 'select' ? (
          <select
            ref={inputRef as any}
            value={editValue}
            onChange={(e) => handleChange(e.target.value)}
            onBlur={() => setEditing(false)}
            className={inputCls}
          >
            <option value="">اختر...</option>
            {options?.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        ) : (
          <input
            ref={inputRef as any}
            type={type}
            value={editValue}
            onChange={(e) => handleChange(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={() => { if (autoSave) { if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current); handleSave(); } }}
            className={inputCls}
          />
        )}
        {saving && <div className="w-3.5 h-3.5 border-2 border-brand-400 border-t-transparent rounded-full animate-spin shrink-0" />}
        {saved && <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
        {!autoSave && !saving && (
          <>
            <button
              onClick={handleSave}
              disabled={saving}
              className="p-1 rounded-md bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 transition-colors disabled:opacity-50"
            >
              <Check className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleCancel}
              className="p-1 rounded-md bg-red-500/20 text-red-300 hover:bg-red-500/30 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </>
        )}
      </div>
    );
  }

  return (
    <span
      onClick={() => setEditing(true)}
      className={`group/ie cursor-pointer inline-flex items-center gap-1.5 rounded px-1 -mx-1 hover:bg-white/5 transition-colors ${className}`}
    >
      {value || <span className="text-gray-600 italic">{placeholder}</span>}
      <Pencil className="w-3 h-3 text-gray-600 opacity-0 group-hover/ie:opacity-100 transition-opacity shrink-0" />
      {saved && <Check className="w-3 h-3 text-emerald-400 shrink-0 animate-pulse" />}
    </span>
  );
}
