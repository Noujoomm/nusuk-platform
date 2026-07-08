'use client';

/**
 * شريط تقدّم علوي رفيع يظهر أثناء التنقّل بين الأقسام — تغذية بصرية فورية
 * بأن النظام يستجيب، دون لودر كامل الشاشة.
 *
 * اتجاهياً (RTL): الشريط مثبّت على الحافة اليمنى (right-0) وينمو عرضه نحو
 * اليسار — أي يمتلئ من "البداية" (اليمين) إلى "النهاية" (اليسار)، وهو
 * الاتجاه الصحيح في الواجهة العربية.
 *
 * السلوك: يبدأ بسرعة ثم "يتقطّر" حتى 90% (لأننا لا نعرف مدة التنقّل
 * الحقيقية)، وعند الاكتمال يقفز إلى 100% ثم يتلاشى. يحرّك العرض فقط
 * (transition-[width]) فلا يُشغّل layout.
 */

import { useEffect, useRef, useState } from 'react';

export function TopProgressBar({ active }: { active: boolean }) {
  const [width, setWidth] = useState(0);
  const [visible, setVisible] = useState(false);
  const visibleRef = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    const clear = () => {
      if (timer.current) clearTimeout(timer.current);
    };

    if (active) {
      setVisible(true);
      visibleRef.current = true;
      setWidth(8);
      const trickle = () => {
        setWidth((w) => {
          if (w >= 90) return w;
          const inc = w < 40 ? 10 : w < 70 ? 4 : 1.5;
          return Math.min(90, w + inc);
        });
        timer.current = setTimeout(trickle, 250);
      };
      timer.current = setTimeout(trickle, 250);
      return clear;
    }

    // التنقّل اكتمل: أكمل الشريط إلى 100% ثم أخفِه.
    clear();
    if (visibleRef.current) {
      setWidth(100);
      const done = setTimeout(() => {
        setVisible(false);
        visibleRef.current = false;
        setWidth(0);
      }, 240);
      return () => clearTimeout(done);
    }
    return clear;
  }, [active]);

  if (!visible) return null;

  return (
    <div
      aria-hidden
      className="fixed top-0 inset-x-0 z-[60] h-[3px] pointer-events-none motion-reduce:hidden"
    >
      <div
        className="absolute top-0 right-0 h-full bg-gradient-to-l from-brand-400 via-brand-500 to-brand-700 transition-[width] duration-200 ease-out"
        style={{ width: `${width}%`, boxShadow: '0 0 12px 1px rgba(62,119,214,0.65)' }}
      />
    </div>
  );
}
