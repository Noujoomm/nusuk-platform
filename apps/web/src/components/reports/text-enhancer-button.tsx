'use client';

/**
 * Smart text enhancer — sibling to VoiceFillButton.
 *
 * Sits in the form header next to "ملء بالصوت". Clicking it pops a
 * field picker (achievements / KPIs / challenges / support / upcoming
 * tasks / notes); we send THAT field's text to /api/text-enhancer/enhance,
 * then open a comparison modal where the user can accept, edit, or
 * cancel. On accept, we patch the audit row and call back into the
 * parent to swap the field's value.
 *
 * Visual idiom mirrors VoiceFillButton on purpose: same pill shape,
 * same amber-gradient hover, same dark glassmorphism modal — they're
 * meant to feel like one family.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, Sparkles, X, ChevronDown, Check, Pencil } from 'lucide-react';
import toast from 'react-hot-toast';
import { textEnhancerApi } from '@/lib/api';

// ─── Types ──────────────────────────────────────────────────────────

export type EnhancerFieldKey =
  | 'achievements'
  | 'kpiUpdates'
  | 'challenges'
  | 'supportNeeded'
  | 'upcomingTasks'
  | 'notes';

interface FieldDef {
  key: EnhancerFieldKey;
  label: string;
}

const FIELDS: readonly FieldDef[] = [
  { key: 'achievements', label: 'الإنجازات' },
  { key: 'kpiUpdates', label: 'تحديثات مؤشرات الأداء' },
  { key: 'challenges', label: 'التحديات' },
  { key: 'supportNeeded', label: 'الدعم المطلوب' },
  { key: 'upcomingTasks', label: 'المهام القادمة' },
  { key: 'notes', label: 'ملاحظات' },
];

interface QualityScores {
  language: number;
  organization: number;
  clarity: number;
  professionalism: number;
}

interface EnhanceResponse {
  enhancedText: string;
  interventionLevel: 'light' | 'medium' | 'heavy';
  qualityScores: QualityScores;
  changesCount: number;
  diagnosticSummary: string;
  auditId: string;
}

interface Props {
  trackId: string | null;
  formValues: Record<EnhancerFieldKey, string>;
  onApply: (key: EnhancerFieldKey, newText: string) => void;
  disabled?: boolean;
  /** Min words required for a field to be eligible. Default 10. The
   *  backend hard-floor is also 10 — stay in sync if changing it. */
  minWords?: number;
}

// ─── Component ──────────────────────────────────────────────────────

