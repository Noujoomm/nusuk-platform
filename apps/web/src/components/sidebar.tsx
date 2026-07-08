'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { NavLink } from '@/components/navigation/NavLink';
import { useAuth } from '@/stores/auth';
import { useSidebar } from '@/stores/sidebar';
import { cn, ROLE_LABELS } from '@/lib/utils';
import { dailyUpdatesApi } from '@/lib/api';
import { LogOut } from 'lucide-react';
import { navItemsForRole } from '@/lib/nav';
import NotificationBell from '@/components/notifications/notification-bell';
import { Logo } from '@/components/brand/Logo';

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const [unreadUpdates, setUnreadUpdates] = useState(0);

  useEffect(() => {
    if (!user) return;
    const fetchUnread = () => {
      dailyUpdatesApi.unreadCount().then(({ data }) => setUnreadUpdates(data.unreadCount || 0)).catch(() => {});
    };
    fetchUnread();
    const interval = setInterval(fetchUnread, 30000);
    return () => clearInterval(interval);
  }, [user]);

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  const collapsed = useSidebar((s) => s.collapsed);

  return (
    <aside
      id="primary-sidebar"
      aria-hidden={collapsed}
      // In RTL, `translate-x-full` moves the aside +100% to the right,
      // which slides it off-screen since `right-0` pins it to the
      // right edge. We keep `w-64` constant (don't animate width)
      // because animating width fights with the main content's margin
      // transition and produces a jitter.
      className={cn(
        'fixed right-0 top-0 w-64 h-screen glass border-l border-white/10 flex flex-col z-40 transition-transform duration-300 ease-in-out motion-reduce:transition-none',
        collapsed && 'translate-x-full',
      )}
    >
      {/* Header */}
      <div className="p-5 border-b border-white/10">
        <div className="flex items-center justify-between">
          <Logo size={40} src="/brand/roya-icon.png" />
          <NotificationBell />
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1 overflow-auto">
        {navItemsForRole(user?.role).map((item) => {
          const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
          return (
            <NavLink
              key={item.href}
              href={item.href}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all',
                isActive
                  ? 'bg-brand-500/20 text-brand-300'
                  : 'text-gray-400 hover:bg-white/5 hover:text-white',
              )}
            >
              <item.icon className="w-5 h-5" />
              {item.label}
              {item.href === '/updates' && unreadUpdates > 0 && (
                <span className="mr-auto bg-brand-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                  {unreadUpdates > 99 ? '99+' : unreadUpdates}
                </span>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* User */}
      <div className="p-4 border-t border-white/10">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center text-sm font-bold">
            {user?.nameAr?.charAt(0) || user?.name?.charAt(0) || '?'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">{user?.nameAr || user?.name}</p>
            <p className="text-xs text-gray-500">{ROLE_LABELS[user?.role || ''] || user?.role}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 w-full px-3 py-2 rounded-xl text-sm text-red-400 hover:bg-red-500/10 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          تسجيل الخروج
        </button>
      </div>
    </aside>
  );
}
