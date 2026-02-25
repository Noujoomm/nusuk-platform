'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { searchApi, aiApi, tracksApi } from '@/lib/api';
import { useDebounce } from '@/hooks/use-debounce';
import {
  Search,
  Brain,
  Zap,
  FileText,
  GitBranch,
  Users,
  FolderOpen,
  UserCheck,
  Target,
  AlertTriangle,
  BookOpen,
  Loader2,
  SlidersHorizontal,
  X,
  ArrowLeft,
  Sparkles,
  RefreshCw,
  Database,
} from 'lucide-react';

// ─── Types ─────────────────────────────────────────
interface KeywordResult {
  type: string;
  id: string;
  title: string;
  titleAr?: string;
  subtitle?: string;
  trackName?: string;
  trackId?: string;
}

interface SemanticResult {
  entityType: string;
  entityId: string;
  content: string;
  trackId?: string;
  similarity: number;
  metadata?: Record<string, any>;
}

type SearchMode = 'keyword' | 'semantic';

// ─── Config ────────────────────────────────────────
const ENTITY_TYPE_CONFIG: Record<string, { label: string; icon: typeof FileText; color: string }> = {
  record:      { label: 'السجلات',      icon: FileText,       color: 'text-blue-400 bg-blue-500/20' },
  track:       { label: 'المسارات',     icon: GitBranch,      color: 'text-purple-400 bg-purple-500/20' },
  employee:    { label: 'الموظفون',     icon: UserCheck,      color: 'text-emerald-400 bg-emerald-500/20' },
  report:      { label: 'التقارير',     icon: FileText,       color: 'text-amber-400 bg-amber-500/20' },
  file:        { label: 'الملفات',      icon: FolderOpen,     color: 'text-cyan-400 bg-cyan-500/20' },
  user:        { label: 'المستخدمون',   icon: Users,          color: 'text-pink-400 bg-pink-500/20' },
  scope:       { label: 'نطاق العمل',   icon: BookOpen,       color: 'text-indigo-400 bg-indigo-500/20' },
  kpi:         { label: 'مؤشرات الأداء', icon: Target,        color: 'text-orange-400 bg-orange-500/20' },
  penalty:     { label: 'المخالفات',    icon: AlertTriangle,  color: 'text-red-400 bg-red-500/20' },
  deliverable: { label: 'المخرجات',     icon: BookOpen,       color: 'text-teal-400 bg-teal-500/20' },
};

const SEMANTIC_ENTITY_TYPES = ['scope', 'kpi', 'penalty', 'deliverable', 'employee'];

function getResultRoute(type: string, id: string, trackId?: string): string {
  switch (type) {
    case 'record':      return `/tracks/${trackId}`;
    case 'track':       return `/tracks/${id}`;
    case 'employee':    return '/employees';
    case 'report':      return '/reports';
    case 'file':        return '/files';
    case 'user':        return '/users';
    case 'scope':
    case 'kpi':
    case 'penalty':
    case 'deliverable': return trackId ? `/tracks/${trackId}` : '/tracks';
    default:            return '/';
  }
}

