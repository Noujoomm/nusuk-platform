import {
  SkeletonPageHeader,
  SkeletonStatGrid,
  SkeletonTable,
} from '@/components/ui/skeleton';

/** هيكل الحضور والانصراف: رأس + إحصائيات + جدول سجلات. */
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
