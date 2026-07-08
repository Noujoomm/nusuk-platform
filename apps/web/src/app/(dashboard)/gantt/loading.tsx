import { Skeleton, SkeletonPageHeader, SkeletonCard } from '@/components/ui/skeleton';

/** هيكل مخطط جانت: رأس + شريط أدوات + صفوف المهام الزمنية. */
export default function Loading() {
  return (
    <div>
      <SkeletonPageHeader />
      <SkeletonCard className="p-0 overflow-hidden">
        {/* شريط أدوات */}
        <div className="flex items-center gap-3 border-b border-white/10 px-5 py-3">
          <Skeleton className="h-8 w-28 rounded-lg" />
          <Skeleton className="h-8 w-20 rounded-lg" />
          <Skeleton className="ms-auto h-8 w-24 rounded-lg" />
        </div>
        {/* صفوف زمنية */}
        <div className="divide-y divide-white/5">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-5 py-3">
              <Skeleton className="h-4 w-40 shrink-0" />
              {/* أطوال/إزاحات متفاوتة توحي بأشرطة جانت زمنية */}
              <Skeleton
                className="h-6 rounded-full"
                style={{
                  width: `${25 + ((i * 13) % 55)}%`,
                  marginInlineStart: `${(i * 7) % 30}%`,
                }}
              />
            </div>
          ))}
        </div>
      </SkeletonCard>
    </div>
  );
}
