import { useEffect, useState } from 'react';
import { api } from '../utils/api';
import { Employee } from '../types';
import { formatDate } from '../utils/format';
import {
  Plus,
  Edit2,
  Trash2,
  X,
  Shield,
  ShieldCheck,
  UserCheck,
  Mail,
  Lock,
  User,
  Users,
  Link2,
  Search
} from 'lucide-react';

interface Account {
  id: string;
  email: string;
  name: string;
  role: string;
  employee_id: string | null;
  employee_name: string | null;
  department: string | null;
  position: string | null;
  created_at: string;
}

const ROLE_LABELS: Record<string, string> = {
  admin: '관리자',
  manager: '매니저',
  employee: '직원',
};

const ROLE_COLORS: Record<string, string> = {
  admin: 'bg-red-100 text-red-700',
  manager: 'bg-blue-100 text-blue-700',
  employee: 'bg-green-100 text-green-700',
};

export default function Accounts() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
    role: 'employee',
    employee_id: '',
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [accountsData, employeesData] = await Promise.all([
        api.get<Account[]>('/auth/users'),
        api.get<Employee[]>('/employees'),
      ]);
      setAccounts(accountsData);
      setEmployees(employeesData);
    } catch (error) {
      console.error('Failed to fetch data:', error);
      alert('데이터 조회 실패');
    } finally {
      setIsLoading(false);
    }
  };

  const linkedEmployeeIds = accounts
    .filter(a => a.employee_id && (!editingAccount || a.id !== editingAccount.id))
    .map(a => a.employee_id);

  const availableEmployees = employees.filter(
    e => e.status === 'active' && !linkedEmployeeIds.includes(e.id)
  );

  const openModal = (account?: Account) => {
    if (account) {
      setEditingAccount(account);
      setFormData({
        email: account.email,
        password: '',
        name: account.name,
        role: account.role,
        employee_id: account.employee_id || '',
      });
    } else {
      setEditingAccount(null);
      setFormData({ email: '', password: '', name: '', role: 'employee', employee_id: '' });
    }
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingAccount(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingAccount) {
        await api.put(`/auth/users/${editingAccount.id}`, formData);
      } else {
        if (!formData.password) {
          alert('비밀번호를 입력해주세요.');
          return;
        }
        await api.post('/auth/users', formData);
      }
      closeModal();
      fetchData();
    } catch (error) {
      alert(error instanceof Error ? error.message : '저장 실패');
    }
  };

  const handleDelete = async (account: Account) => {
    if (!confirm(`'${account.name}' 계정을 삭제하시겠습니까?`)) return;
    try {
      await api.delete(`/auth/users/${account.id}`);
      fetchData();
    } catch (error) {
      alert(error instanceof Error ? error.message : '삭제 실패');
    }
  };

  const filteredAccounts = accounts.filter(a => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      a.name.toLowerCase().includes(term) ||
      a.email.toLowerCase().includes(term) ||
      (a.employee_name || '').toLowerCase().includes(term) ||
      (a.department || '').toLowerCase().includes(term)
    );
  });

  const roleIcon = (role: string) => {
    if (role === 'admin') return <ShieldCheck className="h-3.5 w-3.5" />;
    if (role === 'manager') return <Shield className="h-3.5 w-3.5" />;
    return <UserCheck className="h-3.5 w-3.5" />;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">계정관리</h1>
          <p className="text-sm text-slate-500 mt-1">직원 계정 생성 및 권한 관리</p>
        </div>
        <button onClick={() => openModal()} className="btn-primary flex items-center gap-2">
          <Plus className="h-4 w-4" />
          계정 생성
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-sm border p-4">
          <div className="text-sm text-slate-500">전체 계정</div>
          <div className="text-2xl font-bold text-slate-900 mt-1">{accounts.length}</div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border p-4">
          <div className="text-sm text-slate-500">관리자</div>
          <div className="text-2xl font-bold text-red-600 mt-1">{accounts.filter(a => a.role === 'admin').length}</div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border p-4">
          <div className="text-sm text-slate-500">매니저</div>
          <div className="text-2xl font-bold text-blue-600 mt-1">{accounts.filter(a => a.role === 'manager').length}</div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border p-4">
          <div className="text-sm text-slate-500">직원</div>
          <div className="text-2xl font-bold text-green-600 mt-1">{accounts.filter(a => a.role === 'employee').length}</div>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <input
          type="text"
          placeholder="이름, 이메일, 직원명으로 검색"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="input pl-10"
        />
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">이름</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">이메일</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600">역할</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">연동 직원</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">부서/직급</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">생성일</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600">관리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredAccounts.map(account => (
                <tr key={account.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center">
                        <span className="text-xs font-bold text-white">{account.name?.charAt(0)}</span>
                      </div>
                      <span className="text-sm font-medium text-slate-900">{account.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-500">{account.email}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded-full ${ROLE_COLORS[account.role] || 'bg-gray-100 text-gray-700'}`}>
                      {roleIcon(account.role)}
                      {ROLE_LABELS[account.role] || account.role}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-500">
                    {account.employee_name ? (
                      <span className="inline-flex items-center gap-1 text-primary-600">
                        <Link2 className="h-3 w-3" />
                        {account.employee_name}
                      </span>
                    ) : (
                      <span className="text-slate-300">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-500">
                    {account.department || account.position
                      ? `${account.department || ''} ${account.position || ''}`.trim()
                      : '-'}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-500">{formatDate(account.created_at)}</td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={() => openModal(account)}
                        className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                        title="수정"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(account)}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                        title="삭제"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredAccounts.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-slate-400">
                    <Users className="mx-auto h-10 w-10 text-slate-300 mb-2" />
                    등록된 계정이 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 역할 안내 */}
      <div className="bg-white rounded-xl shadow-sm border p-5">
        <h3 className="text-sm font-semibold text-slate-700 mb-3">역할별 접근 권한</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div className="flex items-start gap-2">
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded-full ${ROLE_COLORS.admin}`}>
              <ShieldCheck className="h-3 w-3" /> 관리자
            </span>
            <span className="text-slate-500">모든 메뉴 접근 + 계정관리</span>
          </div>
          <div className="flex items-start gap-2">
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded-full ${ROLE_COLORS.manager}`}>
              <Shield className="h-3 w-3" /> 매니저
            </span>
            <span className="text-slate-500">본인 담당 데이터만 조회 (서비스/업체/영업/정산/인센티브/블로그)</span>
          </div>
          <div className="flex items-start gap-2">
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded-full ${ROLE_COLORS.employee}`}>
              <UserCheck className="h-3 w-3" /> 직원
            </span>
            <span className="text-slate-500">본인 담당 데이터만 조회 (대시보드, 영업관리, 인센티브)</span>
          </div>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b bg-gradient-to-r from-primary-500 to-primary-600">
              <h2 className="text-lg font-bold text-white">
                {editingAccount ? '계정 수정' : '계정 생성'}
              </h2>
              <button onClick={closeModal} className="p-1 text-white/80 hover:text-white rounded-lg">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <User className="inline h-4 w-4 mr-1" />이름 *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  placeholder="홍길동"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <Mail className="inline h-4 w-4 mr-1" />이메일 *
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={e => setFormData({ ...formData, email: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  placeholder="user@company.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <Lock className="inline h-4 w-4 mr-1" />
                  비밀번호 {editingAccount ? '(변경 시에만 입력)' : '*'}
                </label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={e => setFormData({ ...formData, password: e.target.value })}
                  required={!editingAccount}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  placeholder={editingAccount ? '변경하려면 입력' : '비밀번호 입력'}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <Shield className="inline h-4 w-4 mr-1" />역할 *
                </label>
                <select
                  value={formData.role}
                  onChange={e => setFormData({ ...formData, role: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                >
                  <option value="employee">직원</option>
                  <option value="manager">매니저</option>
                  <option value="admin">관리자</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <Link2 className="inline h-4 w-4 mr-1" />직원 연동
                </label>
                <select
                  value={formData.employee_id}
                  onChange={e => setFormData({ ...formData, employee_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">연동 안함</option>
                  {availableEmployees.map(emp => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name} ({emp.department} / {emp.position})
                    </option>
                  ))}
                  {editingAccount?.employee_id && !availableEmployees.find(e => e.id === editingAccount.employee_id) && (
                    <option value={editingAccount.employee_id}>
                      {editingAccount.employee_name} (현재 연동)
                    </option>
                  )}
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={closeModal} className="flex-1 btn-ghost">
                  취소
                </button>
                <button type="submit" className="flex-1 btn-primary">
                  {editingAccount ? '수정' : '생성'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
