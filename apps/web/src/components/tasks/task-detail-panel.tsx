'use client';

import { useState } from 'react';
import {
  X,
  Calendar,
  Flag,
  Activity,
  Users,
  User,
  Clock,
  FileText,
  ChevronLeft,
  Building2,
  Globe,
  History,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  cn,
  formatDate,
  formatDateTime,
  TASK_STATUS_LABELS,
  TASK_STATUS_COLORS,
  PRIORITY_LABELS,
  PRIORITY_COLORS,
  ASSIGNEE_TYPE_LABELS,
  ASSIGNEE_TYPE_COLORS,
} from '@/lib/utils';
import { tasksApi } from '@/lib/api';
import { useAuth } from '@/stores/auth';
import { Task } from '@/stores/tasks';
import CommentThread from '@/components/comments/comment-thread';

interface Props {
  task: Task;
  onClose: () => void;
  onUpdate: () => void;
}

const STATUS_FLOW: Record<string, string[]> = {
  pending: ['in_progress'],
  in_progress: ['completed', 'delayed'],
  delayed: ['in_progress', 'completed'],
  completed: [],
  cancelled: [],
};

const TABS = [
  { key: 'details', label: 'التفاصيل' },
  { key: 'comments', label: 'التعليقات' },
  { key: 'audit', label: 'سجل التعديلات' },
] as const;

type TabKey = (typeof TABS)[number]['key'];

const AUDIT_ACTION_LABELS: Record<string, string> = {
  CREATED: 'إنشاء',
  UPDATED: 'تحديث',
  STATUS_CHANGED: 'تغيير الحالة',
  COMMENT_ADDED: 'إضافة تعليق',
  REASSIGNED: 'إعادة تعيين',
  DELETED: 'حذف',
};

const ASSIGNEE_TYPE_ICONS: Record<string, typeof Users> = {
  TRACK: Users,
  USER: User,
  HR: Building2,
  GLOBAL: Globe,
};

