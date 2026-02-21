'use client';

import { useEffect, useState } from 'react';
import { usersApi } from '@/lib/api';
import { ROLE_LABELS } from '@/lib/utils';
import { Plus, Edit3, Trash2, Search, Key } from 'lucide-react';
import toast from 'react-hot-toast';

interface UserItem {
  id: string;
  email: string;
  name: string;
  nameAr: string;
  role: string;
  isActive: boolean;
  createdAt: string;
}

export default function UsersPage() {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ email: '', name: '', nameAr: '', password: '', role: 'employee' });
  const [saving, setSaving] = useState(false);

  const loadUsers = async () => {
    try {
      const { data } = await usersApi.list({ page, pageSize: 25, search: search || undefined });
      setUsers(data.data);
      setTotal(data.total);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { loadUsers(); }, [page, search]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await usersApi.create(form);
      toast.success('تم إنشاء المستخدم');
      setShowCreate(false);
      setForm({ email: '', name: '', nameAr: '', password: '', role: 'employee' });
      loadUsers();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'فشل إنشاء المستخدم');
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('هل أنت متأكد من حذف هذا المستخدم؟')) return;
    try {
      await usersApi.delete(id);
      toast.success('تم حذف المستخدم');
      loadUsers();
    } catch {
      toast.error('فشل حذف المستخدم');
    }
  };

  const handleResetPassword = async (id: string) => {
    const password = prompt('أدخل كلمة المرور الجديدة:');
    if (!password || password.length < 6) {
      if (password) toast.error('كلمة المرور يجب أن تكون 6 أحرف على الأقل');
      return;
    }
    try {
      await usersApi.resetPassword(id, password);
      toast.success('تم تغيير كلمة المرور');
    } catch {
      toast.error('فشل تغيير كلمة المرور');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">المستخدمين</h1>
          <p className="text-gray-400 mt-1">{total} مستخدم</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" />
          مستخدم جديد
        </button>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
        <input
          type="text"
          placeholder="بحث..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="input-field pr-10"
        />
      </div>

      {/* Create Form */}
      {showCreate && (
        <div className="glass p-5">
          <h3 className="font-semibold mb-4">إنشاء مستخدم جديد</h3>
          <form onSubmit={handleCreate} className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <input placeholder="البريد الإلكتروني" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="input-field" required dir="ltr" />
            <input placeholder="الاسم (EN)" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input-field" required />
            <input placeholder="الاسم (AR)" value={form.nameAr} onChange={(e) => setForm({ ...form, nameAr: e.target.value })} className="input-field" required />
            <input placeholder="كلمة المرور" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="input-field" required dir="ltr" />
            <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="input-field">
              {Object.entries(ROLE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
            <div className="flex gap-2">
              <button type="submit" disabled={saving} className="btn-primary flex-1">{saving ? '...' : 'إنشاء'}</button>
              <button type="button" onClick={() => setShowCreate(false)} className="btn-secondary">إلغاء</button>
            </div>
          </form>
        </div>
      )}

      {/* Table */}
      <div className="glass overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/10">
              <th className="text-right p-4 text-sm font-medium text-gray-400">المستخدم</th>
              <th className="text-right p-4 text-sm font-medium text-gray-400">البريد</th>
              <th className="text-right p-4 text-sm font-medium text-gray-400">الدور</th>
              <th className="text-right p-4 text-sm font-medium text-gray-400">الحالة</th>
              <th className="text-right p-4 text-sm font-medium text-gray-400">إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-white/5 hover:bg-white/5">
                <td className="p-4">
                  <p className="font-medium">{u.nameAr}</p>
                  <p className="text-xs text-gray-500">{u.name}</p>
                </td>
                <td className="p-4 text-sm text-gray-300" dir="ltr">{u.email}</td>
                <td className="p-4">
                  <span className="badge bg-brand-500/20 text-brand-300">{ROLE_LABELS[u.role] || u.role}</span>
                </td>
                <td className="p-4">
                  <span className={`badge ${u.isActive ? 'bg-emerald-500/20 text-emerald-300' : 'bg-red-500/20 text-red-300'}`}>
                    {u.isActive ? 'نشط' : 'معطل'}
                  </span>
                </td>
                <td className="p-4">
                  <div className="flex items-center gap-1">
                    <button onClick={() => handleResetPassword(u.id)} className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white" title="تغيير كلمة المرور">
                      <Key className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDelete(u.id)} className="p-1.5 rounded-lg hover:bg-red-500/10 text-gray-400 hover:text-red-400" title="حذف">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr><td colSpan={5} className="p-8 text-center text-gray-500">لا يوجد مستخدمين</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
