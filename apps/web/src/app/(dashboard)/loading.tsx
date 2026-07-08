import {
  SkeletonPageHeader,
  SkeletonStatGrid,
  SkeletonTable,
} from '@/components/ui/skeleton';

/**
 * هيكل احتياطي عام لمنطقة المحتوى داخل مجموعة (dashboard).
 *
 * يظهر لأي مقطع مسار لا يملك loading.tsx خاصاً به. بما أنه على مستوى
 * المجموعة، تبقى القشرة (الشريط الجانبي/العلوي) ثابتة ويُستبدل المحتوى
 * فقط — فلا وميض لكامل الشاشة أثناء التنقّل.
 */
export default function Loading() {
  return (
    <div>
      <SkeletonPageHeader />
      <SkeletonStatGrid count={4} />
      <div className="mt-6">
        <SkeletonTable rows={6} />
      </div>
    </div>
  );
}
