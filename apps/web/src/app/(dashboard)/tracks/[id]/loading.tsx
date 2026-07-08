import {
  Skeleton,
  SkeletonStatGrid,
  SkeletonCard,
} from '@/components/ui/skeleton';

/** هيكل تفاصيل المسار: رأس + شريط تبويبات + إحصائيات + محتوى. */
export default function Loading() {
  return (
    <div>
      {/* رأس المسار */}
      <div className="mb-6 flex items-center gap-4">
        <Skeleton className="h-12 w-12 rounded-2xl" />
        <div className="space-y-2">
          <Skeleton className="h-7 w-64" />
          <Skeleton className="h-4 w-40" />
        </div>
      </div>

      {/* تبويبات */}
      <div className="mb-6 flex gap-2 overflow-hidden">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-24 rounded-xl" />
        ))}
      </div>

      <SkeletonStatGrid count={4} />

      <div className="mt-6 space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <SkeletonCard key={i} className="p-4">
            <div className="flex items-center gap-3">
              <Skeleton className="h-9 w-9 rounded-lg" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-3 w-1/2" />
              </div>
              <Skeleton className="h-6 w-16 rounded-full" />
            </div>
          </SkeletonCard>
        ))}
      </div>
    </div>
  );
}
