'use client';

import { useCallback, useRef, useState } from 'react';
import { Upload, Trash2, CheckCircle, AlertCircle, CalendarDays, RefreshCw, FileText } from 'lucide-react';
import toast from 'react-hot-toast';
import { attendanceApi, BatchUploadResponse } from '@/lib/api';

const MAX_FILES = 12;
type Status = 'queued' | 'uploading' | 'success' | 'duplicate' | 'needs_date' | 'failed';

interface FileEntry {
  id: string;
  file: File;
  status: Status;
  manualDate?: string; // 'YYYY-MM-DD'
  result?: {
    reportDate?: string;
    coversCenter?: 'makkah' | 'madinah' | 'shared' | null;
    totalRecords?: number;
    matchedCount?: number;
    unmatchedCount?: number;
  };
  error?: string;
}

interface Props {
  onComplete?: () => void; // called after batch finishes; page uses to refresh upload list
}

export function BatchUploader({ onComplete }: Props) {
  const [center, setCenter] = useState<'auto' | 'makkah' | 'madinah'>('auto');
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const addFiles = useCallback((picked: FileList | File[] | null) => {
    if (!picked) return;
    const arr = Array.from(picked).filter(
      (f) => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'),
    );
    if (arr.length === 0) {
      toast.error('الرجاء اختيار ملفات PDF فقط');
      return;
    }
    setFiles((prev) => {
      const existing = new Set(prev.map((e) => `${e.file.name}__${e.file.size}`));
      const fresh = arr
        .filter((f) => !existing.has(`${f.name}__${f.size}`))
        .map((f) => ({ id: crypto.randomUUID(), file: f, status: 'queued' as Status }));
      const merged = [...prev, ...fresh];
      if (merged.length > MAX_FILES) {
        toast.error(`الحد الأقصى المسموح به هو ${MAX_FILES} ملف`);
        return merged.slice(0, MAX_FILES);
      }
      return merged;
    });
  }, []);

  const removeFile = (id: string) => setFiles((prev) => prev.filter((e) => e.id !== id));
  const clearAll = () => setFiles([]);
  const updateDate = (id: string, date: string) =>
    setFiles((prev) => prev.map((e) => (e.id === id ? { ...e, manualDate: date } : e)));

  const runBatch = useCallback(
    async (entries: FileEntry[]) => {
      const targetIds = new Set(entries.map((e) => e.id));
      setFiles((prev) =>
        prev.map((e) =>
          targetIds.has(e.id) ? { ...e, status: 'uploading' as Status, error: undefined } : e,
        ),
      );

      const dates: Record<string, string> = {};
      for (const e of entries) {
        if (e.manualDate) dates[e.file.name] = e.manualDate;
      }

      try {
        const centerOverride = center === 'auto' ? undefined : center;
        const { data } = await attendanceApi.uploadPdfBatch(
          entries.map((e) => e.file),
          centerOverride,
          dates,
        );
        const byName = new Map(data.results.map((r) => [r.fileName, r]));
        setFiles((prev) =>
          prev.map((e) => {
            if (!targetIds.has(e.id)) return e;
            const r = byName.get(e.file.name);
            if (!r) return { ...e, status: 'failed' as Status, error: 'لم يُعثر على نتيجة' };
            if (r.success) {
              return {
                ...e,
                status: 'success' as Status,
                result: {
                  reportDate: r.reportDate,
                  coversCenter: r.coversCenter,
                  totalRecords: r.totalRecords,
                  matchedCount: r.matchedCount,
                  unmatchedCount: r.unmatchedCount,
                },
              };
            }
            const status: Status =
              r.errorCode === 'duplicate'
                ? 'duplicate'
                : r.errorCode === 'no_date'
                  ? 'needs_date'
                  : 'failed';
            return { ...e, status, error: r.error };
          }),
        );
        const goodMsg = data.succeeded > 0 ? `${data.succeeded} ناجح` : '';
        const badMsg = data.failed > 0 ? `${data.failed} فشل` : '';
        toast.success(`اكتمل: ${[goodMsg, badMsg].filter(Boolean).join(' · ')}`);
        onComplete?.();
      } catch (err: any) {
        const msg = err?.response?.data?.message ?? err?.message ?? 'فشل رفع الدفعة';
        toast.error(msg);
        setFiles((prev) =>
          prev.map((e) =>
            targetIds.has(e.id) ? { ...e, status: 'failed' as Status, error: msg } : e,
          ),
        );
      }
    },
    [center, onComplete],
  );

  const handleUploadAll = async () => {
    if (files.length === 0 || uploading) return;
    if (files.length > MAX_FILES) {
      toast.error(`الحد الأقصى المسموح به هو ${MAX_FILES} ملف`);
      return;
    }
    const queued = files.filter((e) => e.status === 'queued');
    if (queued.length === 0) {
      toast.error('لا توجد ملفات في الانتظار');
      return;
    }
    setUploading(true);
    try {
      await runBatch(queued);
    } finally {
      setUploading(false);
    }
  };

  const handleRetry = async (id: string) => {
    const entry = files.find((e) => e.id === id);
    if (!entry || uploading) return;
    if (entry.status === 'needs_date' && !entry.manualDate) {
      toast.error('يرجى تحديد التاريخ يدوياً قبل إعادة المحاولة');
      return;
    }
    setUploading(true);
    try {
      await runBatch([entry]);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="rounded-2xl bg-white/[0.03] border border-white/10 p-5 space-y-4" dir="rtl">
      {/* Header + city selector */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h3 className="font-semibold text-base">رفع دفعة ملفات الحضور والانصراف</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            حتى {MAX_FILES} ملف PDF في الرفعة الواحدة · يستخرج التاريخ والمدينة تلقائياً عند توفرها
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-gray-400 ml-1">المركز:</span>
          {(
            [
              {
                k: 'auto' as const,
                label: 'تلقائي',
                active: 'bg-brand-500/20 text-brand-200 border-brand-400/40',
              },
              {
                k: 'makkah' as const,
                label: '🕋 مكة',
                active: 'bg-emerald-500/20 text-emerald-200 border-emerald-400/40',
              },
              {
                k: 'madinah' as const,
                label: '🕌 المدينة',
                active: 'bg-blue-500/20 text-blue-200 border-blue-400/40',
              },
            ] as const
          ).map((c) => {
            const isActive = center === c.k;
            return (
              <button
                key={c.k}
                disabled={uploading}
                onClick={() => setCenter(c.k)}
                className={`text-xs px-3 py-1.5 rounded-lg transition-colors border disabled:opacity-50 ${
                  isActive
                    ? c.active
                    : 'bg-white/5 text-gray-400 border-transparent hover:bg-white/10'
                }`}
              >
                {c.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
        }}
        onDrop={(e) => {
          e.preventDefault();
          addFiles(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        className="cursor-pointer rounded-xl border-2 border-dashed border-white/15 hover:border-white/25 hover:bg-white/[0.03] p-8 text-center transition-colors"
      >
        <Upload className="w-7 h-7 mx-auto mb-2 text-gray-400" />
        <p className="text-sm text-gray-300">اسحب الملفات هنا أو اضغط للاختيار</p>
        <p className="text-[11px] text-gray-500 mt-1">
          PDF فقط · حتى {MAX_FILES} ملف
        </p>
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          multiple
          hidden
          onChange={(e) => {
            addFiles(e.target.files);
            if (inputRef.current) inputRef.current.value = '';
          }}
        />
      </div>

      {files.length > 0 && (
        <>
          <div className="rounded-xl border border-white/10 divide-y divide-white/10 overflow-hidden">
            {files.map((e) => (
              <FileRow
                key={e.id}
                entry={e}
                uploading={uploading}
                onRemove={() => removeFile(e.id)}
                onDateChange={(d) => updateDate(e.id, d)}
                onRetry={() => handleRetry(e.id)}
              />
            ))}
          </div>

          <div className="flex items-center justify-between gap-2 flex-wrap">
            <p className="text-xs text-gray-500">
              {files.length} / {MAX_FILES} ملف
            </p>
            <div className="flex items-center gap-2">
              {!uploading && (
                <button
                  onClick={clearAll}
                  className="text-xs px-3 py-2 rounded-lg bg-white/5 text-gray-300 hover:bg-white/10 transition-colors"
                >
                  مسح الكل
                </button>
              )}
              <button
                onClick={handleUploadAll}
                disabled={uploading || files.filter((e) => e.status === 'queued').length === 0}
                className="text-sm px-4 py-2 rounded-lg bg-brand-700 hover:bg-brand-800 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium transition-colors"
              >
                {uploading
                  ? 'جارٍ المعالجة...'
                  : `رفع ${files.filter((e) => e.status === 'queued').length} ملف`}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function FileRow({
  entry,
  uploading,
  onRemove,
  onDateChange,
  onRetry,
}: {
  entry: FileEntry;
  uploading: boolean;
  onRemove: () => void;
  onDateChange: (d: string) => void;
  onRetry: () => void;
}) {
  return (
    <div className="flex items-start gap-3 p-3 text-sm">
      <FileText className="w-4 h-4 mt-0.5 text-gray-500 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="truncate text-gray-200">{entry.file.name}</p>
        <p className="text-[11px] text-gray-500 mt-0.5">{(entry.file.size / 1024).toFixed(0)} KB</p>
        {entry.result && (
          <p className="text-[11px] text-gray-400 mt-1">
            📅 {entry.result.reportDate ?? '—'}
            {' · '}
            {entry.result.coversCenter === 'makkah'
              ? '🕋 مكة'
              : entry.result.coversCenter === 'madinah'
                ? '🕌 المدينة'
                : entry.result.coversCenter === 'shared'
                  ? 'مشترك'
                  : 'مختلطة'}
            {' · '}
            مطابقة: {entry.result.matchedCount ?? 0} · غير مطابقة: {entry.result.unmatchedCount ?? 0}
          </p>
        )}
        {entry.error && <p className="text-[11px] text-red-300 mt-1">{entry.error}</p>}
        {entry.status === 'needs_date' && (
          <div className="mt-2 flex items-center gap-2 flex-wrap">
            <span className="text-[11px] text-amber-300">حدّد التاريخ:</span>
            <input
              type="date"
              value={entry.manualDate ?? ''}
              onChange={(e) => onDateChange(e.target.value)}
              disabled={uploading}
              className="text-[11px] bg-white/5 border border-white/10 rounded-md px-2 py-1 text-gray-200 outline-none focus:border-white/25"
            />
            <button
              onClick={onRetry}
              disabled={uploading || !entry.manualDate}
              className="text-[11px] inline-flex items-center gap-1 px-2 py-1 rounded-md bg-amber-500/15 text-amber-200 hover:bg-amber-500/25 disabled:opacity-50"
            >
              <RefreshCw className="w-3 h-3" /> إعادة المحاولة
            </button>
          </div>
        )}
      </div>
      <StatusBadge status={entry.status} />
      {!uploading && entry.status !== 'uploading' && (
        <button
          onClick={onRemove}
          className="text-gray-500 hover:text-red-300 shrink-0 mt-0.5"
          title="حذف"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: Status }) {
  const map: Record<Status, { label: string; cls: string }> = {
    queued: { label: 'في الانتظار', cls: 'bg-white/5 text-gray-400' },
    uploading: { label: 'جارٍ المعالجة', cls: 'bg-amber-500/15 text-amber-300' },
    success: { label: 'نجح', cls: 'bg-emerald-500/15 text-emerald-300' },
    duplicate: { label: 'مكرر', cls: 'bg-orange-500/15 text-orange-300' },
    needs_date: { label: 'يحتاج تاريخ', cls: 'bg-amber-500/15 text-amber-200' },
    failed: { label: 'فشل', cls: 'bg-red-500/15 text-red-300' },
  };
  const m = map[status];
  return (
    <span className={`text-[11px] px-2 py-1 rounded-md font-medium shrink-0 ${m.cls}`}>
      {m.label}
    </span>
  );
}
