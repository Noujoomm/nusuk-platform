'use client';

/**
 * استعادة موضع التمرير لحاوية المحتوى الرئيسية (<main>) عند التنقّل.
 *
 * لماذا هوك مخصّص؟ التمرير في المنصة يحدث داخل <main class="overflow-auto">
 * وليس على نافذة المتصفح، واستعادة Next.js الافتراضية تعمل على window فقط.
 *
 * السلوك:
 *   - يحفظ scrollTop لكل مسار أثناء التمرير.
 *   - عند العودة لقسم مُزار: يستعيد موضعه السابق. وبما أن الصفحات تجلب
 *     بياناتها بشكل غير متزامن (فقد يكون المحتوى قصيراً لحظة الاستعادة)،
 *     نعيد المحاولة عبر عدّة إطارات حتى ينمو المحتوى كفايةً أو تنتهي مهلة
 *     قصيرة.
 *   - عند الانتقال لقسم جديد (لا موضع محفوظ): يبدأ من الأعلى.
 */

import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react';
import { usePathname } from 'next/navigation';

// أقصى عدد إطارات لإعادة محاولة الاستعادة (~1 ثانية بمعدّل 60fps).
const MAX_RESTORE_FRAMES = 60;

// useLayoutEffect على الخادم يُطلق تحذيراً؛ نستخدم useEffect أثناء SSR
// وuseLayoutEffect في المتصفح (لاستعادة الموضع قبل الرسم بلا وميض).
const useIsomorphicLayoutEffect =
  typeof window !== 'undefined' ? useLayoutEffect : useEffect;

export function useScrollRestoration(ref: RefObject<HTMLElement>) {
  const pathname = usePathname();
  const positions = useRef<Map<string, number>>(new Map());

  // احفظ موضع التمرير الحالي باستمرار (مفتاحه المسار).
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onScroll = () => {
      positions.current.set(pathname, el.scrollTop);
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      // خزّن آخر قيمة قبل مغادرة هذا المسار.
      positions.current.set(pathname, el.scrollTop);
      el.removeEventListener('scroll', onScroll);
    };
  }, [ref, pathname]);

  // استعِد الموضع عند تغيّر المسار (قبل الرسم لتفادي الوميض).
  useIsomorphicLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const target = positions.current.get(pathname) ?? 0;

    if (target === 0) {
      el.scrollTop = 0;
      return;
    }

    let raf = 0;
    let frames = 0;
    const apply = () => {
      el.scrollTop = target;
      frames += 1;
      const reached = Math.abs(el.scrollTop - target) <= 1;
      if (!reached && frames < MAX_RESTORE_FRAMES) {
        raf = requestAnimationFrame(apply);
      }
    };
    raf = requestAnimationFrame(apply);
    return () => cancelAnimationFrame(raf);
  }, [ref, pathname]);
}
