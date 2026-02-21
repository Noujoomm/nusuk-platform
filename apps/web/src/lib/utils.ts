import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string | Date) {
  return new Intl.DateTimeFormat('ar-SA', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(date));
}

export function formatDateTime(date: string | Date) {
  return new Intl.DateTimeFormat('ar-SA', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date));
}

export const STATUS_LABELS: Record<string, string> = {
  draft: 'مسودة',
  active: 'نشط',
  in_progress: 'قيد التنفيذ',
  completed: 'مكتمل',
  cancelled: 'ملغي',
};

export const PRIORITY_LABELS: Record<string, string> = {
  low: 'منخفض',
  medium: 'متوسط',
  high: 'مرتفع',
  critical: 'حرج',
};

export const ROLE_LABELS: Record<string, string> = {
  admin: 'مدير النظام',
  pm: 'مدير المشروع',
  track_lead: 'قائد المسار',
  employee: 'موظف',
  hr: 'موارد بشرية',
};

export const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-500/20 text-gray-300',
  active: 'bg-blue-500/20 text-blue-300',
  in_progress: 'bg-amber-500/20 text-amber-300',
  completed: 'bg-emerald-500/20 text-emerald-300',
  cancelled: 'bg-red-500/20 text-red-300',
};

export const PRIORITY_COLORS: Record<string, string> = {
  low: 'bg-gray-500/20 text-gray-300',
  medium: 'bg-blue-500/20 text-blue-300',
  high: 'bg-amber-500/20 text-amber-300',
  critical: 'bg-red-500/20 text-red-300',
};