// ─── Component ─────────────────────────────────────
export default function SearchPage() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<SearchMode>('keyword');
  const [loading, setLoading] = useState(false);
  const [keywordResults, setKeywordResults] = useState<KeywordResult[]>([]);
  const [semanticResults, setSemanticResults] = useState<SemanticResult[]>([]);
  const [filterType, setFilterType] = useState<string>('');
  const [filterTrack, setFilterTrack] = useState<string>('');
  const [tracks, setTracks] = useState<Array<{ id: string; nameAr: string }>>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [indexing, setIndexing] = useState(false);
  const [indexStats, setIndexStats] = useState<{ total: number; byType: Record<string, number> } | null>(null);
  const [searched, setSearched] = useState(false);

  const debouncedQuery = useDebounce(query, 400);

  // Load tracks for filter dropdown
  useEffect(() => {
    tracksApi.list().then(({ data }) => {
      const list = data.data || data || [];
      setTracks(list.map((t: any) => ({ id: t.id, nameAr: t.nameAr || t.name })));
    }).catch(() => {});
  }, []);

  // Perform search when debounced query or mode changes
  useEffect(() => {
    if (debouncedQuery.length < 2) {
      setKeywordResults([]);
      setSemanticResults([]);
      setSearched(false);
      return;
    }

    let cancelled = false;

    const doSearch = async () => {
      setLoading(true);
      setSearched(true);
      try {
        if (mode === 'keyword') {
          const params: any = {};
          if (filterType) params.types = filterType;
          if (filterTrack) params.trackId = filterTrack;
          const { data } = await searchApi.search(debouncedQuery, params);
          if (!cancelled) setKeywordResults(data.results || data.data || []);
        } else {
          const params: any = {};
          if (filterType) params.types = filterType;
          if (filterTrack) params.trackId = filterTrack;
          const { data } = await aiApi.semanticSearch(debouncedQuery, params);
          if (!cancelled) setSemanticResults(data.results || []);
        }
      } catch {
        if (!cancelled) {
          setKeywordResults([]);
          setSemanticResults([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    doSearch();
    return () => { cancelled = true; };
  }, [debouncedQuery, mode, filterType, filterTrack]);

  const handleReindex = useCallback(async () => {
    setIndexing(true);
    try {
      await aiApi.indexAll();
      const { data } = await aiApi.embeddingStats();
      setIndexStats(data);
    } catch {
      // Silently handle
    }
    setIndexing(false);
  }, []);

  // Load embedding stats on mount
  useEffect(() => {
    aiApi.embeddingStats()
      .then(({ data }) => setIndexStats(data))
      .catch(() => {});
  }, []);

  // Grouped keyword results
  const groupedKeyword = keywordResults.reduce<Record<string, KeywordResult[]>>((acc, r) => {
    if (!acc[r.type]) acc[r.type] = [];
    acc[r.type].push(r);
    return acc;
  }, {});

  // Grouped semantic results
  const groupedSemantic = semanticResults.reduce<Record<string, SemanticResult[]>>((acc, r) => {
    if (!acc[r.entityType]) acc[r.entityType] = [];
    acc[r.entityType].push(r);
    return acc;
  }, {});

  const totalResults = mode === 'keyword' ? keywordResults.length : semanticResults.length;
  const availableTypes = mode === 'keyword'
    ? ['record', 'track', 'employee', 'report', 'file', 'user']
    : SEMANTIC_ENTITY_TYPES;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Search className="w-7 h-7 text-brand-400" />
            البحث الذكي
          </h1>
          <p className="text-sm text-gray-400 mt-1">بحث متقدم في جميع بيانات المنصة باستخدام الكلمات المفتاحية أو الذكاء الاصطناعي</p>
        </div>
      </div>

      {/* Search Bar */}
      <div className="glass rounded-2xl border border-white/10 p-6">
        {/* Mode Toggle */}
        <div className="flex items-center gap-2 mb-4">
          <button
            onClick={() => setMode('keyword')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              mode === 'keyword'
                ? 'bg-brand-500/20 text-brand-300 border border-brand-500/30'
                : 'text-gray-400 hover:bg-white/5 hover:text-white border border-transparent'
            }`}
          >
            <Zap className="w-4 h-4" />
            بحث بالكلمات المفتاحية
          </button>
          <button
            onClick={() => setMode('semantic')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              mode === 'semantic'
                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                : 'text-gray-400 hover:bg-white/5 hover:text-white border border-transparent'
            }`}
          >
            <Brain className="w-4 h-4" />
            بحث ذكي (AI)
          </button>

          <div className="flex-1" />

          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm transition-all ${
              showFilters ? 'bg-white/10 text-white' : 'text-gray-400 hover:bg-white/5 hover:text-white'
            }`}
          >
            <SlidersHorizontal className="w-4 h-4" />
            تصفية
          </button>
        </div>

        {/* Search Input */}
        <div className="relative">
          <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={mode === 'keyword' ? 'ابحث بالكلمات المفتاحية...' : 'اسأل بلغة طبيعية... مثال: ما هي نطاقات العمل المتعلقة بالبنية التحتية؟'}
            className="w-full rounded-xl border border-white/10 bg-white/5 pr-12 pl-12 py-4 text-base text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500/50"
            autoFocus
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute left-4 top-1/2 -translate-y-1/2 p-1 rounded-lg hover:bg-white/10 transition-colors"
            >
              <X className="w-4 h-4 text-gray-400" />
            </button>
          )}
        </div>

        {/* Filters */}
        {showFilters && (
          <div className="flex items-center gap-4 mt-4 pt-4 border-t border-white/10">
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-400">النوع:</label>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-brand-500/50"
              >
                <option value="">الكل</option>
                {availableTypes.map((t) => {
                  const config = ENTITY_TYPE_CONFIG[t];
                  return config ? <option key={t} value={t}>{config.label}</option> : null;
                })}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-400">المسار:</label>
              <select
                value={filterTrack}
                onChange={(e) => setFilterTrack(e.target.value)}
                className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-brand-500/50"
              >
                <option value="">الكل</option>
                {tracks.map((t) => (
                  <option key={t.id} value={t.id}>{t.nameAr}</option>
                ))}
              </select>
            </div>
            {(filterType || filterTrack) && (
              <button
                onClick={() => { setFilterType(''); setFilterTrack(''); }}
                className="text-xs text-red-400 hover:text-red-300 transition-colors"
              >
                مسح الفلاتر
              </button>
            )}
          </div>
        )}

        {/* Mode description */}
        {mode === 'semantic' && (
          <div className="mt-3 flex items-start gap-2 rounded-lg bg-purple-500/10 border border-purple-500/20 px-3 py-2">
            <Sparkles className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
            <p className="text-xs text-purple-300">
              البحث الذكي يستخدم الذكاء الاصطناعي لفهم المعنى وليس فقط الكلمات. يمكنك طرح أسئلة بلغة طبيعية مثل: &ldquo;ما هي الغرامات المتعلقة بالتأخير؟&rdquo; أو &ldquo;الموظفون في مجال التقنية&rdquo;
            </p>
          </div>
        )}
      </div>

      {/* Results Section */}
      <div className="space-y-4">
        {/* Loading */}
        {loading && (
          <div className="glass rounded-2xl border border-white/10 p-12 text-center">
            <Loader2 className="w-8 h-8 animate-spin text-brand-400 mx-auto mb-3" />
            <p className="text-sm text-gray-400">
              {mode === 'semantic' ? 'جاري البحث بالذكاء الاصطناعي...' : 'جاري البحث...'}
            </p>
          </div>
        )}

        {/* Empty state - no query */}
        {!loading && !searched && (
          <div className="glass rounded-2xl border border-white/10 p-12 text-center">
            <Search className="w-12 h-12 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400 text-sm">أدخل كلمة البحث للبدء</p>
            <p className="text-gray-600 text-xs mt-1">يدعم البحث العربية والإنجليزية</p>
          </div>
        )}

        {/* Empty state - no results */}
        {!loading && searched && totalResults === 0 && (
          <div className="glass rounded-2xl border border-white/10 p-12 text-center">
            <Search className="w-12 h-12 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400 text-sm">لا توجد نتائج لـ &ldquo;{query}&rdquo;</p>
            {mode === 'keyword' && (
              <button
                onClick={() => setMode('semantic')}
                className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-500/20 text-purple-300 text-sm hover:bg-purple-500/30 transition-colors"
              >
                <Brain className="w-4 h-4" />
                جرّب البحث الذكي
              </button>
            )}
          </div>
        )}

        {/* Results count */}
        {!loading && searched && totalResults > 0 && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-400">
              <span className="text-white font-medium">{totalResults}</span> نتيجة
              {mode === 'semantic' && <span className="text-purple-400 mr-2">• بحث ذكي</span>}
            </p>
          </div>
        )}

        {/* Keyword Results */}
        {!loading && mode === 'keyword' && Object.keys(groupedKeyword).length > 0 && (
          <div className="space-y-4">
            {Object.entries(groupedKeyword).map(([type, items]) => {
              const config = ENTITY_TYPE_CONFIG[type];
              if (!config) return null;
              const Icon = config.icon;

              return (
                <div key={type} className="glass rounded-2xl border border-white/10 overflow-hidden">
                  {/* Group Header */}
                  <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10 bg-white/5">
                    <div className={`p-1.5 rounded-lg ${config.color.split(' ')[1]}`}>
                      <Icon className={`w-4 h-4 ${config.color.split(' ')[0]}`} />
                    </div>
                    <span className="text-sm font-medium text-white">{config.label}</span>
                    <span className="text-xs text-gray-500 mr-auto">{items.length} نتيجة</span>
                  </div>

                  {/* Items */}
                  <div className="divide-y divide-white/5">
                    {items.map((result) => (
                      <button
                        key={`${result.type}-${result.id}`}
                        onClick={() => router.push(getResultRoute(result.type, result.id, result.trackId))}
                        className="flex items-center gap-3 w-full px-4 py-3 text-right hover:bg-white/5 transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-white truncate">
                            {result.titleAr || result.title}
                          </p>
                          {result.subtitle && (
                            <p className="text-xs text-gray-400 mt-0.5 truncate">{result.subtitle}</p>
                          )}
                        </div>
                        {result.trackName && (
                          <span className="shrink-0 rounded-lg bg-white/5 px-2.5 py-1 text-[11px] font-medium text-gray-300">
                            {result.trackName}
                          </span>
                        )}
                        <ArrowLeft className="w-4 h-4 text-gray-600 shrink-0" />
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Semantic Results */}
        {!loading && mode === 'semantic' && Object.keys(groupedSemantic).length > 0 && (
          <div className="space-y-4">
            {Object.entries(groupedSemantic).map(([type, items]) => {
              const config = ENTITY_TYPE_CONFIG[type];
              if (!config) return null;
              const Icon = config.icon;

              return (
                <div key={type} className="glass rounded-2xl border border-white/10 overflow-hidden">
                  {/* Group Header */}
                  <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10 bg-white/5">
                    <div className={`p-1.5 rounded-lg ${config.color.split(' ')[1]}`}>
                      <Icon className={`w-4 h-4 ${config.color.split(' ')[0]}`} />
                    </div>
                    <span className="text-sm font-medium text-white">{config.label}</span>
                    <span className="text-xs text-gray-500 mr-auto">{items.length} نتيجة</span>
                  </div>

                  {/* Items */}
                  <div className="divide-y divide-white/5">
                    {items.map((result) => (
                      <button
                        key={`${result.entityType}-${result.entityId}`}
                        onClick={() => router.push(getResultRoute(result.entityType, result.entityId, result.trackId || undefined))}
                        className="flex items-center gap-3 w-full px-4 py-3.5 text-right hover:bg-white/5 transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-white leading-relaxed">{result.content}</p>
                          {result.metadata?.name && (
                            <p className="text-xs text-gray-400 mt-1">{result.metadata.name}</p>
                          )}
                        </div>
                        {/* Similarity Score */}
                        <div className="shrink-0 flex items-center gap-1.5">
                          <div className="w-16 h-1.5 rounded-full bg-white/10 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-gradient-to-l from-purple-400 to-brand-400"
                              style={{ width: `${Math.round(result.similarity * 100)}%` }}
                            />
                          </div>
                          <span className="text-[11px] text-gray-400 font-mono w-10 text-left">
                            {Math.round(result.similarity * 100)}%
                          </span>
                        </div>
                        <ArrowLeft className="w-4 h-4 text-gray-600 shrink-0" />
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* AI Indexing Stats Panel */}
      <div className="glass rounded-2xl border border-white/10 p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Database className="w-5 h-5 text-brand-400" />
            <h3 className="text-sm font-medium text-white">فهرس البحث الذكي</h3>
          </div>
          <button
            onClick={handleReindex}
            disabled={indexing}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-brand-500/20 text-brand-300 text-xs hover:bg-brand-500/30 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${indexing ? 'animate-spin' : ''}`} />
            {indexing ? 'جاري الفهرسة...' : 'إعادة الفهرسة'}
          </button>
        </div>

        {indexStats ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
            <div className="rounded-xl bg-white/5 border border-white/10 p-3 text-center">
              <p className="text-lg font-bold text-white">{indexStats.total}</p>
              <p className="text-[11px] text-gray-400">إجمالي</p>
            </div>
            {Object.entries(indexStats.byType || {}).map(([type, count]) => {
              const config = ENTITY_TYPE_CONFIG[type];
              return (
                <div key={type} className="rounded-xl bg-white/5 border border-white/10 p-3 text-center">
                  <p className="text-lg font-bold text-white">{count as number}</p>
                  <p className="text-[11px] text-gray-400">{config?.label || type}</p>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-xs text-gray-500">لم يتم فهرسة البيانات بعد. اضغط على &ldquo;إعادة الفهرسة&rdquo; للبدء.</p>
        )}
      </div>
    </div>
  );
}
