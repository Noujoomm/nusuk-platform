'use client';

import { useState, useRef } from 'react';
import { filesApi } from '@/lib/api';
import {
  Brain,
  Upload,
  FileText,
  Table2,
  Tags,
  Lightbulb,
  Loader2,
  CheckCircle2,
  X,
  Sparkles,
  FileSpreadsheet,
  AlertCircle,
  Download,
  ClipboardCopy,
} from 'lucide-react';

type AnalysisType = 'extract' | 'summarize' | 'classify';

const ANALYSIS_TYPES: Array<{ value: AnalysisType; label: string; labelAr: string; icon: typeof Brain; description: string }> = [
  { value: 'extract', label: 'Extract Data', labelAr: 'استخراج البيانات', icon: Table2, description: 'استخراج البيانات المهيكلة من الملف وتحويلها لجدول' },
  { value: 'summarize', label: 'Summarize', labelAr: 'تلخيص المحتوى', icon: FileText, description: 'تحليل المحتوى وتقديم ملخص شامل مع النقاط الرئيسية' },
  { value: 'classify', label: 'Classify', labelAr: 'تصنيف الملف', icon: Tags, description: 'تصنيف الملف وتحديد المواضيع والوسوم المناسبة' },
];

export default function AIAnalyzePage() {
  const [file, setFile] = useState<File | null>(null);
  const [analysisType, setAnalysisType] = useState<AnalysisType>('extract');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [copied, setCopied] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) setFile(dropped);
  };

  const handleAnalyze = async () => {
    if (!file) return;
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const { data } = await filesApi.analyze(file, analysisType);
      setResult(data);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'حدث خطأ أثناء التحليل. تأكد من إعداد مفتاح OpenAI.');
    }
    setLoading(false);
  };

  const handleCopy = () => {
    if (!result?.analysis) return;
    navigator.clipboard.writeText(JSON.stringify(result.analysis, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExportCSV = () => {
    const analysis = result?.analysis;
    if (!analysis?.rows || !analysis?.columns) return;

    const headers = analysis.columns.join(',');
    const rows = analysis.rows.map((row: any) =>
      analysis.columns.map((col: string) => `"${(row[col] || '').toString().replace(/"/g, '""')}"`).join(','),
    );
    const csv = [headers, ...rows].join('\n');
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ai-extract-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
          <Brain className="w-7 h-7 text-purple-400" />
          تحليل الملفات بالذكاء الاصطناعي
        </h1>
        <p className="text-sm text-gray-400 mt-1">ارفع ملفاً واستخدم GPT-4o لاستخراج البيانات وتحليل المحتوى</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Upload + Config */}
        <div className="lg:col-span-1 space-y-4">
          {/* File Upload */}
          <div className="glass rounded-2xl border border-white/10 p-5">
            <h3 className="text-sm font-medium text-white mb-3">رفع الملف</h3>

            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
                dragOver
                  ? 'border-purple-400 bg-purple-500/10'
                  : file
                    ? 'border-emerald-500/30 bg-emerald-500/5'
                    : 'border-white/10 hover:border-white/20 hover:bg-white/5'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept=".xlsx,.xls,.csv,.txt,.json,.pdf,.doc,.docx"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) { setFile(f); setResult(null); }
                }}
              />
              {file ? (
                <div className="flex items-center gap-3 justify-center">
                  <FileSpreadsheet className="w-8 h-8 text-emerald-400" />
                  <div className="text-right">
                    <p className="text-sm font-medium text-white">{file.name}</p>
                    <p className="text-xs text-gray-400">{formatFileSize(file.size)}</p>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); setFile(null); setResult(null); }}
                    className="p-1 rounded-lg hover:bg-white/10"
                  >
                    <X className="w-4 h-4 text-gray-400" />
                  </button>
                </div>
              ) : (
                <>
                  <Upload className="w-8 h-8 text-gray-500 mx-auto mb-2" />
                  <p className="text-sm text-gray-400">اسحب الملف هنا أو انقر للاختيار</p>
                  <p className="text-xs text-gray-600 mt-1">Excel, CSV, TXT, JSON</p>
                </>
              )}
            </div>
          </div>

          {/* Analysis Type */}
          <div className="glass rounded-2xl border border-white/10 p-5">
            <h3 className="text-sm font-medium text-white mb-3">نوع التحليل</h3>
            <div className="space-y-2">
              {ANALYSIS_TYPES.map((type) => {
                const Icon = type.icon;
                return (
                  <button
                    key={type.value}
                    onClick={() => { setAnalysisType(type.value); setResult(null); }}
                    className={`w-full flex items-start gap-3 p-3 rounded-xl text-right transition-all ${
                      analysisType === type.value
                        ? 'bg-purple-500/20 border border-purple-500/30'
                        : 'hover:bg-white/5 border border-transparent'
                    }`}
                  >
                    <Icon className={`w-5 h-5 shrink-0 mt-0.5 ${analysisType === type.value ? 'text-purple-400' : 'text-gray-500'}`} />
                    <div>
                      <p className={`text-sm font-medium ${analysisType === type.value ? 'text-purple-300' : 'text-gray-300'}`}>
                        {type.labelAr}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">{type.description}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Analyze Button */}
          <button
            onClick={handleAnalyze}
            disabled={!file || loading}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-purple-500/20 text-purple-300 font-medium hover:bg-purple-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                جاري التحليل بالذكاء الاصطناعي...
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5" />
                تحليل الملف
              </>
            )}
          </button>
        </div>

        {/* Right: Results */}
        <div className="lg:col-span-2">
          {/* Error */}
          {error && (
            <div className="glass rounded-2xl border border-red-500/20 p-5 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-red-300">خطأ في التحليل</p>
                <p className="text-xs text-red-400/80 mt-1">{error}</p>
              </div>
            </div>
          )}

          {/* Loading */}
          {loading && (
            <div className="glass rounded-2xl border border-white/10 p-12 text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-purple-500/20 flex items-center justify-center">
                <Brain className="w-8 h-8 text-purple-400 animate-pulse" />
              </div>
              <p className="text-white font-medium">جاري تحليل الملف...</p>
              <p className="text-xs text-gray-400 mt-1">يتم استخدام GPT-4o لاستخراج وتحليل البيانات</p>
              <div className="mt-4 w-48 h-1.5 rounded-full bg-white/10 mx-auto overflow-hidden">
                <div className="h-full rounded-full bg-purple-400/50 animate-pulse" style={{ width: '60%' }} />
              </div>
            </div>
          )}

          {/* Empty State */}
          {!loading && !result && !error && (
            <div className="glass rounded-2xl border border-white/10 p-12 text-center">
              <Brain className="w-12 h-12 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400">ارفع ملفاً واختر نوع التحليل للبدء</p>
              <p className="text-xs text-gray-600 mt-1">يدعم ملفات Excel, CSV, TXT, JSON</p>
            </div>
          )}

          {/* Results */}
          {!loading && result && (
            <div className="space-y-4">
              {/* Result Header */}
              <div className="glass rounded-2xl border border-white/10 p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  <div>
                    <p className="text-sm font-medium text-white">تم التحليل بنجاح</p>
                    <p className="text-xs text-gray-400">{result.fileName} — {formatFileSize(result.fileSize)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCopy}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 text-gray-300 text-xs hover:bg-white/10 transition-colors"
                  >
                    <ClipboardCopy className="w-3.5 h-3.5" />
                    {copied ? 'تم النسخ!' : 'نسخ JSON'}
                  </button>
                  {result.analysis?.rows && result.analysis?.columns && (
                    <button
                      onClick={handleExportCSV}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-300 text-xs hover:bg-emerald-500/30 transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" />
                      تصدير CSV
                    </button>
                  )}
                </div>
              </div>

              {/* Extract Results */}
              {analysisType === 'extract' && result.analysis && !result.analysis.raw && (
                <>
                  {/* Summary */}
                  {result.analysis.summary && (
                    <div className="glass rounded-2xl border border-white/10 p-5">
                      <h4 className="text-sm font-medium text-white mb-2 flex items-center gap-2">
                        <FileText className="w-4 h-4 text-brand-400" />
                        ملخص
                      </h4>
                      <p className="text-sm text-gray-300 leading-relaxed">{result.analysis.summary}</p>
                      {result.analysis.entityType && (
                        <span className="inline-block mt-2 px-2.5 py-1 rounded-lg bg-purple-500/20 text-purple-300 text-xs">
                          النوع: {result.analysis.entityType}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Data Table */}
                  {result.analysis.rows?.length > 0 && result.analysis.columns?.length > 0 && (
                    <div className="glass rounded-2xl border border-white/10 overflow-hidden">
                      <div className="px-5 py-3 border-b border-white/10 flex items-center gap-2">
                        <Table2 className="w-4 h-4 text-brand-400" />
                        <h4 className="text-sm font-medium text-white">البيانات المستخرجة</h4>
                        <span className="text-xs text-gray-500 mr-auto">{result.analysis.rows.length} صف</span>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-white/10 bg-white/5">
                              {result.analysis.columns.map((col: string) => (
                                <th key={col} className="px-4 py-2 text-right font-medium text-gray-300 whitespace-nowrap">{col}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {result.analysis.rows.map((row: any, i: number) => (
                              <tr key={i} className="border-b border-white/5 hover:bg-white/5">
                                {result.analysis.columns.map((col: string) => (
                                  <td key={col} className="px-4 py-2 text-gray-400 whitespace-nowrap">{row[col] ?? '-'}</td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Insights */}
                  {result.analysis.insights?.length > 0 && (
                    <div className="glass rounded-2xl border border-white/10 p-5">
                      <h4 className="text-sm font-medium text-white mb-3 flex items-center gap-2">
                        <Lightbulb className="w-4 h-4 text-amber-400" />
                        رؤى وملاحظات
                      </h4>
                      <ul className="space-y-2">
                        {result.analysis.insights.map((insight: string, i: number) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
                            <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 text-xs flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
                            {insight}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              )}

              {/* Summarize Results */}
              {analysisType === 'summarize' && result.analysis && !result.analysis.raw && (
                <>
                  {result.analysis.title && (
                    <div className="glass rounded-2xl border border-white/10 p-5">
                      <h4 className="text-base font-medium text-white mb-2">{result.analysis.title}</h4>
                      <p className="text-sm text-gray-300 leading-relaxed">{result.analysis.summary}</p>
                    </div>
                  )}

                  {result.analysis.keyPoints?.length > 0 && (
                    <div className="glass rounded-2xl border border-white/10 p-5">
                      <h4 className="text-sm font-medium text-white mb-3">النقاط الرئيسية</h4>
                      <ul className="space-y-2">
                        {result.analysis.keyPoints.map((point: string, i: number) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
                            <CheckCircle2 className="w-4 h-4 text-brand-400 shrink-0 mt-0.5" />
                            {point}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {result.analysis.statistics && Object.keys(result.analysis.statistics).length > 0 && (
                    <div className="glass rounded-2xl border border-white/10 p-5">
                      <h4 className="text-sm font-medium text-white mb-3">إحصائيات</h4>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {Object.entries(result.analysis.statistics).map(([key, val]) => (
                          <div key={key} className="rounded-xl bg-white/5 border border-white/10 p-3 text-center">
                            <p className="text-lg font-bold text-white">{val as string}</p>
                            <p className="text-[11px] text-gray-400">{key}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {result.analysis.recommendations?.length > 0 && (
                    <div className="glass rounded-2xl border border-white/10 p-5">
                      <h4 className="text-sm font-medium text-white mb-3 flex items-center gap-2">
                        <Lightbulb className="w-4 h-4 text-amber-400" />
                        التوصيات
                      </h4>
                      <ul className="space-y-2">
                        {result.analysis.recommendations.map((rec: string, i: number) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
                            <span className="w-5 h-5 rounded-full bg-brand-500/20 text-brand-400 text-xs flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
                            {rec}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              )}

              {/* Classify Results */}
              {analysisType === 'classify' && result.analysis && !result.analysis.raw && (
                <div className="glass rounded-2xl border border-white/10 p-5 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="rounded-xl bg-white/5 border border-white/10 p-4">
                      <p className="text-xs text-gray-500 mb-1">التصنيف الرئيسي</p>
                      <p className="text-sm font-medium text-white">{result.analysis.category || '-'}</p>
                    </div>
                    <div className="rounded-xl bg-white/5 border border-white/10 p-4">
                      <p className="text-xs text-gray-500 mb-1">التصنيف الفرعي</p>
                      <p className="text-sm font-medium text-white">{result.analysis.subcategory || '-'}</p>
                    </div>
                    <div className="rounded-xl bg-white/5 border border-white/10 p-4">
                      <p className="text-xs text-gray-500 mb-1">اللغة</p>
                      <p className="text-sm font-medium text-white">{result.analysis.language || '-'}</p>
                    </div>
                    <div className="rounded-xl bg-white/5 border border-white/10 p-4">
                      <p className="text-xs text-gray-500 mb-1">المسار المقترح</p>
                      <p className="text-sm font-medium text-white">{result.analysis.relevantTrackType || '-'}</p>
                    </div>
                  </div>

                  {result.analysis.topics?.length > 0 && (
                    <div>
                      <p className="text-xs text-gray-500 mb-2">المواضيع</p>
                      <div className="flex flex-wrap gap-2">
                        {result.analysis.topics.map((topic: string, i: number) => (
                          <span key={i} className="px-2.5 py-1 rounded-lg bg-purple-500/20 text-purple-300 text-xs">{topic}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {result.analysis.suggestedTags?.length > 0 && (
                    <div>
                      <p className="text-xs text-gray-500 mb-2">الوسوم المقترحة</p>
                      <div className="flex flex-wrap gap-2">
                        {result.analysis.suggestedTags.map((tag: string, i: number) => (
                          <span key={i} className="px-2.5 py-1 rounded-lg bg-brand-500/20 text-brand-300 text-xs">{tag}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {result.analysis.confidence != null && (
                    <div>
                      <p className="text-xs text-gray-500 mb-1">مستوى الثقة</p>
                      <div className="flex items-center gap-3">
                        <div className="flex-1 h-2 rounded-full bg-white/10 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-gradient-to-l from-emerald-400 to-brand-400"
                            style={{ width: `${Math.round(result.analysis.confidence * 100)}%` }}
                          />
                        </div>
                        <span className="text-sm font-medium text-white">{Math.round(result.analysis.confidence * 100)}%</span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Raw/Fallback Result */}
              {result.analysis?.raw && (
                <div className="glass rounded-2xl border border-white/10 p-5">
                  <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">{result.analysis.summary}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
