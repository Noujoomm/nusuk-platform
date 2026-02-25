'use client';

import { useState } from 'react';
import {
  STATUS_LABELS,
  STATUS_COLORS,
  PRIORITY_LABELS,
  PRIORITY_COLORS,
  formatDate,
  formatDateTime,
} from '@/lib/utils';
import { X, Calendar, User, Flag, Activity, FileText, Hash } from 'lucide-react';
import SubtaskList from '@/components/subtask-list';
import Checklist from '@/components/checklist';
import CommentThread from '@/components/comments/comment-thread';

interface Props {
  record: any;
  trackId: string;
  canEdit?: boolean;
  onClose: () => void;
  onUpdate: () => void;
}

const TABS = [
  { key: 'details', label: 'التفاصيل' },
  { key: 'subtasks', label: 'المهام الفرعية' },
  { key: 'checklist', label: 'قائمة المهام' },
  { key: 'comments', label: 'التعليقات' },
] as const;

type TabKey = (typeof TABS)[number]['key'];

export default function RecordDetailPanel({ record, trackId, canEdit, onClose, onUpdate }: Props) {
  const [activeTab, setActiveTab] = useState<TabKey>('details');

  const title = record.titleAr || record.title || 'بدون عنوان';
  const statusLabel = STATUS_LABELS[record.status] || record.status;
  const statusColor = STATUS_COLORS[record.status] || 'bg-gray-500/20 text-gray-300';
  const priorityLabel = PRIORITY_LABELS[record.priority] || record.priority;
  const priorityColor = PRIORITY_COLORS[record.priority] || 'bg-gray-500/20 text-gray-300';
  const progress = record.progress ?? 0;

  const extraFields = record.extraFields
    ? Object.entries(record.extraFields).filter(([, v]) => v !== '' && v !== null && v !== undefined)
    : [];

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-50 bg-black/30"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed top-0 left-0 h-full w-[600px] max-w-full glass border-r border-white/10 z-50 overflow-auto transition-transform duration-300 ease-out animate-in slide-in-from-left">
        {/* Header */}
        <div className="p-5 border-b border-white/10">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-semibold text-white truncate">{title}</h2>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <span className={`px-2.5 py-0.5 rounded-lg text-xs font-medium ${statusColor}`}>
                  {statusLabel}
                </span>
                <span className={`px-2.5 py-0.5 rounded-lg text-xs font-medium ${priorityColor}`}>
                  {priorityLabel}
                </span>
              </div>
              {record.owner && (
                <p className="text-sm text-gray-400 mt-2 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5" />
                  {record.owner}
                </p>
              )}
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
            >
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-2 p-4 border-b border-white/10 overflow-x-auto">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors whitespace-nowrap ${
                activeTab === tab.key
                  ? 'bg-brand-500/20 text-brand-300'
                  : 'bg-white/5 text-gray-400 hover:bg-white/10'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="p-5">
          {activeTab === 'details' && (
            <div className="space-y-4">
              {/* Status */}
              <div className="flex items-center justify-between bg-white/5 rounded-xl p-3">
                <span className="text-sm text-gray-400 flex items-center gap-2">
                  <Activity className="w-4 h-4" />
                  الحالة
                </span>
                <span className={`px-2.5 py-0.5 rounded-lg text-xs font-medium ${statusColor}`}>
                  {statusLabel}
                </span>
              </div>

              {/* Priority */}
              <div className="flex items-center justify-between bg-white/5 rounded-xl p-3">
                <span className="text-sm text-gray-400 flex items-center gap-2">
                  <Flag className="w-4 h-4" />
                  الأولوية
                </span>
                <span className={`px-2.5 py-0.5 rounded-lg text-xs font-medium ${priorityColor}`}>
                  {priorityLabel}
                </span>
              </div>

              {/* Owner */}
              <div className="flex items-center justify-between bg-white/5 rounded-xl p-3">
                <span className="text-sm text-gray-400 flex items-center gap-2">
                  <User className="w-4 h-4" />
                  المسؤول
                </span>
                <span className="text-sm text-white">{record.owner || '—'}</span>
              </div>

              {/* Progress */}
              <div className="bg-white/5 rounded-xl p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-400">التقدم</span>
                  <span className="text-sm text-white">{progress}%</span>
                </div>
                <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-brand-500 rounded-full transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>

              {/* Due Date */}
              <div className="flex items-center justify-between bg-white/5 rounded-xl p-3">
                <span className="text-sm text-gray-400 flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  تاريخ الاستحقاق
                </span>
                <span className="text-sm text-white">
                  {record.dueDate ? formatDate(record.dueDate) : '—'}
                </span>
              </div>

              {/* Notes */}
              {record.notes && (
                <div className="bg-white/5 rounded-xl p-3">
                  <span className="text-sm text-gray-400 flex items-center gap-2 mb-2">
                    <FileText className="w-4 h-4" />
                    ملاحظات
                  </span>
                  <p className="text-sm text-white whitespace-pre-wrap leading-relaxed">
                    {record.notes}
                  </p>
                </div>
              )}

              {/* Created By */}
              <div className="flex items-center justify-between bg-white/5 rounded-xl p-3">
                <span className="text-sm text-gray-400">أنشئ بواسطة</span>
                <span className="text-sm text-white">
                  {record.createdBy?.nameAr || record.createdBy?.name || record.createdBy || '—'}
                </span>
              </div>

              {/* Created At */}
              <div className="flex items-center justify-between bg-white/5 rounded-xl p-3">
                <span className="text-sm text-gray-400">تاريخ الإنشاء</span>
                <span className="text-sm text-white" dir="ltr">
                  {record.createdAt ? formatDateTime(record.createdAt) : '—'}
                </span>
              </div>

              {/* Version */}
              <div className="flex items-center justify-between bg-white/5 rounded-xl p-3">
                <span className="text-sm text-gray-400 flex items-center gap-2">
                  <Hash className="w-4 h-4" />
                  الإصدار
                </span>
                <span className="text-sm text-white">{record.version ?? '—'}</span>
              </div>

              {/* Extra Fields */}
              {extraFields.length > 0 && (
                <div className="border-t border-white/10 pt-4 mt-4">
                  <p className="text-sm font-medium text-gray-400 mb-3">حقول إضافية</p>
                  <div className="space-y-3">
                    {extraFields.map(([key, value]) => (
                      <div
                        key={key}
                        className="flex items-center justify-between bg-white/5 rounded-xl p-3"
                      >
                        <span className="text-sm text-gray-400">{key}</span>
                        <span className="text-sm text-white">{String(value)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'subtasks' && (
            <SubtaskList recordId={record.id} canEdit={canEdit} />
          )}

          {activeTab === 'checklist' && (
            <Checklist recordId={record.id} canEdit={canEdit} />
          )}

          {activeTab === 'comments' && (
            <CommentThread entityType="record" entityId={record.id} />
          )}
        </div>
      </div>
    </>
  );
}
