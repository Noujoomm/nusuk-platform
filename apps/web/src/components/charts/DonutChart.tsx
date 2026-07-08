'use client';

/**
 * مخطّط دائري (Donut) قابل لإعادة الاستخدام فوق recharts.
 *
 * يُحمّل ديناميكياً عبر <LazyDonutChart> حتى لا تدخل مكتبة recharts (ثقيلة)
 * في حزمة الصفحة الأولية — تُجلب فقط عند الحاجة لعرض المخطّط، مع هيكل
 * تحميل يظهر فوراً. التنسيق موحّد مع ثيم Dark Glassmorphism.
 */

import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from 'recharts';

export interface DonutDatum {
  name: string;
  value: number;
}

export interface DonutChartProps {
  data: DonutDatum[];
  colors: string[];
  height?: number;
  innerRadius?: number;
  outerRadius?: number;
  /** يُرجِع [القيمة المنسّقة، التسمية] لعرضها في التلميح. */
  valueFormatter?: (value: number) => [string, string];
}

const TOOLTIP_STYLE = {
  backgroundColor: 'rgba(15,23,42,0.95)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: '12px',
  color: '#ffffff',
  direction: 'rtl' as const,
  padding: '10px 14px',
  boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
  backdropFilter: 'blur(10px)',
  fontSize: '12px',
};

export default function DonutChart({
  data,
  colors,
  height = 280,
  innerRadius = 55,
  outerRadius = 90,
  valueFormatter,
}: DonutChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={innerRadius}
          outerRadius={outerRadius}
          paddingAngle={3}
          dataKey="value"
        >
          {data.map((_, i) => (
            <Cell key={i} fill={colors[i % colors.length]} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={TOOLTIP_STYLE}
          labelStyle={{ color: '#ffffff', fontWeight: 'bold' }}
          itemStyle={{ color: '#e5e7eb' }}
          formatter={
            valueFormatter
              ? (value: any) => valueFormatter(Number(value))
              : undefined
          }
        />
        <Legend
          formatter={(value) => (
            <span className="text-xs text-gray-400">{value}</span>
          )}
          iconSize={8}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
