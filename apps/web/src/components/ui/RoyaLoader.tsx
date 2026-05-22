'use client';

/**
 * RoyaLoader — شاشة التحميل الموحّدة لمنصة رؤية.
 *
 * لودر واحد فاخر يُلبس الشعار ست طبقات حركية في آنٍ واحد:
 *   ١) نبض تنفّسي على الشعار (scale 1 → 1.04 → 1).
 *   ٢) هالة توهّج زرقاء خلف الشعار، تنبض خارج طور النبض (إزاحة ~0.4s).
 *   ٣) حلقة مدارية رفيعة (conic-gradient) تدور ببطء حول الشعار.
 *   ٤) ومضة لمعان قطرية تعبر الشعار كل ~4s (إحساس انعكاس زجاجي).
 *   ٥) ثلاث نقاط تتلاشى بالتسلسل من اليمين لليسار (اتجاه القراءة العربي).
 *   ٦) عبارة "جارٍ التحميل..." تتنفّس بتلاشٍ لطيف.
 *
 * كل الحركات على transform/opacity فقط (60fps بلا إعادة تخطيط).
 * يحترم prefers-reduced-motion عبر useReducedMotion: ينهار إلى نبض
 * تلاشٍ بسيط فقط. متاح بـ role="status" + aria-live + نص للقارئ الصوتي.
 *
 * مكتفٍ ذاتياً: لا يعتمد على <MotionProvider>، فيصلح للاستخدام في
 * app/loading.tsx وشاشة الإقلاع ومزوّد التحميل اليدوي على حدٍّ سواء.
 */

import Image from 'next/image';
import { motion, useReducedMotion, type Transition } from 'framer-motion';

type Size = 'sm' | 'md' | 'lg';

interface RoyaLoaderProps {
  /** ملء الشاشة (تراكب ثابت) مقابل وضع مضمّن داخل عنصر. الافتراضي true. */
  fullScreen?: boolean;
  /** نص التحميل. الافتراضي "جارٍ التحميل...". */
  message?: string;
  /** الحجم — الافتراضي 'lg' لملء الشاشة و'sm' للمضمّن. */
  size?: Size;
  /** مسار شعار بديل (الافتراضي يطابق ما يضعه المستخدم في /public). */
  logoSrc?: string;
  className?: string;
}

/** أبعاد كل مقاس بالبكسل (الشعار، فجوة الحلقة، النقطة، حجم نص العبارة). */
const SIZES: Record<Size, { logo: number; ring: number; dot: number; caption: string; gap: string }> = {
  sm: { logo: 56, ring: 20, dot: 6, caption: 'text-xs', gap: 'gap-3' },
  md: { logo: 84, ring: 26, dot: 8, caption: 'text-sm', gap: 'gap-4' },
  lg: { logo: 120, ring: 34, dot: 10, caption: 'text-base', gap: 'gap-5' },
};

const ROYAL = '#1d4ed8';

