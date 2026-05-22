'use client';

/**
 * مزوّد التحميل العام + الخطّاف useGlobalLoading().
 *
 * يتيح لأي مكوّن استدعاء show()/hide() لإظهار اللودر الموحّد أثناء
 * العمليات الطويلة (توليد تقرير ثقيل، رفع ملف…). يُركّب مرة واحدة في
 * layout.tsx فيغلّف التطبيق كله.
 *
 * يدعم استدعاءات متداخلة عبر عدّاد مرجعي: كل show() يقابله hide()،
 * فلا يختفي اللودر إلا بعد انتهاء آخر عملية. كما يوفّر withLoading()
 * لتغليف أي وعد (Promise) بإظهار/إخفاء آمن حتى عند الخطأ.
 */

import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { RoyaLoader } from '@/components/ui/RoyaLoader';

interface LoadingContextValue {
  /** إظهار اللودر (مع رسالة اختيارية). يزيد العدّاد المرجعي. */
  show: (message?: string) => void;
  /** إخفاء اللودر. ينقص العدّاد؛ يختفي فعلياً عند بلوغ الصفر. */
  hide: () => void;
  /** تغليف وعد بإظهار/إخفاء تلقائي آمن. */
  withLoading: <T>(promise: Promise<T>, message?: string) => Promise<T>;
  isLoading: boolean;
}

const LoadingContext = createContext<LoadingContextValue | null>(null);

export function LoadingProvider({ children }: { children: React.ReactNode }) {
  const [count, setCount] = useState(0);
  const [message, setMessage] = useState<string | undefined>(undefined);
  const countRef = useRef(0);

  const show = useCallback((msg?: string) => {
    countRef.current += 1;
    if (msg) setMessage(msg);
    setCount(countRef.current);
  }, []);

  const hide = useCallback(() => {
    countRef.current = Math.max(0, countRef.current - 1);
    setCount(countRef.current);
    if (countRef.current === 0) setMessage(undefined);
  }, []);

  const withLoading = useCallback(
    async <T,>(promise: Promise<T>, msg?: string): Promise<T> => {
      show(msg);
      try {
        return await promise;
      } finally {
        hide();
      }
    },
    [show, hide],
  );

  const value = useMemo<LoadingContextValue>(
    () => ({ show, hide, withLoading, isLoading: count > 0 }),
    [show, hide, withLoading, count],
  );

  return (
    <LoadingContext.Provider value={value}>
      {children}
      <AnimatePresence>
        {count > 0 && <RoyaLoader key="global" fullScreen message={message} />}
      </AnimatePresence>
    </LoadingContext.Provider>
  );
}

export function useGlobalLoading(): LoadingContextValue {
  const ctx = useContext(LoadingContext);
  if (!ctx) {
    throw new Error('useGlobalLoading must be used within a <LoadingProvider>');
  }
  return ctx;
}
