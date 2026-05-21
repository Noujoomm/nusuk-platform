'use client';

/**
 * منصة رؤية — صفحة الهبوط العامة (محتوى العميل).
 *
 * كل الحركات transform/opacity فقط، RTL (الدخول من اليمين)، وتحترم
 * prefers-reduced-motion عبر <MotionProvider reducedMotion="user">.
 * مشهد الـ 3D يُحمّل lazy (ssr:false) ويُستبدل تلقائياً بتدرّج ثابت على
 * الأجهزة الضعيفة/الجوال/عند تقليل الحركة (داخل Hero3DScene).
 */

import Link from 'next/link';
import dynamic from 'next/dynamic';
import { motion } from 'framer-motion';
import {
  LayoutDashboard, Sparkles, Activity, Receipt, Fingerprint,
  FileBarChart, ChevronDown, LogIn, ArrowLeft,
} from 'lucide-react';
import { MotionProvider } from '@/components/motion/MotionProvider';
import { AnimatedSection } from '@/components/landing/AnimatedSection';
import { TiltCard } from '@/components/motion/TiltCard';
import { CountUp } from '@/components/motion/CountUp';
import { Logo } from '@/components/brand/Logo';
import { fadeInRight, fadeInUp, scaleIn, staggerItem } from '@/lib/animations';

// الـ 3D خارج SSR والـ bundle الأولي؛ يكتشف القدرة داخلياً ويستبدل بتدرّج.
const Hero3DScene = dynamic(
  () => import('@/components/landing/three/Hero3DScene').then((m) => m.Hero3DScene),
  {
    ssr: false,
    loading: () => <div className="absolute inset-0" style={{ background: 'var(--color-bg-primary)' }} />,
  },
);

const FEATURES = [
  { icon: LayoutDashboard, title: 'لوحة تحكم تنفيذية', desc: 'مؤشرات الأداء وترتيب المسارات في لوحة واحدة لحظية.' },
  { icon: Sparkles, title: 'مساعد رؤية الذكي', desc: 'استخراج المهام وتحسين التقارير بالذكاء الاصطناعي.' },
  { icon: Activity, title: 'تتبّع الإنتاجية', desc: 'قياس إنجاز الفرق والمسارات أسبوعياً بدقة.' },
  { icon: Receipt, title: 'إدارة العهد والفواتير', desc: 'دورة كاملة للعُهد والمصروفات مع موافقات وتدقيق.' },
  { icon: Fingerprint, title: 'الحضور والانصراف', desc: 'تحليل البصمات اليومية وتقارير الغياب الرسمية.' },
  { icon: FileBarChart, title: 'التقارير الذكية', desc: 'توليد وتحليل التقارير ومركز ذكاء متكامل.' },
];

const STATS: { value: number; label: string; format?: (n: number) => string }[] = [
  { value: 7, label: 'مسارات تشغيلية' },
  { value: 6, label: 'أدوار وظيفية' },
  { value: 6, label: 'وحدات متكاملة' },
  { value: 100, label: 'عربي RTL', format: (n) => `${Math.round(n)}٪` },
];

