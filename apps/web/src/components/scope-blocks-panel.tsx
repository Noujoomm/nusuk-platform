'use client';

import { useEffect, useState } from 'react';
import { scopeBlocksApi } from '@/lib/api';
import { cn, formatPercent, SCOPE_STATUS_LABELS, SCOPE_STATUS_COLORS } from '@/lib/utils';
import { useAuth } from '@/stores/auth';
import InlineEdit from '@/components/inline-edit';
import {
  ChevronDown,
  ChevronLeft,
  Layers,
  Plus,
  Upload,
  Search,
  BarChart3,
} from 'lucide-react';

interface ScopeBlock {
  id: string;
  trackId: string;
  code: string;
  title: string;
  content?: string;
  parentId?: string;
  orderIndex: number;
  progress: number;
  status: string;
  children?: ScopeBlock[];
}

interface ScopeBlocksPanelProps {
  trackId: string;
  trackColor: string;
}

export default function ScopeBlocksPanel({ trackId, trackColor }: ScopeBlocksPanelProps) {
  const { user } = useAuth();
  const [blocks, setBlocks] = useState<ScopeBlock[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [importText, setImportText] = useState('');
  const [showImport, setShowImport] = useState(false);
  const [importing, setImporting] = useState(false);

  const canEdit = user?.role === 'admin' || user?.role === 'pm' || user?.role === 'track_lead';

  const fetchData = async () => {
    try {
      const [blocksRes, statsRes] = await Promise.all([
        scopeBlocksApi.byTrack(trackId),
        scopeBlocksApi.stats(trackId),
      ]);
      setBlocks(blocksRes.data || []);
      setStats(statsRes.data || null);
    } catch {}
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [trackId]);

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const expandAll = () => {
    const allIds = new Set<string>();
    const collectIds = (items: ScopeBlock[]) => {
      items.forEach((b) => {
        allIds.add(b.id);
        if (b.children) collectIds(b.children);
      });
    };
    collectIds(blocks);
    setExpandedIds(allIds);
  };

  const collapseAll = () => setExpandedIds(new Set());

  const handleProgressUpdate = async (blockId: string, progress: number) => {
    await scopeBlocksApi.updateProgress(blockId, { progress, status: progress >= 100 ? 'completed' : progress > 0 ? 'in_progress' : 'pending' });
    await fetchData();
  };

  const handleTitleUpdate = async (blockId: string, title: string) => {
    await scopeBlocksApi.update(blockId, { title });
    await fetchData();
  };

  const handleImport = async () => {
    if (!importText.trim()) return;
    setImporting(true);
    try {
      await scopeBlocksApi.importText({ trackId, text: importText });
      setImportText('');
      setShowImport(false);
      await fetchData();
    } catch {}
    setImporting(false);
  };

  // Filter blocks by search
  const filterBlocks = (items: ScopeBlock[]): ScopeBlock[] => {
    if (!searchQuery) return items;
    return items.filter((b) => {
      const matches = b.title.includes(searchQuery) || b.code.includes(searchQuery) || b.content?.includes(searchQuery);
      const childMatches = b.children ? filterBlocks(b.children).length > 0 : false;
      return matches || childMatches;
    }).map((b) => ({
      ...b,
      children: b.children ? filterBlocks(b.children) : [],
    }));
  };

  const filteredBlocks = filterBlocks(blocks);

  const renderBlock = (block: ScopeBlock, depth: number = 0) => {
    const isExpanded = expandedIds.has(block.id);
    const hasChildren = block.children && block.children.length > 0;
    const progressColor = block.progress >= 100 ? '#10b981' : block.progress > 50 ? trackColor : block.progress > 0 ? '#f59e0b' : '#6b7280';

    return (
      <div key={block.id} className={cn('border-r-2 transition-colors', depth > 0 && 'mr-4')} style={{ borderColor: `${trackColor}30` }}>
        <div className="glass-hover rounded-xl border border-white/5 mb-2 overflow-hidden">
          {/* Block Header */}
          <div className="flex items-center gap-3 p-3.5 cursor-pointer hover:bg-white/5 transition-colors" onClick={() => hasChildren && toggleExpand(block.id)}>
            {/* Expand Icon */}
            <div className="w-5 shrink-0">
              {hasChildren && (
                isExpanded
                  ? <ChevronDown className="w-4 h-4 text-gray-400" />
                  : <ChevronLeft className="w-4 h-4 text-gray-400" />
              )}
            </div>

            {/* Code Badge */}
            <span
              className="shrink-0 px-2 py-0.5 rounded-md text-xs font-mono font-bold"
              style={{ backgroundColor: `${trackColor}20`, color: trackColor }}
            >
              {block.code}
            </span>

            {/* Title */}
            <div className="flex-1 min-w-0" onClick={(e) => e.stopPropagation()}>
              {canEdit ? (
                <InlineEdit
                  value={block.title}
                  onSave={(val) => handleTitleUpdate(block.id, val)}
                  className="text-sm font-medium"
                  canEdit={canEdit}
                />
              ) : (
                <span className="text-sm font-medium">{block.title}</span>
              )}
            </div>

            {/* Progress */}
            <div className="flex items-center gap-2 shrink-0">
              <span className={cn('text-xs px-2 py-0.5 rounded-full', SCOPE_STATUS_COLORS[block.status] || 'bg-gray-500/20 text-gray-300')}>
                {SCOPE_STATUS_LABELS[block.status] || block.status}
              </span>
              <div className="w-16 h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all duration-300" style={{ width: `${block.progress}%`, backgroundColor: progressColor }} />
              </div>
              <span className="text-xs font-mono text-gray-400 w-10 text-left">{Math.round(block.progress)}%</span>
            </div>
          </div>

          {/* Content + Progress Slider (when expanded or no children) */}
          {isExpanded && (
            <div className="border-t border-white/5 p-3.5 space-y-3">
              {block.content && (
                <p className="text-sm text-gray-400 leading-relaxed">{block.content}</p>
              )}
              {canEdit && (
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-500">التقدم:</span>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="5"
                    value={block.progress}
                    onChange={(e) => handleProgressUpdate(block.id, parseInt(e.target.value))}
                    className="flex-1 h-1.5 accent-brand-500 cursor-pointer"
                  />
                  <span className="text-xs text-gray-400 font-mono w-10">{Math.round(block.progress)}%</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Children */}
        {hasChildren && isExpanded && (
          <div className="mr-2">
            {block.children!.map((child) => renderBlock(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Stats Bar */}
      {stats && (
        <div className="grid grid-cols-3 gap-3">
          <div className="glass rounded-xl p-3 text-center">
            <p className="text-lg font-bold" style={{ color: trackColor }}>{stats.total || 0}</p>
            <p className="text-xs text-gray-400">إجمالي البنود</p>
          </div>
          <div className="glass rounded-xl p-3 text-center">
            <p className="text-lg font-bold text-emerald-300">{formatPercent(stats.averageProgress || 0)}</p>
            <p className="text-xs text-gray-400">متوسط التقدم</p>
          </div>
          <div className="glass rounded-xl p-3 text-center">
            <p className="text-lg font-bold text-amber-300">{stats.byStatus?.completed || 0}</p>
            <p className="text-xs text-gray-400">مكتمل</p>
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder="بحث في نطاق العمل..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 pr-10 text-sm text-white placeholder-gray-500 focus:border-brand-500/50 focus:outline-none"
          />
        </div>
        <button onClick={expandAll} className="px-3 py-2 rounded-xl text-xs text-gray-400 hover:bg-white/5 transition-colors">توسيع الكل</button>
        <button onClick={collapseAll} className="px-3 py-2 rounded-xl text-xs text-gray-400 hover:bg-white/5 transition-colors">طي الكل</button>
        {canEdit && (
          <button
            onClick={() => setShowImport(!showImport)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs bg-brand-500/20 text-brand-300 hover:bg-brand-500/30 transition-colors"
          >
            <Upload className="w-3.5 h-3.5" />
            استيراد نص
          </button>
        )}
      </div>

      {/* Import Panel */}
      {showImport && (
        <div className="glass rounded-xl border border-brand-500/30 p-4 space-y-3">
          <p className="text-sm text-gray-300">الصق النص المنظم (بتنسيق 1.7، 1.7.1 إلخ) لتحويله تلقائيا لبنود نطاق العمل:</p>
          <textarea
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            rows={8}
            placeholder="1.7 العنوان الرئيسي&#10;المحتوى هنا...&#10;1.7.1 العنوان الفرعي&#10;المحتوى الفرعي..."
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-gray-500 focus:border-brand-500/50 focus:outline-none font-mono"
            dir="rtl"
          />
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowImport(false)} className="px-4 py-2 rounded-xl text-sm text-gray-400 hover:bg-white/5 transition-colors">إلغاء</button>
            <button
              onClick={handleImport}
              disabled={importing || !importText.trim()}
              className="px-4 py-2 rounded-xl text-sm bg-brand-500/20 text-brand-300 hover:bg-brand-500/30 transition-colors disabled:opacity-50"
            >
              {importing ? 'جاري الاستيراد...' : 'استيراد'}
            </button>
          </div>
        </div>
      )}

      {/* Blocks Tree */}
      {filteredBlocks.length > 0 ? (
        <div className="space-y-1">
          {filteredBlocks.map((block) => renderBlock(block))}
        </div>
      ) : (
        <div className="glass rounded-2xl border border-white/10 p-12 text-center">
          <Layers className="w-12 h-12 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-400">لا توجد بنود نطاق عمل</p>
          {canEdit && (
            <p className="text-xs text-gray-500 mt-1">استخدم زر &quot;استيراد نص&quot; لإضافة بنود من نص منظم</p>
          )}
        </div>
      )}
    </div>
  );
}
