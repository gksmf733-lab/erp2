import { useEffect, useState } from 'react';
import { api } from '../utils/api';
import { Transaction } from '../types';
import { formatCurrency, formatDate, getStatusColor } from '../utils/format';
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  X,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Calendar,
  Filter,
  CheckSquare,
  Repeat,
  ToggleLeft,
  ToggleRight
} from 'lucide-react';

interface Summary {
  income: number;
  expense: number;
  balance: number;
  byCategory: { type: string; category: string; total: number }[];
}

interface FixedExpense {
  id: string;
  name: string;
  category: string;
  amount: number;
  description: string | null;
  is_active: boolean;
  created_at: string;
}

interface MonthlySummary {
  year: number;
  month: number;
  income: number;
  expense: number;
  fixedExpense: number;
  totalExpense: number;
  balance: number;
  fixedExpenses: FixedExpense[];
}

export default function Finance() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [monthlySummary, setMonthlySummary] = useState<MonthlySummary | null>(null);
  const [fixedExpenses, setFixedExpenses] = useState<FixedExpense[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterType, setFilterType] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showFixedModal, setShowFixedModal] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [editingFixed, setEditingFixed] = useState<FixedExpense | null>(null);
  const [selectedTransactions, setSelectedTransactions] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<'transactions' | 'fixed'>('transactions');
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [formData, setFormData] = useState({
    type: 'income' as 'income' | 'expense',
    category: '',
    amount: 0,
    description: '',
    date: new Date().toISOString().split('T')[0],
  });
  const [fixedFormData, setFixedFormData] = useState({
    name: '',
    category: '',
    amount: 0,
    description: '',
  });

  const incomeCategories = ['매출', '투자', '이자', '기타수입'];
  const expenseCategories = ['급여', '임대료', '운영비', '마케팅', '연구개발', '업체상품', '기타지출'];
  const fixedCategories = ['급여', '임대료', '보험료', '통신비', '구독료', '대출이자', '관리비', '기타고정비'];

  useEffect(() => {
    fetchData();
  }, [filterType, filterCategory]);

  useEffect(() => {
    fetchMonthlySummary();
  }, [selectedMonth]);

  useEffect(() => {
    if (activeTab === 'fixed') {
      fetchFixedExpenses();
    }
  }, [activeTab]);

  const fetchData = async () => {
    try {
      const params = new URLSearchParams();
      if (filterType) params.append('type', filterType);
      if (filterCategory) params.append('category', filterCategory);

      const transactionsRes = await api.get<Transaction[]>(`/finance/transactions?${params.toString()}`);
      const summaryRes = await api.get<Summary>('/finance/summary');
      setTransactions(transactionsRes);
      setSummary(summaryRes);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchFixedExpenses = async () => {
    try {
      const res = await api.get<FixedExpense[]>('/finance/fixed-expenses');
      setFixedExpenses(res);
    } catch (error) {
      console.error('Failed to fetch fixed expenses:', error);
    }
  };

  const fetchMonthlySummary = async () => {
    try {
      const [year, month] = selectedMonth.split('-');
      const res = await api.get<MonthlySummary>(`/finance/monthly-summary?year=${year}&month=${month}`);
      setMonthlySummary(res);
    } catch (error) {
      console.error('Failed to fetch monthly summary:', error);
    }
  };

  const openModal = (transaction?: Transaction) => {
    if (transaction) {
      setEditingTransaction(transaction);
      setFormData({
        type: transaction.type,
        category: transaction.category,
        amount: transaction.amount,
        description: transaction.description || '',
        date: transaction.date,
      });
    } else {
      setEditingTransaction(null);
      setFormData({
        type: 'income',
        category: '',
        amount: 0,
        description: '',
        date: new Date().toISOString().split('T')[0],
      });
    }
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingTransaction(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingTransaction) {
        await api.put(`/finance/transactions/${editingTransaction.id}`, formData);
      } else {
        await api.post('/finance/transactions', formData);
      }
      closeModal();
      fetchData();
    } catch (error) {
      alert(error instanceof Error ? error.message : '저장에 실패했습니다.');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('정말 삭제하시겠습니까?')) return;
    try {
      await api.delete(`/finance/transactions/${id}`);
      fetchData();
    } catch (error) {
      alert(error instanceof Error ? error.message : '삭제에 실패했습니다.');
    }
  };

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedTransactions);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedTransactions(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedTransactions.size === transactions.length) {
      setSelectedTransactions(new Set());
    } else {
      setSelectedTransactions(new Set(transactions.map(t => t.id)));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedTransactions.size === 0) return;
    if (!confirm(`선택한 ${selectedTransactions.size}건의 거래내역을 삭제하시겠습니까?`)) return;

    try {
      const ids = Array.from(selectedTransactions);
      await api.post('/finance/transactions/bulk-delete', { ids });
      setSelectedTransactions(new Set());
      fetchData();
    } catch (error) {
      alert(error instanceof Error ? error.message : '삭제에 실패했습니다.');
    }
  };

  // 고정비 모달 관련 함수들
  const openFixedModal = (item?: FixedExpense) => {
    if (item) {
      setEditingFixed(item);
      setFixedFormData({
        name: item.name,
        category: item.category,
        amount: item.amount,
        description: item.description || '',
      });
    } else {
      setEditingFixed(null);
      setFixedFormData({
        name: '',
        category: '',
        amount: 0,
        description: '',
      });
    }
    setShowFixedModal(true);
  };

  const closeFixedModal = () => {
    setShowFixedModal(false);
    setEditingFixed(null);
  };

  const handleFixedSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingFixed) {
        await api.put(`/finance/fixed-expenses/${editingFixed.id}`, fixedFormData);
      } else {
        await api.post('/finance/fixed-expenses', fixedFormData);
      }
      closeFixedModal();
      fetchFixedExpenses();
      fetchMonthlySummary();
    } catch (error) {
      alert(error instanceof Error ? error.message : '저장에 실패했습니다.');
    }
  };

  const handleFixedDelete = async (id: string) => {
    if (!confirm('정말 삭제하시겠습니까?')) return;
    try {
      await api.delete(`/finance/fixed-expenses/${id}`);
      fetchFixedExpenses();
      fetchMonthlySummary();
    } catch (error) {
      alert(error instanceof Error ? error.message : '삭제에 실패했습니다.');
    }
  };

  const toggleFixedActive = async (item: FixedExpense) => {
    try {
      await api.put(`/finance/fixed-expenses/${item.id}`, { is_active: !item.is_active });
      fetchFixedExpenses();
      fetchMonthlySummary();
    } catch (error) {
      alert(error instanceof Error ? error.message : '상태 변경에 실패했습니다.');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900">재무/회계</h1>
        <button
          onClick={() => openModal()}
          className="inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
        >
          <Plus className="h-5 w-5 mr-2" />
          거래 등록
        </button>
      </div>

      {/* 월별 지출 요약 카드 */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
          <h2 className="text-lg font-semibold text-gray-900">월별 지출 요약</h2>
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="p-4 bg-green-50 rounded-lg">
            <p className="text-sm text-gray-500">수입</p>
            <p className="text-xl font-bold text-green-600">{formatCurrency(monthlySummary?.income || 0)}</p>
          </div>
          <div className="p-4 bg-red-50 rounded-lg">
            <p className="text-sm text-gray-500">변동 지출</p>
            <p className="text-xl font-bold text-red-600">{formatCurrency(monthlySummary?.expense || 0)}</p>
          </div>
          <div className="p-4 bg-orange-50 rounded-lg">
            <p className="text-sm text-gray-500">고정비</p>
            <p className="text-xl font-bold text-orange-600">{formatCurrency(monthlySummary?.fixedExpense || 0)}</p>
          </div>
          <div className="p-4 bg-purple-50 rounded-lg">
            <p className="text-sm text-gray-500">총 지출</p>
            <p className="text-xl font-bold text-purple-600">{formatCurrency(monthlySummary?.totalExpense || 0)}</p>
          </div>
          <div className={`p-4 rounded-lg ${(monthlySummary?.balance || 0) >= 0 ? 'bg-primary-50' : 'bg-red-50'}`}>
            <p className="text-sm text-gray-500">순이익</p>
            <p className={`text-xl font-bold ${(monthlySummary?.balance || 0) >= 0 ? 'text-primary-600' : 'text-red-600'}`}>
              {formatCurrency(monthlySummary?.balance || 0)}
            </p>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">총 수입</p>
              <p className="text-2xl font-bold text-green-600 mt-1">
                {formatCurrency(summary?.income || 0)}
              </p>
            </div>
            <div className="p-3 rounded-lg bg-green-100">
              <TrendingUp className="h-6 w-6 text-green-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">총 지출</p>
              <p className="text-2xl font-bold text-red-600 mt-1">
                {formatCurrency(summary?.expense || 0)}
              </p>
            </div>
            <div className="p-3 rounded-lg bg-red-100">
              <TrendingDown className="h-6 w-6 text-red-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">순이익</p>
              <p className={`text-2xl font-bold mt-1 ${(summary?.balance || 0) >= 0 ? 'text-primary-600' : 'text-red-600'}`}>
                {formatCurrency(summary?.balance || 0)}
              </p>
            </div>
            <div className="p-3 rounded-lg bg-primary-100">
              <DollarSign className="h-6 w-6 text-primary-600" />
            </div>
          </div>
        </div>
      </div>

      {/* 탭 */}
      <div className="bg-white rounded-xl shadow-sm">
        <div className="border-b border-gray-200">
          <nav className="flex -mb-px">
            <button
              onClick={() => setActiveTab('transactions')}
              className={`py-4 px-6 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'transactions'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <DollarSign className="inline h-4 w-4 mr-1" />
              거래내역
            </button>
            <button
              onClick={() => setActiveTab('fixed')}
              className={`py-4 px-6 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'fixed'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Repeat className="inline h-4 w-4 mr-1" />
              고정비 관리
            </button>
          </nav>
        </div>
      </div>

      {/* 거래내역 탭 */}
      {activeTab === 'transactions' && (
        <>
      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex items-center space-x-2">
            <Filter className="h-5 w-5 text-gray-400" />
            <span className="text-sm text-gray-500">필터:</span>
          </div>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          >
            <option value="">전체 유형</option>
            <option value="income">수입</option>
            <option value="expense">지출</option>
          </select>
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          >
            <option value="">전체 카테고리</option>
            <optgroup label="수입">
              {incomeCategories.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </optgroup>
            <optgroup label="지출">
              {expenseCategories.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </optgroup>
          </select>
        </div>
      </div>

      {/* Transaction Table */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {/* 선택된 항목 액션 바 */}
        {selectedTransactions.size > 0 && (
          <div className="flex items-center justify-between px-6 py-3 bg-primary-50 border-b border-primary-100">
            <div className="flex items-center gap-2">
              <CheckSquare className="h-5 w-5 text-primary-600" />
              <span className="text-sm font-medium text-primary-700">
                {selectedTransactions.size}건 선택됨
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSelectedTransactions(new Set())}
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
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-12">
                  <input
                    type="checkbox"
                    checked={transactions.length > 0 && selectedTransactions.size === transactions.length}
                    onChange={toggleSelectAll}
                    className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                  />
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  날짜
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  유형
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  카테고리
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  설명
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  금액
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  관리
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {transactions.map((transaction) => (
                <tr key={transaction.id} className={`hover:bg-gray-50 ${selectedTransactions.has(transaction.id) ? 'bg-primary-50/50' : ''}`}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <input
                      type="checkbox"
                      checked={selectedTransactions.has(transaction.id)}
                      onChange={() => toggleSelect(transaction.id)}
                      className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                    />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatDate(transaction.date)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      transaction.type === 'income'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {transaction.type === 'income' ? (
                        <TrendingUp className="h-3 w-3 mr-1" />
                      ) : (
                        <TrendingDown className="h-3 w-3 mr-1" />
                      )}
                      {transaction.type === 'income' ? '수입' : '지출'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {transaction.category}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {transaction.description || '-'}
                  </td>
                  <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium text-right ${
                    transaction.type === 'income' ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {transaction.type === 'income' ? '+' : '-'}{formatCurrency(transaction.amount)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => openModal(transaction)}
                      className="text-primary-600 hover:text-primary-900 mr-3"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(transaction.id)}
                      className="text-red-600 hover:text-red-900"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {transactions.length === 0 && (
          <div className="text-center py-12">
            <DollarSign className="mx-auto h-12 w-12 text-gray-400" />
            <p className="mt-4 text-gray-500">등록된 거래 내역이 없습니다.</p>
          </div>
        )}
      </div>
        </>
      )}

      {/* 고정비 관리 탭 */}
      {activeTab === 'fixed' && (
        <>
          <div className="flex justify-end">
            <button
              onClick={() => openFixedModal()}
              className="inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
            >
              <Plus className="h-5 w-5 mr-2" />
              고정비 등록
            </button>
          </div>

          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      항목명
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      카테고리
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      설명
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      월 금액
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      상태
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      관리
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {fixedExpenses.map((item) => (
                    <tr key={item.id} className={`hover:bg-gray-50 ${!item.is_active ? 'opacity-50' : ''}`}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {item.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                          {item.category}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {item.description || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-right text-orange-600">
                        {formatCurrency(item.amount)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <button
                          onClick={() => toggleFixedActive(item)}
                          className={`inline-flex items-center ${item.is_active ? 'text-green-600' : 'text-gray-400'}`}
                          title={item.is_active ? '활성화됨 - 클릭하여 비활성화' : '비활성화됨 - 클릭하여 활성화'}
                        >
                          {item.is_active ? (
                            <ToggleRight className="h-6 w-6" />
                          ) : (
                            <ToggleLeft className="h-6 w-6" />
                          )}
                        </button>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => openFixedModal(item)}
                          className="text-primary-600 hover:text-primary-900 mr-3"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleFixedDelete(item.id)}
                          className="text-red-600 hover:text-red-900"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {fixedExpenses.length === 0 && (
              <div className="text-center py-12">
                <Repeat className="mx-auto h-12 w-12 text-gray-400" />
                <p className="mt-4 text-gray-500">등록된 고정비가 없습니다.</p>
              </div>
            )}
            {fixedExpenses.length > 0 && (
              <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">
                    활성화된 고정비: {fixedExpenses.filter(e => e.is_active).length}건
                  </span>
                  <span className="text-lg font-bold text-orange-600">
                    월 합계: {formatCurrency(fixedExpenses.filter(e => e.is_active).reduce((sum, e) => sum + e.amount, 0))}
                  </span>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={closeModal} />

            <div className="relative bg-white rounded-xl shadow-xl max-w-lg w-full mx-auto p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-900">
                  {editingTransaction ? '거래 내역 수정' : '거래 등록'}
                </h2>
                <button onClick={closeModal} className="text-gray-400 hover:text-gray-600">
                  <X className="h-6 w-6" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">유형</label>
                    <select
                      value={formData.type}
                      onChange={(e) => setFormData({ ...formData, type: e.target.value as 'income' | 'expense', category: '' })}
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    >
                      <option value="income">수입</option>
                      <option value="expense">지출</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">카테고리</label>
                    <select
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    >
                      <option value="">선택</option>
                      {(formData.type === 'income' ? incomeCategories : expenseCategories).map((cat) => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">금액</label>
                  <input
                    type="number"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: parseInt(e.target.value) || 0 })}
                    required
                    min="0"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <Calendar className="inline h-4 w-4 mr-1" />
                    날짜
                  </label>
                  <input
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">설명</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>

                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    취소
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                  >
                    {editingTransaction ? '수정' : '등록'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* 고정비 Modal */}
      {showFixedModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={closeFixedModal} />

            <div className="relative bg-white rounded-xl shadow-xl max-w-lg w-full mx-auto p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-900">
                  {editingFixed ? '고정비 수정' : '고정비 등록'}
                </h2>
                <button onClick={closeFixedModal} className="text-gray-400 hover:text-gray-600">
                  <X className="h-6 w-6" />
                </button>
              </div>

              <form onSubmit={handleFixedSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">항목명</label>
                  <input
                    type="text"
                    value={fixedFormData.name}
                    onChange={(e) => setFixedFormData({ ...fixedFormData, name: e.target.value })}
                    required
                    placeholder="예: 사무실 임대료"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">카테고리</label>
                  <select
                    value={fixedFormData.category}
                    onChange={(e) => setFixedFormData({ ...fixedFormData, category: e.target.value })}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  >
                    <option value="">선택</option>
                    {fixedCategories.map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">월 금액</label>
                  <input
                    type="number"
                    value={fixedFormData.amount}
                    onChange={(e) => setFixedFormData({ ...fixedFormData, amount: parseInt(e.target.value) || 0 })}
                    required
                    min="0"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">설명</label>
                  <textarea
                    value={fixedFormData.description}
                    onChange={(e) => setFixedFormData({ ...fixedFormData, description: e.target.value })}
                    rows={3}
                    placeholder="고정비에 대한 메모를 입력하세요"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>

                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={closeFixedModal}
                    className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    취소
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                  >
                    {editingFixed ? '수정' : '등록'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
