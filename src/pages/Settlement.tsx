import React, { useEffect, useState } from 'react';
import { api } from '../utils/api';
import { formatCurrency, formatDate } from '../utils/format';
import * as XLSX from 'xlsx';
import {
  Calculator,
  Search,
  Edit2,
  Trash2,
  X,
  CheckCircle,
  Calendar,
  User,
  Clock,
  Shield,
  TrendingDown,
  Plus,
  Download,
  History,
  FileText,
  UserCheck,
  ChevronDown,
  ChevronRight,
  Check,
  RefreshCw,
  Users,
  Zap,
  Save,
  Store,
  Building
} from 'lucide-react';

interface AssigneeSummary {
  assignee_id: string;
  assignee_name: string;
  department: string;
  position: string;
  order_count: number;
  total_sales: number;
  expected_sales: number;
  confirmed_sales: number;
  expected_count: number;
  confirmed_count: number;
  total_expenses: number;
  vendor_expenses: number;
  incentive_expenses: number;
  expected_expenses: number;
  confirmed_expenses: number;
}

interface SettlementRecord {
  id: string;
  assignee_id: string;
  assignee_name: string;
  department: string;
  position: string;
  total_expenses: number;
  period_start: string;
  period_end: string;
  total_sales: number;
  commission_rate: number;
  commission_amount: number;
  status: string;
  settled_date: string | null;
  notes: string | null;
  created_at: string;
  linked_order_count: number;
}

interface VendorItem {
  vendor_name: string;
  product_name: string;
  unit_price: number;
  quantity: number;
  item_type?: 'normal' | 'refund';
}

interface OrderItem {
  item_name: string;
  unit_price: number;
  quantity: number;
  item_type?: 'normal' | 'refund';
}

interface IncentiveItem {
  employee_name: string;
  amount: number;
  quantity: number;
  status: string;
  policy_name: string | null;
}

interface AssigneeOrder {
  id: string;
  order_number: string;
  customer_name: string;
  customer_company: string;
  assignee_name: string;
  assignee_department: string;
  total_amount: number;
  vendor_expense: number;
  incentive_expense: number;
  vendor_items: VendorItem[] | null;
  order_items: OrderItem[] | null;
  incentive_items: IncentiveItem[] | null;
  status: string;
  order_date: string;
  start_date: string;
  due_date: string;
  settlement_type: 'expected' | 'confirmed';
  settlement_status: 'pending' | 'settled';
  settled_date: string | null;
  settlement_id: string | null;
}

interface OrderEditLog {
  id: string;
  order_id: string;
  action: 'created' | 'updated' | 'deleted';
  field_name: string | null;
  old_value: string | null;
  new_value: string | null;
  change_summary: string;
  edited_by: string;
  created_at: string;
}

interface VendorSummaryData {
  vendor_id: string;
  vendor_name: string;
  order_count: number;
  total_amount: number;
  total_refund: number;
  net_amount: number;
  settled_amount: number;
}

interface VendorSettlementRecord {
  id: string;
  vendor_id: string;
  vendor_name: string;
  period_start: string;
  period_end: string;
  total_amount: number;
  total_refund: number;
  net_amount: number;
  status: string;
  settled_date: string | null;
  notes: string | null;
  created_at: string;
}

interface VendorOrderData {
  id: string;
  order_number: string;
  order_date: string;
  due_date: string;
  total_amount: number;
  status: string;
  customer_name: string;
  customer_company: string;
  assignee_name: string;
  vendor_items: { product_name: string; unit_price: number; quantity: number; item_type: string }[] | null;
  vendor_amount: number;
}

type TabType = 'summary' | 'settlements' | 'vendors';

