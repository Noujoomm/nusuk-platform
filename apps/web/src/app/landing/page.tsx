import type { Metadata } from 'next';
import { LandingClient } from '@/components/landing/LandingClient';

/**
 * صفحة الهبوط العامة لمنصة رؤية — مسار /landing، خارج مجموعة (dashboard)
 * فلا يطبّق عليها حارس المصادقة. server component فقط للـ metadata؛
 * المحتوى التفاعلي في <LandingClient/>.
 */
export const metadata: Metadata = {
  title: 'منصة رؤية — نظام إدارة مشروع بطاقة نُسك',
  description:
    'منصة رؤية: نظام إدارة المشاريع المؤسسي لمشروع بطاقة نُسك في وزارة الحج والعمرة. لوحات قيادة تنفيذية، مساعد ذكي، تتبّع إنتاجية، وإدارة متكاملة.',
  openGraph: {
    title: 'منصة رؤية',
    description: 'نظام إدارة المشاريع المؤسسي لمشروع بطاقة نُسك.',
    type: 'website',
  },
};

export default function LandingPage() {
  return <LandingClient />;
}
