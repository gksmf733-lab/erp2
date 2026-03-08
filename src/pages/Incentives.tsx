import React, { useEffect, useState } from 'react';
import { api } from '../utils/api';
import { formatCurrency, formatDate } from '../utils/format';
import {
  Gift,
  Plus,
  Edit2,
  Trash2,
  X,
  Search,
  CheckCircle,
  Clock,
  User,
  Users,
  FileText,
  DollarSign,
  Save,
  Zap,
  RefreshCw,
  Award,
  ChevronDown,
  ChevronRight
} from 'lucide-react';

interface IncentivePolicy {
  id: string;
  name: string;
  amount: number;
  description: string | null;
  is_active: boolean;
  created_at: string;
}

interface OrderIncentive {
  id: string;
  order_id: string;
  employee_id: string;
  policy_id: string | null;
  amount: number;
  quantity: number;
  status: 'pending' | 'paid';
  notes: string | null;
  created_at: string;
  paid_at: string | null;
  employee_name: string;
  employee_department: string;
  employee_position: string;
  order_number: string;
  order_amount: number;
  order_date: string;
  order_status: string;
  customer_name: string;
  customer_company: string;
  policy_name: string | null;
}

interface PolicyDetail {
  policy_name: string;
  total_quantity: number;
  total_amount: number;
}

interface EmployeeSummary {
  employee_id: string;
  employee_name: string;
  department: string;
  position: string;
  incentive_count: number;
  total_amount: number;
  paid_amount: number;
  pending_amount: number;
  paid_count: number;
  pending_count: number;
  policy_details: PolicyDetail[];
}

interface Employee {
  id: string;
  name: string;
  department: string;
  position: string;
}

interface Order {
  id: string;
  order_number: string;
  customer_name?: string;
  customer_company?: string;
  total_amount: number;
  status: string;
  order_date: string;
}

type TabType = 'incentives' | 'policies' | 'summary';

