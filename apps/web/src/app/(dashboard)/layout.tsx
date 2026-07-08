'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Menu, X } from 'lucide-react';
import { useAuth } from '@/stores/auth';
import { useSidebar } from '@/stores/sidebar';
import { useScrollRestoration } from '@/hooks/use-scroll-restoration';
import { cn } from '@/lib/utils';
import Sidebar from '@/components/sidebar';
import { MotionProvider } from '@/components/motion/MotionProvider';
import { NavigationProvider } from '@/components/navigation/NavigationProvider';
import { PageTransition } from '@/components/motion/PageTransition';
import GlobalSearch from '@/components/global-search';
import BottomDock from '@/components/ui/bottom-dock';
import ThemeToggle from '@/components/theme-toggle';
import { RoyaLoader } from '@/components/ui/RoyaLoader';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, loading, loadUser } = useAuth();
  const [searchOpen, setSearchOpen] = useState(false);
  const sidebarCollapsed = useSidebar((s) => s.collapsed);
  const toggleSidebar = useSidebar((s) => s.toggle);
  const mainRef = useRef<HTMLElement>(null);
  useScrollRestoration(mainRef);

  useEffect(() => {
    const timeout = setTimeout(() => {
      useAuth.setState({ loading: false });
    }, 10000);
    loadUser().finally(() => clearTimeout(timeout));
  }, [loadUser]);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd+K opens search; Ctrl/Cmd+B toggles the sidebar. Both
      // guard against text-input focus so they don't hijack typing.
      const inEditable =
        e.target instanceof HTMLElement &&
        (e.target.isContentEditable ||
          e.target.tagName === 'INPUT' ||
          e.target.tagName === 'TEXTAREA' ||
          e.target.tagName === 'SELECT');
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      } else if ((e.metaKey || e.ctrlKey) && (e.key === 'b' || e.key === 'B') && !inEditable) {
        e.preventDefault();
        toggleSidebar();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [toggleSidebar]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950">
        <RoyaLoader fullScreen={false} size="md" message="جاري التحميل..." />
      </div>
    );
  }

  if (!user) return null;

  return (
    <MotionProvider>
    <NavigationProvider>
    <div className="min-h-screen flex bg-gray-950">
      <Sidebar />
      <main
        ref={mainRef}
        className={cn(
          'flex-1 p-6 pb-20 overflow-auto transition-[margin] duration-300 ease-in-out motion-reduce:transition-none',
          sidebarCollapsed ? 'mr-0' : 'mr-64',
        )}
      >
        {/* Top utility row: hamburger on the right (where the sidebar
            lives in RTL), theme toggle on the left. Both stay accessible
            regardless of sidebar state. */}
        <div className="flex items-center justify-between mb-4">
          <button
            type="button"
            onClick={toggleSidebar}
            aria-label={sidebarCollapsed ? 'إظهار القائمة الجانبية' : 'إخفاء القائمة الجانبية'}
            aria-expanded={!sidebarCollapsed}
            aria-controls="primary-sidebar"
            title={
              sidebarCollapsed
                ? 'إظهار القائمة (Ctrl/Cmd+B)'
                : 'إخفاء القائمة (Ctrl/Cmd+B)'
            }
            className="inline-flex items-center justify-center w-10 h-10 rounded-lg border border-white/10 bg-white/[0.03] text-gray-300 hover:bg-white/10 hover:text-white transition-colors"
          >
            {sidebarCollapsed ? <Menu className="w-5 h-5" /> : <X className="w-5 h-5" />}
          </button>
          <ThemeToggle />
        </div>
        <PageTransition>{children}</PageTransition>
      </main>
      <GlobalSearch isOpen={searchOpen} onClose={() => setSearchOpen(false)} />
      <BottomDock />
    </div>
    </NavigationProvider>
    </MotionProvider>
  );
}
