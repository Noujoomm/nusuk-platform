import {
  SkeletonPageHeader,
  SkeletonStatGrid,
  SkeletonTable,
} from '@/components/ui/skeleton';

/** هيكل المهام: رأس + إحصائيات سريعة + جدول/قائمة. */
export default function Loading() {
  return (
    <div>
      <SkeletonPageHeader />
      <SkeletonStatGrid count={4} />
      <div className="mt-6">
        <SkeletonTable rows={8} />
      </div>
    </div>
  );
}
