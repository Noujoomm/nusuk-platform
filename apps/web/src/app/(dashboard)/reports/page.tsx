'use client';

import { useEffect, useState, useCallback } from 'react';
import { reportsApi, tracksApi } from '@/lib/api';
import { formatDateTime } from '@/lib/utils';
import { FileText, Plus, Search, ChevronDown, Calendar, Brain } from 'lucide-react';
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

interface Report {
  id: string;
  title: string;
  type: 'daily' | 'weekly' | 'monthly' | 'annual';
  reportDate: string;
  achievements: string | null;
  kpiUpdates: string | null;
  challenges: string | null;
  supportNeeded: string | null;
  notes: string | null;
  aiSummary: string | null;
  createdAt: string;
  author: ReportAuthor;
  track: ReportTrack;
}

interface ReportStats {
  total: number;
  daily: number;
  weekly: number;
  monthly: number;
  annual: number;
}

interface CreateReportForm {
  trackId: string;
  type: 'daily' | 'weekly' | 'monthly' | 'annual';
  title: string;
  achievements: string;
  kpiUpdates: string;
  challenges: string;
  supportNeeded: string;
  notes: string;
  reportDate: string;
}

// ─── Constants ───

const TYPE_LABELS: Record<string, string> = {
  daily: 'يومي',
  weekly: 'أسبوعي',
  monthly: 'شهري',
  annual: 'سنوي',
};

const TYPE_COLORS: Record<string, string> = {
  daily: 'bg-blue-500/20 text-blue-300',
  weekly: 'bg-violet-500/20 text-violet-300',
  monthly: 'bg-amber-500/20 text-amber-300',
  annual: 'bg-emerald-500/20 text-emerald-300',
};

const INITIAL_FORM: CreateReportForm = {
  trackId: '',
  type: 'daily',
  title: '',
  achievements: '',
  kpiUpdates: '',
  challenges: '',
  supportNeeded: '',
  notes: '',
  reportDate: new Date().toISOString().split('T')[0],
};

// ─── Component ───

