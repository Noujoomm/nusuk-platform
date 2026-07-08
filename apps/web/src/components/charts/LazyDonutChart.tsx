'use client';

/**
 * غلاف يحمّل <DonutChart> (ومعه recharts) ديناميكياً — ssr:false لأن
 * المخطّط عميل بالكامل — مع هيكل تحميل بنفس ارتفاع المخطّط لتفادي القفز.
 * الصفحات تستورد هذا الغلاف فلا تدخل recharts في حزمتها الأولية.
 */

import dynamic from 'next/dynamic';
import type { DonutChartProps } from './DonutChart';

const DonutChart = dynamic(() => import('./DonutChart'), {
  ssr: false,
  loading: () => (
    <div
      aria-hidden
      className="shimmer relative h-[280px] w-full overflow-hidden rounded-xl bg-white/[0.05]"
    />
  ),
});

export function LazyDonutChart(props: DonutChartProps) {
  return <DonutChart {...props} />;
}
