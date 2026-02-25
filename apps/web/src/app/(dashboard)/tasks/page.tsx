'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import {
  Plus,
  Search,
  ListChecks,
  Clock,
  CheckCircle,
  AlertTriangle,
  Loader2,
} from 'lucide-react';
import { useTasks, Task } from '@/stores/tasks';
import { useAuth } from '@/stores/auth';
import { tracksApi, usersApi } from '@/lib/api';
import {
  cn,
  formatNumber,
  TASK_STATUS_LABELS,
  PRIORITY_LABELS,
} from '@/lib/utils';
import { useDebounce } from '@/hooks/use-debounce';
import TaskCard from '@/components/tasks/task-card';
import TaskModal from '@/components/tasks/task-modal';
import TaskDetailPanel from '@/components/tasks/task-detail-panel';

interface Track {
  id: string;
  nameAr: string;
}

interface UserItem {
  id: string;
  name: string;
  nameAr: string;
}

export default function TasksPage() {
  const { user } = useAuth();
  const { tasks, loading, stats, statsLoading, fetchTasks, fetchStats } = useTasks();

  // Filters
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);

  // Lookup data
  const [tracks, setTracks] = useState<Track[]>([]);
  const [users, setUsers] = useState<UserItem[]>([]);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  // Detail panel state
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  const isAdminOrPm = user?.role === 'admin' || user?.role === 'pm';

  // Load tasks, stats, tracks, users
  const loadAll = useCallback(() => {
    fetchTasks();
    fetchStats();
  }, [fetchTasks, fetchStats]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  useEffect(() => {
    const load = async () => {
      try {
        const [tracksRes, usersRes] = await Promise.all([tracksApi.list(), usersApi.list()]);
        setTracks(tracksRes.data?.data || tracksRes.data || []);
        setUsers(usersRes.data?.data || usersRes.data || []);
      } catch {
        // Silent fail
      }
    };
    load();
  }, []);

  // Filtered tasks
  const filtered = useMemo(() => {
    return tasks.filter((t) => {
      const matchStatus = !statusFilter || t.status === statusFilter;
      const matchPriority = !priorityFilter || t.priority === priorityFilter;
      const matchSearch =
        !debouncedSearch ||
        t.titleAr?.includes(debouncedSearch) ||
        t.title?.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
        t.track?.nameAr?.includes(debouncedSearch);
      return matchStatus && matchPriority && matchSearch;
    });
  }, [tasks, statusFilter, priorityFilter, debouncedSearch]);

  // Handlers
  const handleCreate = () => {
    setEditingTask(null);
    setModalOpen(true);
  };

  const handleCardClick = (task: Task) => {
    setSelectedTask(task);
  };

  const handleModalSuccess = () => {
    loadAll();
  };

  const handleDetailUpdate = () => {
    loadAll();
    // Refresh selected task from refreshed list
    if (selectedTask) {
      const updated = tasks.find((t) => t.id === selectedTask.id);
      if (updated) setSelectedTask(updated);
    }
  };

  // Stats values
  const safeStats = stats || { total: 0, in_progress: 0, completed: 0, overdue: 0 };

  const STAT_CARDS = [
    {
      label: 'إجمالي المهام',
      value: formatNumber(safeStats.total || 0),
      icon: ListChecks,
      color: 'text-blue-400',
      bg: 'bg-blue-500/20',
    },
    {
      label: 'قيد التنفيذ',
      value: formatNumber(safeStats.in_progress || 0),
      icon: Clock,
      color: 'text-amber-400',
      bg: 'bg-amber-500/20',
    },
    {
      label: 'مكتملة',
      value: formatNumber(safeStats.completed || 0),
      icon: CheckCircle,
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/20',
    },
    {
      label: 'متأخرة',
      value: formatNumber(safeStats.overdue || 0),
      icon: AlertTriangle,
      color: 'text-red-400',
      bg: 'bg-red-500/20',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold">المهام</h1>
          <p className="text-gray-400 mt-1">إدارة ومتابعة المهام والتكليفات</p>
        </div>
        {isAdminOrPm && (
          <button
            onClick={handleCreate}
            className="rounded-xl bg-brand-500/20 px-4 py-2.5 text-sm font-medium text-brand-300 hover:bg-brand-500/30 transition-colors flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            إضافة مهمة
          </button>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {STAT_CARDS.map((stat) => (
          <div key={stat.label} className="glass p-4">
            <div className="flex items-center gap-3">
              <div className={cn('p-2.5 rounded-xl', stat.bg)}>
                <stat.icon className={cn('w-5 h-5', stat.color)} />
              </div>
              <div className="min-w-0">
                {statsLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin text-gray-500" />
                ) : (
                  <p className="text-lg font-bold truncate">{stat.value}</p>
                )}
                <p className="text-xs text-gray-400">{stat.label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder="بحث في المهام..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-field pr-10"
          />
        </div>

        {/* Status filter */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="input-field w-auto"
        >
          <option value="">كل الحالات</option>
          {Object.entries(TASK_STATUS_LABELS).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>

        {/* Priority filter */}
        <select
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value)}
          className="input-field w-auto"
        >
          <option value="">كل الأولويات</option>
          {Object.entries(PRIORITY_LABELS).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {/* Summary */}
      <div className="glass p-3">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-gray-400" />
          <span className="text-sm text-gray-400">
            عرض {formatNumber(filtered.length)} من {formatNumber(tasks.length)} مهمة
          </span>
        </div>
      </div>

      {/* Task Cards Grid */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-20 text-gray-400">
          <ListChecks className="h-12 w-12" />
          <p className="text-sm">لا توجد مهام</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((task) => (
            <TaskCard key={task.id} task={task} onClick={handleCardClick} />
          ))}
        </div>
      )}

      {/* Task Modal */}
      <TaskModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        task={editingTask}
        tracks={tracks}
        users={users}
        onSuccess={handleModalSuccess}
      />

      {/* Task Detail Panel */}
      {selectedTask && (
        <TaskDetailPanel
          task={selectedTask}
          onClose={() => setSelectedTask(null)}
          onUpdate={handleDetailUpdate}
        />
      )}
    </div>
  );
}
