'use client';

import { useEffect, useState } from 'react';
import { auditApi } from '@/lib/api';
import { formatDateTime } from '@/lib/utils';
import { ClipboardList, ChevronDown } from 'lucide-react';

interface AuditEntry {
  id: string;
  actionType: string;
  entityType: string;
  entityId: string;
  createdAt: string;
  actor: { name: string; nameAr: string } | null;
  track: { nameAr: string } | null;
  beforeData: any;
  afterData: any;
}

const ACTION_LABELS: Record<string, string> = {
  create: 'إنشاء',
  update: 'تعديل',
  delete: 'حذف',
  login: 'تسجيل دخول',
  logout: 'تسجيل خروج',
};

const ENTITY_LABELS: Record<string, string> = {
  record: 'سجل',
  track: 'مسار',
  user: 'مستخدم',
};

export default function AuditPage() {
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await auditApi.list({ page, pageSize: 30 });
        setLogs(data.data);
        setTotal(data.total);
      } catch {}
      setLoading(false);
    };
    load();
  }, [page]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">سجل المراجعة</h1>
        <p className="text-gray-400 mt-1">{total} إجراء مسجل</p>
      </div>

      <div className="space-y-2">
        {logs.map((log) => (
          <div key={log.id} className="glass">
            <button
              onClick={() => setExpanded(expanded === log.id ? null : log.id)}
              className="w-full flex items-center justify-between p-4 text-right"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
                  <ClipboardList className="w-4 h-4 text-gray-400" />
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium">
                    <span className="text-gray-400">{log.actor?.nameAr || 'نظام'}</span>
                    {' '}
                    <span className="text-brand-300">{ACTION_LABELS[log.actionType] || log.actionType}</span>
                    {' '}
                    <span className="text-gray-400">{ENTITY_LABELS[log.entityType] || log.entityType}</span>
                    {log.track && <span className="text-gray-500"> ({log.track.nameAr})</span>}
                  </p>
                  <p className="text-xs text-gray-500">{formatDateTime(log.createdAt)}</p>
                </div>
              </div>
              <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform ${expanded === log.id ? 'rotate-180' : ''}`} />
            </button>

            {expanded === log.id && (log.beforeData || log.afterData) && (
              <div className="px-4 pb-4 grid grid-cols-2 gap-4">
                {log.beforeData && (
                  <div>
                    <p className="text-xs font-medium text-red-400 mb-1">قبل</p>
                    <pre className="text-xs bg-black/30 p-3 rounded-lg overflow-auto max-h-40 text-gray-400" dir="ltr">
                      {JSON.stringify(log.beforeData, null, 2)}
                    </pre>
                  </div>
                )}
                {log.afterData && (
                  <div>
                    <p className="text-xs font-medium text-emerald-400 mb-1">بعد</p>
                    <pre className="text-xs bg-black/30 p-3 rounded-lg overflow-auto max-h-40 text-gray-400" dir="ltr">
                      {JSON.stringify(log.afterData, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}

        {logs.length === 0 && (
          <div className="glass p-8 text-center text-gray-500">لا يوجد سجلات مراجعة</div>
        )}
      </div>
    </div>
  );
}