export function RoyaLoader({
  fullScreen = true,
  message = 'جارٍ التحميل...',
  size,
  logoSrc = '/roya-logo.png',
  className = '',
}: RoyaLoaderProps) {
  const reduce = useReducedMotion();
  const s = SIZES[size ?? (fullScreen ? 'lg' : 'sm')];

  // الحلقة والهالة أكبر قليلاً من الشعار لتُحيط به.
  const ringSize = s.logo + s.ring;
  const haloSize = Math.round(s.logo * 1.6);

  const breath: Transition = { duration: 2, repeat: Infinity, ease: 'easeInOut' };

  const content = (
    <div className={`flex flex-col items-center justify-center ${s.gap}`} dir="rtl">
      {/* ── الشعار + الطبقات المحيطة ── */}
      <div className="relative grid place-items-center" style={{ width: ringSize, height: ringSize }}>
        {/* (٢) هالة التوهّج — خارج طور النبض بإزاحة 0.4s */}
        <motion.div
          aria-hidden
          className="absolute rounded-full"
          style={{
            width: haloSize,
            height: haloSize,
            background: `radial-gradient(circle, ${ROYAL}55 0%, ${ROYAL}22 45%, transparent 70%)`,
            filter: 'blur(8px)',
          }}
          animate={reduce ? { opacity: 0.4 } : { scale: [1, 1.14, 1], opacity: [0.35, 0.65, 0.35] }}
          transition={reduce ? undefined : { ...breath, delay: 0.4 }}
        />

        {/* (٣) الحلقة المدارية — conic-gradient شفاف→أزرق→شفاف، تدور 3s */}
        {!reduce && (
          <motion.div
            aria-hidden
            className="absolute rounded-full"
            style={{
              width: ringSize,
              height: ringSize,
              background: `conic-gradient(from 0deg, transparent 0%, ${ROYAL} 25%, transparent 55%)`,
              WebkitMask: 'radial-gradient(farthest-side, transparent calc(100% - 2.5px), #000 calc(100% - 2.5px))',
              mask: 'radial-gradient(farthest-side, transparent calc(100% - 2.5px), #000 calc(100% - 2.5px))',
            }}
            animate={{ rotate: 360 }}
            transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
          />
        )}

        {/* (١) نبض الشعار التنفّسي + (٤) ومضة اللمعان */}
        <motion.div
          className="relative overflow-hidden rounded-2xl shadow-2xl"
          style={{ width: s.logo, height: s.logo, boxShadow: `0 12px 32px -8px ${ROYAL}66` }}
          animate={reduce ? { opacity: [0.65, 1, 0.65] } : { scale: [1, 1.04, 1] }}
          transition={breath}
        >
          <Image
            src={logoSrc}
            alt="رؤية"
            width={s.logo}
            height={s.logo}
            priority
            className="w-full h-full object-cover"
          />
          {/* (٤) ومضة لمعان قطرية تعبر الشعار كل ~4s */}
          {!reduce && (
            <motion.div
              aria-hidden
              className="absolute inset-0"
              style={{
                background:
                  'linear-gradient(115deg, transparent 35%, rgba(255,255,255,0.45) 50%, transparent 65%)',
              }}
              initial={{ x: '-130%' }}
              animate={{ x: '130%' }}
              transition={{ duration: 1.1, repeat: Infinity, repeatDelay: 2.9, ease: 'easeInOut' }}
            />
          )}
        </motion.div>
      </div>

      {/* (٥) النقاط — dir=rtl يجعل أول عنصر هو الأيمن فيضيء أولاً */}
      <div className="flex items-center gap-2" dir="rtl" aria-hidden>
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="rounded-full"
            style={{ width: s.dot, height: s.dot, backgroundColor: ROYAL }}
            animate={reduce ? { opacity: 0.55 } : { opacity: [0.2, 1, 0.2], scale: [0.85, 1, 0.85] }}
            transition={reduce ? undefined : { duration: 1.2, repeat: Infinity, ease: 'easeInOut', delay: i * 0.2 }}
          />
        ))}
      </div>

      {/* (٦) العبارة العربية — تتنفّس بتلاشٍ لطيف */}
      <motion.p
        className={`${s.caption} font-medium`}
        style={{ color: 'var(--color-text-secondary, #94a3b8)' }}
        animate={reduce ? { opacity: 0.8 } : { opacity: [0.55, 1, 0.55] }}
        transition={reduce ? undefined : { duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
      >
        {message}
      </motion.p>
    </div>
  );

  // الدخول ~200ms، الخروج ~300ms (يعمل الخروج عند تغليفه بـ AnimatePresence).
  const fade = {
    initial: { opacity: 0 },
    animate: { opacity: 1, transition: { duration: 0.2, ease: 'easeOut' as const } },
    exit: { opacity: 0, transition: { duration: 0.3, ease: 'easeIn' as const } },
  };

  if (!fullScreen) {
    return (
      <motion.div
        {...fade}
        role="status"
        aria-live="polite"
        className={`flex items-center justify-center ${className}`}
      >
        {content}
        <span className="sr-only">{message}</span>
      </motion.div>
    );
  }

  return (
    <motion.div
      {...fade}
      role="status"
      aria-live="polite"
      dir="rtl"
      className={`fixed inset-0 z-[9999] flex items-center justify-center ${className}`}
      style={{ background: 'linear-gradient(to bottom, #0f172a, #1e293b)' }}
    >
      {content}
      <span className="sr-only">{message}</span>
    </motion.div>
  );
}

export default RoyaLoader;