export function LandingClient() {
  return (
    <MotionProvider>
      <main dir="rtl" className="relative bg-gray-950 text-white overflow-x-hidden">
        {/* ─── Hero ─── */}
        <section className="relative min-h-screen flex flex-col items-center justify-center px-4 text-center">
          <Hero3DScene />
          {/* تعتيم لطيف لقراءة النص فوق المشهد */}
          <div className="absolute inset-0 bg-gradient-to-b from-gray-950/40 via-transparent to-gray-950 pointer-events-none" />

          <div className="relative z-10 max-w-3xl">
            <motion.div initial="hidden" animate="show" variants={scaleIn} className="flex justify-center mb-6">
              <Logo size={72} withWordmark={false} src="/brand/roya-icon.png" />
            </motion.div>
            <motion.h1
              initial="hidden" animate="show" variants={fadeInRight}
              className="text-4xl sm:text-6xl font-bold mb-4"
            >
              منصة رؤية
            </motion.h1>
            <motion.p
              initial="hidden" animate="show" variants={fadeInUp}
              transition={{ delay: 0.1 }}
              className="text-base sm:text-lg text-gray-300 mb-8 leading-relaxed"
            >
              نظام إدارة المشاريع المؤسسي لمشروع بطاقة نُسك — وزارة الحج والعمرة.
              لوحات قيادة، ذكاء اصطناعي، وإدارة متكاملة في منصة واحدة.
            </motion.p>
            <motion.div
              initial="hidden" animate="show" variants={fadeInUp}
              transition={{ delay: 0.2 }}
              className="flex items-center justify-center gap-3 flex-wrap"
            >
              <Link
                href="/login"
                className="inline-flex items-center gap-2 rounded-xl bg-brand-700 hover:bg-brand-800 px-6 py-3 font-semibold transition-colors"
              >
                <LogIn className="w-5 h-5" />
                تسجيل الدخول
              </Link>
              <a
                href="#features"
                className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/[0.04] hover:bg-white/10 px-6 py-3 font-medium transition-colors"
              >
                اكتشف المزيد
                <ArrowLeft className="w-4 h-4" />
              </a>
            </motion.div>
          </div>

          {/* مؤشر التمرير (bounce — يتوقف مع reduce motion عبر MotionConfig) */}
          <motion.a
            href="#features"
            aria-label="انتقل للأسفل"
            className="absolute bottom-8 z-10 text-gray-400 hover:text-white"
            animate={{ y: [0, 10, 0] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
          >
            <ChevronDown className="w-7 h-7" />
          </motion.a>
        </section>

        {/* ─── Features ─── */}
        <AnimatedSection id="features" stagger className="max-w-6xl mx-auto px-4 py-24">
          <motion.h2 variants={staggerItem} className="text-3xl font-bold text-center mb-3">
            كل ما تحتاجه إدارة المشروع
          </motion.h2>
          <motion.p variants={staggerItem} className="text-gray-400 text-center mb-12">
            ست وحدات متكاملة على منصة واحدة.
          </motion.p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map((f) => (
              <motion.div key={f.title} variants={staggerItem}>
                <TiltCard className="glass p-6 h-full rounded-2xl" max={6}>
                  <div className="w-12 h-12 rounded-xl bg-brand-500/15 flex items-center justify-center mb-4">
                    <f.icon className="w-6 h-6 text-brand-300" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">{f.title}</h3>
                  <p className="text-sm text-gray-400 leading-relaxed">{f.desc}</p>
                </TiltCard>
              </motion.div>
            ))}
          </div>
        </AnimatedSection>

        {/* ─── Stats ─── */}
        <section className="relative py-24 px-4" style={{ background: 'var(--gradient-brand)' }}>
          <div className="absolute inset-0 bg-gray-950/30" />
          <AnimatedSection stagger className="relative max-w-5xl mx-auto grid grid-cols-2 lg:grid-cols-4 gap-8 text-center">
            {STATS.map((s) => (
              <motion.div key={s.label} variants={staggerItem}>
                <div className="text-4xl sm:text-5xl font-bold tabular-nums mb-2">
                  <CountUp value={s.value} format={s.format} />
                </div>
                <div className="text-sm text-white/80">{s.label}</div>
              </motion.div>
            ))}
          </AnimatedSection>
        </section>

        {/* ─── CTA ─── */}
        <AnimatedSection className="max-w-3xl mx-auto px-4 py-24 text-center">
          <h2 className="text-3xl font-bold mb-4">جاهز للبدء؟</h2>
          <p className="text-gray-400 mb-8">سجّل دخولك إلى منصة رؤية وابدأ إدارة مشروعك بكفاءة.</p>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 rounded-xl bg-brand-700 hover:bg-brand-800 px-8 py-3.5 font-semibold transition-colors"
          >
            <LogIn className="w-5 h-5" />
            تسجيل الدخول
          </Link>
        </AnimatedSection>

        {/* ─── Footer ─── */}
        <footer className="border-t border-white/10 px-4 py-10">
          <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
            <Logo size={36} src="/brand/roya-icon.png" />
            <nav className="flex items-center gap-5 text-sm text-gray-400">
              <Link href="/login" className="hover:text-white transition-colors">تسجيل الدخول</Link>
              <a href="#features" className="hover:text-white transition-colors">المميزات</a>
            </nav>
            <p className="text-xs text-gray-500">© ٢٠٢٦ منصة رؤية · roya2030.org</p>
          </div>
        </footer>
      </main>
    </MotionProvider>
  );
}