export default function TaskDetailPanel({ task, onClose, onUpdate }: Props) {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabKey>('details');
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [progress, setProgress] = useState(task.progress ?? 0);
  const [savingProgress, setSavingProgress] = useState(false);

  const statusLabel = TASK_STATUS_LABELS[task.status] || task.status;
  const statusColor = TASK_STATUS_COLORS[task.status] || 'bg-gray-500/20 text-gray-300';
  const priorityLabel = PRIORITY_LABELS[task.priority] || task.priority;
  const priorityColor = PRIORITY_COLORS[task.priority] || 'bg-gray-500/20 text-gray-300';
  const assigneeTypeLabel = ASSIGNEE_TYPE_LABELS[task.assigneeType] || task.assigneeType;
  const assigneeTypeColor = ASSIGNEE_TYPE_COLORS[task.assigneeType] || 'bg-gray-500/20 text-gray-300';
  const AssigneeIcon = ASSIGNEE_TYPE_ICONS[task.assigneeType] || Globe;

  const isOverdue =
    task.dueDate &&
    new Date(task.dueDate) < new Date() &&
    task.status !== 'completed' &&
    task.status !== 'cancelled';

  const isAssigned = task.assignments?.some((a) => a.userId === user?.id);
  const isDirectAssignee = task.assigneeType === 'USER' && task.assigneeUserId === user?.id;
  const isAdminOrPm = user?.role === 'admin' || user?.role === 'pm';
  const canChangeStatus = isAssigned || isDirectAssignee || isAdminOrPm;

  const nextStatuses = STATUS_FLOW[task.status] || [];

  const handleStatusChange = async (newStatus: string) => {
    setUpdatingStatus(true);
    try {
      await tasksApi.updateStatus(task.id, newStatus);
      toast.success('تم تحديث حالة المهمة');
      onUpdate();
    } catch {
      toast.error('فشل تحديث الحالة');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleProgressSave = async () => {
    setSavingProgress(true);
    try {
      await tasksApi.update(task.id, { progress });
      toast.success('تم تحديث التقدم');
      onUpdate();
    } catch {
      toast.error('فشل تحديث التقدم');
    } finally {
      setSavingProgress(false);
    }
  };

  // Determine assignee display
  let assigneeDisplay = '';
  if (task.assigneeType === 'TRACK' && task.assigneeTrack) {
    assigneeDisplay = task.assigneeTrack.nameAr;
  } else if (task.assigneeType === 'USER' && task.assigneeUser) {
    assigneeDisplay = task.assigneeUser.nameAr || task.assigneeUser.name;
  } else if (task.assigneeType === 'HR') {
    assigneeDisplay = 'قسم الموارد البشرية';
  } else if (task.assigneeType === 'GLOBAL') {
    assigneeDisplay = 'الجميع';
  }

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 z-50 bg-black/30" onClick={onClose} />

      {/* Panel */}
      <div className="fixed top-0 left-0 h-full w-[600px] max-w-full glass border-r border-white/10 z-50 overflow-auto transition-transform duration-300 ease-out animate-in slide-in-from-left">
        {/* Header */}
        <div className="p-5 border-b border-white/10">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-semibold text-white truncate">
                {task.titleAr || task.title}
              </h2>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <span className={cn('px-2.5 py-0.5 rounded-lg text-xs font-medium', statusColor)}>
                  {statusLabel}
                </span>
                <span
                  className={cn('px-2.5 py-0.5 rounded-lg text-xs font-medium', priorityColor)}
                >
                  {priorityLabel}
                </span>
                <span
                  className={cn('px-2.5 py-0.5 rounded-lg text-xs font-medium flex items-center gap-1', assigneeTypeColor)}
                >
                  <AssigneeIcon className="h-3 w-3" />
                  {assigneeTypeLabel}
                </span>
                {isOverdue && (
                  <span className="px-2.5 py-0.5 rounded-lg text-xs font-medium bg-red-500/20 text-red-300">
                    متأخرة
                  </span>
                )}
              </div>
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
              className={cn(
                'px-4 py-2 rounded-xl text-sm font-medium transition-colors whitespace-nowrap',
                activeTab === tab.key
                  ? 'bg-brand-500/20 text-brand-300'
                  : 'bg-white/5 text-gray-400 hover:bg-white/10',
              )}
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
                <span className={cn('px-2.5 py-0.5 rounded-lg text-xs font-medium', statusColor)}>
                  {statusLabel}
                </span>
              </div>

              {/* Status update buttons */}
              {canChangeStatus && nextStatuses.length > 0 && (
                <div className="bg-white/5 rounded-xl p-3">
                  <p className="text-xs text-gray-400 mb-2">تغيير الحالة</p>
                  <div className="flex items-center gap-2 flex-wrap">
                    {nextStatuses.map((s) => (
                      <button
                        key={s}
                        onClick={() => handleStatusChange(s)}
                        disabled={updatingStatus}
                        className={cn(
                          'rounded-xl px-4 py-2 text-xs font-medium transition-colors disabled:opacity-50',
                          TASK_STATUS_COLORS[s] || 'bg-gray-500/20 text-gray-300',
                          'hover:opacity-80',
                        )}
                      >
                        <span className="flex items-center gap-1.5">
                          <ChevronLeft className="h-3 w-3" />
                          {TASK_STATUS_LABELS[s] || s}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Priority */}
              <div className="flex items-center justify-between bg-white/5 rounded-xl p-3">
                <span className="text-sm text-gray-400 flex items-center gap-2">
                  <Flag className="w-4 h-4" />
                  الأولوية
                </span>
                <span
                  className={cn('px-2.5 py-0.5 rounded-lg text-xs font-medium', priorityColor)}
                >
                  {priorityLabel}
                </span>
              </div>

              {/* Assignee Type & Target */}
              <div className="bg-white/5 rounded-xl p-3">
                <span className="text-sm text-gray-400 flex items-center gap-2 mb-2">
                  <AssigneeIcon className="w-4 h-4" />
                  معين إلى
                </span>
                <div className="flex items-center gap-2">
                  <span className={cn('px-2.5 py-0.5 rounded-lg text-xs font-medium', assigneeTypeColor)}>
                    {assigneeTypeLabel}
                  </span>
                  {assigneeDisplay && (
                    <span className="text-sm text-white">
                      {assigneeDisplay}
                    </span>
                  )}
                </div>
              </div>

              {/* Progress */}
              <div className="bg-white/5 rounded-xl p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-400">التقدم</span>
                  <span className="text-sm text-white font-medium">{progress}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={progress}
                  onChange={(e) => setProgress(Number(e.target.value))}
                  disabled={!canChangeStatus}
                  className="w-full h-2 rounded-full appearance-none bg-white/10 accent-brand-500 cursor-pointer disabled:cursor-default disabled:opacity-60"
                />
                {canChangeStatus && progress !== (task.progress ?? 0) && (
                  <button
                    onClick={handleProgressSave}
                    disabled={savingProgress}
                    className="mt-2 rounded-lg bg-brand-500/20 px-3 py-1.5 text-xs font-medium text-brand-300 hover:bg-brand-500/30 transition-colors disabled:opacity-50"
                  >
                    {savingProgress ? 'جاري الحفظ...' : 'حفظ التقدم'}
                  </button>
                )}
              </div>

              {/* Track */}
              {task.track && (
                <div className="flex items-center justify-between bg-white/5 rounded-xl p-3">
                  <span className="text-sm text-gray-400 flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    المسار
                  </span>
                  <span
                    className="rounded-lg px-2.5 py-0.5 text-xs font-medium"
                    style={{
                      backgroundColor: `${task.track.color || '#6366f1'}20`,
                      color: task.track.color || '#818cf8',
                    }}
                  >
                    {task.track.nameAr}
                  </span>
                </div>
              )}

              {/* Due Date */}
              <div className="flex items-center justify-between bg-white/5 rounded-xl p-3">
                <span className="text-sm text-gray-400 flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  تاريخ الاستحقاق
                </span>
                <span className={cn('text-sm', isOverdue ? 'text-red-400' : 'text-white')}>
                  {task.dueDate ? formatDate(task.dueDate) : '---'}
                </span>
              </div>

              {/* Created By */}
              <div className="flex items-center justify-between bg-white/5 rounded-xl p-3">
                <span className="text-sm text-gray-400 flex items-center gap-2">
                  <User className="w-4 h-4" />
                  أنشئ بواسطة
                </span>
                <span className="text-sm text-white">
                  {task.createdBy?.nameAr || task.createdBy?.name || '---'}
                </span>
              </div>

              {/* Created At */}
              <div className="flex items-center justify-between bg-white/5 rounded-xl p-3">
                <span className="text-sm text-gray-400 flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  تاريخ الإنشاء
                </span>
                <span className="text-sm text-white" dir="ltr">
                  {task.createdAt ? formatDateTime(task.createdAt) : '---'}
                </span>
              </div>

              {/* Description */}
              {task.descriptionAr && (
                <div className="bg-white/5 rounded-xl p-3">
                  <span className="text-sm text-gray-400 flex items-center gap-2 mb-2">
                    <FileText className="w-4 h-4" />
                    الوصف
                  </span>
                  <p className="text-sm text-white whitespace-pre-wrap leading-relaxed">
                    {task.descriptionAr}
                  </p>
                </div>
              )}

              {/* Assignments (legacy) */}
              {task.assignments && task.assignments.length > 0 && (
                <div className="bg-white/5 rounded-xl p-3">
                  <span className="text-sm text-gray-400 flex items-center gap-2 mb-3">
                    <Users className="w-4 h-4" />
                    المسؤولون
                  </span>
                  <div className="space-y-2">
                    {task.assignments.map((a) => {
                      const initial =
                        a.user?.nameAr?.charAt(0) || a.user?.name?.charAt(0) || '?';
                      return (
                        <div key={a.id} className="flex items-center gap-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-500/30 text-xs font-bold text-brand-200">
                            {initial}
                          </div>
                          <span className="text-sm text-white">
                            {a.user?.nameAr || a.user?.name}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'comments' && (
            <CommentThread entityType="task" entityId={task.id} />
          )}

          {activeTab === 'audit' && (
            <div className="space-y-3">
              {task.auditLogs && task.auditLogs.length > 0 ? (
                task.auditLogs.map((log) => (
                  <div key={log.id} className="bg-white/5 rounded-xl p-3">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <History className="w-3.5 h-3.5 text-gray-400" />
                        <span className="text-xs font-medium text-brand-300">
                          {AUDIT_ACTION_LABELS[log.action] || log.action}
                        </span>
                      </div>
                      <span className="text-[10px] text-gray-500" dir="ltr">
                        {formatDateTime(log.createdAt)}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400">
                      بواسطة {log.actor?.nameAr || log.actor?.name || '---'}
                    </p>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <History className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">لا يوجد سجل تعديلات</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
