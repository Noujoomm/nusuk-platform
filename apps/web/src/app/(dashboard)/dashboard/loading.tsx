import {
  SkeletonPageHeader,
  SkeletonStatGrid,
  SkeletonChart,
} from '@/components/ui/skeleton';

/** هيكل لوحة القيادة: رأس + بطاقات إحصائية + رسمان بيانيان. */
export default function Loading() {
  return (
    <div>
      <SkeletonPageHeader />
      <SkeletonStatGrid count={4} />
      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <SkeletonChart />
        <SkeletonChart />
      </div>
    </div>
  );
}
