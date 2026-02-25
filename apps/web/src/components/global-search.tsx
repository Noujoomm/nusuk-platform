'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { searchApi } from '@/lib/api';
import { useDebounce } from '@/hooks/use-debounce';
import {
  Search,
  FileText,
  GitBranch,
  Users,
  FolderOpen,
  Loader2,
  X,
} from 'lucide-react';

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

export default function GlobalSearch({ isOpen, onClose }: Props) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);

  const debouncedQuery = useDebounce(query, 300);

  // Auto-focus input when modal opens
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setResults([]);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Escape key to close
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Fetch search results when debounced query changes
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
        if (!cancelled) {
          setResults(data.data || data || []);
        }
      } catch {
        if (!cancelled) {
          setResults([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchResults();
    return () => {
      cancelled = true;
    };
  }, [debouncedQuery]);

  const handleResultClick = useCallback(
    (result: SearchResult) => {
      router.push(getResultRoute(result));
      onClose();
    },
    [router, onClose],
  );

  // Group results by type
  const grouped = results.reduce<Record<string, SearchResult[]>>(
    (acc, result) => {
      if (!acc[result.type]) acc[result.type] = [];
      acc[result.type].push(result);
      return acc;
    },
    {},
  );

  if (!isOpen) return null;

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
            placeholder="بحث عن سجلات، مسارات، ملفات..."
            className="input-field flex-1 border-0 bg-transparent py-4 text-base focus:ring-0"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="rounded-lg p-1.5 hover:bg-white/10"
            >
              <X className="h-4 w-4 text-gray-400" />
            </button>
          )}
        </div>

        {/* Results Area */}
        <div className="max-h-[50vh] overflow-y-auto">
          {/* Loading State */}
          {loading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-brand-400" />
            </div>
          )}

          {/* Initial State - No Query */}
          {!loading && !debouncedQuery && (
            <div className="flex flex-col items-center justify-center gap-2 py-12 text-gray-400">
              <kbd className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm font-medium">
                ⌘K
              </kbd>
              <p className="text-sm">⌘K للبحث السريع</p>
            </div>
          )}

          {/* Empty State */}
          {!loading && debouncedQuery.length >= 2 && results.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-2 py-12 text-gray-400">
              <Search className="h-10 w-10" />
              <p className="text-sm">لا توجد نتائج</p>
            </div>
          )}

          {/* Grouped Results */}
          {!loading &&
            Object.entries(grouped).map(([type, items]) => {
              const config = TYPE_CONFIG[type as SearchResult['type']];
              if (!config) return null;
              const Icon = config.icon;

              return (
                <div key={type}>
                  {/* Group Header */}
                  <div className="flex items-center gap-2 border-b border-white/5 bg-white/5 px-4 py-2">
                    <Icon className="h-4 w-4 text-gray-400" />
                    <span className="text-xs font-medium text-gray-400">
                      {config.label}
                    </span>
                  </div>

                  {/* Group Items */}
                  {items.map((result) => (
                    <button
                      key={`${result.type}-${result.id}`}
                      onClick={() => handleResultClick(result)}
                      className="flex w-full items-center gap-3 border-b border-white/5 px-4 py-3 text-right transition-colors hover:bg-white/10"
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
                  ))}
                </div>
              );
            })}
        </div>

        {/* Footer */}
        <div className="border-t border-white/10 px-4 py-2.5 text-center">
          <span className="text-xs text-gray-500">اضغط ESC للإغلاق</span>
        </div>
      </div>
    </div>
  );
}