export default function ReportsPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [stats, setStats] = useState<ReportStats>({ total: 0, daily: 0, weekly: 0, monthly: 0, annual: 0 });
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // UI state
  const [showForm, setShowForm] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  // Filters
  const [filterTrack, setFilterTrack] = useState('');
  const [filterType, setFilterType] = useState('');
  const [search, setSearch] = useState('');

  // Form
  const [form, setForm] = useState<CreateReportForm>(INITIAL_FORM);

  const pageSize = 20;

  const loadReports = useCallback(async () => {
    try {
      const params: Record<string, any> = { page, pageSize };
      if (filterTrack) params.trackId = filterTrack;
      if (filterType) params.type = filterType;
      const { data } = await reportsApi.list(params);
      setReports(data.data);
      setTotal(data.total);
    } catch {
      toast.error('فشل تحميل التقارير');
    }
  }, [page, filterTrack, filterType]);

  const loadStats = async () => {
    try {
      const { data } = await reportsApi.stats();
      setStats(data);
    } catch {
      // stats are optional, fail silently
    }
  };

  const loadTracks = async () => {
    try {
      const { data } = await tracksApi.list();
      setTracks(data);
    } catch {
      toast.error('فشل تحميل المسارات');
    }
  };

  useEffect(() => {
    Promise.all([loadReports(), loadStats(), loadTracks()]).finally(() =>
      setLoading(false),
    );
  }, []);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  // Filter by search locally
  const filtered = reports.filter((r) => {
    if (!search) return true;
    return (
      r.title?.includes(search) ||
      r.author?.nameAr?.includes(search) ||
      r.track?.nameAr?.includes(search)
    );
  });

  const totalPages = Math.ceil(total / pageSize);

  // ─── Form handlers ───

  const updateForm = (field: keyof CreateReportForm, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.trackId) {
      toast.error('يرجى اختيار المسار');
      return;
    }
    if (!form.title.trim()) {
      toast.error('يرجى إدخال عنوان التقرير');
      return;
    }

    setSubmitting(true);
    try {
      const body: Record<string, any> = {
        trackId: form.trackId,
        type: form.type,
        title: form.title.trim(),
        reportDate: form.reportDate,
      };
      if (form.achievements.trim()) body.achievements = form.achievements.trim();
      if (form.kpiUpdates.trim()) body.kpiUpdates = form.kpiUpdates.trim();
      if (form.challenges.trim()) body.challenges = form.challenges.trim();
      if (form.supportNeeded.trim()) body.supportNeeded = form.supportNeeded.trim();
      if (form.notes.trim()) body.notes = form.notes.trim();

      const { data: newReport } = await reportsApi.create(body);

      toast.success('تم إنشاء التقرير بنجاح');

      if (newReport.aiSummary) {
        toast.success('تم إنشاء ملخص الذكاء الاصطناعي', { icon: '🤖', duration: 4000 });
      }

      setForm(INITIAL_FORM);
      setShowForm(false);
      setPage(1);
      await Promise.all([loadReports(), loadStats()]);
    } catch {
      toast.error('فشل إنشاء التقرير');
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Render ───

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">التقارير</h1>
          <p className="text-gray-400 mt-1">{total} تقرير</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className={`w-4 h-4 transition-transform ${showForm ? 'rotate-45' : ''}`} />
          {showForm ? 'إلغاء' : 'تقرير جديد'}
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: 'إجمالي التقارير', value: stats.total, icon: FileText, color: 'text-blue-400', bg: 'bg-blue-500/20' },
          { label: 'تقارير يومية', value: stats.daily, icon: Calendar, color: 'text-cyan-400', bg: 'bg-cyan-500/20' },
          { label: 'تقارير أسبوعية', value: stats.weekly, icon: Calendar, color: 'text-violet-400', bg: 'bg-violet-500/20' },
          { label: 'تقارير شهرية', value: stats.monthly, icon: Calendar, color: 'text-amber-400', bg: 'bg-amber-500/20' },
          { label: 'تقارير سنوية', value: stats.annual, icon: Calendar, color: 'text-emerald-400', bg: 'bg-emerald-500/20' },
        ].map((stat) => (
          <div key={stat.label} className="glass p-4">
            <div className="flex items-center gap-3">
              <div className={`p-2.5 rounded-xl ${stat.bg}`}>
                <stat.icon className={`w-5 h-5 ${stat.color}`} />
              </div>
              <div className="min-w-0">
                <p className="text-lg font-bold truncate">{stat.value}</p>
                <p className="text-xs text-gray-400">{stat.label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Create Report Form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="glass p-5 space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <FileText className="w-5 h-5 text-brand-400" />
            إنشاء تقرير جديد
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Track */}
            <div>
              <label className="block text-sm text-gray-400 mb-1">المسار</label>
              <select
                value={form.trackId}
                onChange={(e) => updateForm('trackId', e.target.value)}
                className="input-field w-full"
                required
              >
                <option value="">اختر المسار</option>
                {tracks.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.nameAr}
                  </option>
                ))}
              </select>
            </div>

            {/* Type */}
            <div>
              <label className="block text-sm text-gray-400 mb-1">نوع التقرير</label>
              <select
                value={form.type}
                onChange={(e) => updateForm('type', e.target.value)}
                className="input-field w-full"
              >
                {Object.entries(TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            {/* Title */}
            <div>
              <label className="block text-sm text-gray-400 mb-1">عنوان التقرير</label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => updateForm('title', e.target.value)}
                placeholder="أدخل عنوان التقرير..."
                className="input-field w-full"
                required
              />
            </div>

            {/* Report Date */}
            <div>
              <label className="block text-sm text-gray-400 mb-1">تاريخ التقرير</label>
              <input
                type="date"
                value={form.reportDate}
                onChange={(e) => updateForm('reportDate', e.target.value)}
                className="input-field w-full"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Achievements */}
            <div>
              <label className="block text-sm text-gray-400 mb-1">الإنجازات</label>
              <textarea
                value={form.achievements}
                onChange={(e) => updateForm('achievements', e.target.value)}
                placeholder="ما تم إنجازه خلال الفترة..."
                className="input-field w-full min-h-[100px] resize-y"
                rows={3}
              />
            </div>

            {/* KPI Updates */}
            <div>
              <label className="block text-sm text-gray-400 mb-1">تحديثات مؤشرات الأداء</label>
              <textarea
                value={form.kpiUpdates}
                onChange={(e) => updateForm('kpiUpdates', e.target.value)}
                placeholder="تحديثات مؤشرات الأداء الرئيسية..."
                className="input-field w-full min-h-[100px] resize-y"
                rows={3}
              />
            </div>

            {/* Challenges */}
            <div>
              <label className="block text-sm text-gray-400 mb-1">التحديات</label>
              <textarea
                value={form.challenges}
                onChange={(e) => updateForm('challenges', e.target.value)}
                placeholder="التحديات والعقبات التي واجهتها..."
                className="input-field w-full min-h-[100px] resize-y"
                rows={3}
              />
            </div>

            {/* Support Needed */}
            <div>
              <label className="block text-sm text-gray-400 mb-1">الدعم المطلوب</label>
              <textarea
                value={form.supportNeeded}
                onChange={(e) => updateForm('supportNeeded', e.target.value)}
                placeholder="الدعم والموارد المطلوبة..."
                className="input-field w-full min-h-[100px] resize-y"
                rows={3}
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm text-gray-400 mb-1">ملاحظات</label>
            <textarea
              value={form.notes}
              onChange={(e) => updateForm('notes', e.target.value)}
              placeholder="ملاحظات إضافية..."
              className="input-field w-full min-h-[80px] resize-y"
              rows={2}
            />
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              type="submit"
              disabled={submitting}
              className="btn-primary flex items-center gap-2"
            >
              {submitting ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
              {submitting ? 'جارٍ الإنشاء...' : 'إنشاء التقرير'}
            </button>
            <button
              type="button"
              onClick={() => {
                setForm(INITIAL_FORM);
                setShowForm(false);
              }}
              className="btn-secondary"
            >
              إلغاء
            </button>
          </div>
        </form>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder="بحث بالعنوان أو الكاتب أو المسار..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-field pr-10"
          />
        </div>
        <select
          value={filterTrack}
          onChange={(e) => {
            setFilterTrack(e.target.value);
            setPage(1);
          }}
          className="input-field w-auto"
        >
          <option value="">كل المسارات</option>
          {tracks.map((t) => (
            <option key={t.id} value={t.id}>
              {t.nameAr}
            </option>
          ))}
        </select>
        <select
          value={filterType}
          onChange={(e) => {
            setFilterType(e.target.value);
            setPage(1);
          }}
          className="input-field w-auto"
        >
          <option value="">كل الأنواع</option>
          {Object.entries(TYPE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {/* Reports List */}
      <div className="space-y-3">
        {filtered.map((report) => (
          <div key={report.id} className="glass overflow-hidden">
            {/* Report Header (clickable) */}
            <button
              onClick={() =>
                setExpanded(expanded === report.id ? null : report.id)
              }
              className="w-full flex items-center justify-between p-4 text-right"
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0">
                  <FileText className="w-5 h-5 text-gray-400" />
                </div>
                <div className="text-right min-w-0 flex-1">
                  <p className="text-sm font-semibold text-white truncate">
                    {report.title}
                  </p>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className="text-xs text-gray-400">
                      {report.author?.nameAr}
                    </span>
                    {report.track && (
                      <>
                        <span className="text-gray-600">|</span>
                        <span className="text-xs text-brand-300">
                          {report.track.nameAr}
                        </span>
                      </>
                    )}
                    <span className="text-gray-600">|</span>
                    <span className="text-xs text-gray-500">
                      {formatDateTime(report.reportDate)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 flex-shrink-0 mr-3">
                <span
                  className={`badge text-xs ${TYPE_COLORS[report.type] || 'bg-gray-500/20 text-gray-300'}`}
                >
                  {TYPE_LABELS[report.type] || report.type}
                </span>
                <ChevronDown
                  className={`w-4 h-4 text-gray-500 transition-transform ${
                    expanded === report.id ? 'rotate-180' : ''
                  }`}
                />
              </div>
            </button>

            {/* AI Summary (always visible if present) */}
            {report.aiSummary && (
              <div className="px-4 pb-3">
                <div className="flex items-start gap-2 bg-brand-500/10 rounded-lg p-3">
                  <Brain className="w-4 h-4 text-brand-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs font-medium text-brand-300 mb-1">
                      ملخص الذكاء الاصطناعي
                    </p>
                    <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">
                      {report.aiSummary}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Expanded Details */}
            {expanded === report.id && (
              <div className="px-4 pb-4 space-y-3 border-t border-white/5 pt-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {report.achievements && (
                    <DetailSection
                      title="الإنجازات"
                      content={report.achievements}
                      color="text-emerald-400"
                      bgColor="bg-emerald-500/10"
                    />
                  )}
                  {report.kpiUpdates && (
                    <DetailSection
                      title="تحديثات مؤشرات الأداء"
                      content={report.kpiUpdates}
                      color="text-blue-400"
                      bgColor="bg-blue-500/10"
                    />
                  )}
                  {report.challenges && (
                    <DetailSection
                      title="التحديات"
                      content={report.challenges}
                      color="text-amber-400"
                      bgColor="bg-amber-500/10"
                    />
                  )}
                  {report.supportNeeded && (
                    <DetailSection
                      title="الدعم المطلوب"
                      content={report.supportNeeded}
                      color="text-red-400"
                      bgColor="bg-red-500/10"
                    />
                  )}
                </div>
                {report.notes && (
                  <DetailSection
                    title="ملاحظات"
                    content={report.notes}
                    color="text-gray-400"
                    bgColor="bg-white/5"
                  />
                )}
              </div>
            )}
          </div>
        ))}

        {filtered.length === 0 && (
          <div className="glass p-8 text-center text-gray-500">
            <FileText className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p>لا توجد تقارير</p>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="btn-secondary text-sm disabled:opacity-40"
          >
            السابق
          </button>
          <span className="text-sm text-gray-400 px-3">
            صفحة {page} من {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="btn-secondary text-sm disabled:opacity-40"
          >
            التالي
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Detail Section Component ───

function DetailSection({
  title,
  content,
  color,
  bgColor,
}: {
  title: string;
  content: string;
  color: string;
  bgColor: string;
}) {
  return (
    <div className={`rounded-lg p-3 ${bgColor}`}>
      <p className={`text-xs font-medium mb-1 ${color}`}>{title}</p>
      <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">
        {content}
      </p>
    </div>
  );
}
