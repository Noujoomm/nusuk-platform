'use client';

/**
 * خطّافات React Query المشتركة لقراءات البيانات الأكثر زيارة.
 *
 * الفائدة: بعد أول جلب تبقى البيانات في الكاش خلال staleTime (دقيقة)، فأي
 * رجوع للقسم = عرض فوري بلا طلب شبكة جديد → أسرع وأخفّ على الـ Throttler.
 *
 * بعد أي طفرة (إنشاء/تعديل/حذف) نُبطل المفتاح المعني عبر invalidateQueries
 * ليُعاد الجلب مرة واحدة.
 */

import { useQuery } from '@tanstack/react-query';
import { tracksApi, employeesApi } from '@/lib/api';

/** مفاتيح الكاش — مصدر وحيد يمنع التضارب في الأسماء. */
export const queryKeys = {
  tracks: ['tracks'] as const,
  employees: ['employees'] as const,
};

/** قائمة المسارات. */
export function useTracksQuery() {
  return useQuery({
    queryKey: queryKeys.tracks,
    queryFn: async () => (await tracksApi.list()).data,
  });
}

/** قائمة الموظفين. */
export function useEmployeesQuery() {
  return useQuery({
    queryKey: queryKeys.employees,
    queryFn: async () => (await employeesApi.list()).data,
  });
}
