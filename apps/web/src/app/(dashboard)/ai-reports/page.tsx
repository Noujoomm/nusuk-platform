'use client';

import { useState, useEffect, useCallback } from 'react';
import { aiApi, tracksApi } from '@/lib/api';
import { cn, formatDateTime, AI_REPORT_TYPE_LABELS, formatNumber } from '@/lib/utils';
import {
  Brain,
  Download,
  Trash2,
  FileSpreadsheet,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Loader2,
  FileText,
  BarChart3,
  Calendar,
  TrendingUp,
  Target,
  PieChart,
} from 'lucide-react';
import toast from 'react-hot-toast';

// ─── Types ───

interface Track {
  id: string;
  name: string;
  nameAr: string;
}

interface ReportAuthor {
  id: string;
  name: string;
  nameAr: string;
}

interface ReportTrack {
  id: string;
  nameAr: string;
}

interface AIReport {
  id: string;
  titleAr: string;
  title?: string;
  type: string;
  contentHtml: string;
  trackId?: string;
  track?: ReportTrack;
  author?: ReportAuthor;
  createdAt: string;
}

// ─── Constants ───

type ReportType = keyof typeof AI_REPORT_TYPE_LABELS;

const REPORT_TYPE_ICONS: Record<string, typeof Brain> = {
  daily: Calendar,
  weekly: FileText,
  monthly: BarChart3,
  executive: TrendingUp,
  track_performance: Target,
  kpi_analysis: PieChart,
};

const REPORT_TYPE_COLORS: Record<string, { bg: string; text: string; border: string; selectedBg: string }> = {
  daily: {
    bg: 'bg-blue-500/10',
    text: 'text-blue-400',
    border: 'border-blue-500/20',
    selectedBg: 'bg-blue-500/20',
  },
  weekly: {
    bg: 'bg-violet-500/10',
    text: 'text-violet-400',
    border: 'border-violet-500/20',
    selectedBg: 'bg-violet-500/20',
  },
  monthly: {
    bg: 'bg-amber-500/10',
    text: 'text-amber-400',
    border: 'border-amber-500/20',
    selectedBg: 'bg-amber-500/20',
  },
  executive: {
    bg: 'bg-emerald-500/10',
    text: 'text-emerald-400',
    border: 'border-emerald-500/20',
    selectedBg: 'bg-emerald-500/20',
  },
  track_performance: {
    bg: 'bg-cyan-500/10',
    text: 'text-cyan-400',
    border: 'border-cyan-500/20',
    selectedBg: 'bg-cyan-500/20',
  },
  kpi_analysis: {
    bg: 'bg-rose-500/10',
    text: 'text-rose-400',
    border: 'border-rose-500/20',
    selectedBg: 'bg-rose-500/20',
  },
};

const BADGE_COLORS: Record<string, string> = {
  daily: 'bg-blue-500/20 text-blue-300',
  weekly: 'bg-violet-500/20 text-violet-300',
  monthly: 'bg-amber-500/20 text-amber-300',
  executive: 'bg-emerald-500/20 text-emerald-300',
  track_performance: 'bg-cyan-500/20 text-cyan-300',
  kpi_analysis: 'bg-rose-500/20 text-rose-300',
};

// ─── Component ───

