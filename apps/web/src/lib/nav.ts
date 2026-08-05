/**
 * مصدر الحقيقة الوحيد لعناصر التنقّل + صلاحيات الأدوار.
 *
 * تستهلكه القائمة الجانبية (<Sidebar>) ولوحة الأوامر (⌘K) معاً، فلا
 * يتكرّر منطق الصلاحيات في مكانين ولا يفترقان. أي عنصر يُعرض/يُتاح فقط
 * للأدوار المذكورة في `roles` — نفس القاعدة المطبّقة في الـ backend عبر
 * @Roles()/Guards.
 *
 * الأدوار: admin, system_manager, pm, track_lead, employee, hr,
 * support_services (دور مقيّد يرى قسم «الخدمات المساندة» فقط).
 */

import type { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard,
  GitBranch,
  Users,
  AlertTriangle,
  FileText,
  FolderOpen,
  UserCheck,
  CheckSquare,
  Brain,
  Activity,
  Upload,
  Search,
  Sparkles,
  BarChart3,
  Database,
  GanttChart,
  ClipboardList,
  Receipt,
  Fingerprint,
  Files,
  Archive,
  ScanSearch,
} from 'lucide-react';

export type Role =
  | 'admin'
  | 'system_manager'
  | 'pm'
  | 'track_lead'
  | 'employee'
  | 'hr'
  | 'support_services';

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  roles: Role[];
  /** مرادفات تُحسّن مطابقة البحث في لوحة الأوامر (لا تُعرض). */
  keywords?: string[];
}

export const NAV_ITEMS: NavItem[] = [
  { href: '/', label: 'لوحة التحكم', icon: LayoutDashboard, roles: ['admin', 'pm', 'track_lead', 'employee', 'hr'], keywords: ['home', 'الرئيسية', 'dashboard'] },
  { href: '/dashboard', label: 'لوحة القيادة', icon: BarChart3, roles: ['admin', 'system_manager', 'pm', 'track_lead', 'employee', 'hr'], keywords: ['analytics', 'التحليلات', 'command'] },
  { href: '/tracks', label: 'المسارات', icon: GitBranch, roles: ['admin', 'pm', 'track_lead', 'employee'], keywords: ['tracks', 'مسار', 'projects', 'مشاريع'] },
  { href: '/tasks', label: 'المهام', icon: CheckSquare, roles: ['admin', 'pm', 'track_lead', 'employee'], keywords: ['tasks', 'مهامي الذكية', 'todo'] },
  { href: '/gantt', label: 'مخطط جانت', icon: GanttChart, roles: ['admin', 'pm', 'track_lead'], keywords: ['gantt', 'timeline', 'جدول زمني'] },
  { href: '/productivity', label: 'الإنتاجية', icon: Activity, roles: ['admin', 'pm'], keywords: ['productivity', 'أداء'] },
  { href: '/reports', label: 'التقارير', icon: FileText, roles: ['admin', 'pm', 'track_lead'], keywords: ['reports', 'تقرير'] },
  { href: '/assistant', label: 'مساعد رؤية', icon: Sparkles, roles: ['admin', 'system_manager', 'pm', 'track_lead', 'employee', 'hr'], keywords: ['assistant', 'ai', 'مساعد', 'ذكاء'] },
  { href: '/ai-reports', label: 'التقارير الذكية', icon: Brain, roles: ['admin', 'pm'], keywords: ['ai reports', 'تقارير ذكية'] },
  { href: '/reports-intelligence', label: 'مركز ذكاء التقارير', icon: Sparkles, roles: ['admin', 'system_manager'], keywords: ['intelligence', 'ذكاء التقارير'] },
  { href: '/penalties', label: 'الغرامات', icon: AlertTriangle, roles: ['admin', 'pm'], keywords: ['penalties', 'غرامة'] },
  { href: '/employees', label: 'الموظفون', icon: UserCheck, roles: ['admin', 'pm', 'hr'], keywords: ['employees', 'موظف', 'staff'] },
  { href: '/files', label: 'الملفات', icon: FolderOpen, roles: ['admin', 'pm', 'track_lead'], keywords: ['files', 'ملف', 'documents'] },
  { href: '/search', label: 'البحث الذكي', icon: Search, roles: ['admin', 'pm', 'track_lead', 'employee', 'hr'], keywords: ['search', 'بحث'] },
  { href: '/ai-analyze', label: 'تحليل الملفات AI', icon: Sparkles, roles: ['admin', 'pm'], keywords: ['analyze', 'تحليل', 'ai'] },
  { href: '/import', label: 'استيراد البيانات', icon: Upload, roles: ['admin', 'pm', 'hr'], keywords: ['import', 'استيراد', 'excel'] },
  { href: '/executive-tasks', label: 'المهام التنفيذية', icon: ClipboardList, roles: ['admin', 'pm'], keywords: ['executive', 'تنفيذية'] },
  { href: '/updates', label: 'التحديثات', icon: Activity, roles: ['admin', 'pm', 'track_lead', 'employee', 'hr'], keywords: ['updates', 'تحديثات', 'news'] },
  { href: '/support-services', label: 'خدمات المساندة', icon: Receipt, roles: ['admin', 'pm', 'support_services'], keywords: ['support', 'مساندة', 'funds', 'invoices'] },
  { href: '/distribution-analyzer', label: 'محلل نسبة الإنجاز', icon: ScanSearch, roles: ['admin', 'system_manager', 'pm', 'track_lead', 'employee', 'hr'], keywords: ['distribution', 'توزيع', 'إنجاز'] },
  { href: '/attendance', label: 'الحضور والانصراف', icon: Fingerprint, roles: ['admin', 'system_manager'], keywords: ['attendance', 'حضور', 'غياب', 'انصراف'] },
  { href: '/attendance/uploads', label: 'سجل ملفات الحضور', icon: Files, roles: ['admin', 'system_manager'], keywords: ['attendance uploads', 'ملفات الحضور'] },
  { href: '/attendance/archive', label: 'أرشيف الحضور', icon: Archive, roles: ['admin', 'system_manager'], keywords: ['attendance archive', 'أرشيف'] },
  { href: '/attendance-analytics/makkah', label: 'تحليل حضور مكة', icon: BarChart3, roles: ['admin', 'system_manager'], keywords: ['makkah', 'مكة', 'حضور'] },
  { href: '/attendance-analytics/madinah', label: 'تحليل حضور المدينة', icon: BarChart3, roles: ['admin', 'system_manager'], keywords: ['madinah', 'المدينة', 'حضور'] },
  { href: '/users', label: 'المستخدمين', icon: Users, roles: ['admin'], keywords: ['users', 'مستخدمين', 'accounts'] },
  { href: '/system-export', label: 'النظام والنسخ', icon: Database, roles: ['admin'], keywords: ['system', 'export', 'نسخ احتياطي', 'backup'] },
];

/** عناصر التنقّل المسموح بها لدور معيّن — نفس فلترة الصلاحيات في كل مكان. */
export function navItemsForRole(role: string | undefined | null): NavItem[] {
  if (!role) return [];
  return NAV_ITEMS.filter((item) => item.roles.includes(role as Role));
}
