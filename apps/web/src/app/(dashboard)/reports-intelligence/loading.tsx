import {
  SkeletonPageHeader,
  SkeletonStatGrid,
  SkeletonCardGrid,
} from '@/components/ui/skeleton';

/** هيكل مركز ذكاء التقارير: رأس + مؤشرات + شبكة بطاقات رؤى. */
export default function Loading() {
  return (
    <div>
      <SkeletonPageHeader />
      <SkeletonStatGrid count={4} />
      <div className="mt-6">
        <SkeletonCardGrid count={6} />
      </div>
    </div>
  );
}
