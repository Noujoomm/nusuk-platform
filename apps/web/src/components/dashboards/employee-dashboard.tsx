'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/stores/auth';
import { useTasks, Task } from '@/stores/tasks';
import { tasksApi } from '@/lib/api';
import { getSocket } from '@/lib/socket';
import { cn, formatDate, formatNumber, TASK_STATUS_LABELS, TASK_STATUS_COLORS, PRIORITY_LABELS, PRIORITY_COLORS } from '@/lib/utils';
import {
  CheckSquare,
  Clock,
  AlertTriangle,
  ListChecks,
  Loader2,
  ChevronLeft,
  ArrowLeftRight,
} from 'lucide-react';

const NEXT_STATUS: Record<string, string> = {
  pending: 'in_progress',
  in_progress: 'completed',
};

export default function EmployeeDashboard() {
  const { user } = useAuth();
  const { myTasks, loading, fetchMyTasks, updateTaskStatus } = useTasks();
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    fetchMyTasks();
  }, [fetchMyTasks]);

  // Real-time task updates via WebSocket
  useEffect(() => {
    const socket = getSocket();
    const refresh = () => fetchMyTasks();
    socket.on('task.assigned', refresh);
    socket.on('task.updated', refresh);
    socket.on('task.deleted', refresh);
    socket.on('task.completed', refresh);
    return () => {
      socket.off('task.assigned', refresh);
      socket.off('task.updated', refresh);
      socket.off('task.deleted', refresh);
      socket.off('task.completed', refresh);
    };
  }, [fetchMyTasks]);

  const handleStatusChange = async (taskId: string, currentStatus: string) => {
    const next = NEXT_STATUS[currentStatus];
    if (!next) return;
    setUpdatingId(taskId);
    try {
      await updateTaskStatus(taskId, next);
    } catch {}
    setUpdatingId(null);
  };

  // Personal stats
  const totalTasks = myTasks.length;
  const completedTasks = myTasks.filter((t) => t.status === 'completed').length;
  const inProgressTasks = myTasks.filter((t) => t.status === 'in_progress').length;
  const overdueTasks = myTasks.filter(
    (t) => t.dueDate && new Date(t.dueDate) < new Date() && t.status !== 'completed'
  ).length;

  const stats = [
    { label: 'إجمالي المهام', value: totalTasks, icon: ListChecks, color: 'text-blue-400', bg: 'bg-blue-500/20' },
    { label: 'مكتملة', value: completedTasks, icon: CheckSquare, color: 'text-emerald-400', bg: 'bg-emerald-500/20' },
    { label: 'قيد التنفيذ', value: inProgressTasks, icon: Clock, color: 'text-amber-400', bg: 'bg-amber-500/20' },
    { label: 'متأخرة', value: overdueTasks, icon: AlertTriangle, color: 'text-red-400', bg: 'bg-red-500/20' },
  ];

  if (loading && myTasks.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Greeting */}
      <div className="glass rounded-2xl border border-white/10 p-6">
        <h1 className="text-2xl font-bold">
          مرحبا {user?.nameAr || user?.name}
        </h1>
        <p className="text-gray-400 mt-1">هذه مهامك ونظرة عامة على تقدمك</p>
      </div>

      {/* Personal Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <div key={stat.label} className="glass rounded-2xl border border-white/10 p-4">
            <div className="flex items-center gap-3">
              <div className={cn('p-2.5 rounded-xl', stat.bg)}>
                <stat.icon className={cn('w-5 h-5', stat.color)} />
              </div>
              <div className="min-w-0">
                <p className="text-xl font-bold">{formatNumber(stat.value)}</p>
                <p className="text-xs text-gray-400">{stat.label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* My Tasks List */}
      <div className="glass rounded-2xl border border-white/10 p-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <ListChecks className="w-5 h-5 text-brand-400" />
          مهامي
        </h2>

        {myTasks.length === 0 ? (
          <div className="text-center text-gray-500 py-12">
            <ListChecks className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p>لا توجد مهام مسندة إليك حاليا</p>
          </div>
        ) : (
          <div className="space-y-3">
            {myTasks.map((task) => {
              const canAdvance = !!NEXT_STATUS[task.status];
              const isUpdating = updatingId === task.id;
              return (
                <div
                  key={task.id}
                  className="bg-white/5 rounded-xl p-4 hover:bg-white/[0.07] transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-medium truncate">{task.titleAr || task.title}</h3>
                        <span className={cn('text-xs px-2 py-0.5 rounded-full whitespace-nowrap', PRIORITY_COLORS[task.priority] || 'bg-gray-500/20 text-gray-300')}>
                          {PRIORITY_LABELS[task.priority] || task.priority}
                        </span>
                      </div>

                      {task.descriptionAr && (
                        <p className="text-sm text-gray-400 line-clamp-1 mb-2">{task.descriptionAr}</p>
                      )}

                      <div className="flex items-center gap-3 text-xs text-gray-500">
                        {task.track && (
                          <span className="flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: task.track.color }} />
                            {task.track.nameAr}
                          </span>
                        )}
                        {task.dueDate && (
                          <span className={cn(
                            'flex items-center gap-1',
                            new Date(task.dueDate) < new Date() && task.status !== 'completed' && 'text-red-400'
                          )}>
                            <Clock className="w-3 h-3" />
                            {formatDate(task.dueDate)}
                          </span>
                        )}
                      </div>

                      {/* Progress bar */}
                      <div className="mt-3 flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                          <div
                            className={cn(
                              'h-full rounded-full transition-all duration-500',
                              task.progress >= 100 ? 'bg-emerald-500' :
                              task.progress >= 50 ? 'bg-amber-500' : 'bg-brand-500'
                            )}
                            style={{ width: `${Math.min(task.progress, 100)}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-400 w-8 text-left">{task.progress}%</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className={cn('text-xs px-2.5 py-1 rounded-full', TASK_STATUS_COLORS[task.status] || 'bg-gray-500/20 text-gray-300')}>
                        {TASK_STATUS_LABELS[task.status] || task.status}
                      </span>
                      {canAdvance && (
                        <button
                          onClick={() => handleStatusChange(task.id, task.status)}
                          disabled={isUpdating}
                          className="p-1.5 rounded-lg bg-brand-500/20 text-brand-300 hover:bg-brand-500/30 transition-colors disabled:opacity-50"
                          title={`تغيير إلى: ${TASK_STATUS_LABELS[NEXT_STATUS[task.status]]}`}
                        >
                          {isUpdating ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <ArrowLeftRight className="w-4 h-4" />
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