export function TextEnhancerButton({
  trackId,
  formValues,
  onApply,
  disabled,
  minWords = 10,
}: Props) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [enhancing, setEnhancing] = useState<EnhancerFieldKey | null>(null);
  const [result, setResult] = useState<
    | { field: EnhancerFieldKey; original: string; response: EnhanceResponse }
    | null
  >(null);
  const pickerRef = useRef<HTMLDivElement | null>(null);

  // Close field picker on outside click.
  useEffect(() => {
    if (!pickerOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (!pickerRef.current?.contains(e.target as Node)) setPickerOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [pickerOpen]);

  const fieldStates = useMemo(
    () =>
      FIELDS.map((f) => ({
        ...f,
        wordCount: countWords(formValues[f.key]),
      })),
    [formValues],
  );

  const startEnhance = async (field: EnhancerFieldKey) => {
    setPickerOpen(false);
    if (!trackId) {
      toast.error('اختر المسار أولاً قبل التحسين.');
      return;
    }
    const text = formValues[field];
    if (countWords(text) < minWords) {
      toast.error(`النص قصير جداً للتحسين (الحد الأدنى ${minWords} كلمة).`);
      return;
    }
    setEnhancing(field);
    const tid = toast.loading('جارٍ تحسين النص...');
    try {
      const { data } = await textEnhancerApi.enhance({
        text,
        trackId,
        fieldContext: FIELDS.find((f) => f.key === field)?.label,
      });
      toast.success('جاهز للمراجعة', { id: tid });
      setResult({
        field,
        original: text,
        response: data as EnhanceResponse,
      });
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      toast.error(typeof msg === 'string' ? msg : 'فشل تحسين النص', { id: tid });
    } finally {
      setEnhancing(null);
    }
  };

  const onAccept = async (finalText: string) => {
    if (!result) return;
    const auditId = result.response.auditId;
    const field = result.field;
    setResult(null);
    onApply(field, finalText);
    try {
      await textEnhancerApi.accept(auditId);
    } catch {
      // Soft-fail: the user already applied the text. The accept
      // flag is purely analytics — losing it isn't worth a toast.
    }
  };

  const isLoading = enhancing !== null;
  // Only the explicit `disabled` prop and a real in-flight request
  // disable the button. We INTENTIONALLY don't gate on `!trackId` —
  // the picker handles that case visibly with a banner, instead of
  // leaving the button "permanently dimmed" with only a hover-title
  // explaining why (hover doesn't fire on touch, and users routinely
  // missed it).
  const buttonDisabled = Boolean(disabled) || isLoading;
  const eligibleFieldCount = useMemo(
    () => fieldStates.filter((f) => f.wordCount >= minWords).length,
    [fieldStates, minWords],
  );

  return (
    <div className="relative" ref={pickerRef} dir="rtl">
      <button
        type="button"
        onClick={() => setPickerOpen((v) => !v)}
        disabled={buttonDisabled}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-violet-500/20 to-fuchsia-500/20 border border-violet-400/40 text-violet-100 hover:from-violet-500/30 hover:to-fuchsia-500/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        title={
          disabled
            ? 'غير متاح حالياً'
            : 'حسّن صياغة أحد الحقول النصية بالذكاء الاصطناعي'
        }
      >
        {isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Sparkles className="w-4 h-4" />
        )}
        تحسين بالذكاء الاصطناعي
        {!isLoading && <ChevronDown className="w-3.5 h-3.5 opacity-70" />}
      </button>

      {pickerOpen && !isLoading && (
        <div className="absolute z-30 mt-2 right-0 w-72 rounded-lg border border-white/10 bg-gray-900/95 backdrop-blur shadow-xl overflow-hidden">
          {!trackId ? (
            <div className="px-3 py-3 text-[12px] text-amber-200 bg-amber-500/10 border-b border-amber-400/20">
              اختر المسار من القائمة أعلاه أولاً، ثم سيُتاح تحسين الحقول.
            </div>
          ) : (
            <div className="px-3 py-2 text-[11px] text-gray-400 border-b border-white/5">
              اختر الحقل المراد تحسينه
              {eligibleFieldCount === 0 && (
                <span className="block text-amber-300/90 mt-0.5">
                  لا يوجد حقل به {minWords} كلمات أو أكثر بعد.
                </span>
              )}
            </div>
          )}
          <ul className="py-1">
            {fieldStates.map((f) => {
              const eligible = trackId !== null && f.wordCount >= minWords;
              const reason = !trackId
                ? 'اختر المسار أولاً'
                : f.wordCount < minWords
                  ? `اكتب على الأقل ${minWords} كلمات لتفعيل التحسين (الحالي: ${f.wordCount})`
                  : '';
              return (
                <li key={f.key}>
                  <button
                    type="button"
                    disabled={!eligible}
                    onClick={() => startEnhance(f.key)}
                    title={reason || undefined}
                    className="w-full text-right px-3 py-2 flex items-center justify-between gap-2 text-sm hover:bg-white/5 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                  >
                    <span className="text-white/90">{f.label}</span>
                    <span className="text-[11px] text-gray-500 tabular-nums">
                      {f.wordCount} {f.wordCount === 1 ? 'كلمة' : 'كلمات'}
                      {trackId && f.wordCount < minWords && (
                        <span className="text-amber-300/80"> • أقل من {minWords}</span>
                      )}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {result && (
        <ComparisonModal
          field={FIELDS.find((f) => f.key === result.field)!}
          original={result.original}
          response={result.response}
          onAccept={onAccept}
          onCancel={() => setResult(null)}
        />
      )}
    </div>
  );
}

// ─── Comparison modal ──────────────────────────────────────────────

const LEVEL_LABEL: Record<EnhanceResponse['interventionLevel'], string> = {
  light: 'تنقيح طفيف',
  medium: 'تحسين متوسط',
  heavy: 'إعادة صياغة شاملة',
};
const LEVEL_TONE: Record<EnhanceResponse['interventionLevel'], string> = {
  light: 'bg-emerald-500/15 border-emerald-400/40 text-emerald-200',
  medium: 'bg-amber-500/15 border-amber-400/40 text-amber-200',
  heavy: 'bg-rose-500/15 border-rose-400/40 text-rose-200',
};

function ComparisonModal({
  field,
  original,
  response,
  onAccept,
  onCancel,
}: {
  field: FieldDef;
  original: string;
  response: EnhanceResponse;
  onAccept: (text: string) => void | Promise<void>;
  onCancel: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editedText, setEditedText] = useState(response.enhancedText);
  const [activeTab, setActiveTab] = useState<'before' | 'after'>('after');

  // Esc closes; lock body scroll while open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onCancel();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onCancel]);

  const finalText = editing ? editedText : response.enhancedText;
  const canAccept = finalText.trim().length > 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      dir="rtl"
    >
      <div
        className="relative w-full max-w-5xl max-h-[90vh] overflow-hidden rounded-2xl border border-white/10 bg-gray-900/95 backdrop-blur shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <header className="px-5 py-4 border-b border-white/5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-white">
            <Sparkles className="w-5 h-5 text-violet-300" />
            <h2 className="text-base font-semibold">
              تحسين الذكاء الاصطناعي — {field.label}
            </h2>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="p-1.5 rounded-lg hover:bg-white/5 text-gray-400 hover:text-white"
            aria-label="إغلاق"
          >
            <X className="w-5 h-5" />
          </button>
        </header>

        {/* Meta strip */}
        <div className="px-5 py-3 border-b border-white/5 flex items-center gap-3 flex-wrap text-xs">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 ${LEVEL_TONE[response.interventionLevel]}`}
          >
            مستوى التدخل: {LEVEL_LABEL[response.interventionLevel]}
          </span>
          <span className="text-gray-400">
            عدد التغييرات تقريباً: <span className="tabular-nums text-white/90">{response.changesCount}</span>
          </span>
          <span className="text-gray-400">
            الجودة:{' '}
            <span className="tabular-nums text-white/90">
              {avg(response.qualityScores).toFixed(1)} / 5
            </span>
          </span>
          <span className="text-gray-500 truncate">
            {response.diagnosticSummary}
          </span>
        </div>

        {/* Mobile tabs */}
        <div className="md:hidden px-5 pt-3 flex gap-2">
          <TabButton active={activeTab === 'before'} onClick={() => setActiveTab('before')}>
            قبل
          </TabButton>
          <TabButton active={activeTab === 'after'} onClick={() => setActiveTab('after')}>
            بعد
          </TabButton>
        </div>

        {/* Body — split on md+, tabs on mobile */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Pane
              title="النص الأصلي"
              hidden={activeTab === 'after'}
              tone="muted"
            >
              <pre className="whitespace-pre-wrap break-words text-sm leading-7 text-gray-300">
                {original}
              </pre>
            </Pane>
            <Pane
              title={editing ? 'النص المحسّن (قابل للتعديل)' : 'النص المحسّن'}
              hidden={activeTab === 'before'}
              tone="primary"
            >
              {editing ? (
                <textarea
                  value={editedText}
                  onChange={(e) => setEditedText(e.target.value)}
                  className="w-full min-h-[280px] bg-transparent border border-white/10 rounded-lg p-3 text-sm leading-7 text-white resize-y focus:outline-none focus:border-violet-400/60"
                  dir="rtl"
                />
              ) : (
                <pre className="whitespace-pre-wrap break-words text-sm leading-7 text-white">
                  {response.enhancedText}
                </pre>
              )}
            </Pane>
          </div>
        </div>

        {/* Footer actions */}
        <footer className="px-5 py-3 border-t border-white/5 flex items-center justify-between gap-2 flex-wrap">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded-lg text-sm text-gray-300 hover:bg-white/5"
          >
            إلغاء
          </button>
          <div className="flex items-center gap-2">
            {!editing ? (
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm bg-white/5 border border-white/10 text-white hover:bg-white/10"
              >
                <Pencil className="w-4 h-4" />
                تعديل يدوي
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="px-3.5 py-2 rounded-lg text-sm text-gray-300 hover:bg-white/5"
              >
                إلغاء التعديل
              </button>
            )}
            <button
              type="button"
              disabled={!canAccept}
              onClick={() => onAccept(finalText)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm bg-emerald-500/20 border border-emerald-400/40 text-emerald-100 hover:bg-emerald-500/30 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Check className="w-4 h-4" />
              {editing ? 'تطبيق التعديلات' : 'قبول وتطبيق'}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}

function Pane({
  title,
  hidden,
  tone,
  children,
}: {
  title: string;
  hidden: boolean;
  tone: 'muted' | 'primary';
  children: React.ReactNode;
}) {
  return (
    <section
      className={`${hidden ? 'hidden md:block' : 'block'} rounded-xl border ${
        tone === 'primary'
          ? 'border-violet-400/30 bg-violet-500/[0.04]'
          : 'border-white/10 bg-white/[0.02]'
      } p-4`}
    >
      <header className="text-[11px] text-gray-400 mb-2">{title}</header>
      {children}
    </section>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 px-3 py-1.5 rounded-md text-xs ${
        active
          ? 'bg-violet-500/20 border border-violet-400/40 text-white'
          : 'bg-white/5 border border-white/10 text-gray-300'
      }`}
    >
      {children}
    </button>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────

/**
 * Arabic-aware word count.
 *
 * Pasted Arabic text routinely arrives with characters that a naive
 * `split(/\s+/)` treats as word-characters but humans don't:
 *   - U+00A0  non-breaking space (Word, web copy)
 *   - U+200C  zero-width non-joiner
 *   - U+200D  zero-width joiner
 *   - U+200E/F LTR/RTL marks
 *   - U+FEFF  zero-width no-break space (BOM)
 *   - U+0640  tatweel (kashida) — visual lengthening, not a word break,
 *             but it shouldn't be left in place either; we drop it so a
 *             tatweel-stretched word still counts as one word.
 * Tatweels INSIDE a word are removed; the other invisibles are turned
 * into regular spaces so they break words like a normal space would.
 */
function countWords(s: string | null | undefined): number {
  if (!s) return 0;
  return s
    .replace(/ـ/g, '')
    .replace(/[ ‌‍‎‏﻿]/g, ' ')
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 0).length;
}

function avg(s: QualityScores): number {
  return (s.language + s.organization + s.clarity + s.professionalism) / 4;
}
