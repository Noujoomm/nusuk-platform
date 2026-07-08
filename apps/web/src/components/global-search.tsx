'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { searchApi } from '@/lib/api';
import { useDebounce } from '@/hooks/use-debounce';
import { useAuth } from '@/stores/auth';
import { useNav } from '@/components/navigation/NavigationProvider';
import {
  Search,
  FileText,
  GitBranch,
  Users,
  FolderOpen,
  X,
  CornerDownLeft,
  ArrowUpDown,
} from 'lucide-react';
import { RoyaLoader } from '@/components/ui/RoyaLoader';
import { navItemsForRole, type NavItem } from '@/lib/nav';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

interface SearchResult {
  id: string;
  type: 'record' | 'track' | 'employee' | 'report' | 'file' | 'user';
  title?: string;
  titleAr?: string;
  subtitle?: string;
  trackId?: string;
  trackName?: string;
}

const TYPE_CONFIG: Record<
  SearchResult['type'],
  { label: string; icon: typeof FileText }
> = {
  record: { label: 'السجلات', icon: FileText },
  track: { label: 'المسارات', icon: GitBranch },
  employee: { label: 'الموظفون', icon: Users },
  report: { label: 'التقارير', icon: FileText },
  file: { label: 'الملفات', icon: FolderOpen },
  user: { label: 'المستخدمون', icon: Users },
};

function getResultRoute(result: SearchResult): string {
  switch (result.type) {
    case 'record':
      return `/tracks/${result.trackId}`;
    case 'track':
      return `/tracks/${result.id}`;
    case 'employee':
      return '/employees';
    case 'report':
      return '/reports';
    case 'file':
      return '/files';
    case 'user':
      return '/users';
  }
}

/** يطابق عنصر تنقّل مع نص البحث (الاسم أو المرادفات، غير حسّاس لحالة الأحرف). */
function sectionMatches(item: NavItem, q: string): boolean {
  if (!q) return true;
  const needle = q.toLowerCase();
  if (item.label.toLowerCase().includes(needle)) return true;
  return (item.keywords ?? []).some((k) => k.toLowerCase().includes(needle));
}

