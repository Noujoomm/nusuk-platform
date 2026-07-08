'use client';

/**
 * مزوّد حالة التنقّل + شريط التقدّم العلوي.
 *
 * يجمع مصدرين لمعرفة "هل نحن ننتقل الآن؟":
 *   1. useTransition — يبقى pending أثناء تحوّل React للمسار الجديد
 *      (ويشمل انتظار حدود Suspense/loading.tsx للمقاطع غير المحمّلة بعد).
 *   2. علامة يدوية (start) تُضبط لحظة النقر على رابط، وتُمسح تلقائياً
 *      حال تغيّر المسار فعلياً — تغطّي الفجوة قبل أن يلتقط الـ transition.
 *
 * الاستخدام:
 *   - navigate(href): تنقّل برمجي (مثلاً من ⌘K) ملفوف بـ startTransition.
 *   - start(): تُستدعى من <NavLink> قبل أن يتولّى <Link> التنقّل الفعلي —
 *     هكذا نحتفظ بالـ prefetch المدمج في <Link> ونعرض الشريط في آنٍ معاً.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  useTransition,
} from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { TopProgressBar } from './TopProgressBar';

interface NavContextValue {
  /** هل يجري تنقّل الآن؟ */
  isNavigating: boolean;
  /** علّم بدء تنقّل (يستخدمه <NavLink> مع <Link>). */
  start: () => void;
  /** تنقّل برمجي مع حالة pending (⌘K، أزرار…). */
  navigate: (href: string) => void;
}

const NavContext = createContext<NavContextValue | null>(null);

export function NavigationProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();
  const [pendingStart, setPendingStart] = useState(false);
  const safety = useRef<ReturnType<typeof setTimeout>>();

  const clearSafety = () => {
    if (safety.current) clearTimeout(safety.current);
  };

  const start = useCallback(() => {
    setPendingStart(true);
    clearSafety();
    // صمام أمان: لو لم يتغيّر المسار (نقرة على نفس الرابط، أو فشل) نمسح
    // المؤشّر بعد مهلة حتى لا يعلق الشريط.
    safety.current = setTimeout(() => setPendingStart(false), 8000);
  }, []);

  const navigate = useCallback(
    (href: string) => {
      if (!href || href === pathname) return;
      start();
      startTransition(() => router.push(href));
    },
    [router, pathname, start],
  );

  // تغيّر المسار = اكتمل التنقّل ⇒ امسح المؤشّر اليدوي.
  useEffect(() => {
    setPendingStart(false);
    clearSafety();
  }, [pathname]);

  useEffect(() => () => clearSafety(), []);

  const isNavigating = isPending || pendingStart;

  return (
    <NavContext.Provider value={{ isNavigating, start, navigate }}>
      <TopProgressBar active={isNavigating} />
      {children}
    </NavContext.Provider>
  );
}

export function useNav(): NavContextValue {
  const ctx = useContext(NavContext);
  if (!ctx) {
    throw new Error('useNav يجب أن يُستخدم داخل <NavigationProvider>');
  }
  return ctx;
}
