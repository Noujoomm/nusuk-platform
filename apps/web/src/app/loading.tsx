import { RoyaLoader } from '@/components/ui/RoyaLoader';

/**
 * واجهة التحميل التلقائية لـ App Router. يعرضها Next.js تلقائياً عند
 * تحميل أي مقطع مسار (route segment) وكـ fallback لأي حدود Suspense.
 */
export default function Loading() {
  return <RoyaLoader fullScreen />;
}
