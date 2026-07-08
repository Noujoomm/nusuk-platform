import { SkeletonPageHeader, SkeletonCardGrid } from '@/components/ui/skeleton';

/** هيكل قائمة المسارات: رأس + شبكة بطاقات. */
export default function Loading() {
  return (
    <div>
      <SkeletonPageHeader />
      <SkeletonCardGrid count={6} />
    </div>
  );
}
