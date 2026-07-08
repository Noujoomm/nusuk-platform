import { SkeletonPageHeader, SkeletonTable } from '@/components/ui/skeleton';

/** هيكل التقارير: رأس + جدول تقارير. */
export default function Loading() {
  return (
    <div>
      <SkeletonPageHeader />
      <SkeletonTable rows={9} />
    </div>
  );
}
