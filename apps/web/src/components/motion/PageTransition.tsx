'use client';

/**
 * انتقال ناعم وسريع بين الأقسام.
 *
 * سابقاً كان يستخدم <AnimatePresence mode="wait"> — وهذا يُجبر كل تنقّلة
 * على الانتظار حتى ينتهي تلاشي الصفحة القديمة (exit) قبل تركيب الجديدة،
 * فيضيف تأخيراً محسوساً على *كل* انتقال. الآن نُركّب الصفحة الجديدة
 * فوراً (key على المسار) ونشغّل دخولاً خفيفاً بالـ opacity فقط:
 *   - لا exit ⇒ لا انتظار ⇒ إحساس فوري بالسرعة.
 *   - opacity فقط ⇒ لا layout shift ولا تأثّر باتجاه RTL (محايد اتجاهياً).
 *   - مدة قصيرة جداً (0.18s) ⇒ يظهر المحتوى دون أن يبطّئ.
 *
 * تغيّر الـ key عند تبدّل المسار يجعل React يُلغي تركيب الصفحة القديمة
 * فوراً ويُركّب الجديدة، فيبدأ دخولها من الحالة initial. تخطّي الحركة
 * لمن يُفضّل تقليلها يتكفّل به <MotionConfig reducedMotion="user"> عالمياً.
 */

import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { EASE_OUT } from '@/lib/motion/variants';

export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <motion.div
      key={pathname}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.18, ease: EASE_OUT }}
      style={{ willChange: 'opacity' }}
    >
      {children}
    </motion.div>
  );
}
