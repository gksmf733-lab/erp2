import { useEffect, useState } from 'react';
import { api } from '../utils/api';
import { Employee } from '../types';
import { formatCurrency, formatDate, getStatusColor, getStatusLabel } from '../utils/format';
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  X,
  User,
  Mail,
  Phone,
  Building,
  Calendar,
  Users as UsersIcon,
  Filter,
  MoreVertical,
  CheckSquare
} from 'lucide-react';

export default function Employees() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDepartment, setFilterDepartment] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [selectedEmployees, setSelectedEmployees] = useState<Set<string>>(new Set());
  const [formData, setFormData] = useState({
    employee_number: '',
    name: '',
    department: '',
    position: '',
    email: '',
    phone: '',
    hire_date: '',
    salary: 0,
  });

  const departments = ['개발팀', '마케팅팀', '영업팀', '인사팀', '재무팀', '운영팀'];

  useEffect(() => {
    fetchEmployees();
  }, [searchTerm, filterDepartment]);

  const fetchEmployees = async () => {
    try {
      const params = new URLSearchParams();
      if (searchTerm) params.append('search', searchTerm);
      if (filterDepartment) params.append('department', filterDepartment);

      const data = await api.get<Employee[]>(`/employees?${params.toString()}`);
      setEmployees(data);
    } catch (error) {
      console.error('Failed to fetch employees:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const openModal = (employee?: Employee) => {
    if (employee) {
      setEditingEmployee(employee);
      setFormData({
        employee_number: employee.employee_number,
        name: employee.name,
        department: employee.department,
        position: employee.position,
        email: employee.email || '',
        phone: employee.phone || '',
        hire_date: employee.hire_date,
        salary: employee.salary,
      });
    } else {
      setEditingEmployee(null);
      setFormData({
        employee_number: '',
        name: '',
        department: '',
        position: '',
        email: '',
        phone: '',
        hire_date: new Date().toISOString().split('T')[0],
        salary: 0,
      });
    }
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingEmployee(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingEmployee) {
        await api.put(`/employees/${editingEmployee.id}`, formData);
      } else {
        await api.post('/employees', formData);
      }
      closeModal();
      fetchEmployees();
    } catch (error) {
      alert(error instanceof Error ? error.message : '저장에 실패했습니다.');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('정말 삭제하시겠습니까?')) return;
    try {
      await api.delete(`/employees/${id}`);
      fetchEmployees();
    } catch (error) {
      alert(error instanceof Error ? error.message : '삭제에 실패했습니다.');
    }
  };

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedEmployees);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedEmployees(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedEmployees.size === employees.length) {
      setSelectedEmployees(new Set());
    } else {
      setSelectedEmployees(new Set(employees.map(e => e.id)));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedEmployees.size === 0) return;
    if (!confirm(`선택한 ${selectedEmployees.size}명의 직원을 삭제하시겠습니까?`)) return;

    try {
      const ids = Array.from(selectedEmployees);
      await api.post('/employees/bulk-delete', { ids });
      setSelectedEmployees(new Set());
      fetchEmployees();
    } catch (error) {
      alert(error instanceof Error ? error.message : '삭제에 실패했습니다.');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary-200 rounded-full animate-spin border-t-primary-600 mx-auto"></div>
          <p className="mt-4 text-sm text-slate-500 font-medium">데이터를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">인사관리</h1>
          <p className="text-slate-500 mt-1">직원 정보를 관리하세요</p>
        </div>
        <button
          onClick={() => openModal()}
          className="btn-primary"
        >
          <Plus className="h-5 w-5 mr-2" />
          직원 등록
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl shadow-soft border border-slate-100 p-5">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-slate-400" />
            <input
              type="text"
              placeholder="이름 또는 사번으로 검색"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input input-with-icon"
            />
          </div>
          <div className="relative">
            <Filter className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-slate-400 pointer-events-none" />
            <select
              value={filterDepartment}
              onChange={(e) => setFilterDepartment(e.target.value)}
              className="select pl-11 min-w-[160px]"
            >
              <option value="">전체 부서</option>
              {departments.map((dept) => (
                <option key={dept} value={dept}>{dept}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Employee Table */}
      <div className="bg-white rounded-2xl shadow-soft border border-slate-100 overflow-hidden">
        {/* 선택된 항목 액션 바 */}
        {selectedEmployees.size > 0 && (
          <div className="flex items-center justify-between px-6 py-3 bg-primary-50 border-b border-primary-100">
            <div className="flex items-center gap-2">
              <CheckSquare className="h-5 w-5 text-primary-600" />
              <span className="text-sm font-medium text-primary-700">
                {selectedEmployees.size}명 선택됨
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSelectedEmployees(new Set())}
                className="px-3 py-1.5 text-sm text-slate-600 hover:text-slate-800 hover:bg-white rounded-lg transition-colors"
              >
                선택 해제
              </button>
              <button
                onClick={handleBulkDelete}
                className="px-3 py-1.5 text-sm text-white bg-red-500 hover:bg-red-600 rounded-lg transition-colors flex items-center gap-1"
              >
                <Trash2 className="h-4 w-4" />
                삭제
              </button>
            </div>
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th className="w-12">
                  <input
                    type="checkbox"
                    checked={employees.length > 0 && selectedEmployees.size === employees.length}
                    onChange={toggleSelectAll}
                    className="w-4 h-4 text-primary-600 border-slate-300 rounded focus:ring-primary-500"
                  />
                </th>
                <th>직원정보</th>
                <th>부서/직급</th>
                <th>연락처</th>
                <th>입사일</th>
                <th>급여</th>
                <th>상태</th>
                <th className="text-right">관리</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((employee) => (
                <tr key={employee.id} className={`group ${selectedEmployees.has(employee.id) ? 'bg-primary-50/50' : ''}`}>
                  <td>
                    <input
                      type="checkbox"
                      checked={selectedEmployees.has(employee.id)}
                      onChange={() => toggleSelect(employee.id)}
                      className="w-4 h-4 text-primary-600 border-slate-300 rounded focus:ring-primary-500"
                    />
                  </td>
                  <td>
                    <div className="flex items-center gap-3">
                      <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center shadow-md">
                        <span className="text-sm font-bold text-white">{employee.name.charAt(0)}</span>
                      </div>
                      <div>
                        <div className="font-semibold text-slate-900">{employee.name}</div>
                        <div className="text-sm text-slate-500">{employee.employee_number}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div className="font-medium text-slate-900">{employee.department}</div>
                    <div className="text-sm text-slate-500">{employee.position}</div>
                  </td>
                  <td>
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2 text-slate-700">
                        <Mail className="h-4 w-4 text-slate-400" />
                        <span className="text-sm">{employee.email || '-'}</span>
                      </div>
                      <div className="flex items-center gap-2 text-slate-500">
                        <Phone className="h-4 w-4 text-slate-400" />
                        <span className="text-sm">{employee.phone || '-'}</span>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className="text-slate-700">{formatDate(employee.hire_date)}</span>
                  </td>
                  <td>
                    <span className="font-semibold text-slate-900">{formatCurrency(employee.salary)}</span>
                  </td>
                  <td>
                    <span className={`badge ${getStatusColor(employee.status)}`}>
                      {getStatusLabel(employee.status)}
                    </span>
                  </td>
                  <td>
                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => openModal(employee)}
                        className="p-2 text-slate-500 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                        title="수정"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(employee.id)}
                        className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="삭제"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {employees.length === 0 && (
          <div className="empty-state">
            <UsersIcon className="empty-state-icon" />
            <p className="empty-state-title">등록된 직원이 없습니다</p>
            <p className="empty-state-description">새 직원을 등록하여 시작하세요</p>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <>
          <div className="modal-overlay" onClick={closeModal} />
          <div className="modal-container">
            <div className="modal modal-lg animate-scale-in" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">
                    {editingEmployee ? '직원 정보 수정' : '직원 등록'}
                  </h2>
                  <p className="text-sm text-slate-500 mt-1">
                    {editingEmployee ? '직원 정보를 수정하세요' : '새로운 직원을 등록하세요'}
                  </p>
                </div>
                <button onClick={closeModal} className="btn-icon">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit}>
                <div className="modal-body space-y-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        사번 *
                      </label>
                      <div className="relative">
                        <User className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-slate-400" />
                        <input
                          type="text"
                          value={formData.employee_number}
                          onChange={(e) => setFormData({ ...formData, employee_number: e.target.value })}
                          required
                          disabled={!!editingEmployee}
                          className="input pl-11 disabled:bg-slate-50 disabled:text-slate-500"
                          placeholder="예: EMP001"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">이름 *</label>
                      <input
                        type="text"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        required
                        className="input"
                        placeholder="홍길동"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        부서 *
                      </label>
                      <div className="relative">
                        <Building className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-slate-400 pointer-events-none" />
                        <select
                          value={formData.department}
                          onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                          required
                          className="select pl-11"
                        >
                          <option value="">선택</option>
                          {departments.map((dept) => (
                            <option key={dept} value={dept}>{dept}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">직급 *</label>
                      <input
                        type="text"
                        value={formData.position}
                        onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                        required
                        placeholder="예: 대리, 과장, 팀장"
                        className="input"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        이메일
                      </label>
                      <div className="relative">
                        <Mail className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-slate-400" />
                        <input
                          type="email"
                          value={formData.email}
                          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                          className="input pl-11"
                          placeholder="email@company.com"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        전화번호
                      </label>
                      <div className="relative">
                        <Phone className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-slate-400" />
                        <input
                          type="tel"
                          value={formData.phone}
                          onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                          className="input pl-11"
                          placeholder="010-0000-0000"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        입사일 *
                      </label>
                      <div className="relative">
                        <Calendar className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-slate-400" />
                        <input
                          type="date"
                          value={formData.hire_date}
                          onChange={(e) => setFormData({ ...formData, hire_date: e.target.value })}
                          required
                          className="input pl-11"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">급여</label>
                      <input
                        type="number"
                        value={formData.salary}
                        onChange={(e) => setFormData({ ...formData, salary: parseInt(e.target.value) || 0 })}
                        className="input"
                        placeholder="0"
                      />
                    </div>
                  </div>
                </div>

                <div className="modal-footer">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="btn-secondary"
                  >
                    취소
                  </button>
                  <button
                    type="submit"
                    className="btn-primary"
                  >
                    {editingEmployee ? '수정' : '등록'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
