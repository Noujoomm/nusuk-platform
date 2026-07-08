'use client';

/**
 * رابط تنقّل يجمع بين:
 *   - <Link> من Next (يحتفظ بالـ prefetch التلقائي عند المرور/الظهور،
 *     والفتح في تبويب جديد، والوصولية).
 *   - إشعار <NavigationProvider> ببدء التنقّل ليظهر شريط التقدّم فوراً.
 *
 * لا نستبدل <Link> بـ router.push حتى لا نفقد الـ prefetch؛ فقط نضيف
 * start() في onClick للنقرات اليسرى بدون مُعدِّلات (نتجاهل ⌘/Ctrl/Shift/
 * الزر الأوسط لأنها تفتح تبويباً جديداً ولا تُبدّل المسار الحالي).
 */

import Link from 'next/link';
import type { ComponentProps, MouseEvent } from 'react';
import { usePathname } from 'next/navigation';
import { useNav } from './NavigationProvider';

type NavLinkProps = ComponentProps<typeof Link>;

export function NavLink({ href, onClick, ...props }: NavLinkProps) {
  const { start } = useNav();
  const pathname = usePathname();

  const handleClick = (e: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(e);
    if (e.defaultPrevented) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    const target = typeof href === 'string' ? href : href.pathname ?? '';
    if (target && target !== pathname) start();
  };

  return <Link href={href} onClick={handleClick} {...props} />;
}
