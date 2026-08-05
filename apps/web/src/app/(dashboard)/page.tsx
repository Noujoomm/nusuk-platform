'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/stores/auth';
import { RoyaLoader } from '@/components/ui/RoyaLoader';
import EmployeeDashboard from '@/components/dashboards/employee-dashboard';
import TrackLeadDashboard from '@/components/dashboards/track-lead-dashboard';
import HRDashboard from '@/components/dashboards/hr-dashboard';
import AdminDashboard from '@/components/dashboards/admin-dashboard';

export default function DashboardPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  // الدور المقيّد «الخدمات المساندة» لا يملك لوحة تحكم — يُعاد لقسمه الوحيد
  useEffect(() => {
    if (!loading && user?.role === 'support_services') {
      router.replace('/support-services');
    }
  }, [loading, user?.role, router]);

  if (loading || user?.role === 'support_services') {
    return (
      <div className="flex items-center justify-center h-64">
        <RoyaLoader fullScreen={false} size="md" />
      </div>
    );
  }

  switch (user?.role) {
    case 'employee':
      return <EmployeeDashboard />;
    case 'track_lead':
      return <TrackLeadDashboard />;
    case 'hr':
      return <HRDashboard />;
    case 'admin':
    case 'pm':
    default:
      return <AdminDashboard />;
  }
}