export default function GlobalSearch({ isOpen, onClose }: Props) {
  const { navigate } = useNav();
  const { user } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const debouncedQuery = useDebounce(query, 300);

  // الأقسام المسموح بها للدور، مُفلترة محلياً بالنص (فورية بلا شبكة).
  const sections = useMemo(
    () => navItemsForRole(user?.role).filter((item) => sectionMatches(item, query)),
    [user?.role, query],
  );

  // Auto-focus input when modal opens
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setResults([]);
      setActiveIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Fetch entity results when debounced query changes (>= 2 chars)
  useEffect(() => {
    if (debouncedQuery.length < 2) {
      setResults([]);
      return;
    }

    let cancelled = false;
    const fetchResults = async () => {
      setLoading(true);
      try {
        const { data } = await searchApi.search(debouncedQuery);
        if (!cancelled) setResults(data.data || data || []);
      } catch {
        if (!cancelled) setResults([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchResults();
    return () => {
      cancelled = true;
    };
  }, [debouncedQuery]);

  // Group entity results by type
  const grouped = useMemo(
    () =>
      results.reduce<Record<string, SearchResult[]>>((acc, result) => {
        if (!acc[result.type]) acc[result.type] = [];
        acc[result.type].push(result);
        return acc;
      }, {}),
    [results],
  );

  // قائمة مسطّحة موحّدة (أقسام ثم كيانات) للتنقّل بالأسهم + Enter.
  const flatItems = useMemo(() => {
    const items: Array<
      | { kind: 'section'; section: NavItem }
      | { kind: 'result'; result: SearchResult }
    > = [];
    sections.forEach((section) => items.push({ kind: 'section', section }));
    Object.values(grouped).forEach((group) =>
      group.forEach((result) => items.push({ kind: 'result', result })),
    );
    return items;
  }, [sections, grouped]);

  // أبقِ المؤشّر ضمن الحدود عند تغيّر عدد العناصر.
  useEffect(() => {
    setActiveIndex((i) => Math.min(i, Math.max(0, flatItems.length - 1)));
  }, [flatItems.length]);

  const go = useCallback(
    (href: string) => {
      navigate(href);
      onClose();
    },
    [navigate, onClose],
  );

  const activate = useCallback(
    (item: (typeof flatItems)[number]) => {
      if (item.kind === 'section') go(item.section.href);
      else go(getResultRoute(item.result));
    },
    [go],
  );

  // اختصارات لوحة المفاتيح: Esc للإغلاق، الأسهم للتنقّل، Enter للتفعيل.
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex((i) => (flatItems.length ? (i + 1) % flatItems.length : 0));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex((i) =>
          flatItems.length ? (i - 1 + flatItems.length) % flatItems.length : 0,
        );
      } else if (e.key === 'Enter') {
        const item = flatItems[activeIndex];
        if (item) {
          e.preventDefault();
          activate(item);
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, flatItems, activeIndex, activate]);

  // مرّر العنصر النشِط إلى داخل منطقة الرؤية.
  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>('[data-active="true"]');
    el?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  if (!isOpen) return null;

  const showEntityEmpty =
    !loading && debouncedQuery.length >= 2 && results.length === 0;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="glass w-full max-w-2xl mx-auto mt-[15vh] overflow-hidden rounded-xl border border-white/10"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input */}
        <div className="flex items-center gap-3 border-b border-white/10 px-4">
          <Search className="h-5 w-5 shrink-0 text-gray-400" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="انتقل إلى قسم، أو ابحث عن سجلات ومسارات وملفات..."
            className="input-field flex-1 border-0 bg-transparent py-4 text-base focus:ring-0"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="rounded-lg p-1.5 hover:bg-white/10"
              aria-label="مسح البحث"
            >
              <X className="h-4 w-4 text-gray-400" />
            </button>
          )}
        </div>

        {/* Results Area */}
        <div ref={listRef} className="max-h-[55vh] overflow-y-auto">
          {/* الأقسام (تنقّل سريع) */}
          {sections.length > 0 && (
            <div>
              <div className="flex items-center gap-2 border-b border-white/5 bg-white/5 px-4 py-2">
                <ArrowUpDown className="h-4 w-4 text-gray-400" />
                <span className="text-xs font-medium text-gray-400">
                  الانتقال السريع
                </span>
              </div>
              {sections.map((section) => {
                const idx = flatItems.findIndex(
                  (it) => it.kind === 'section' && it.section.href === section.href,
                );
                const isActive = idx === activeIndex;
                const Icon = section.icon;
                return (
                  <button
                    key={section.href}
                    data-active={isActive}
                    onMouseMove={() => setActiveIndex(idx)}
                    onClick={() => go(section.href)}
                    className={cnRow(isActive)}
                  >
                    <Icon className="h-4 w-4 shrink-0 text-gray-400" />
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-white">
                      {section.label}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Loading (entities) */}
          {loading && (
            <div className="flex items-center justify-center py-8">
              <RoyaLoader fullScreen={false} size="sm" />
            </div>
          )}

          {/* Grouped entity results */}
          {!loading &&
            Object.entries(grouped).map(([type, items]) => {
              const config = TYPE_CONFIG[type as SearchResult['type']];
              if (!config) return null;
              const Icon = config.icon;

              return (
                <div key={type}>
                  <div className="flex items-center gap-2 border-b border-white/5 bg-white/5 px-4 py-2">
                    <Icon className="h-4 w-4 text-gray-400" />
                    <span className="text-xs font-medium text-gray-400">
                      {config.label}
                    </span>
                  </div>
                  {items.map((result) => {
                    const idx = flatItems.findIndex(
                      (it) => it.kind === 'result' && it.result === result,
                    );
                    const isActive = idx === activeIndex;
                    return (
                      <button
                        key={`${result.type}-${result.id}`}
                        data-active={isActive}
                        onMouseMove={() => setActiveIndex(idx)}
                        onClick={() => go(getResultRoute(result))}
                        className={cnRow(isActive)}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-white">
                            {result.titleAr || result.title}
                          </p>
                          {result.subtitle && (
                            <p className="mt-0.5 text-xs text-gray-400">
                              {result.subtitle}
                            </p>
                          )}
                        </div>
                        {result.trackName && (
                          <span className="shrink-0 rounded-lg bg-white/5 px-2 py-1 text-[10px] font-medium text-gray-300">
                            {result.trackName}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              );
            })}

          {/* Empty state — nothing (no sections, no entities) */}
          {sections.length === 0 && showEntityEmpty && (
            <div className="flex flex-col items-center justify-center gap-2 py-12 text-gray-400">
              <Search className="h-10 w-10" />
              <p className="text-sm">لا توجد نتائج</p>
            </div>
          )}
          {sections.length === 0 && !loading && debouncedQuery.length < 2 && (
            <div className="flex flex-col items-center justify-center gap-2 py-12 text-gray-400">
              <Search className="h-10 w-10" />
              <p className="text-sm">لا توجد أقسام مطابقة</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-center gap-4 border-t border-white/10 px-4 py-2.5 text-[11px] text-gray-500">
          <span className="flex items-center gap-1">
            <ArrowUpDown className="h-3 w-3" /> للتنقّل
          </span>
          <span className="flex items-center gap-1">
            <CornerDownLeft className="h-3 w-3" /> للفتح
          </span>
          <span>ESC للإغلاق</span>
        </div>
      </div>
    </div>
  );
}

/** صف نتيجة/قسم — نمط موحّد مع إبراز العنصر النشِط. */
function cnRow(isActive: boolean): string {
  return [
    'flex w-full items-center gap-3 border-b border-white/5 px-4 py-3 text-right transition-colors',
    isActive ? 'bg-brand-500/15' : 'hover:bg-white/10',
  ].join(' ');
}
