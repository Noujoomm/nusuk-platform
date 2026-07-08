/**
 * لبنات الهياكل العظمية (Skeletons) — تغذية بصرية فورية بنفس شكل المحتوى
 * القادم، بدل سبينر عام. تُستخدم في ملفات loading.tsx لكل مقطع مسار.
 *
 * تعتمد على أداة `.shimmer` في globals.css (كنس GPU باتجاه RTL صحيح،
 * ويحترم prefers-reduced-motion تلقائياً). كل لبنة كتلة خافتة زجاجية
 * تنسجم مع ثيم Dark Glassmorphism.
 */

import { cn } from '@/lib/utils';

/** كتلة أساسية بلمعان. */
export function Skeleton({
  className,
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      aria-hidden
      style={style}
      className={cn(
        'shimmer relative overflow-hidden rounded-lg bg-white/[0.06]',
        className,
      )}
    />
  );
}

/** بطاقة زجاجية فارغة (حاوية عناصر داخلية). */
export function SkeletonCard({
  className,
  children,
}: {
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className={cn('glass rounded-2xl border border-white/10 p-5', className)}>
      {children}
    </div>
  );
}

/** رأس الصفحة: عنوان + وصف + زر إجراء. */
export function SkeletonPageHeader() {
  return (
    <div className="mb-6 flex items-start justify-between gap-4">
      <div className="space-y-2">
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-4 w-72" />
      </div>
      <Skeleton className="h-10 w-32 rounded-xl" />
    </div>
  );
}

/** صف بطاقات إحصائية (KPIs). */
export function SkeletonStatGrid({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} className="p-4">
          <div className="flex items-center gap-3">
            <Skeleton className="h-11 w-11 rounded-xl" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-6 w-16" />
            </div>
          </div>
        </SkeletonCard>
      ))}
    </div>
  );
}

/** كتلة رسم بياني. */
export function SkeletonChart({ className }: { className?: string }) {
  return (
    <SkeletonCard className={className}>
      <Skeleton className="mb-4 h-4 w-40" />
      <Skeleton className="h-56 w-full rounded-xl" />
    </SkeletonCard>
  );
}

/** جدول: رأس + صفوف. */
export function SkeletonTable({ rows = 8 }: { rows?: number }) {
  return (
    <SkeletonCard className="p-0 overflow-hidden">
      <div className="flex items-center gap-4 border-b border-white/10 px-5 py-3">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-32" />
        <Skeleton className="ms-auto h-4 w-20" />
      </div>
      <div className="divide-y divide-white/5">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-5 py-3.5">
            <Skeleton className="h-9 w-9 rounded-lg" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3.5 w-1/3" />
              <Skeleton className="h-3 w-1/2" />
            </div>
            <Skeleton className="h-6 w-16 rounded-full" />
          </div>
        ))}
      </div>
    </SkeletonCard>
  );
}

/** شبكة بطاقات (مسارات، ملفات…). */
export function SkeletonCardGrid({
  count = 6,
  columns = 'lg:grid-cols-3',
}: {
  count?: number;
  columns?: string;
}) {
  return (
    <div className={cn('grid grid-cols-1 gap-4 sm:grid-cols-2', columns)}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i}>
          <div className="mb-4 flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-xl" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
          <Skeleton className="mb-2 h-3 w-full" />
          <Skeleton className="h-3 w-4/5" />
          <div className="mt-4 flex items-center gap-2">
            <Skeleton className="h-2 flex-1 rounded-full" />
            <Skeleton className="h-4 w-10" />
          </div>
        </SkeletonCard>
      ))}
    </div>
  );
}