export default function Incentives() {
  const [activeTab, setActiveTab] = useState<TabType>('incentives');
  const [loading, setLoading] = useState(true);

  // 인센티브 목록
  const [incentives, setIncentives] = useState<OrderIncentive[]>([]);
  const [filterEmployee, setFilterEmployee] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  // 정책 목록
  const [policies, setPolicies] = useState<IncentivePolicy[]>([]);

  // 직원별 집계
  const [summaries, setSummaries] = useState<EmployeeSummary[]>([]);

  // 직원 목록 (드롭다운용)
  const [employees, setEmployees] = useState<Employee[]>([]);

  // 주문 목록 (드롭다운용)
  const [orders, setOrders] = useState<Order[]>([]);

  // 인센티브 생성 모달
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createData, setCreateData] = useState({
    order_id: '',
    employee_id: '',
    policy_id: '',
    amount: '',
    notes: ''
  });

  // 정책 생성/수정 모달
  const [showPolicyModal, setShowPolicyModal] = useState(false);
  const [editingPolicyId, setEditingPolicyId] = useState<string | null>(null);
  const [policyData, setPolicyData] = useState({
    name: '',
    amount: '',
    description: ''
  });

  // 인센티브 수정
  const [editingIncentiveId, setEditingIncentiveId] = useState<string | null>(null);
  const [editIncentiveData, setEditIncentiveData] = useState({
    amount: '',
    status: '',
    notes: ''
  });

  // 직원별 집계 확장
  const [expandedEmployee, setExpandedEmployee] = useState<string | null>(null);
  const [employeeIncentives, setEmployeeIncentives] = useState<OrderIncentive[]>([]);

  const p = (v: any) => parseFloat(String(v)) || 0;

  // 데이터 로드
  const fetchIncentives = async () => {
    try {
      const qs: string[] = [];
      if (filterEmployee) qs.push(`employee_id=${filterEmployee}`);
      if (filterStatus) qs.push(`status=${filterStatus}`);
      const params = qs.length > 0 ? '?' + qs.join('&') : '';
      const data = await api.get<OrderIncentive[]>(`/incentives${params}`);
      setIncentives(data);
    } catch { setIncentives([]); }
  };

  const fetchPolicies = async () => {
    try {
      const data = await api.get<IncentivePolicy[]>('/incentives/policies');
      setPolicies(data);
    } catch { setPolicies([]); }
  };

  const fetchSummaries = async () => {
    try {
      const data = await api.get<EmployeeSummary[]>('/incentives/summary');
      setSummaries(data);
    } catch { setSummaries([]); }
  };

  const fetchEmployees = async () => {
    try {
      const data = await api.get<Employee[]>('/employees');
      setEmployees(data);
    } catch { setEmployees([]); }
  };

  const fetchOrders = async () => {
    try {
      const data = await api.get<Order[]>('/settlement/orders');
      setOrders(data);
    } catch { setOrders([]); }
  };

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchEmployees(), fetchOrders(), fetchPolicies()])
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    setLoading(true);
    if (activeTab === 'incentives') {
      fetchIncentives().finally(() => setLoading(false));
    } else if (activeTab === 'policies') {
      fetchPolicies().finally(() => setLoading(false));
    } else {
      fetchSummaries().finally(() => setLoading(false));
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'incentives') {
      fetchIncentives();
    }
  }, [filterEmployee, filterStatus]);

  // 정책 선택 시 금액 자동 입력
  const handlePolicySelect = (policyId: string) => {
    setCreateData({ ...createData, policy_id: policyId });
    if (policyId) {
      const policy = policies.find(p => p.id === policyId);
      if (policy) {
        setCreateData(prev => ({ ...prev, policy_id: policyId, amount: String(policy.amount) }));
      }
    }
  };

  // 인센티브 생성
  const handleCreateIncentive = async () => {
    if (!createData.order_id || !createData.employee_id) {
      alert('주문과 직원을 선택해주세요.');
      return;
    }
    if (!createData.amount && !createData.policy_id) {
      alert('금액을 입력하거나 정책을 선택해주세요.');
      return;
    }
    try {
      await api.post('/incentives', {
        order_id: createData.order_id,
        employee_id: createData.employee_id,
        policy_id: createData.policy_id || null,
        amount: createData.amount ? parseFloat(createData.amount) : undefined,
        notes: createData.notes
      });
      setShowCreateModal(false);
      setCreateData({ order_id: '', employee_id: '', policy_id: '', amount: '', notes: '' });
      fetchIncentives();
      fetchSummaries();
    } catch (err: any) {
      alert(err.message);
    }
  };

  // 인센티브 수정
  const handleUpdateIncentive = async (id: string) => {
    try {
      await api.put(`/incentives/${id}`, {
        amount: editIncentiveData.amount ? parseFloat(editIncentiveData.amount) : undefined,
        status: editIncentiveData.status || undefined,
        notes: editIncentiveData.notes
      });
      setEditingIncentiveId(null);
      fetchIncentives();
      fetchSummaries();
    } catch (err: any) {
      alert(err.message);
    }
  };

  // 인센티브 삭제
  const handleDeleteIncentive = async (id: string) => {
    if (!confirm('이 인센티브를 삭제하시겠습니까?')) return;
    try {
      await api.delete(`/incentives/${id}`);
      fetchIncentives();
      fetchSummaries();
    } catch (err: any) {
      alert(err.message);
    }
  };

  // 상태 변경 (지급 처리)
  const handleToggleStatus = async (incentive: OrderIncentive) => {
    const newStatus = incentive.status === 'pending' ? 'paid' : 'pending';
    try {
      await api.put(`/incentives/${incentive.id}`, { status: newStatus });
      fetchIncentives();
      fetchSummaries();
    } catch (err: any) {
      alert(err.message);
    }
  };

  // 일괄 지급
  const handleBatchPay = async (employeeId: string) => {
    if (!confirm('이 직원의 대기 중인 인센티브를 모두 지급 처리하시겠습니까?')) return;
    try {
      await api.post('/incentives/batch-pay', { employee_id: employeeId });
      fetchIncentives();
      fetchSummaries();
      if (expandedEmployee === employeeId) {
        const data = await api.get<OrderIncentive[]>(`/incentives?employee_id=${employeeId}`);
        setEmployeeIncentives(data);
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  // 정책 생성/수정
  const handleSavePolicy = async () => {
    if (!policyData.name || !policyData.amount) {
      alert('정책명과 금액은 필수입니다.');
      return;
    }
    try {
      if (editingPolicyId) {
        await api.put(`/incentives/policies/${editingPolicyId}`, {
          name: policyData.name,
          amount: parseFloat(policyData.amount),
          description: policyData.description
        });
      } else {
        await api.post('/incentives/policies', {
          name: policyData.name,
          amount: parseFloat(policyData.amount),
          description: policyData.description
        });
      }
      setShowPolicyModal(false);
      setEditingPolicyId(null);
      setPolicyData({ name: '', amount: '', description: '' });
      fetchPolicies();
    } catch (err: any) {
      alert(err.message);
    }
  };

  // 정책 삭제
  const handleDeletePolicy = async (id: string) => {
    if (!confirm('이 정책을 삭제하시겠습니까?')) return;
    try {
      await api.delete(`/incentives/policies/${id}`);
      fetchPolicies();
    } catch (err: any) {
      alert(err.message);
    }
  };

  // 정책 활성/비활성
  const handleTogglePolicy = async (policy: IncentivePolicy) => {
    try {
      await api.put(`/incentives/policies/${policy.id}`, { is_active: !policy.is_active });
      fetchPolicies();
    } catch (err: any) {
      alert(err.message);
    }
  };

  // 직원별 상세 보기
  const handleExpandEmployee = async (employeeId: string) => {
    if (expandedEmployee === employeeId) {
      setExpandedEmployee(null);
      setEmployeeIncentives([]);
      return;
    }
    setExpandedEmployee(employeeId);
    try {
      const data = await api.get<OrderIncentive[]>(`/incentives?employee_id=${employeeId}`);
      setEmployeeIncentives(data);
    } catch {
      setEmployeeIncentives([]);
    }
  };

  const startEditIncentive = (inc: OrderIncentive) => {
    setEditingIncentiveId(inc.id);
    setEditIncentiveData({
      amount: String(inc.amount),
      status: inc.status,
      notes: inc.notes || ''
    });
  };

  const openEditPolicy = (policy: IncentivePolicy) => {
    setEditingPolicyId(policy.id);
    setPolicyData({
      name: policy.name,
      amount: String(policy.amount),
      description: policy.description || ''
    });
    setShowPolicyModal(true);
  };

  // 합계 계산 (단가 × 수량)
  const incTotal = (i: OrderIncentive) => p(i.amount) * (p(i.quantity) || 1);
  const totalIncentiveAmount = incentives.reduce((sum, i) => sum + incTotal(i), 0);
  const paidIncentives = incentives.filter(i => i.status === 'paid');
  const pendingIncentives = incentives.filter(i => i.status === 'pending');
  const totalPaid = paidIncentives.reduce((sum, i) => sum + incTotal(i), 0);
  const totalPending = pendingIncentives.reduce((sum, i) => sum + incTotal(i), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">인센티브 관리</h1>
          <p className="text-sm text-gray-500 mt-1">주문별 직원 인센티브 부여 및 관리</p>
        </div>
      </div>

      {/* 탭 */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-8">
          <button
            onClick={() => setActiveTab('incentives')}
            className={`py-3 px-1 border-b-2 text-sm font-medium transition-colors ${
              activeTab === 'incentives'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Gift className="inline-block w-4 h-4 mr-1 -mt-0.5" />
            인센티브 현황
          </button>
          <button
            onClick={() => setActiveTab('policies')}
            className={`py-3 px-1 border-b-2 text-sm font-medium transition-colors ${
              activeTab === 'policies'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <FileText className="inline-block w-4 h-4 mr-1 -mt-0.5" />
            정책 관리
          </button>
          <button
            onClick={() => setActiveTab('summary')}
            className={`py-3 px-1 border-b-2 text-sm font-medium transition-colors ${
              activeTab === 'summary'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Users className="inline-block w-4 h-4 mr-1 -mt-0.5" />
            직원별 집계
          </button>
        </nav>
      </div>

      {/* ===================== 인센티브 현황 탭 ===================== */}
      {activeTab === 'incentives' && (
        <div className="space-y-4">
          {/* 필터 + 액션 */}
          <div className="bg-white rounded-lg shadow-sm border p-4">
            <div className="flex flex-col sm:flex-row sm:flex-wrap items-start sm:items-center gap-3 sm:gap-4">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-gray-400" />
                <span className="text-sm font-medium text-gray-700">직원</span>
              </div>
              <select
                value={filterEmployee}
                onChange={e => setFilterEmployee(e.target.value)}
                className="border rounded-lg px-3 py-2 text-sm flex-1 sm:flex-none"
              >
                <option value="">전체 직원</option>
                {employees.map(e => (
                  <option key={e.id} value={e.id}>{e.name} ({e.department})</option>
                ))}
              </select>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-gray-400" />
                <span className="text-sm font-medium text-gray-700">상태</span>
              </div>
              <select
                value={filterStatus}
                onChange={e => setFilterStatus(e.target.value)}
                className="border rounded-lg px-3 py-2 text-sm flex-1 sm:flex-none"
              >
                <option value="">전체</option>
                <option value="pending">대기</option>
                <option value="paid">지급완료</option>
              </select>
              {(filterEmployee || filterStatus) && (
                <button onClick={() => { setFilterEmployee(''); setFilterStatus(''); }} className="text-sm text-red-500 hover:text-red-700">초기화</button>
              )}
              <div className="sm:ml-auto">
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="flex items-center gap-1 px-3 py-2 bg-primary-600 text-white text-sm rounded-lg hover:bg-primary-700"
                >
                  <Plus className="w-4 h-4" />
                  인센티브 부여
                </button>
              </div>
            </div>
          </div>

          {/* 요약 카드 */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white rounded-lg shadow-sm border p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">총 건수</p>
                  <p className="text-2xl font-bold text-gray-900">{incentives.length}건</p>
                </div>
                <Gift className="w-8 h-8 text-purple-200" />
              </div>
            </div>
            <div className="bg-white rounded-lg shadow-sm border p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">총 금액</p>
                  <p className="text-2xl font-bold text-blue-600">{formatCurrency(totalIncentiveAmount)}</p>
                </div>
                <DollarSign className="w-8 h-8 text-blue-200" />
              </div>
            </div>
            <div className="bg-white rounded-lg shadow-sm border p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">지급완료</p>
                  <p className="text-2xl font-bold text-green-600">{formatCurrency(totalPaid)}</p>
                </div>
                <CheckCircle className="w-8 h-8 text-green-200" />
              </div>
            </div>
            <div className="bg-white rounded-lg shadow-sm border p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">대기</p>
                  <p className="text-2xl font-bold text-yellow-600">{formatCurrency(totalPending)}</p>
                </div>
                <Clock className="w-8 h-8 text-yellow-200" />
              </div>
            </div>
          </div>

          {/* 인센티브 테이블 */}
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
            </div>
          ) : incentives.length === 0 ? (
            <div className="bg-white rounded-lg shadow-sm border p-12 text-center text-gray-500">
              <Gift className="mx-auto h-12 w-12 text-gray-300 mb-4" />
              <p>인센티브 내역이 없습니다.</p>
              <p className="text-sm text-gray-400 mt-1">상단의 '인센티브 부여' 버튼으로 인센티브를 추가하세요.</p>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">직원</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">주문번호</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">고객</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">적용정책</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">단가</th>
                      <th className="px-3 py-2 text-center text-xs font-medium text-gray-500">수량</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">합계</th>
                      <th className="px-3 py-2 text-center text-xs font-medium text-gray-500">상태</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">비고</th>
                      <th className="px-3 py-2 text-center text-xs font-medium text-gray-500">액션</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {incentives.map((inc) => (
                      <tr key={inc.id} className={`hover:bg-gray-50 ${inc.status === 'paid' ? 'bg-green-50' : ''}`}>
                        {editingIncentiveId === inc.id ? (
                          <>
                            <td className="px-3 py-2 text-sm font-medium text-gray-900">
                              {inc.employee_name}
                              {inc.employee_department && <span className="text-gray-400 ml-1">({inc.employee_department})</span>}
                            </td>
                            <td className="px-3 py-2 text-sm text-gray-900">{inc.order_number}</td>
                            <td className="px-3 py-2 text-sm text-gray-500">{inc.customer_company || inc.customer_name || '-'}</td>
                            <td className="px-3 py-2 text-sm text-gray-500">{inc.policy_name || '-'}</td>
                            <td className="px-3 py-2">
                              <input
                                type="number"
                                value={editIncentiveData.amount}
                                onChange={e => setEditIncentiveData({ ...editIncentiveData, amount: e.target.value })}
                                className="w-24 border rounded px-2 py-1 text-sm text-right"
                              />
                            </td>
                            <td className="px-3 py-2 text-sm text-center text-gray-500">{p(inc.quantity) || 1}</td>
                            <td className="px-3 py-2 text-sm text-right font-medium text-blue-600 whitespace-nowrap">
                              {formatCurrency((editIncentiveData.amount ? parseFloat(editIncentiveData.amount) : p(inc.amount)) * (p(inc.quantity) || 1))}
                            </td>
                            <td className="px-3 py-2">
                              <select
                                value={editIncentiveData.status}
                                onChange={e => setEditIncentiveData({ ...editIncentiveData, status: e.target.value })}
                                className="border rounded px-2 py-1 text-sm"
                              >
                                <option value="pending">대기</option>
                                <option value="paid">지급완료</option>
                              </select>
                            </td>
                            <td className="px-3 py-2">
                              <input
                                type="text"
                                value={editIncentiveData.notes}
                                onChange={e => setEditIncentiveData({ ...editIncentiveData, notes: e.target.value })}
                                className="w-full border rounded px-2 py-1 text-sm"
                                placeholder="비고"
                              />
                            </td>
                            <td className="px-3 py-2 text-center">
                              <div className="flex items-center justify-center gap-1">
                                <button onClick={() => handleUpdateIncentive(inc.id)} className="p-1.5 rounded-lg bg-green-100 hover:bg-green-200 text-green-700" title="저장">
                                  <Save className="h-4 w-4" />
                                </button>
                                <button onClick={() => setEditingIncentiveId(null)} className="p-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600" title="취소">
                                  <X className="h-4 w-4" />
                                </button>
                              </div>
                            </td>
                          </>
                        ) : (
                          <>
                            <td className="px-3 py-2 text-sm font-medium text-gray-900 whitespace-nowrap">
                              {inc.employee_name}
                              {inc.employee_department && <span className="text-gray-400 ml-1">({inc.employee_department})</span>}
                            </td>
                            <td className="px-3 py-2 text-sm text-gray-900 whitespace-nowrap">{inc.order_number}</td>
                            <td className="px-3 py-2 text-sm text-gray-500">{inc.customer_company || inc.customer_name || '-'}</td>
                            <td className="px-3 py-2 text-sm text-gray-500">
                              {inc.policy_name ? (
                                <span className="inline-flex px-2 py-0.5 text-xs font-medium rounded-full bg-purple-100 text-purple-700">{inc.policy_name}</span>
                              ) : '-'}
                            </td>
                            <td className="px-3 py-2 text-sm text-right text-gray-600 whitespace-nowrap">{formatCurrency(p(inc.amount))}</td>
                            <td className="px-3 py-2 text-sm text-center text-gray-600">{p(inc.quantity) || 1}</td>
                            <td className="px-3 py-2 text-sm text-right font-medium text-blue-600 whitespace-nowrap">{formatCurrency(incTotal(inc))}</td>
                            <td className="px-3 py-2 text-center">
                              <span className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded-full ${
                                inc.status === 'paid' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                              }`}>
                                {inc.status === 'paid' ? '지급완료' : '대기'}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-sm text-gray-500">{inc.notes || '-'}</td>
                            <td className="px-3 py-2 text-center">
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  onClick={() => handleToggleStatus(inc)}
                                  className={`p-1.5 rounded-lg transition-colors ${
                                    inc.status === 'paid'
                                      ? 'bg-yellow-100 hover:bg-yellow-200 text-yellow-700'
                                      : 'bg-green-100 hover:bg-green-200 text-green-700'
                                  }`}
                                  title={inc.status === 'paid' ? '대기로 변경' : '지급완료로 변경'}
                                >
                                  {inc.status === 'paid' ? <RefreshCw className="h-4 w-4" /> : <CheckCircle className="h-4 w-4" />}
                                </button>
                                <button onClick={() => startEditIncentive(inc)} className="p-1.5 rounded-lg bg-blue-100 hover:bg-blue-200 text-blue-700" title="수정">
                                  <Edit2 className="h-4 w-4" />
                                </button>
                                <button onClick={() => handleDeleteIncentive(inc.id)} className="p-1.5 rounded-lg bg-red-100 hover:bg-red-200 text-red-700" title="삭제">
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            </td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-100 border-t-2 border-gray-300">
                    <tr>
                      <td colSpan={6} className="px-3 py-2 text-sm font-bold text-gray-900 text-right">합계</td>
                      <td className="px-3 py-2 text-sm text-right font-bold text-blue-600 whitespace-nowrap">{formatCurrency(totalIncentiveAmount)}</td>
                      <td colSpan={3}></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ===================== 정책 관리 탭 ===================== */}
      {activeTab === 'policies' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={() => {
                setEditingPolicyId(null);
                setPolicyData({ name: '', amount: '', description: '' });
                setShowPolicyModal(true);
              }}
              className="flex items-center gap-1 px-3 py-2 bg-primary-600 text-white text-sm rounded-lg hover:bg-primary-700"
            >
              <Plus className="w-4 h-4" />
              정책 추가
            </button>
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
            </div>
          ) : policies.length === 0 ? (
            <div className="bg-white rounded-lg shadow-sm border p-12 text-center text-gray-500">
              <FileText className="mx-auto h-12 w-12 text-gray-300 mb-4" />
              <p>등록된 인센티브 정책이 없습니다.</p>
              <p className="text-sm text-gray-400 mt-1">정책을 미리 등록해두면 인센티브 부여 시 빠르게 적용할 수 있습니다.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {policies.map(policy => (
                <div key={policy.id} className={`bg-white rounded-lg shadow-sm border p-5 ${!policy.is_active ? 'opacity-60' : ''}`}>
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Award className={`w-5 h-5 ${policy.is_active ? 'text-purple-500' : 'text-gray-400'}`} />
                      <h3 className="font-semibold text-gray-900">{policy.name}</h3>
                    </div>
                    <span className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded-full ${
                      policy.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {policy.is_active ? '활성' : '비활성'}
                    </span>
                  </div>
                  <p className="text-2xl font-bold text-blue-600 mb-2">{formatCurrency(p(policy.amount))}</p>
                  {policy.description && (
                    <p className="text-sm text-gray-500 mb-4">{policy.description}</p>
                  )}
                  <div className="flex items-center gap-2 pt-3 border-t">
                    <button
                      onClick={() => handleTogglePolicy(policy)}
                      className={`px-3 py-1.5 text-xs rounded-lg ${
                        policy.is_active
                          ? 'bg-gray-100 hover:bg-gray-200 text-gray-600'
                          : 'bg-green-100 hover:bg-green-200 text-green-700'
                      }`}
                    >
                      {policy.is_active ? '비활성화' : '활성화'}
                    </button>
                    <button onClick={() => openEditPolicy(policy)} className="px-3 py-1.5 text-xs bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-lg">수정</button>
                    <button onClick={() => handleDeletePolicy(policy.id)} className="px-3 py-1.5 text-xs bg-red-100 hover:bg-red-200 text-red-700 rounded-lg">삭제</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ===================== 직원별 집계 탭 ===================== */}
      {activeTab === 'summary' && (
        <div className="space-y-4">
          {/* 전체 집계 카드 */}
          {(() => {
            const totalAll = summaries.reduce((sum, s) => sum + p(s.total_amount), 0);
            const totalAllPaid = summaries.reduce((sum, s) => sum + p(s.paid_amount), 0);
            const totalAllPending = summaries.reduce((sum, s) => sum + p(s.pending_amount), 0);
            return (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="bg-white rounded-lg shadow-sm border p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-500">인센티브 대상</p>
                      <p className="text-2xl font-bold text-gray-900">{summaries.length}명</p>
                    </div>
                    <Users className="w-8 h-8 text-purple-200" />
                  </div>
                </div>
                <div className="bg-white rounded-lg shadow-sm border p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-500">총 인센티브</p>
                      <p className="text-2xl font-bold text-blue-600">{formatCurrency(totalAll)}</p>
                    </div>
                    <DollarSign className="w-8 h-8 text-blue-200" />
                  </div>
                </div>
                <div className="bg-white rounded-lg shadow-sm border p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-500">지급완료</p>
                      <p className="text-2xl font-bold text-green-600">{formatCurrency(totalAllPaid)}</p>
                    </div>
                    <CheckCircle className="w-8 h-8 text-green-200" />
                  </div>
                </div>
                <div className="bg-white rounded-lg shadow-sm border p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-500">미지급</p>
                      <p className="text-2xl font-bold text-yellow-600">{formatCurrency(totalAllPending)}</p>
                    </div>
                    <Clock className="w-8 h-8 text-yellow-200" />
                  </div>
                </div>
              </div>
            );
          })()}

          {loading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
            </div>
          ) : summaries.length === 0 ? (
            <div className="bg-white rounded-lg shadow-sm border p-12 text-center text-gray-500">
              <Users className="mx-auto h-12 w-12 text-gray-300 mb-4" />
              <p>인센티브가 부여된 직원이 없습니다.</p>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 w-8"></th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">직원명</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">부서</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">직급</th>
                      <th className="px-3 py-2 text-center text-xs font-medium text-gray-500">건수</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">총 인센티브</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">지급완료</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">미지급</th>
                      <th className="px-3 py-2 text-center text-xs font-medium text-gray-500">액션</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {summaries.map(s => {
                      const isExpanded = expandedEmployee === s.employee_id;
                      return (
                        <React.Fragment key={s.employee_id}>
                          <tr
                            className={`hover:bg-gray-50 cursor-pointer ${isExpanded ? 'bg-purple-50' : ''}`}
                            onClick={() => handleExpandEmployee(s.employee_id)}
                          >
                            <td className="px-3 py-2 text-center">
                              {isExpanded ? <ChevronDown className="h-4 w-4 text-gray-400" /> : <ChevronRight className="h-4 w-4 text-gray-400" />}
                            </td>
                            <td className="px-3 py-2 text-sm font-medium text-gray-900">{s.employee_name}</td>
                            <td className="px-3 py-2 text-sm text-gray-500">{s.department || '-'}</td>
                            <td className="px-3 py-2 text-sm text-gray-500">{s.position || '-'}</td>
                            <td className="px-3 py-2 text-sm text-center">
                              <span className="inline-flex px-2 py-0.5 text-xs font-medium rounded-full bg-purple-100 text-purple-700">
                                {s.incentive_count}건
                              </span>
                            </td>
                            <td className="px-3 py-2 text-sm text-right font-medium text-blue-600 whitespace-nowrap">{formatCurrency(p(s.total_amount))}</td>
                            <td className="px-3 py-2 text-sm text-right font-medium text-green-600 whitespace-nowrap">{formatCurrency(p(s.paid_amount))}</td>
                            <td className="px-3 py-2 text-sm text-right font-medium text-yellow-600 whitespace-nowrap">{formatCurrency(p(s.pending_amount))}</td>
                            <td className="px-3 py-2 text-center" onClick={e => e.stopPropagation()}>
                              {p(s.pending_amount) > 0 && (
                                <button
                                  onClick={() => handleBatchPay(s.employee_id)}
                                  className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-green-100 hover:bg-green-200 text-green-700 rounded-lg"
                                  title="일괄 지급"
                                >
                                  <Zap className="h-3 w-3" />
                                  일괄 지급
                                </button>
                              )}
                            </td>
                          </tr>
                          {/* 확장: 직원별 인센티브 상세 */}
                          {isExpanded && (
                            <tr>
                              <td colSpan={10} className="p-0">
                                <div className="bg-purple-50 border-t border-b border-purple-200 px-6 py-4">
                                  {/* 정책별 집계 */}
                                  {s.policy_details && s.policy_details.length > 0 && (
                                    <div className="mb-4">
                                      <div className="text-xs font-medium text-purple-700 mb-2">{s.employee_name}님의 정책별 집계</div>
                                      <table className="min-w-full mb-1">
                                        <thead>
                                          <tr className="border-b border-purple-200">
                                            <th className="px-2 py-1 text-left text-[10px] font-medium text-purple-600">정책(상품)</th>
                                            <th className="px-2 py-1 text-center text-[10px] font-medium text-purple-600">수량</th>
                                            <th className="px-2 py-1 text-right text-[10px] font-medium text-purple-600">합계 금액</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {s.policy_details.map((pd, idx) => (
                                            <tr key={idx} className="border-b border-purple-100 last:border-b-0">
                                              <td className="px-2 py-1.5 text-xs text-gray-900">{pd.policy_name}</td>
                                              <td className="px-2 py-1.5 text-xs text-center text-gray-600">{pd.total_quantity}</td>
                                              <td className="px-2 py-1.5 text-xs text-right font-medium text-blue-600">{formatCurrency(pd.total_amount)}</td>
                                            </tr>
                                          ))}
                                        </tbody>
                                        <tfoot className="border-t border-purple-300 bg-purple-100">
                                          <tr>
                                            <td className="px-2 py-1.5 text-xs font-bold text-purple-700">합계</td>
                                            <td className="px-2 py-1.5 text-xs text-center font-bold text-purple-700">
                                              {s.policy_details.reduce((sum, pd) => sum + pd.total_quantity, 0)}
                                            </td>
                                            <td className="px-2 py-1.5 text-xs text-right font-bold text-purple-700">
                                              {formatCurrency(s.policy_details.reduce((sum, pd) => sum + pd.total_amount, 0))}
                                            </td>
                                          </tr>
                                        </tfoot>
                                      </table>
                                    </div>
                                  )}
                                  {/* 인센티브 상세 내역 */}
                                  <div className="text-xs font-medium text-purple-700 mb-3">{s.employee_name}님의 인센티브 내역</div>
                                  {employeeIncentives.length === 0 ? (
                                    <div className="text-sm text-gray-400 text-center py-4">내역이 없습니다.</div>
                                  ) : (
                                    <table className="min-w-full">
                                      <thead>
                                        <tr className="border-b border-purple-200">
                                          <th className="px-2 py-1 text-left text-[10px] font-medium text-purple-600">주문번호</th>
                                          <th className="px-2 py-1 text-left text-[10px] font-medium text-purple-600">고객</th>
                                          <th className="px-2 py-1 text-left text-[10px] font-medium text-purple-600">정책</th>
                                          <th className="px-2 py-1 text-right text-[10px] font-medium text-purple-600">단가</th>
                                          <th className="px-2 py-1 text-center text-[10px] font-medium text-purple-600">수량</th>
                                          <th className="px-2 py-1 text-right text-[10px] font-medium text-purple-600">합계</th>
                                          <th className="px-2 py-1 text-center text-[10px] font-medium text-purple-600">상태</th>
                                          <th className="px-2 py-1 text-left text-[10px] font-medium text-purple-600">비고</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {employeeIncentives.map(inc => (
                                          <tr key={inc.id} className="border-b border-purple-100 last:border-b-0">
                                            <td className="px-2 py-1.5 text-xs text-gray-900">{inc.order_number}</td>
                                            <td className="px-2 py-1.5 text-xs text-gray-500">{inc.customer_company || inc.customer_name || '-'}</td>
                                            <td className="px-2 py-1.5 text-xs text-gray-500">{inc.policy_name || '-'}</td>
                                            <td className="px-2 py-1.5 text-xs text-right text-gray-600">{formatCurrency(p(inc.amount))}</td>
                                            <td className="px-2 py-1.5 text-xs text-center text-gray-600">{p(inc.quantity) || 1}</td>
                                            <td className="px-2 py-1.5 text-xs text-right font-medium text-blue-600">{formatCurrency(incTotal(inc))}</td>
                                            <td className="px-2 py-1.5 text-center">
                                              <span className={`inline-flex px-1.5 py-0.5 text-[10px] font-semibold rounded-full ${
                                                inc.status === 'paid' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                                              }`}>
                                                {inc.status === 'paid' ? '지급완료' : '대기'}
                                              </span>
                                            </td>
                                            <td className="px-2 py-1.5 text-xs text-gray-500">{inc.notes || '-'}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                      <tfoot className="border-t border-purple-300 bg-purple-100">
                                        <tr>
                                          <td colSpan={5} className="px-2 py-1.5 text-xs text-right font-bold text-purple-700">합계</td>
                                          <td className="px-2 py-1.5 text-xs text-right font-bold text-purple-700">
                                            {formatCurrency(employeeIncentives.reduce((sum, inc) => sum + incTotal(inc), 0))}
                                          </td>
                                          <td colSpan={2}></td>
                                        </tr>
                                      </tfoot>
                                    </table>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ===================== 인센티브 생성 모달 ===================== */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-lg font-bold text-gray-900 flex items-center">
                <Gift className="w-5 h-5 mr-2 text-purple-600" />
                인센티브 부여
              </h2>
              <button onClick={() => setShowCreateModal(false)} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">주문 선택 *</label>
                <select
                  value={createData.order_id}
                  onChange={e => setCreateData({ ...createData, order_id: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                >
                  <option value="">주문 선택</option>
                  {orders.map(o => (
                    <option key={o.id} value={o.id}>
                      {o.order_number} - {o.customer_company || o.customer_name || '고객'} ({formatCurrency(p(o.total_amount))})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">직원 선택 *</label>
                <select
                  value={createData.employee_id}
                  onChange={e => setCreateData({ ...createData, employee_id: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                >
                  <option value="">직원 선택</option>
                  {employees.map(e => (
                    <option key={e.id} value={e.id}>{e.name} ({e.department} / {e.position})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">정책 적용 (선택)</label>
                <select
                  value={createData.policy_id}
                  onChange={e => handlePolicySelect(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                >
                  <option value="">정책 선택 (수동 입력)</option>
                  {policies.filter(p => p.is_active).map(p => (
                    <option key={p.id} value={p.id}>{p.name} ({formatCurrency(p.amount)})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">인센티브 금액 *</label>
                <input
                  type="number"
                  value={createData.amount}
                  onChange={e => setCreateData({ ...createData, amount: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  placeholder="금액 입력"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">비고</label>
                <textarea
                  value={createData.notes}
                  onChange={e => setCreateData({ ...createData, notes: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  rows={2}
                  placeholder="비고 사항 입력"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 p-6 border-t">
              <button onClick={() => setShowCreateModal(false)} className="px-4 py-2 text-sm text-gray-700 bg-white border rounded-lg hover:bg-gray-50">취소</button>
              <button onClick={handleCreateIncentive} className="px-4 py-2 text-sm text-white bg-primary-600 rounded-lg hover:bg-primary-700">부여</button>
            </div>
          </div>
        </div>
      )}

      {/* ===================== 정책 생성/수정 모달 ===================== */}
      {showPolicyModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-lg font-bold text-gray-900 flex items-center">
                <Award className="w-5 h-5 mr-2 text-purple-600" />
                {editingPolicyId ? '정책 수정' : '정책 추가'}
              </h2>
              <button onClick={() => { setShowPolicyModal(false); setEditingPolicyId(null); }} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">정책명 *</label>
                <input
                  type="text"
                  value={policyData.name}
                  onChange={e => setPolicyData({ ...policyData, name: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  placeholder="예: 신규 계약 인센티브"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">금액 *</label>
                <input
                  type="number"
                  value={policyData.amount}
                  onChange={e => setPolicyData({ ...policyData, amount: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  placeholder="인센티브 금액"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">설명</label>
                <textarea
                  value={policyData.description}
                  onChange={e => setPolicyData({ ...policyData, description: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  rows={3}
                  placeholder="정책에 대한 설명"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 p-6 border-t">
              <button onClick={() => { setShowPolicyModal(false); setEditingPolicyId(null); }} className="px-4 py-2 text-sm text-gray-700 bg-white border rounded-lg hover:bg-gray-50">취소</button>
              <button onClick={handleSavePolicy} className="px-4 py-2 text-sm text-white bg-primary-600 rounded-lg hover:bg-primary-700">
                {editingPolicyId ? '수정' : '추가'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
