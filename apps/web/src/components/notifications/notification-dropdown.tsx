'use client';

import { useEffect } from 'react';
import { Bell, X } from 'lucide-react';
import { useNotifications } from '@/stores/notifications';
import { cn, formatDateTime } from '@/lib/utils';

interface NotificationDropdownProps {
  onClose: () => void;
}

export default function NotificationDropdown({ onClose }: NotificationDropdownProps) {
  const {
    notifications,
    loading,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification,
  } = useNotifications();

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  return (
    <div className="glass absolute left-0 top-full mt-2 w-96 max-h-[500px] overflow-hidden z-50 rounded-xl border border-white/10">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <h3 className="text-sm font-semibold text-white">الإشعارات</h3>
        <button
          onClick={() => markAllAsRead()}
          className="text-xs text-brand-300 transition-colors hover:text-white"
        >
          تحديد الكل كمقروء
        </button>
      </div>

      {/* Content */}
      <div className="max-h-[400px] overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-12 text-gray-400">
            <Bell className="h-10 w-10" />
            <p className="text-sm">لا توجد إشعارات</p>
          </div>
        ) : (
          notifications.map((notification) => (
            <div
              key={notification.id}
              onClick={() => {
                if (!notification.isRead) {
                  markAsRead(notification.id);
                }
              }}
              className={cn(
                'flex cursor-pointer items-start gap-3 border-b border-white/5 px-4 py-3 transition-colors hover:bg-white/5',
                !notification.isRead && 'bg-brand-500/5'
              )}
            >
              {/* Read/Unread indicator */}
              <div className="mt-2 shrink-0">
                <div
                  className={cn(
                    'h-2 w-2 rounded-full',
                    notification.isRead ? 'bg-transparent' : 'bg-brand-300'
                  )}
                />
              </div>

              {/* Content */}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-white">
                  {notification.titleAr || notification.title}
                </p>
                <p className="mt-1 line-clamp-2 text-xs text-gray-400">
                  {notification.body}
                </p>
                <p className="mt-1 text-[10px] text-gray-400/60">
                  {formatDateTime(notification.createdAt)}
                </p>
              </div>

              {/* Delete button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  deleteNotification(notification.id);
                }}
                className="mt-1 shrink-0 rounded p-1 text-gray-400 transition-colors hover:bg-white/10 hover:text-white"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
