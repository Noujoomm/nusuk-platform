'use client';

/**
 * شاشة الإقلاع الأولى. تبدأ ظاهرة (لتطابق ما يُصيّره الخادم وتفادي
 * عدم تطابق الـ hydration)، ثم تختفي بتلاشٍ بعد أول mount على العميل —
 * أي حالما تصبح الواجهة جاهزة للرسم. تغلّف بقية التطبيق فيظهر المحتوى
 * تحتها مباشرة بعد اختفائها.
 */

import { useEffect, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { RoyaLoader } from '@/components/ui/RoyaLoader';

export function AppBootLoader({ children }: { children: React.ReactNode }) {
  const [booting, setBooting] = useState(true);

  useEffect(() => {
    // ننتظر إطاراً واحداً بعد التركيب لضمان رسم أول لقطة، ثم نخفي.
    const raf = requestAnimationFrame(() => setBooting(false));
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <>
      {children}
      <AnimatePresence>{booting && <RoyaLoader key="boot" fullScreen />}</AnimatePresence>
    </>
  );
}

export default AppBootLoader;
