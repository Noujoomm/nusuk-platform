'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  onSubmit: (body: string) => Promise<void>;
  placeholder?: string;
  initialValue?: string;
  onCancel?: () => void;
  autoFocus?: boolean;
}

export default function CommentForm({
  onSubmit,
  placeholder = 'اكتب تعليقك...',
  initialValue = '',
  onCancel,
  autoFocus = false,
}: Props) {
  const [body, setBody] = useState(initialValue);
  const [submitting, setSubmitting] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const isUpdate = !!initialValue;

  useEffect(() => {
    if (autoFocus && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [autoFocus]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = body.trim();
    if (!trimmed || submitting) return;

    setSubmitting(true);
    try {
      await onSubmit(trimmed);
      if (!isUpdate) {
        setBody('');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      handleSubmit(e);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
      <textarea
        ref={textareaRef}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="input-field resize-none text-sm"
        style={{ minHeight: '60px' }}
        disabled={submitting}
        rows={2}
      />

      <div className="flex items-center gap-2 justify-start">
        <button
          type="submit"
          disabled={!body.trim() || submitting}
          className={cn(
            'btn-primary flex items-center gap-1.5 px-4 py-1.5 text-sm',
            (!body.trim() || submitting) && 'opacity-50 cursor-not-allowed'
          )}
        >
          {submitting ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Send className="h-3.5 w-3.5" />
          )}
          {isUpdate ? 'تحديث' : 'إرسال'}
        </button>

        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="btn-secondary px-4 py-1.5 text-sm"
          >
            إلغاء
          </button>
        )}
      </div>
    </form>
  );
}
