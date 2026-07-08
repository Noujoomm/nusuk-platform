'use client';

/**
 * مزوّد React Query — طبقة تخزين مؤقت للبيانات.
 *
 * الهدف: الرجوع إلى قسم مُزار خلال نافذة `staleTime` = عرض فوري من الكاش
 * بلا إعادة جلب من الشبكة. هذا يحسّن السرعة المحسوسة والفعلية معاً، ويخفّف
 * الضغط على الـ Throttler (100 طلب/دقيقة) لأننا لا نكرّر نفس الطلب.
 *
 * يُركّب مرة واحدة في الجذر فيغلّف التطبيق كله. نُنشئ الـ QueryClient عبر
 * useState حتى يبقى نفس النسخة عبر إعادة الرسم (ولا يُعاد إنشاؤه).
 */

import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // خلال دقيقة تُعتبر البيانات "طازجة" ⇒ لا إعادة جلب عند العودة.
            staleTime: 60_000,
            // تبقى في الكاش 5 دقائق بعد آخر استخدام قبل جمع القمامة.
            gcTime: 5 * 60_000,
            // لا نعيد الجلب لمجرّد العودة لتبويب المتصفح (يزعج ويستهلك طلبات).
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      }),
  );

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