export default function Settlement() {
  const [activeTab, setActiveTab] = useState<TabType>('summary');
  const [summaries, setSummaries] = useState<AssigneeSummary[]>([]);
  const [settlements, setSettlements] = useState<SettlementRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
  const [periodStart, setPeriodStart] = useState(firstDay);
  const [periodEnd, setPeriodEnd] = useState(lastDay);

  const [filterStatus, setFilterStatus] = useState('');
  const [filterAssignee, setFilterAssignee] = useState('');
  const [filterCustomer, setFilterCustomer] = useState('');
  const [filterSettlementAssignee, setFilterSettlementAssignee] = useState('');
  const [filterSettlementCustomer, setFilterSettlementCustomer] = useState('');

  const [allOrders, setAllOrders] = useState<AssigneeOrder[]>([]);

  const [showModal, setShowModal] = useState(false);
  const [modalData, setModalData] = useState({
    assignee_id: '',
    assignee_name: '',
    period_start: firstDay,
    period_end: lastDay,
    commission_rate: '10',
    notes: ''
  });

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState({ commission_rate: '', status: '', notes: '' });

  // 로그 관련 상태
  const [showLogModal, setShowLogModal] = useState(false);
  const [selectedOrderForLog, setSelectedOrderForLog] = useState<AssigneeOrder | null>(null);
  const [orderLogs, setOrderLogs] = useState<OrderEditLog[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);

  // 확장된 주문 목록 (업체 지출내역 드롭다운)
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());

  // 일괄 정산 관련 상태
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [batchData, setBatchData] = useState({
    assignee_id: '',
    assignee_name: '',
    period_start: firstDay,
    period_end: lastDay,
    commission_rate: '10',
    create_settlement_record: true
  });
  const [batchProcessing, setBatchProcessing] = useState(false);

  // 개별 주문 정산 상태 변경 중인 주문 ID
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);

  // 정산내역 탭 내부 서브탭
  const [settlementSubTab, setSettlementSubTab] = useState<'orders' | 'records'>('orders');

  // 업체정산 관련 상태
  const [vendorSummaries, setVendorSummaries] = useState<VendorSummaryData[]>([]);
  const [vendorSettlementList, setVendorSettlementList] = useState<VendorSettlementRecord[]>([]);
  const [vendorOrders, setVendorOrders] = useState<VendorOrderData[]>([]);
  const [selectedVendorId, setSelectedVendorId] = useState<string | null>(null);
  const [expandedVendors, setExpandedVendors] = useState<Set<string>>(new Set());
  const [showVendorSettleModal, setShowVendorSettleModal] = useState(false);
  const [vendorSettleData, setVendorSettleData] = useState({
    vendor_id: '', vendor_name: '', period_start: firstDay, period_end: lastDay, notes: ''
  });
  const [vendorSubTab, setVendorSubTab] = useState<'vendors' | 'records'>('vendors');
  const [vendorSettleProcessing, setVendorSettleProcessing] = useState(false);

  const toggleOrderExpand = (orderId: string) => {
    setExpandedOrders(prev => {
      const newSet = new Set(prev);
      if (newSet.has(orderId)) {
        newSet.delete(orderId);
      } else {
        newSet.add(orderId);
      }
      return newSet;
    });
  };

  const fetchSummary = async () => {
    try {
      const params = periodStart && periodEnd ? `?period_start=${periodStart}&period_end=${periodEnd}` : '';
      const summaryData = await api.get<AssigneeSummary[]>(`/settlement/summary${params}`);
      setSummaries(summaryData);
    } catch {
      setSummaries([]);
    }
  };

  const fetchOrders = async (assigneeOverride?: string) => {
    try {
      const qs: string[] = [];
      if (periodStart && periodEnd) { qs.push(`period_start=${periodStart}`, `period_end=${periodEnd}`); }
      // 현재 활성 탭에 맞는 담당자 필터 사용
      const effectiveAssignee = assigneeOverride !== undefined ? assigneeOverride : (activeTab === 'settlements' ? filterSettlementAssignee : filterAssignee);
      if (effectiveAssignee) qs.push(`assignee_id=${effectiveAssignee}`);
      const orderParams = qs.length > 0 ? `?${qs.join('&')}` : '';
      const ordersData = await api.get<AssigneeOrder[]>(`/settlement/orders${orderParams}`);
      setAllOrders(ordersData);
    } catch {
      setAllOrders([]);
    }
  };

  const fetchSettlements = async () => {
    try {
      const qs: string[] = [];
      if (filterStatus) qs.push(`status=${filterStatus}`);
      if (filterSettlementAssignee) qs.push(`assignee_id=${filterSettlementAssignee}`);
      const params = qs.length > 0 ? '?' + qs.join('&') : '';
      const data = await api.get<SettlementRecord[]>(`/settlement${params}`);
      setSettlements(data);
    } catch { setSettlements([]); }
  };

  const fetchVendorSummary = async () => {
    try {
      const params = periodStart && periodEnd ? `?period_start=${periodStart}&period_end=${periodEnd}` : '';
      const data = await api.get<VendorSummaryData[]>(`/settlement/vendor-summary${params}`);
      setVendorSummaries(data);
    } catch { setVendorSummaries([]); }
  };

  const fetchVendorSettlements = async () => {
    try {
      const data = await api.get<VendorSettlementRecord[]>('/settlement/vendor-settle');
      setVendorSettlementList(data);
    } catch { setVendorSettlementList([]); }
  };

  const fetchVendorOrders = async (vendorId: string) => {
    try {
      const qs = [`vendor_id=${vendorId}`];
      if (periodStart && periodEnd) { qs.push(`period_start=${periodStart}`, `period_end=${periodEnd}`); }
      const data = await api.get<VendorOrderData[]>(`/settlement/vendor-orders?${qs.join('&')}`);
      setVendorOrders(data);
    } catch { setVendorOrders([]); }
  };

  useEffect(() => {
    setLoading(true);
    if (activeTab === 'summary') {
      Promise.all([fetchSummary(), fetchOrders()]).finally(() => setLoading(false));
    } else if (activeTab === 'vendors') {
      Promise.all([fetchVendorSummary(), fetchVendorSettlements()])
        .finally(() => setLoading(false));
    } else {
      // 정산내역 탭: 정산 데이터와 주문 데이터 모두 로드
      Promise.all([fetchSettlements(), fetchSummary(), fetchOrders()]).finally(() => setLoading(false));
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'summary') {
      fetchSummary();
      fetchOrders();
    }
  }, [periodStart, periodEnd, filterAssignee]);

  useEffect(() => {
    if (activeTab === 'settlements') {
      fetchSettlements();
      fetchSummary();
      fetchOrders();
    }
  }, [filterStatus, filterSettlementAssignee, periodStart, periodEnd]);

  useEffect(() => {
    if (activeTab === 'vendors') {
      fetchVendorSummary();
      fetchVendorSettlements();
    }
  }, [periodStart, periodEnd]);

  const handleCreate = async () => {
    try {
      await api.post('/settlement', {
        assignee_id: modalData.assignee_id,
        period_start: modalData.period_start,
        period_end: modalData.period_end,
        commission_rate: parseFloat(modalData.commission_rate) || 0,
        notes: modalData.notes
      });
      setShowModal(false);
      fetchSettlements();
      setActiveTab('settlements');
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleUpdate = async (id: string) => {
    try {
      await api.put(`/settlement/${id}`, {
        commission_rate: editData.commission_rate ? parseFloat(editData.commission_rate) : undefined,
        status: editData.status || undefined,
        settled_date: editData.status === 'completed' ? new Date().toISOString().split('T')[0] : undefined,
        notes: editData.notes
      });
      setEditingId(null);
      fetchSettlements();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('정산 내역을 삭제하시겠습니까?')) return;
    try {
      await api.delete(`/settlement/${id}`);
      fetchSettlements();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const startEdit = (s: SettlementRecord) => {
    setEditingId(s.id);
    setEditData({
      commission_rate: String(s.commission_rate),
      status: s.status,
      notes: s.notes || ''
    });
  };

  // 개별 주문 정산 상태 변경
  const handleOrderSettlementStatus = async (orderId: string, newStatus: 'pending' | 'settled') => {
    setUpdatingOrderId(orderId);
    try {
      await api.put(`/settlement/orders/${orderId}/status`, { settlement_status: newStatus });
      fetchSummary(); fetchOrders();
    } catch (err: any) {
      alert(err.message || '정산 상태 변경 실패');
    } finally {
      setUpdatingOrderId(null);
    }
  };

  // 담당자별 일괄 정산
  const handleBatchSettlement = async () => {
    if (!batchData.assignee_id) {
      alert('담당자를 선택해주세요.');
      return;
    }
    setBatchProcessing(true);
    try {
      const result = await api.post<{ message: string; updated_count: number }>('/settlement/batch', {
        assignee_id: batchData.assignee_id,
        period_start: batchData.period_start,
        period_end: batchData.period_end,
        settlement_status: 'settled',
        commission_rate: parseFloat(batchData.commission_rate) || 10,
        create_settlement_record: batchData.create_settlement_record
      });
      alert(result.message);
      setShowBatchModal(false);
      fetchSummary(); fetchOrders();
      fetchSettlements();
    } catch (err: any) {
      alert(err.message || '일괄 정산 처리 실패');
    } finally {
      setBatchProcessing(false);
    }
  };

  // 업체 정산 처리
  const handleVendorSettle = async () => {
    if (!vendorSettleData.vendor_id) {
      alert('업체를 선택해주세요.');
      return;
    }
    setVendorSettleProcessing(true);
    try {
      await api.post('/settlement/vendor-settle', {
        vendor_id: vendorSettleData.vendor_id,
        period_start: vendorSettleData.period_start,
        period_end: vendorSettleData.period_end,
        notes: vendorSettleData.notes
      });
      setShowVendorSettleModal(false);
      fetchVendorSummary();
      fetchVendorSettlements();
    } catch (err: any) {
      alert(err.message || '업체 정산 처리 실패');
    } finally {
      setVendorSettleProcessing(false);
    }
  };

  const handleDeleteVendorSettle = async (id: string) => {
    if (!confirm('업체 정산 내역을 삭제하시겠습니까?')) return;
    try {
      await api.delete(`/settlement/vendor-settle/${id}`);
      fetchVendorSettlements();
      fetchVendorSummary();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const toggleVendorExpand = async (vendorId: string) => {
    const newSet = new Set(expandedVendors);
    if (newSet.has(vendorId)) {
      newSet.delete(vendorId);
      setSelectedVendorId(null);
    } else {
      newSet.clear();
      newSet.add(vendorId);
      setSelectedVendorId(vendorId);
      await fetchVendorOrders(vendorId);
    }
    setExpandedVendors(newSet);
  };

  // 로그 관련 함수
  const openLogModal = async (order: AssigneeOrder) => {
    setSelectedOrderForLog(order);
    setShowLogModal(true);
    setIsLoadingLogs(true);
    try {
      const logs = await api.get<OrderEditLog[]>(`/sales/orders/${order.id}/logs`);
      setOrderLogs(logs);
    } catch (error) {
      console.error('Failed to load order logs:', error);
      setOrderLogs([]);
    } finally {
      setIsLoadingLogs(false);
    }
  };

  const closeLogModal = () => {
    setShowLogModal(false);
    setSelectedOrderForLog(null);
    setOrderLogs([]);
  };

  const formatLogDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getActionLabel = (action: string) => {
    switch (action) {
      case 'created': return { text: '생성', color: 'bg-green-100 text-green-700' };
      case 'updated': return { text: '수정', color: 'bg-blue-100 text-blue-700' };
      case 'deleted': return { text: '삭제', color: 'bg-red-100 text-red-700' };
      default: return { text: action, color: 'bg-gray-100 text-gray-700' };
    }
  };

  // 환불 관련 로그인지 확인
  const isRefundLog = (log: OrderEditLog) => {
    const refundFieldNames = ['item_refund', 'item_refund_add', 'item_refund_modify', 'vendor_item_refund', 'vendor_item_refund_add', 'vendor_item_refund_modify'];
    if (log.field_name && refundFieldNames.includes(log.field_name)) return true;
    if (log.change_summary && (log.change_summary.includes('환불') || log.change_summary.includes('(환불)'))) return true;
    return false;
  };

  const p = (v: any) => parseFloat(String(v)) || 0;

  // 업체별 엑셀 다운로드
  const downloadVendorExcel = async (vendor: VendorSummaryData) => {
    try {
      const qs = [`vendor_id=${vendor.vendor_id}`];
      if (periodStart) qs.push(`period_start=${periodStart}`);
      if (periodEnd) qs.push(`period_end=${periodEnd}`);
      const orders = await api.get<VendorOrderData[]>(`/settlement/vendor-orders?${qs.join('&')}`);

      const excelData = orders.map(vo => {
        const items = vo.vendor_items && vo.vendor_items.length > 0
          ? vo.vendor_items.map(vi => `${vi.product_name}(${vi.quantity}건)${vi.item_type === 'refund' ? '[환입]' : ''}`).join(', ')
          : '-';
        return {
          '주문번호': vo.order_number,
          '고객사': vo.customer_company || vo.customer_name || '-',
          '담당자': vo.assignee_name || '-',
          '주문일': vo.order_date ? vo.order_date.split('T')[0] : '-',
          '업체 지출금': p(vo.vendor_amount),
          '상품 내역': items
        };
      });

      // 합계 행 추가
      const totalAmount = orders.reduce((sum, vo) => sum + p(vo.vendor_amount), 0);
      excelData.push({
        '주문번호': '',
        '고객사': '',
        '담당자': '',
        '주문일': '합계',
        '업체 지출금': totalAmount,
        '상품 내역': ''
      });

      const ws = XLSX.utils.json_to_sheet(excelData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, '업체정산');

      ws['!cols'] = [
        { wch: 14 },
        { wch: 15 },
        { wch: 10 },
        { wch: 12 },
        { wch: 15 },
        { wch: 30 },
      ];

      const today = new Date().toISOString().split('T')[0];
      XLSX.writeFile(wb, `${vendor.vendor_name}_정산_${today}.xlsx`);
    } catch (error) {
      alert('엑셀 다운로드 실패: ' + (error instanceof Error ? error.message : '알 수 없는 오류'));
    }
  };

  // 엑셀 다운로드 함수 (주문번호별 정산)
  const downloadExcel = () => {
    // 담당자 필터 적용
    const filteredOrders = filterSettlementAssignee
      ? allOrders.filter(o => {
          const assignee = summaries.find(s => s.assignee_name === o.assignee_name);
          return assignee && assignee.assignee_id === filterSettlementAssignee;
        })
      : allOrders;

    const defaultRate = 10;
    const excelData = filteredOrders.map(order => {
      const totalSales = p(order.total_amount);
      const expenses = p(order.vendor_expense) + p(order.incentive_expense);
      const netProfitBefore = totalSales - expenses;
      const commission = Math.round(netProfitBefore * defaultRate / 100);
      const netProfit = netProfitBefore - commission;
      return {
        '담당자': order.assignee_name || '-',
        '부서': order.assignee_department || '-',
        '주문번호': order.order_number,
        '총매출': totalSales,
        '지출금': expenses,
        '순수익': netProfit,
        '수수료율': `${defaultRate}%`,
        '수수료': commission,
        '상태': order.settlement_type === 'confirmed' ? '정산완료' : '미정산',
        '비고': order.customer_company || order.customer_name || '-'
      };
    });

    const ws = XLSX.utils.json_to_sheet(excelData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '정산내역');

    // 컬럼 너비 설정
    ws['!cols'] = [
      { wch: 12 }, // 담당자
      { wch: 10 }, // 부서
      { wch: 12 }, // 주문번호
      { wch: 15 }, // 총매출
      { wch: 15 }, // 지출금
      { wch: 15 }, // 순수익
      { wch: 10 }, // 수수료율
      { wch: 15 }, // 수수료
      { wch: 10 }, // 상태
      { wch: 15 }, // 비고
    ];

    const today = new Date().toISOString().split('T')[0];
    XLSX.writeFile(wb, `정산내역_${today}.xlsx`);
  };
  // 고객사 목록 (드롭다운용)
  const uniqueCustomers = Array.from(
    new Map(
      allOrders
        .filter(o => o.customer_company || o.customer_name)
        .map(o => {
          const name = o.customer_company || o.customer_name || '';
          return [name, name];
        })
    ).values()
  ).sort();

  // 주문 목록 기준 매출/지출 합계 (담당자 + 고객사 필터 적용)
  const filteredOrders = allOrders.filter(o => {
    if (filterAssignee) {
      const assignee = summaries.find(s => s.assignee_name === o.assignee_name);
      if (!assignee || assignee.assignee_id !== filterAssignee) return false;
    }
    if (filterCustomer) {
      const customerName = o.customer_company || o.customer_name || '';
      if (customerName !== filterCustomer) return false;
    }
    return true;
  });

  // 고객사 필터가 활성화된 경우, 해당 주문이 있는 담당자만 표시
  const filteredSummaries = summaries.filter(s => {
    if (filterAssignee && s.assignee_id !== filterAssignee) return false;
    if (filterCustomer) {
      const hasMatchingOrder = allOrders.some(o => {
        const assignee = summaries.find(ss => ss.assignee_name === o.assignee_name);
        if (!assignee || assignee.assignee_id !== s.assignee_id) return false;
        const customerName = o.customer_company || o.customer_name || '';
        return customerName === filterCustomer;
      });
      if (!hasMatchingOrder) return false;
    }
    return true;
  });

  const totalExpectedSales = filteredSummaries.reduce((sum, s) => sum + p(s.expected_sales), 0);
  const totalExpectedExpenses = filteredSummaries.reduce((sum, s) => sum + p(s.expected_expenses), 0);
  const totalExpected = totalExpectedSales - totalExpectedExpenses;
  const totalConfirmedSales = filteredSummaries.reduce((sum, s) => sum + p(s.confirmed_sales), 0);
  const totalConfirmedExpenses = filteredSummaries.reduce((sum, s) => sum + p(s.confirmed_expenses), 0);
  const totalConfirmed = totalConfirmedSales - totalConfirmedExpenses;
  const totalOrderCount = filteredSummaries.reduce((sum, s) => sum + parseInt(String(s.order_count)), 0);
  const totalExpenses = filteredSummaries.reduce((sum, s) => sum + p(s.total_expenses), 0);

  const totalSalesAmount = filteredOrders.reduce((sum, o) => sum + p(o.total_amount), 0);
  const totalVendorExpenses = filteredOrders.reduce((sum, o) => sum + p(o.vendor_expense) + p(o.incentive_expense), 0);

  const getSettlementStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };
  const getSettlementStatusLabel = (status: string) => {
    switch (status) {
      case 'completed': return '정산완료';
      case 'pending': return '미정산';
      default: return status;
    }
  };

  const getOrderStatusLabel = (status: string) => {
    const labels: Record<string, string> = { pending: '대기', processing: '진행중', near_due: '종료임박', completed: '종료' };
    return labels[status] || status;
  };
  const getOrderStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: 'bg-yellow-100 text-yellow-800',
      processing: 'bg-blue-100 text-blue-800',
      near_due: 'bg-orange-100 text-orange-800',
      completed: 'bg-green-100 text-green-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">정산관리</h1>
          <p className="text-sm text-gray-500 mt-1">영업담당자별 매출 정산 관리</p>
        </div>
      </div>

      {/* 탭 */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-8">
          <button
            onClick={() => setActiveTab('summary')}
            className={`py-3 px-1 border-b-2 text-sm font-medium transition-colors ${
              activeTab === 'summary'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <User className="inline-block w-4 h-4 mr-1 -mt-0.5" />
            담당자별 매출현황
          </button>
          <button
            onClick={() => setActiveTab('settlements')}
            className={`py-3 px-1 border-b-2 text-sm font-medium transition-colors ${
              activeTab === 'settlements'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Calculator className="inline-block w-4 h-4 mr-1 -mt-0.5" />
            정산내역
          </button>
          <button
            onClick={() => setActiveTab('vendors')}
            className={`py-3 px-1 border-b-2 text-sm font-medium transition-colors ${
              activeTab === 'vendors'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Store className="inline-block w-4 h-4 mr-1 -mt-0.5" />
            업체정산
          </button>
        </nav>
      </div>

      {/* 담당자별 매출현황 탭 */}
      {activeTab === 'summary' && (
        <div className="space-y-4">
          {/* 기간 필터 */}
          <div className="bg-white rounded-lg shadow-sm border p-4">
            <div className="flex flex-col sm:flex-row sm:flex-wrap items-start sm:items-center gap-3 sm:gap-4">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-gray-400" />
                <span className="text-sm font-medium text-gray-700">조회기간</span>
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <input type="date" value={periodStart} onChange={e => setPeriodStart(e.target.value)} className="border rounded-lg px-3 py-2 text-sm flex-1 sm:flex-none" />
                <span className="text-gray-400">~</span>
                <input type="date" value={periodEnd} onChange={e => setPeriodEnd(e.target.value)} className="border rounded-lg px-3 py-2 text-sm flex-1 sm:flex-none" />
              </div>
              <div className="hidden sm:block border-l pl-4 flex items-center gap-2">
                <User className="w-4 h-4 text-gray-400" />
                <span className="text-sm font-medium text-gray-700">담당자</span>
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <User className="w-4 h-4 text-gray-400 sm:hidden" />
                <select
                  value={filterAssignee}
                  onChange={e => setFilterAssignee(e.target.value)}
                  className="border rounded-lg px-3 py-2 text-sm flex-1 sm:flex-none"
                >
                  <option value="">전체 담당자</option>
                  {summaries.map(s => (
                    <option key={s.assignee_id} value={s.assignee_id}>{s.assignee_name} ({s.department || '-'})</option>
                  ))}
                </select>
              </div>
              <div className="hidden sm:block border-l pl-4 flex items-center gap-2">
                <Building className="w-4 h-4 text-gray-400" />
                <span className="text-sm font-medium text-gray-700">고객사</span>
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Building className="w-4 h-4 text-gray-400 sm:hidden" />
                <select
                  value={filterCustomer}
                  onChange={e => setFilterCustomer(e.target.value)}
                  className="border rounded-lg px-3 py-2 text-sm flex-1 sm:flex-none"
                >
                  <option value="">전체 고객사</option>
                  {uniqueCustomers.map(name => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
                {(filterAssignee || filterCustomer) && (
                  <button onClick={() => { setFilterAssignee(''); setFilterCustomer(''); }} className="text-sm text-red-500 hover:text-red-700 whitespace-nowrap">초기화</button>
                )}
              </div>
            </div>
          </div>

          {/* 요약 카드 */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            <div className="bg-white rounded-lg shadow-sm border p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">영업담당자</p>
                  <p className="text-2xl font-bold text-gray-900">{filteredSummaries.length}명</p>
                </div>
                <User className="w-8 h-8 text-primary-200" />
              </div>
            </div>
            <div className="bg-white rounded-lg shadow-sm border p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">총 주문건수</p>
                  <p className="text-2xl font-bold text-gray-900">{totalOrderCount}건</p>
                </div>
                <Calculator className="w-8 h-8 text-blue-200" />
              </div>
            </div>
            <div className="bg-white rounded-lg shadow-sm border p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">매출합계</p>
                  <p className="text-2xl font-bold text-blue-600">{formatCurrency(totalSalesAmount)}</p>
                </div>
                <Calculator className="w-8 h-8 text-blue-200" />
              </div>
            </div>
            <div className="bg-white rounded-lg shadow-sm border p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">지출합계</p>
                  <p className="text-2xl font-bold text-red-600">{formatCurrency(totalVendorExpenses)}</p>
                </div>
                <TrendingDown className="w-8 h-8 text-red-200" />
              </div>
            </div>
            <div className="bg-white rounded-lg shadow-sm border p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">정산예정금액</p>
                  <p className="text-2xl font-bold text-orange-600">{formatCurrency(totalExpected)}</p>
                </div>
                <Clock className="w-8 h-8 text-orange-200" />
              </div>
            </div>
            <div className="bg-white rounded-lg shadow-sm border p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">정산금액</p>
                  <p className="text-2xl font-bold text-green-600">{formatCurrency(totalConfirmed)}</p>
                </div>
                <Shield className="w-8 h-8 text-green-200" />
              </div>
            </div>
          </div>

          {/* 주문 목록 테이블 */}
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="bg-white rounded-lg shadow-sm border p-12 text-center text-gray-500">
              {filterAssignee ? '선택한 담당자의 주문 내역이 없습니다.' : '해당 기간에 배정된 주문 내역이 없습니다.'}
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-2 py-1.5 text-left text-xs font-medium text-gray-500 w-8"></th>
                      <th className="px-2 py-1.5 text-left text-xs font-medium text-gray-500">담당자</th>
                      <th className="px-2 py-1.5 text-left text-xs font-medium text-gray-500">주문번호</th>
                      <th className="px-2 py-1.5 text-left text-xs font-medium text-gray-500">고객사</th>
                      <th className="px-2 py-1.5 text-left text-xs font-medium text-gray-500">주문일</th>
                      <th className="px-2 py-1.5 text-left text-xs font-medium text-gray-500">마감일</th>
                      <th className="px-2 py-1.5 text-right text-xs font-medium text-gray-500">매출</th>
                      <th className="px-2 py-1.5 text-right text-xs font-medium text-gray-500 bg-red-50">총 지출금</th>
                      <th className="px-2 py-1.5 text-center text-xs font-medium text-gray-500">정산구분</th>
                      <th className="px-2 py-1.5 text-center text-xs font-medium text-gray-500">상태</th>
                      <th className="px-2 py-1.5 text-center text-xs font-medium text-gray-500">로그</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredOrders.map(order => {
                      const vendorItems = order.vendor_items && order.vendor_items.length > 0 ? order.vendor_items : null;
                      const orderItems = order.order_items && order.order_items.length > 0 ? order.order_items : null;
                      const incentiveItems = order.incentive_items && order.incentive_items.length > 0 ? order.incentive_items : null;
                      const isExpanded = expandedOrders.has(order.id);
                      const hasItems = (vendorItems && vendorItems.length > 0) || (orderItems && orderItems.length > 0) || (incentiveItems && incentiveItems.length > 0);
                      return (
                        <React.Fragment key={order.id}>
                          {/* 메인 주문 행 */}
                          <tr
                            className={`hover:bg-gray-50 ${hasItems ? 'cursor-pointer' : ''} ${isExpanded ? 'bg-blue-50' : ''}`}
                            onClick={() => hasItems && toggleOrderExpand(order.id)}
                          >
                            <td className="px-2 py-1.5 text-center">
                              {hasItems && (
                                <span className="text-gray-400">
                                  {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                </span>
                              )}
                            </td>
                            <td className="px-2 py-1.5 text-xs font-medium text-gray-900 whitespace-nowrap">
                              {order.assignee_name}
                              {order.assignee_department && <span className="text-gray-400 ml-0.5">({order.assignee_department})</span>}
                            </td>
                            <td className="px-2 py-1.5 text-xs text-gray-900">{order.order_number}</td>
                            <td className="px-2 py-1.5 text-xs text-gray-900">{order.customer_company || order.customer_name || '-'}</td>
                            <td className="px-2 py-1.5 text-xs text-gray-500 whitespace-nowrap">{order.order_date ? formatDate(order.order_date) : '-'}</td>
                            <td className="px-2 py-1.5 text-xs text-gray-500 whitespace-nowrap">{order.due_date ? formatDate(order.due_date) : '-'}</td>
                            <td className="px-2 py-1.5 text-xs text-right font-medium text-gray-900 whitespace-nowrap">{formatCurrency(p(order.total_amount))}</td>
                            <td className="px-2 py-1.5 text-xs text-right font-medium text-red-600 whitespace-nowrap bg-red-50">
                              {(p(order.vendor_expense) + p(order.incentive_expense)) > 0 ? formatCurrency(p(order.vendor_expense) + p(order.incentive_expense)) : '-'}
                              {vendorItems && vendorItems.length > 0 && <span className="text-gray-400 ml-1">(업체{vendorItems.length})</span>}
                              {order.incentive_items && order.incentive_items.length > 0 && <span className="text-orange-400 ml-1">(인센{order.incentive_items.length})</span>}
                            </td>
                            <td className="px-2 py-1.5 text-center">
                              {order.settlement_type === 'confirmed' ? (
                                <span className="inline-flex px-1.5 py-0.5 text-[10px] font-semibold rounded-full bg-green-100 text-green-800">정산금액</span>
                              ) : (
                                <span className="inline-flex px-1.5 py-0.5 text-[10px] font-semibold rounded-full bg-orange-100 text-orange-800">정산예정</span>
                              )}
                            </td>
                            <td className="px-2 py-1.5 text-center">
                              <span className={`inline-flex px-1.5 py-0.5 text-[10px] font-semibold rounded-full ${getOrderStatusColor(order.status)}`}>
                                {getOrderStatusLabel(order.status)}
                              </span>
                            </td>
                            <td className="px-2 py-1.5 text-center">
                              <button
                                onClick={(e) => { e.stopPropagation(); openLogModal(order); }}
                                className="text-gray-400 hover:text-gray-600"
                                title="수정 내역"
                              >
                                <History className="h-4 w-4" />
                              </button>
                            </td>
                          </tr>
                          {/* 매출/지출 내역 드롭다운 */}
                          {isExpanded && hasItems && (
                            <tr>
                              <td colSpan={11} className="p-0">
                                <div className="border-t border-b border-gray-200">
                                  <div className="grid grid-cols-1 md:grid-cols-3 gap-0">
                                    {/* 매출 내역 (왼쪽) */}
                                    <div className="bg-blue-50 md:border-r border-b md:border-b-0 border-gray-200">
                                      <div className="px-4 py-2">
                                        <div className="text-xs font-medium text-blue-700 mb-2">매출 내역</div>
                                        {orderItems && orderItems.length > 0 ? (
                                          <table className="min-w-full">
                                            <thead>
                                              <tr className="border-b border-blue-200">
                                                <th className="px-2 py-1 text-left text-[10px] font-medium text-blue-600">상품명</th>
                                                <th className="px-2 py-1 text-right text-[10px] font-medium text-blue-600">단가</th>
                                                <th className="px-2 py-1 text-right text-[10px] font-medium text-blue-600">수량</th>
                                                <th className="px-2 py-1 text-right text-[10px] font-medium text-blue-600">합계</th>
                                              </tr>
                                            </thead>
                                            <tbody>
                                              {orderItems.map((item, idx) => {
                                                const isRefund = item.item_type === 'refund';
                                                return (
                                                  <tr key={idx} className="border-b border-blue-100 last:border-b-0">
                                                    <td className="px-2 py-1.5 text-xs text-gray-900">
                                                      {item.item_name || '-'}
                                                      {isRefund && <span className="ml-1 px-1 py-0.5 text-[9px] bg-red-100 text-red-600 rounded">환불</span>}
                                                    </td>
                                                    <td className={`px-2 py-1.5 text-xs text-right font-medium ${isRefund ? 'text-red-600' : 'text-blue-600'}`}>
                                                      {isRefund && '-'}{formatCurrency(p(item.unit_price))}
                                                    </td>
                                                    <td className="px-2 py-1.5 text-xs text-right text-gray-900">{item.quantity || 0}건</td>
                                                    <td className={`px-2 py-1.5 text-xs text-right font-medium ${isRefund ? 'text-red-600' : 'text-blue-600'}`}>
                                                      {isRefund && '-'}{formatCurrency(p(item.unit_price) * (item.quantity || 0))}
                                                    </td>
                                                  </tr>
                                                );
                                              })}
                                            </tbody>
                                            <tfoot className="border-t border-blue-300 bg-blue-100">
                                              <tr>
                                                <td colSpan={3} className="px-2 py-1.5 text-xs text-right font-bold text-blue-700">매출 합계</td>
                                                <td className="px-2 py-1.5 text-xs text-right font-bold text-blue-700">
                                                  {formatCurrency(orderItems.reduce((sum, item) => {
                                                    const amount = p(item.unit_price) * (item.quantity || 0);
                                                    return item.item_type === 'refund' ? sum - amount : sum + amount;
                                                  }, 0))}
                                                </td>
                                              </tr>
                                            </tfoot>
                                          </table>
                                        ) : (
                                          <div className="text-xs text-gray-400 text-center py-4">매출 내역이 없습니다.</div>
                                        )}
                                      </div>
                                    </div>
                                    {/* 지출 내역 (오른쪽) */}
                                    <div className="bg-red-50">
                                      <div className="px-4 py-2">
                                        <div className="text-xs font-medium text-red-700 mb-2">지출 내역</div>
                                        {vendorItems && vendorItems.length > 0 ? (
                                          <table className="min-w-full">
                                            <thead>
                                              <tr className="border-b border-red-200">
                                                <th className="px-2 py-1 text-left text-[10px] font-medium text-red-600">업체명</th>
                                                <th className="px-2 py-1 text-left text-[10px] font-medium text-red-600">상품명</th>
                                                <th className="px-2 py-1 text-right text-[10px] font-medium text-red-600">단가</th>
                                                <th className="px-2 py-1 text-right text-[10px] font-medium text-red-600">수량</th>
                                                <th className="px-2 py-1 text-right text-[10px] font-medium text-red-600">합계</th>
                                              </tr>
                                            </thead>
                                            <tbody>
                                              {vendorItems.map((vi, idx) => {
                                                const isRefund = vi.item_type === 'refund';
                                                return (
                                                  <tr key={idx} className="border-b border-red-100 last:border-b-0">
                                                    <td className="px-2 py-1.5 text-xs text-gray-900">{vi.vendor_name || '-'}</td>
                                                    <td className="px-2 py-1.5 text-xs text-gray-900">
                                                      {vi.product_name || '-'}
                                                      {isRefund && <span className="ml-1 px-1 py-0.5 text-[9px] bg-green-100 text-green-600 rounded">환입</span>}
                                                    </td>
                                                    <td className={`px-2 py-1.5 text-xs text-right font-medium ${isRefund ? 'text-green-600' : 'text-red-600'}`}>
                                                      {isRefund && '+'}{formatCurrency(p(vi.unit_price))}
                                                    </td>
                                                    <td className="px-2 py-1.5 text-xs text-right text-gray-900">{vi.quantity || 0}건</td>
                                                    <td className={`px-2 py-1.5 text-xs text-right font-medium ${isRefund ? 'text-green-600' : 'text-red-600'}`}>
                                                      {isRefund && '+'}{formatCurrency(p(vi.unit_price) * (vi.quantity || 0))}
                                                    </td>
                                                  </tr>
                                                );
                                              })}
                                            </tbody>
                                            <tfoot className="border-t border-red-300 bg-red-100">
                                              <tr>
                                                <td colSpan={4} className="px-2 py-1.5 text-xs text-right font-bold text-red-700">지출 합계</td>
                                                <td className="px-2 py-1.5 text-xs text-right font-bold text-red-700">
                                                  {formatCurrency(vendorItems.reduce((sum, vi) => {
                                                    const amount = p(vi.unit_price) * (vi.quantity || 0);
                                                    return vi.item_type === 'refund' ? sum - amount : sum + amount;
                                                  }, 0))}
                                                </td>
                                              </tr>
                                            </tfoot>
                                          </table>
                                        ) : (
                                          <div className="text-xs text-gray-400 text-center py-4">지출 내역이 없습니다.</div>
                                        )}
                                      </div>
                                    </div>
                                    {/* 인센티브 내역 */}
                                    <div className="bg-orange-50 md:border-l border-t md:border-t-0 border-gray-200">
                                      <div className="px-4 py-2">
                                        <div className="text-xs font-medium text-orange-700 mb-2">인센티브</div>
                                        {incentiveItems && incentiveItems.length > 0 ? (
                                          <table className="min-w-full">
                                            <thead>
                                              <tr className="border-b border-orange-200">
                                                <th className="px-2 py-1 text-left text-[10px] font-medium text-orange-600">직원</th>
                                                <th className="px-2 py-1 text-left text-[10px] font-medium text-orange-600">정책</th>
                                                <th className="px-2 py-1 text-right text-[10px] font-medium text-orange-600">금액</th>
                                                <th className="px-2 py-1 text-right text-[10px] font-medium text-orange-600">수량</th>
                                                <th className="px-2 py-1 text-right text-[10px] font-medium text-orange-600">합계</th>
                                              </tr>
                                            </thead>
                                            <tbody>
                                              {incentiveItems.map((inc, idx) => (
                                                <tr key={idx} className="border-b border-orange-100 last:border-b-0">
                                                  <td className="px-2 py-1.5 text-xs text-gray-900">{inc.employee_name || '-'}</td>
                                                  <td className="px-2 py-1.5 text-xs text-gray-900">{inc.policy_name || '직접입력'}</td>
                                                  <td className="px-2 py-1.5 text-xs text-right font-medium text-orange-600">{formatCurrency(p(inc.amount))}</td>
                                                  <td className="px-2 py-1.5 text-xs text-right text-gray-900">{inc.quantity || 1}건</td>
                                                  <td className="px-2 py-1.5 text-xs text-right font-medium text-orange-600">{formatCurrency(p(inc.amount) * (inc.quantity || 1))}</td>
                                                </tr>
                                              ))}
                                            </tbody>
                                            <tfoot className="border-t border-orange-300 bg-orange-100">
                                              <tr>
                                                <td colSpan={4} className="px-2 py-1.5 text-xs text-right font-bold text-orange-700">인센티브 합계</td>
                                                <td className="px-2 py-1.5 text-xs text-right font-bold text-orange-700">
                                                  {formatCurrency(incentiveItems.reduce((sum, inc) => sum + p(inc.amount) * (inc.quantity || 1), 0))}
                                                </td>
                                              </tr>
                                            </tfoot>
                                          </table>
                                        ) : (
                                          <div className="text-xs text-gray-400 text-center py-4">인센티브 내역이 없습니다.</div>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                  {/* 합산금액 (매출 - 지출 - 인센티브) */}
                                  {(() => {
                                    const salesTotal = orderItems ? orderItems.reduce((sum, item) => {
                                      const amount = p(item.unit_price) * (item.quantity || 0);
                                      return item.item_type === 'refund' ? sum - amount : sum + amount;
                                    }, 0) : 0;
                                    const expenseTotal = vendorItems ? vendorItems.reduce((sum, vi) => {
                                      const amount = p(vi.unit_price) * (vi.quantity || 0);
                                      return vi.item_type === 'refund' ? sum - amount : sum + amount;
                                    }, 0) : 0;
                                    const incentiveTotal = incentiveItems ? incentiveItems.reduce((sum, inc) => sum + p(inc.amount) * (inc.quantity || 1), 0) : 0;
                                    const netTotal = salesTotal - expenseTotal - incentiveTotal;
                                    return (
                                      <div className="bg-gray-100 border-t border-gray-300 px-4 py-3">
                                        <div className="flex items-center justify-end gap-4 text-sm flex-wrap">
                                          <span className="text-gray-600">매출</span>
                                          <span className="font-bold text-blue-600">{formatCurrency(salesTotal)}</span>
                                          <span className="text-gray-400">-</span>
                                          <span className="text-gray-600">업체지출</span>
                                          <span className="font-bold text-red-600">{formatCurrency(expenseTotal)}</span>
                                          {incentiveTotal > 0 && (<>
                                            <span className="text-gray-400">-</span>
                                            <span className="text-gray-600">인센티브</span>
                                            <span className="font-bold text-orange-600">{formatCurrency(incentiveTotal)}</span>
                                          </>)}
                                          <span className="text-gray-400">=</span>
                                          <span className="text-gray-600">합산금액</span>
                                          <span className={`font-bold text-lg ${netTotal >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                            {formatCurrency(netTotal)}
                                          </span>
                                        </div>
                                      </div>
                                    );
                                  })()}
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                  {/* 합계 행 */}
                  <tfoot className="bg-gray-100 border-t-2 border-gray-300">
                    <tr>
                      <td className="px-2 py-2"></td>
                      <td colSpan={5} className="px-2 py-2 text-xs font-bold text-gray-900 text-right">합계</td>
                      <td className="px-2 py-2 text-xs text-right font-bold text-blue-600 whitespace-nowrap">{formatCurrency(totalSalesAmount)}</td>
                      <td className="px-2 py-2 text-xs text-right font-bold text-red-600 whitespace-nowrap bg-red-100">{formatCurrency(totalVendorExpenses)}</td>
                      <td colSpan={3}></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 정산내역 탭 */}
      {activeTab === 'settlements' && (() => {
        // 담당자 목록 (summaries 기준)
        const uniqueAssignees = Array.from(new Map(summaries.map(s => [s.assignee_id, { id: s.assignee_id, name: s.assignee_name, department: s.department }])).values());

        // 담당자 + 고객사 필터 적용한 주문 목록
        const filteredOrders = allOrders.filter(o => {
          if (filterSettlementAssignee) {
            const assignee = summaries.find(s => s.assignee_name === o.assignee_name);
            if (!assignee || assignee.assignee_id !== filterSettlementAssignee) return false;
          }
          if (filterSettlementCustomer) {
            const customerName = o.customer_company || o.customer_name || '';
            if (customerName !== filterSettlementCustomer) return false;
          }
          return true;
        });

        // 기본 수수료율 (10%)
        const defaultCommissionRate = 10;

        // 주문 데이터 기준으로 합계 계산
        const stlTotal = filteredOrders.reduce((s, o) => s + p(o.total_amount), 0);
        const stlExpenses = filteredOrders.reduce((s, o) => s + p(o.vendor_expense) + p(o.incentive_expense), 0);
        const stlNetProfitBeforeComm = stlTotal - stlExpenses;
        const stlCommission = Math.round(stlNetProfitBeforeComm * defaultCommissionRate / 100);
        const stlNetProfit = stlNetProfitBeforeComm - stlCommission;

        // 정산 현황 계산
        const settledOrders = filteredOrders.filter(o => o.settlement_status === 'settled');
        const pendingOrders = filteredOrders.filter(o => o.settlement_status !== 'settled');

        return (
        <div className="space-y-4">
          {/* 필터 + 액션 버튼 */}
          <div className="bg-white rounded-lg shadow-sm border p-4">
            <div className="flex flex-col lg:flex-row lg:flex-wrap items-start lg:items-center gap-3 lg:gap-4">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-gray-400" />
                <span className="text-sm font-medium text-gray-700">기간</span>
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <input type="date" value={periodStart} onChange={e => setPeriodStart(e.target.value)} className="border rounded-lg px-3 py-2 text-sm flex-1 sm:flex-none" />
                <span className="text-gray-400">~</span>
                <input type="date" value={periodEnd} onChange={e => setPeriodEnd(e.target.value)} className="border rounded-lg px-3 py-2 text-sm flex-1 sm:flex-none" />
              </div>
              <div className="hidden lg:flex border-l pl-4 items-center gap-2">
                <User className="w-4 h-4 text-gray-400" />
                <span className="text-sm font-medium text-gray-700">담당자</span>
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <User className="w-4 h-4 text-gray-400 lg:hidden" />
                <select
                  value={filterSettlementAssignee}
                  onChange={e => setFilterSettlementAssignee(e.target.value)}
                  className="border rounded-lg px-3 py-2 text-sm flex-1 sm:flex-none"
                >
                  <option value="">전체 담당자</option>
                  {uniqueAssignees.map(a => (
                    <option key={a.id} value={a.id}>{a.name} ({a.department || '-'})</option>
                  ))}
                </select>
              </div>
              <div className="hidden lg:flex border-l pl-4 items-center gap-2">
                <Building className="w-4 h-4 text-gray-400" />
                <span className="text-sm font-medium text-gray-700">고객사</span>
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Building className="w-4 h-4 text-gray-400 lg:hidden" />
                <select
                  value={filterSettlementCustomer}
                  onChange={e => setFilterSettlementCustomer(e.target.value)}
                  className="border rounded-lg px-3 py-2 text-sm flex-1 sm:flex-none"
                >
                  <option value="">전체 고객사</option>
                  {uniqueCustomers.map(name => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
                {(filterSettlementAssignee || filterSettlementCustomer) && (
                  <button onClick={() => { setFilterSettlementAssignee(''); setFilterSettlementCustomer(''); }} className="text-sm text-red-500 hover:text-red-700 whitespace-nowrap">초기화</button>
                )}
              </div>
              <div className="w-full lg:w-auto lg:border-l lg:pl-4 lg:ml-auto flex flex-wrap items-center gap-2 pt-3 lg:pt-0 border-t lg:border-t-0">
                <button
                  onClick={() => {
                    setBatchData({
                      ...batchData,
                      assignee_id: filterSettlementAssignee,
                      assignee_name: uniqueAssignees.find(a => a.id === filterSettlementAssignee)?.name || '',
                      period_start: periodStart,
                      period_end: periodEnd
                    });
                    setShowBatchModal(true);
                  }}
                  className="flex items-center gap-1 px-3 py-2 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 flex-1 sm:flex-none justify-center"
                >
                  <Zap className="w-4 h-4" />
                  <span className="hidden sm:inline">일괄 정산</span>
                  <span className="sm:hidden">일괄</span>
                </button>
                <button
                  onClick={() => setShowModal(true)}
                  className="flex items-center gap-1 px-3 py-2 bg-primary-600 text-white text-sm rounded-lg hover:bg-primary-700 flex-1 sm:flex-none justify-center"
                >
                  <Plus className="w-4 h-4" />
                  <span className="hidden sm:inline">정산 레코드 생성</span>
                  <span className="sm:hidden">생성</span>
                </button>
                <button
                  onClick={downloadExcel}
                  className="flex items-center gap-1 px-3 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 flex-1 sm:flex-none justify-center"
                >
                  <Download className="w-4 h-4" />
                  <span className="hidden sm:inline">엑셀 다운로드</span>
                  <span className="sm:hidden">엑셀</span>
                </button>
              </div>
            </div>
          </div>

          {/* 요약 카드 */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            <div className="bg-white rounded-lg shadow-sm border p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">총매출</p>
                  <p className="text-2xl font-bold text-green-600">{formatCurrency(stlTotal)}</p>
                </div>
                <Shield className="w-8 h-8 text-green-200" />
              </div>
            </div>
            <div className="bg-white rounded-lg shadow-sm border p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">총지출</p>
                  <p className="text-2xl font-bold text-red-600">{formatCurrency(stlExpenses)}</p>
                </div>
                <TrendingDown className="w-8 h-8 text-red-200" />
              </div>
            </div>
            <div className="bg-white rounded-lg shadow-sm border p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">순수익</p>
                  <p className="text-2xl font-bold text-blue-600">{formatCurrency(stlNetProfit)}</p>
                </div>
                <Calculator className="w-8 h-8 text-blue-200" />
              </div>
            </div>
            <div className="bg-white rounded-lg shadow-sm border p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">수수료</p>
                  <p className="text-2xl font-bold text-orange-600">{formatCurrency(stlCommission)}</p>
                </div>
                <Clock className="w-8 h-8 text-orange-200" />
              </div>
            </div>
            <div className="bg-white rounded-lg shadow-sm border p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">정산완료</p>
                  <p className="text-2xl font-bold text-green-600">{settledOrders.length}건</p>
                </div>
                <CheckCircle className="w-8 h-8 text-green-200" />
              </div>
            </div>
            <div className="bg-white rounded-lg shadow-sm border p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">미정산</p>
                  <p className="text-2xl font-bold text-yellow-600">{pendingOrders.length}건</p>
                </div>
                <Clock className="w-8 h-8 text-yellow-200" />
              </div>
            </div>
          </div>

          {/* 서브탭 */}
          <div className="border-b border-gray-200">
            <nav className="flex space-x-4">
              <button
                onClick={() => setSettlementSubTab('orders')}
                className={`py-2 px-3 text-sm font-medium border-b-2 transition-colors ${
                  settlementSubTab === 'orders'
                    ? 'border-primary-500 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <FileText className="inline-block w-4 h-4 mr-1 -mt-0.5" />
                주문별 정산 ({filteredOrders.length})
              </button>
              <button
                onClick={() => setSettlementSubTab('records')}
                className={`py-2 px-3 text-sm font-medium border-b-2 transition-colors ${
                  settlementSubTab === 'records'
                    ? 'border-primary-500 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <Calculator className="inline-block w-4 h-4 mr-1 -mt-0.5" />
                정산 레코드 ({settlements.length})
              </button>
            </nav>
          </div>

          {/* 주문별 정산 테이블 */}
          {settlementSubTab === 'orders' && (
            loading ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
              </div>
            ) : filteredOrders.length === 0 ? (
              <div className="bg-white rounded-lg shadow-sm border p-12 text-center text-gray-500">
                해당 기간에 주문 내역이 없습니다.
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">담당자</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">주문번호</th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">총매출</th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">지출금</th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">순수익</th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">수수료</th>
                        <th className="px-3 py-2 text-center text-xs font-medium text-gray-500">마감구분</th>
                        <th className="px-3 py-2 text-center text-xs font-medium text-gray-500">정산상태</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">비고</th>
                        <th className="px-3 py-2 text-center text-xs font-medium text-gray-500">액션</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {filteredOrders.map((order) => {
                        const totalSales = p(order.total_amount);
                        const expenses = p(order.vendor_expense) + p(order.incentive_expense);
                        const netProfitBefore = totalSales - expenses;
                        const commission = Math.round(netProfitBefore * defaultCommissionRate / 100);
                        const netProfit = netProfitBefore - commission;
                        const isSettled = order.settlement_status === 'settled';
                        const isUpdating = updatingOrderId === order.id;
                        return (
                        <tr key={order.id} className={`hover:bg-gray-50 ${isSettled ? 'bg-green-50' : ''}`}>
                          <td className="px-3 py-2 text-sm font-medium text-gray-900 whitespace-nowrap">
                            {order.assignee_name || '-'}
                            {order.assignee_department && <span className="text-gray-400 ml-1">({order.assignee_department})</span>}
                          </td>
                          <td className="px-3 py-2 text-sm text-gray-900 whitespace-nowrap">
                            {order.order_number}
                          </td>
                          <td className="px-3 py-2 text-sm text-right font-medium text-gray-900 whitespace-nowrap">{formatCurrency(totalSales)}</td>
                          <td className="px-3 py-2 text-sm text-right font-medium text-red-600 whitespace-nowrap">{expenses > 0 ? formatCurrency(expenses) : '-'}</td>
                          <td className="px-3 py-2 text-sm text-right font-medium text-blue-600 whitespace-nowrap">{formatCurrency(netProfit)}</td>
                          <td className="px-3 py-2 text-sm text-right font-medium text-orange-600 whitespace-nowrap">{formatCurrency(commission)}</td>
                          <td className="px-3 py-2 text-center">
                            <span className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded-full ${
                              order.settlement_type === 'confirmed' ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-800'
                            }`}>
                              {order.settlement_type === 'confirmed' ? '마감완료' : '마감전'}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-center">
                            <div className="flex flex-col items-center gap-0.5">
                              <span className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded-full ${
                                isSettled ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                              }`}>
                                {isSettled ? '정산완료' : '미정산'}
                              </span>
                              {order.settlement_id && (
                                <span className="text-[10px] text-blue-500">레코드 연결</span>
                              )}
                            </div>
                          </td>
                          <td className="px-3 py-2 text-sm text-gray-500">{order.customer_company || order.customer_name || '-'}</td>
                          <td className="px-3 py-2 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => handleOrderSettlementStatus(order.id, isSettled ? 'pending' : 'settled')}
                                disabled={isUpdating}
                                className={`p-1.5 rounded-lg transition-colors ${
                                  isUpdating ? 'bg-gray-100 cursor-not-allowed' :
                                  isSettled ? 'bg-yellow-100 hover:bg-yellow-200 text-yellow-700' : 'bg-green-100 hover:bg-green-200 text-green-700'
                                }`}
                                title={isSettled ? '미정산으로 변경' : '정산완료로 변경'}
                              >
                                {isUpdating ? (
                                  <RefreshCw className="h-4 w-4 animate-spin" />
                                ) : isSettled ? (
                                  <X className="h-4 w-4" />
                                ) : (
                                  <Check className="h-4 w-4" />
                                )}
                              </button>
                              <button onClick={() => openLogModal(order)} className="p-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600" title="수정 내역">
                                <History className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                        );
                      })}
                    </tbody>
                    {/* 합계 행 */}
                    <tfoot className="bg-gray-100 border-t-2 border-gray-300">
                      <tr>
                        <td colSpan={2} className="px-3 py-2 text-sm font-bold text-gray-900 text-right">합계</td>
                        <td className="px-3 py-2 text-sm text-right font-bold text-gray-900 whitespace-nowrap">{formatCurrency(stlTotal)}</td>
                        <td className="px-3 py-2 text-sm text-right font-bold text-red-600 whitespace-nowrap">{formatCurrency(stlExpenses)}</td>
                        <td className="px-3 py-2 text-sm text-right font-bold text-blue-600 whitespace-nowrap">{formatCurrency(stlNetProfit)}</td>
                        <td className="px-3 py-2 text-sm text-right font-bold text-orange-600 whitespace-nowrap">{formatCurrency(stlCommission)}</td>
                        <td colSpan={4}></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )
          )}

          {/* 정산 레코드 테이블 */}
          {settlementSubTab === 'records' && (
            loading ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
              </div>
            ) : settlements.length === 0 ? (
              <div className="bg-white rounded-lg shadow-sm border p-12 text-center text-gray-500">
                <Calculator className="mx-auto h-12 w-12 text-gray-300 mb-4" />
                <p>저장된 정산 레코드가 없습니다.</p>
                <p className="text-sm text-gray-400 mt-1">상단의 '정산 레코드 생성' 버튼 또는 '일괄 정산'을 통해 정산 레코드를 생성할 수 있습니다.</p>
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">담당자</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">기간</th>
                        <th className="px-3 py-2 text-center text-xs font-medium text-gray-500">연결 주문</th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">총매출</th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">총지출</th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">수수료율</th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">수수료</th>
                        <th className="px-3 py-2 text-center text-xs font-medium text-gray-500">상태</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">정산일</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">비고</th>
                        <th className="px-3 py-2 text-center text-xs font-medium text-gray-500">액션</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {settlements.map((s) => (
                        <tr key={s.id} className="hover:bg-gray-50">
                          {editingId === s.id ? (
                            <>
                              <td className="px-3 py-2 text-sm font-medium text-gray-900">{s.assignee_name}</td>
                              <td className="px-3 py-2 text-sm text-gray-500">{formatDate(s.period_start)} ~ {formatDate(s.period_end)}</td>
                              <td className="px-3 py-2 text-sm text-center">
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                  {s.linked_order_count || 0}건
                                </span>
                              </td>
                              <td className="px-3 py-2 text-sm text-right font-medium text-gray-900">{formatCurrency(p(s.total_sales))}</td>
                              <td className="px-3 py-2 text-sm text-right font-medium text-red-600">{formatCurrency(p(s.total_expenses))}</td>
                              <td className="px-3 py-2">
                                <input
                                  type="number"
                                  value={editData.commission_rate}
                                  onChange={e => setEditData({ ...editData, commission_rate: e.target.value })}
                                  className="w-16 border rounded px-2 py-1 text-sm text-right"
                                  step="0.1"
                                  min="0"
                                  max="100"
                                />
                              </td>
                              <td className="px-3 py-2 text-sm text-right font-medium text-orange-600">
                                {formatCurrency(Math.round((p(s.total_sales) - p(s.total_expenses)) * (parseFloat(editData.commission_rate) || 0) / 100))}
                              </td>
                              <td className="px-3 py-2">
                                <select
                                  value={editData.status}
                                  onChange={e => setEditData({ ...editData, status: e.target.value })}
                                  className="border rounded px-2 py-1 text-sm"
                                >
                                  <option value="pending">미정산</option>
                                  <option value="completed">정산완료</option>
                                </select>
                              </td>
                              <td className="px-3 py-2 text-sm text-gray-500">{s.settled_date ? formatDate(s.settled_date) : '-'}</td>
                              <td className="px-3 py-2">
                                <input
                                  type="text"
                                  value={editData.notes}
                                  onChange={e => setEditData({ ...editData, notes: e.target.value })}
                                  className="w-full border rounded px-2 py-1 text-sm"
                                  placeholder="비고"
                                />
                              </td>
                              <td className="px-3 py-2 text-center">
                                <div className="flex items-center justify-center gap-1">
                                  <button
                                    onClick={() => handleUpdate(s.id)}
                                    className="p-1.5 rounded-lg bg-green-100 hover:bg-green-200 text-green-700"
                                    title="저장"
                                  >
                                    <Save className="h-4 w-4" />
                                  </button>
                                  <button
                                    onClick={() => setEditingId(null)}
                                    className="p-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600"
                                    title="취소"
                                  >
                                    <X className="h-4 w-4" />
                                  </button>
                                </div>
                              </td>
                            </>
                          ) : (
                            <>
                              <td className="px-3 py-2 text-sm font-medium text-gray-900">
                                {s.assignee_name}
                                {s.department && <span className="text-gray-400 ml-1">({s.department})</span>}
                              </td>
                              <td className="px-3 py-2 text-sm text-gray-500">{formatDate(s.period_start)} ~ {formatDate(s.period_end)}</td>
                              <td className="px-3 py-2 text-sm text-center">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                  (s.linked_order_count || 0) > 0 ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-500'
                                }`}>
                                  {s.linked_order_count || 0}건
                                </span>
                              </td>
                              <td className="px-3 py-2 text-sm text-right font-medium text-gray-900">{formatCurrency(p(s.total_sales))}</td>
                              <td className="px-3 py-2 text-sm text-right font-medium text-red-600">{formatCurrency(p(s.total_expenses))}</td>
                              <td className="px-3 py-2 text-sm text-right text-gray-500">{s.commission_rate}%</td>
                              <td className="px-3 py-2 text-sm text-right font-medium text-orange-600">{formatCurrency(p(s.commission_amount))}</td>
                              <td className="px-3 py-2 text-center">
                                <span className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded-full ${getSettlementStatusColor(s.status)}`}>
                                  {getSettlementStatusLabel(s.status)}
                                </span>
                              </td>
                              <td className="px-3 py-2 text-sm text-gray-500">{s.settled_date ? formatDate(s.settled_date) : '-'}</td>
                              <td className="px-3 py-2 text-sm text-gray-500">{s.notes || '-'}</td>
                              <td className="px-3 py-2 text-center">
                                <div className="flex items-center justify-center gap-1">
                                  <button
                                    onClick={() => startEdit(s)}
                                    className="p-1.5 rounded-lg bg-blue-100 hover:bg-blue-200 text-blue-700"
                                    title="수정"
                                  >
                                    <Edit2 className="h-4 w-4" />
                                  </button>
                                  <button
                                    onClick={() => handleDelete(s.id)}
                                    className="p-1.5 rounded-lg bg-red-100 hover:bg-red-200 text-red-700"
                                    title="삭제"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                </div>
                              </td>
                            </>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          )}
        </div>
        );
      })()}

      {/* 업체정산 탭 */}
      {activeTab === 'vendors' && (() => {
        const totalVendorAmount = vendorSummaries.reduce((sum, v) => sum + p(v.net_amount), 0);
        const totalSettledAmount = vendorSummaries.reduce((sum, v) => sum + p(v.settled_amount), 0);
        const totalUnsettled = totalVendorAmount - totalSettledAmount;
        return (
        <div className="space-y-4">
          {/* 기간 필터 */}
          <div className="bg-white rounded-lg shadow-sm border p-4">
            <div className="flex flex-col sm:flex-row sm:flex-wrap items-start sm:items-center gap-3 sm:gap-4">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-gray-400" />
                <span className="text-sm font-medium text-gray-700">조회기간</span>
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <input type="date" value={periodStart} onChange={e => setPeriodStart(e.target.value)} className="border rounded-lg px-3 py-2 text-sm flex-1 sm:flex-none" />
                <span className="text-gray-400">~</span>
                <input type="date" value={periodEnd} onChange={e => setPeriodEnd(e.target.value)} className="border rounded-lg px-3 py-2 text-sm flex-1 sm:flex-none" />
              </div>
            </div>
          </div>

          {/* 요약 카드 */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white rounded-lg shadow-sm border p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">총 업체수</p>
                  <p className="text-2xl font-bold text-gray-900">{vendorSummaries.length}개</p>
                </div>
                <Store className="w-8 h-8 text-primary-200" />
              </div>
            </div>
            <div className="bg-white rounded-lg shadow-sm border p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">총 지출금</p>
                  <p className="text-2xl font-bold text-red-600">{formatCurrency(totalVendorAmount)}</p>
                </div>
                <TrendingDown className="w-8 h-8 text-red-200" />
              </div>
            </div>
            <div className="bg-white rounded-lg shadow-sm border p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">정산완료</p>
                  <p className="text-2xl font-bold text-green-600">{formatCurrency(totalSettledAmount)}</p>
                </div>
                <CheckCircle className="w-8 h-8 text-green-200" />
              </div>
            </div>
            <div className="bg-white rounded-lg shadow-sm border p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">미정산</p>
                  <p className="text-2xl font-bold text-orange-600">{formatCurrency(totalUnsettled)}</p>
                </div>
                <Clock className="w-8 h-8 text-orange-200" />
              </div>
            </div>
          </div>

          {/* 서브탭 */}
          <div className="border-b border-gray-200">
            <nav className="flex space-x-4">
              <button
                onClick={() => setVendorSubTab('vendors')}
                className={`py-2 px-3 text-sm font-medium border-b-2 transition-colors ${
                  vendorSubTab === 'vendors'
                    ? 'border-primary-500 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <Store className="inline-block w-4 h-4 mr-1 -mt-0.5" />
                업체별 현황 ({vendorSummaries.length})
              </button>
              <button
                onClick={() => setVendorSubTab('records')}
                className={`py-2 px-3 text-sm font-medium border-b-2 transition-colors ${
                  vendorSubTab === 'records'
                    ? 'border-primary-500 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <Calculator className="inline-block w-4 h-4 mr-1 -mt-0.5" />
                정산 레코드 ({vendorSettlementList.length})
              </button>
            </nav>
          </div>

          {/* 업체별 현황 */}
          {vendorSubTab === 'vendors' && (
            loading ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
              </div>
            ) : vendorSummaries.length === 0 ? (
              <div className="bg-white rounded-lg shadow-sm border p-12 text-center text-gray-500">
                해당 기간에 업체 상품 내역이 없습니다.
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 w-8"></th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">업체명</th>
                        <th className="px-3 py-2 text-center text-xs font-medium text-gray-500">주문건수</th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">지출금</th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">환입금</th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">순 지출금</th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">정산완료액</th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">미정산액</th>
                        <th className="px-3 py-2 text-center text-xs font-medium text-gray-500">액션</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {vendorSummaries.map(vendor => {
                        const isExpanded = expandedVendors.has(vendor.vendor_id);
                        const unsettled = p(vendor.net_amount) - p(vendor.settled_amount);
                        return (
                          <React.Fragment key={vendor.vendor_id}>
                            <tr className={`hover:bg-gray-50 ${isExpanded ? 'bg-blue-50' : ''}`}>
                              <td className="px-2 py-2 text-center">
                                <button onClick={() => toggleVendorExpand(vendor.vendor_id)} className="text-gray-400 hover:text-gray-600">
                                  {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                </button>
                              </td>
                              <td className="px-3 py-2 text-sm font-medium text-gray-900">{vendor.vendor_name}</td>
                              <td className="px-3 py-2 text-sm text-center text-gray-900">{vendor.order_count}건</td>
                              <td className="px-3 py-2 text-sm text-right font-medium text-red-600">{formatCurrency(p(vendor.total_amount))}</td>
                              <td className="px-3 py-2 text-sm text-right font-medium text-green-600">
                                {p(vendor.total_refund) > 0 ? formatCurrency(p(vendor.total_refund)) : '-'}
                              </td>
                              <td className="px-3 py-2 text-sm text-right font-bold text-gray-900">{formatCurrency(p(vendor.net_amount))}</td>
                              <td className="px-3 py-2 text-sm text-right font-medium text-green-600">{formatCurrency(p(vendor.settled_amount))}</td>
                              <td className="px-3 py-2 text-sm text-right font-medium text-orange-600">
                                {unsettled > 0 ? formatCurrency(unsettled) : <span className="text-green-600">완료</span>}
                              </td>
                              <td className="px-3 py-2 text-center">
                                <div className="flex items-center justify-center gap-1">
                                  <button
                                    onClick={() => downloadVendorExcel(vendor)}
                                    className="p-1.5 rounded-lg bg-blue-100 hover:bg-blue-200 text-blue-700"
                                    title="엑셀 다운로드"
                                  >
                                    <Download className="h-4 w-4" />
                                  </button>
                                  <button
                                    onClick={() => {
                                      setVendorSettleData({
                                        vendor_id: vendor.vendor_id,
                                        vendor_name: vendor.vendor_name,
                                        period_start: periodStart,
                                        period_end: periodEnd,
                                        notes: ''
                                      });
                                      setShowVendorSettleModal(true);
                                    }}
                                    className="p-1.5 rounded-lg bg-green-100 hover:bg-green-200 text-green-700"
                                    title="정산 처리"
                                  >
                                    <Check className="h-4 w-4" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                            {/* 업체 주문 상세 */}
                            {isExpanded && (
                              <tr>
                                <td colSpan={9} className="p-0">
                                  <div className="bg-gray-50 border-t border-b border-gray-200 p-4">
                                    <div className="text-xs font-medium text-gray-700 mb-3">
                                      <Store className="inline-block w-3.5 h-3.5 mr-1 -mt-0.5" />
                                      {vendor.vendor_name} - 주문 상세 내역
                                    </div>
                                    {vendorOrders.length === 0 ? (
                                      <div className="text-xs text-gray-400 text-center py-4">주문 내역을 불러오는 중...</div>
                                    ) : (
                                      <table className="min-w-full bg-white rounded-lg overflow-hidden">
                                        <thead>
                                          <tr className="border-b border-gray-200 bg-gray-100">
                                            <th className="px-3 py-1.5 text-left text-[10px] font-medium text-gray-600">주문번호</th>
                                            <th className="px-3 py-1.5 text-left text-[10px] font-medium text-gray-600">고객사</th>
                                            <th className="px-3 py-1.5 text-left text-[10px] font-medium text-gray-600">담당자</th>
                                            <th className="px-3 py-1.5 text-left text-[10px] font-medium text-gray-600">주문일</th>
                                            <th className="px-3 py-1.5 text-right text-[10px] font-medium text-gray-600">업체 지출금</th>
                                            <th className="px-3 py-1.5 text-left text-[10px] font-medium text-gray-600">상품 내역</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {vendorOrders.map(vo => (
                                            <tr key={vo.id} className="border-b border-gray-100 last:border-b-0">
                                              <td className="px-3 py-2 text-xs text-gray-900">{vo.order_number}</td>
                                              <td className="px-3 py-2 text-xs text-gray-900">{vo.customer_company || vo.customer_name || '-'}</td>
                                              <td className="px-3 py-2 text-xs text-gray-900">{vo.assignee_name || '-'}</td>
                                              <td className="px-3 py-2 text-xs text-gray-500">{vo.order_date ? formatDate(vo.order_date) : '-'}</td>
                                              <td className="px-3 py-2 text-xs text-right font-medium text-red-600">{formatCurrency(p(vo.vendor_amount))}</td>
                                              <td className="px-3 py-2 text-xs text-gray-600">
                                                {vo.vendor_items && vo.vendor_items.length > 0
                                                  ? vo.vendor_items.map((vi, idx) => (
                                                    <span key={idx} className="inline-block mr-2">
                                                      {vi.product_name}({vi.quantity}건)
                                                      {vi.item_type === 'refund' && <span className="text-green-600 ml-0.5">[환입]</span>}
                                                    </span>
                                                  ))
                                                  : '-'
                                                }
                                              </td>
                                            </tr>
                                          ))}
                                        </tbody>
                                        <tfoot className="bg-gray-100 border-t border-gray-300">
                                          <tr>
                                            <td colSpan={4} className="px-3 py-2 text-xs text-right font-bold text-gray-700">합계</td>
                                            <td className="px-3 py-2 text-xs text-right font-bold text-red-600">
                                              {formatCurrency(vendorOrders.reduce((sum, vo) => sum + p(vo.vendor_amount), 0))}
                                            </td>
                                            <td></td>
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
                    <tfoot className="bg-gray-100 border-t-2 border-gray-300">
                      <tr>
                        <td className="px-2 py-2"></td>
                        <td className="px-3 py-2 text-sm font-bold text-gray-900">합계</td>
                        <td className="px-3 py-2 text-sm text-center font-bold text-gray-900">
                          {vendorSummaries.reduce((sum, v) => sum + parseInt(String(v.order_count)), 0)}건
                        </td>
                        <td className="px-3 py-2 text-sm text-right font-bold text-red-600">
                          {formatCurrency(vendorSummaries.reduce((sum, v) => sum + p(v.total_amount), 0))}
                        </td>
                        <td className="px-3 py-2 text-sm text-right font-bold text-green-600">
                          {formatCurrency(vendorSummaries.reduce((sum, v) => sum + p(v.total_refund), 0))}
                        </td>
                        <td className="px-3 py-2 text-sm text-right font-bold text-gray-900">{formatCurrency(totalVendorAmount)}</td>
                        <td className="px-3 py-2 text-sm text-right font-bold text-green-600">{formatCurrency(totalSettledAmount)}</td>
                        <td className="px-3 py-2 text-sm text-right font-bold text-orange-600">{formatCurrency(totalUnsettled)}</td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )
          )}

          {/* 업체 정산 레코드 */}
          {vendorSubTab === 'records' && (
            loading ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
              </div>
            ) : vendorSettlementList.length === 0 ? (
              <div className="bg-white rounded-lg shadow-sm border p-12 text-center text-gray-500">
                <Store className="mx-auto h-12 w-12 text-gray-300 mb-4" />
                <p>저장된 업체 정산 레코드가 없습니다.</p>
                <p className="text-sm text-gray-400 mt-1">업체별 현황에서 정산 처리를 하면 레코드가 생성됩니다.</p>
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">업체명</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">기간</th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">지출금</th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">환입금</th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">순 정산금</th>
                        <th className="px-3 py-2 text-center text-xs font-medium text-gray-500">상태</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">정산일</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">비고</th>
                        <th className="px-3 py-2 text-center text-xs font-medium text-gray-500">액션</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {vendorSettlementList.map(vs => (
                        <tr key={vs.id} className="hover:bg-gray-50">
                          <td className="px-3 py-2 text-sm font-medium text-gray-900">{vs.vendor_name}</td>
                          <td className="px-3 py-2 text-sm text-gray-500">{formatDate(vs.period_start)} ~ {formatDate(vs.period_end)}</td>
                          <td className="px-3 py-2 text-sm text-right font-medium text-red-600">{formatCurrency(p(vs.total_amount))}</td>
                          <td className="px-3 py-2 text-sm text-right font-medium text-green-600">
                            {p(vs.total_refund) > 0 ? formatCurrency(p(vs.total_refund)) : '-'}
                          </td>
                          <td className="px-3 py-2 text-sm text-right font-bold text-gray-900">{formatCurrency(p(vs.net_amount))}</td>
                          <td className="px-3 py-2 text-center">
                            <span className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded-full ${
                              vs.status === 'completed' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                            }`}>
                              {vs.status === 'completed' ? '정산완료' : '미정산'}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-sm text-gray-500">{vs.settled_date ? formatDate(vs.settled_date) : '-'}</td>
                          <td className="px-3 py-2 text-sm text-gray-500">{vs.notes || '-'}</td>
                          <td className="px-3 py-2 text-center">
                            <button
                              onClick={() => handleDeleteVendorSettle(vs.id)}
                              className="p-1.5 rounded-lg bg-red-100 hover:bg-red-200 text-red-700"
                              title="삭제"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          )}
        </div>
        );
      })()}

      {/* 업체 정산 모달 */}
      {showVendorSettleModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b">
              <div>
                <h2 className="text-lg font-bold text-gray-900 flex items-center">
                  <Store className="w-5 h-5 mr-2 text-green-600" />
                  업체 정산 처리
                </h2>
                <p className="text-sm text-gray-500 mt-1">{vendorSettleData.vendor_name}</p>
              </div>
              <button onClick={() => setShowVendorSettleModal(false)} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">시작일</label>
                  <input type="date" value={vendorSettleData.period_start} onChange={e => setVendorSettleData({ ...vendorSettleData, period_start: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">종료일</label>
                  <input type="date" value={vendorSettleData.period_end} onChange={e => setVendorSettleData({ ...vendorSettleData, period_end: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">비고</label>
                <textarea
                  value={vendorSettleData.notes}
                  onChange={e => setVendorSettleData({ ...vendorSettleData, notes: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  rows={2}
                  placeholder="비고 사항 입력"
                />
              </div>
              <div className="bg-green-50 p-4 rounded-lg">
                <div className="text-sm text-gray-600">
                  <p>업체: <span className="font-medium">{vendorSettleData.vendor_name}</span></p>
                  <p>기간: <span className="font-medium">{vendorSettleData.period_start} ~ {vendorSettleData.period_end}</span></p>
                  <p className="mt-2 text-green-600">해당 기간의 업체 지출금이 자동 계산되어 정산 레코드가 생성됩니다.</p>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 p-6 border-t">
              <button onClick={() => setShowVendorSettleModal(false)} className="px-4 py-2 text-sm text-gray-700 bg-white border rounded-lg hover:bg-gray-50">취소</button>
              <button
                onClick={handleVendorSettle}
                disabled={vendorSettleProcessing}
                className="px-4 py-2 text-sm text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:bg-green-300 flex items-center gap-2"
              >
                {vendorSettleProcessing ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    처리 중...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    정산 처리
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 주문 로그 모달 */}
      {showLogModal && selectedOrderForLog && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75" onClick={closeLogModal} />
            <div className="relative bg-white rounded-xl shadow-xl max-w-2xl w-full mx-auto p-6 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-bold text-gray-900 flex items-center">
                    <History className="h-5 w-5 mr-2 text-primary-600" />
                    수정 내역
                  </h2>
                  <p className="text-sm text-gray-500 mt-1">
                    주문번호: {selectedOrderForLog.order_number} | {selectedOrderForLog.customer_company || selectedOrderForLog.customer_name}
                  </p>
                </div>
                <button onClick={closeLogModal} className="text-gray-400 hover:text-gray-600"><X className="h-6 w-6" /></button>
              </div>

              {isLoadingLogs ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
                </div>
              ) : orderLogs.length > 0 ? (
                <div className="space-y-3">
                  {orderLogs.map((log) => {
                    const actionInfo = getActionLabel(log.action);
                    const showRefundBadge = isRefundLog(log);
                    return (
                      <div key={log.id} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${actionInfo.color}`}>
                              {actionInfo.text}
                            </span>
                            {showRefundBadge && (
                              <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-red-100 text-red-700">
                                환불
                              </span>
                            )}
                            <span className="text-sm font-medium text-gray-900">{log.change_summary}</span>
                          </div>
                        </div>
                        <div className="mt-2 flex items-center gap-4 text-xs text-gray-500">
                          <span className="flex items-center">
                            <Clock className="h-3 w-3 mr-1" />
                            {formatLogDate(log.created_at)}
                          </span>
                          <span className="flex items-center">
                            <UserCheck className="h-3 w-3 mr-1" />
                            {log.edited_by}
                          </span>
                        </div>
                        {log.old_value && log.new_value && (
                          <div className="mt-2 text-xs bg-gray-50 rounded p-2">
                            <span className="text-red-600 line-through">{log.old_value}</span>
                            <span className="mx-2 text-gray-400">→</span>
                            <span className="text-green-600">{log.new_value}</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-12">
                  <FileText className="mx-auto h-12 w-12 text-gray-300" />
                  <p className="mt-4 text-gray-500">수정 내역이 없습니다.</p>
                  <p className="text-sm text-gray-400 mt-1">주문이 생성되거나 수정되면 여기에 기록됩니다.</p>
                </div>
              )}

              <div className="flex justify-end mt-6">
                <button onClick={closeLogModal} className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">닫기</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 정산 생성 모달 */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-lg font-bold text-gray-900">정산 레코드 생성</h2>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">영업담당자</label>
                <select
                  value={modalData.assignee_id}
                  onChange={e => {
                    const sel = summaries.find(s => s.assignee_id === e.target.value);
                    setModalData({ ...modalData, assignee_id: e.target.value, assignee_name: sel ? sel.assignee_name : '' });
                  }}
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                >
                  <option value="">담당자 선택</option>
                  {summaries.map(s => (
                    <option key={s.assignee_id} value={s.assignee_id}>{s.assignee_name} ({s.department || '-'})</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">시작일</label>
                  <input type="date" value={modalData.period_start} onChange={e => setModalData({ ...modalData, period_start: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">종료일</label>
                  <input type="date" value={modalData.period_end} onChange={e => setModalData({ ...modalData, period_end: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">수수료율 (%)</label>
                <input type="number" value={modalData.commission_rate} onChange={e => setModalData({ ...modalData, commission_rate: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm" step="0.1" min="0" max="100" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">비고</label>
                <textarea value={modalData.notes} onChange={e => setModalData({ ...modalData, notes: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm" rows={2} placeholder="비고 사항 입력" />
              </div>
            </div>
            <div className="flex justify-end gap-3 p-6 border-t">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm text-gray-700 bg-white border rounded-lg hover:bg-gray-50">취소</button>
              <button onClick={handleCreate} className="px-4 py-2 text-sm text-white bg-primary-600 rounded-lg hover:bg-primary-700">생성</button>
            </div>
          </div>
        </div>
      )}

      {/* 일괄 정산 모달 */}
      {showBatchModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
            <div className="flex items-center justify-between p-6 border-b">
              <div>
                <h2 className="text-lg font-bold text-gray-900 flex items-center">
                  <Zap className="w-5 h-5 mr-2 text-purple-600" />
                  담당자별 일괄 정산
                </h2>
                <p className="text-sm text-gray-500 mt-1">선택한 담당자의 기간 내 주문을 일괄 정산 처리합니다.</p>
              </div>
              <button onClick={() => setShowBatchModal(false)} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">영업담당자 *</label>
                <select
                  value={batchData.assignee_id}
                  onChange={e => {
                    const sel = summaries.find(s => s.assignee_id === e.target.value);
                    setBatchData({ ...batchData, assignee_id: e.target.value, assignee_name: sel ? sel.assignee_name : '' });
                  }}
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                >
                  <option value="">담당자 선택</option>
                  {summaries.map(s => (
                    <option key={s.assignee_id} value={s.assignee_id}>{s.assignee_name} ({s.department || '-'})</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">시작일 *</label>
                  <input type="date" value={batchData.period_start} onChange={e => setBatchData({ ...batchData, period_start: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">종료일 *</label>
                  <input type="date" value={batchData.period_end} onChange={e => setBatchData({ ...batchData, period_end: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">수수료율 (%)</label>
                <input type="number" value={batchData.commission_rate} onChange={e => setBatchData({ ...batchData, commission_rate: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm" step="0.1" min="0" max="100" />
              </div>
              <div className="flex items-center gap-2 bg-purple-50 p-3 rounded-lg">
                <input
                  type="checkbox"
                  id="create_settlement_record"
                  checked={batchData.create_settlement_record}
                  onChange={e => setBatchData({ ...batchData, create_settlement_record: e.target.checked })}
                  className="w-4 h-4 text-purple-600 rounded border-gray-300"
                />
                <label htmlFor="create_settlement_record" className="text-sm text-gray-700">
                  정산 레코드도 함께 생성 (매출/지출 요약 기록)
                </label>
              </div>
              {batchData.assignee_id && (
                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="text-sm font-medium text-gray-700 mb-2">일괄 정산 대상</div>
                  <div className="text-sm text-gray-600">
                    <p>담당자: <span className="font-medium">{batchData.assignee_name}</span></p>
                    <p>기간: <span className="font-medium">{batchData.period_start} ~ {batchData.period_end}</span></p>
                    <p className="mt-2 text-purple-600">
                      해당 기간의 모든 주문이 '정산완료' 상태로 변경됩니다.
                    </p>
                  </div>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-3 p-6 border-t">
              <button onClick={() => setShowBatchModal(false)} className="px-4 py-2 text-sm text-gray-700 bg-white border rounded-lg hover:bg-gray-50">취소</button>
              <button
                onClick={handleBatchSettlement}
                disabled={batchProcessing || !batchData.assignee_id}
                className="px-4 py-2 text-sm text-white bg-purple-600 rounded-lg hover:bg-purple-700 disabled:bg-purple-300 flex items-center gap-2"
              >
                {batchProcessing ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    처리 중...
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4" />
                    일괄 정산 실행
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