export default function AIReportsPage() {
  const [reports, setReports] = useState<AIReport[]>([]);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Generate form state
  const [selectedType, setSelectedType] = useState<ReportType>('weekly');
  const [selectedTrackId, setSelectedTrackId] = useState('');

  // ─── Data fetching ───

  const loadReports = useCallback(async () => {
    try {
      const { data } = await aiApi.listReports();
      setReports(data?.data || data || []);
    } catch {
      toast.error('فشل تحميل التقارير');
    }
  }, []);

  const loadTracks = useCallback(async () => {
    try {
      const { data } = await tracksApi.list();
      setTracks(data?.data || data || []);
    } catch {
      // Tracks are needed for the selector but not critical
    }
  }, []);

  useEffect(() => {
    Promise.all([loadReports(), loadTracks()]).finally(() => setLoading(false));
  }, [loadReports, loadTracks]);

  // ─── Handlers ───

  const handleGenerate = async () => {
    if (selectedType === 'track_performance' && !selectedTrackId) {
      toast.error('يرجى اختيار المسار لتقرير أداء المسار');
      return;
    }

    setGenerating(true);
    try {
      const payload: Record<string, any> = { type: selectedType };
      if (selectedTrackId) {
        payload.trackId = selectedTrackId;
      }

      await aiApi.generateReport(payload);
      toast.success('تم إنشاء التقرير بنجاح');
      await loadReports();
    } catch {
      toast.error('فشل إنشاء التقرير');
    } finally {
      setGenerating(false);
    }
  };

  const handleDownloadExcel = async (id: string) => {
    try {
      const { data } = await aiApi.downloadExcel(id);
      const blob = new Blob([data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `ai-report-${id}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      toast.success('تم تحميل الملف');
    } catch {
      toast.error('فشل تحميل الملف');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('هل أنت متأكد من حذف هذا التقرير؟')) return;

    setDeletingId(id);
    try {
      await aiApi.deleteReport(id);
      toast.success('تم حذف التقرير');
      setReports((prev) => prev.filter((r) => r.id !== id));
      if (expandedId === id) setExpandedId(null);
    } catch {
      toast.error('فشل حذف التقرير');
    } finally {
      setDeletingId(null);
    }
  };

  // ─── Loading state ───

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-3">
          <div className="p-2 rounded-xl bg-brand-500/20">
            <Brain className="w-6 h-6 text-brand-400" />
          </div>
          التقارير الذكية
        </h1>
        <p className="text-gray-400 mt-1">
          إنشاء وإدارة التقارير المولّدة بالذكاء الاصطناعي
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="glass p-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-brand-500/20">
              <Sparkles className="w-5 h-5 text-brand-400" />
            </div>
            <div className="min-w-0">
              <p className="text-lg font-bold truncate">
                {formatNumber(reports.length)}
              </p>
              <p className="text-xs text-gray-400">إجمالي التقارير المولّدة</p>
            </div>
          </div>
        </div>
        {(['daily', 'weekly', 'monthly'] as const).map((type) => {
          const count = reports.filter((r) => r.type === type).length;
          const Icon = REPORT_TYPE_ICONS[type];
          const colors = REPORT_TYPE_COLORS[type];
          return (
            <div key={type} className="glass p-4">
              <div className="flex items-center gap-3">
                <div className={cn('p-2.5 rounded-xl', colors.bg)}>
                  <Icon className={cn('w-5 h-5', colors.text)} />
                </div>
                <div className="min-w-0">
                  <p className="text-lg font-bold truncate">
                    {formatNumber(count)}
                  </p>
                  <p className="text-xs text-gray-400">
                    {AI_REPORT_TYPE_LABELS[type]}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Generate Report Card */}
      <div className="glass rounded-2xl border border-white/10 p-6 space-y-5">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-brand-500/20">
            <Sparkles className="w-5 h-5 text-brand-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">إنشاء تقرير ذكي</h2>
            <p className="text-sm text-gray-400">
              اختر نوع التقرير وسيقوم الذكاء الاصطناعي بتحليل البيانات وإنشاء
              تقرير شامل
            </p>
          </div>
        </div>

        {/* Report type selector cards */}
        <div>
          <label className="block text-sm text-gray-400 mb-3">نوع التقرير</label>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {Object.entries(AI_REPORT_TYPE_LABELS).map(([type, label]) => {
              const Icon = REPORT_TYPE_ICONS[type] || Brain;
              const colors = REPORT_TYPE_COLORS[type] || REPORT_TYPE_COLORS.daily;
              const isSelected = selectedType === type;

              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => setSelectedType(type as ReportType)}
                  className={cn(
                    'relative flex flex-col items-center gap-2 p-4 rounded-xl border transition-all duration-200',
                    isSelected
                      ? cn(colors.selectedBg, colors.border, 'border-2 ring-1', `ring-${colors.text.replace('text-', '')}/30`)
                      : 'bg-white/5 border-white/10 hover:bg-white/10',
                  )}
                >
                  <div
                    className={cn(
                      'p-2.5 rounded-xl transition-colors',
                      isSelected ? colors.bg : 'bg-white/5',
                    )}
                  >
                    <Icon
                      className={cn(
                        'w-5 h-5 transition-colors',
                        isSelected ? colors.text : 'text-gray-400',
                      )}
                    />
                  </div>
                  <span
                    className={cn(
                      'text-xs font-medium text-center transition-colors',
                      isSelected ? 'text-white' : 'text-gray-400',
                    )}
                  >
                    {label}
                  </span>
                  {isSelected && (
                    <div
                      className={cn(
                        'absolute top-2 left-2 w-2 h-2 rounded-full',
                        colors.text.replace('text-', 'bg-'),
                      )}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Track selector - shown for track_performance or optionally for others */}
        <div>
          <label className="block text-sm text-gray-400 mb-1">
            المسار{' '}
            {selectedType === 'track_performance' ? (
              <span className="text-red-400">*</span>
            ) : (
              <span className="text-gray-600">(اختياري)</span>
            )}
          </label>
          <select
            value={selectedTrackId}
            onChange={(e) => setSelectedTrackId(e.target.value)}
            className="input-field w-full md:w-1/2"
          >
            <option value="">
              {selectedType === 'track_performance'
                ? 'اختر المسار'
                : 'جميع المسارات'}
            </option>
            {tracks.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nameAr}
              </option>
            ))}
          </select>
        </div>

        {/* Generate button */}
        <div>
          <button
            onClick={handleGenerate}
            disabled={generating}
            className={cn(
              'btn-primary flex items-center gap-2 px-6 py-3 text-base',
              generating && 'opacity-70 cursor-not-allowed',
            )}
          >
            {generating ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>جاري إنشاء التقرير بالذكاء الاصطناعي...</span>
              </>
            ) : (
              <>
                <Brain className="w-5 h-5" />
                <span>إنشاء التقرير</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Reports List */}
      <div>
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <FileSpreadsheet className="w-5 h-5 text-gray-400" />
          التقارير المولّدة
          <span className="text-sm font-normal text-gray-500">
            ({formatNumber(reports.length)})
          </span>
        </h2>

        {reports.length === 0 ? (
          <div className="glass p-12 text-center">
            <Brain className="w-12 h-12 mx-auto mb-4 text-gray-600" />
            <p className="text-gray-400 text-lg mb-1">لا توجد تقارير بعد</p>
            <p className="text-gray-500 text-sm">
              استخدم النموذج أعلاه لإنشاء أول تقرير ذكي
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {reports.map((report) => {
              const isExpanded = expandedId === report.id;
              const typeColors = BADGE_COLORS[report.type] || 'bg-gray-500/20 text-gray-300';
              const trackName =
                report.track?.nameAr ||
                tracks.find((t) => t.id === report.trackId)?.nameAr;

              return (
                <div key={report.id} className="glass overflow-hidden">
                  {/* Report Header */}
                  <button
                    onClick={() =>
                      setExpandedId(isExpanded ? null : report.id)
                    }
                    className="w-full flex items-center justify-between p-4 text-right hover:bg-white/5 transition-colors"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-brand-500/10 flex items-center justify-center flex-shrink-0">
                        <Brain className="w-5 h-5 text-brand-400" />
                      </div>
                      <div className="text-right min-w-0 flex-1">
                        <p className="text-sm font-semibold text-white truncate">
                          {report.titleAr || report.title || 'تقرير بدون عنوان'}
                        </p>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          {report.author?.nameAr && (
                            <span className="text-xs text-gray-400">
                              {report.author.nameAr}
                            </span>
                          )}
                          {trackName && (
                            <>
                              {report.author?.nameAr && (
                                <span className="text-gray-600">|</span>
                              )}
                              <span className="text-xs text-brand-300">
                                {trackName}
                              </span>
                            </>
                          )}
                          <span className="text-gray-600">|</span>
                          <span className="text-xs text-gray-500">
                            {formatDateTime(report.createdAt)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 flex-shrink-0 mr-3">
                      <span className={cn('badge text-xs', typeColors)}>
                        {AI_REPORT_TYPE_LABELS[report.type] || report.type}
                      </span>
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-gray-500" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-gray-500" />
                      )}
                    </div>
                  </button>

                  {/* Expanded Content */}
                  {isExpanded && (
                    <div className="border-t border-white/5">
                      {/* Action buttons */}
                      <div className="flex items-center gap-2 px-4 pt-3">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDownloadExcel(report.id);
                          }}
                          className="btn-secondary flex items-center gap-2 text-sm py-1.5 px-3"
                        >
                          <Download className="w-4 h-4" />
                          تحميل Excel
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(report.id);
                          }}
                          disabled={deletingId === report.id}
                          className="btn-danger flex items-center gap-2 text-sm py-1.5 px-3"
                        >
                          {deletingId === report.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                          حذف
                        </button>
                      </div>

                      {/* Report content */}
                      {report.contentHtml ? (
                        <div className="p-4">
                          <div
                            className="glass rounded-xl border border-white/10 p-5 prose prose-invert prose-sm max-w-none
                              prose-headings:text-gray-100 prose-headings:font-semibold
                              prose-p:text-gray-300 prose-p:leading-relaxed
                              prose-strong:text-white
                              prose-ul:text-gray-300 prose-ol:text-gray-300
                              prose-li:marker:text-brand-400
                              prose-table:border-white/10
                              prose-th:border-white/10 prose-th:text-gray-200 prose-th:p-2 prose-th:text-right
                              prose-td:border-white/10 prose-td:text-gray-300 prose-td:p-2"
                            dangerouslySetInnerHTML={{
                              __html: report.contentHtml,
                            }}
                          />
                        </div>
                      ) : (
                        <div className="p-6 text-center text-gray-500 text-sm">
                          لا يوجد محتوى للعرض
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
