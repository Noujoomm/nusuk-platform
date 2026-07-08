import {
  SkeletonPageHeader,
  SkeletonStatGrid,
  SkeletonTable,
} from '@/components/ui/skeleton';

/** هيكل الموظفين: رأس + إحصائيات + جدول. */
export default function Loading() {
  return (
    <div>
      <SkeletonPageHeader />
      <SkeletonStatGrid count={4} />
      <div className="mt-6">
        <SkeletonTable rows={10} />
      </div>
    </div>
  );
}
