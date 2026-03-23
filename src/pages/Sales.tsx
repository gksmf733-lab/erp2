import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../utils/api';
import { Customer, Order, Service } from '../types';
import { formatCurrency, formatDate, getStatusColor, getStatusLabel } from '../utils/format';
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  X,
  Users,
  ShoppingCart,
  Building,
  Mail,
  Phone,
  MapPin,
  Calendar,
  UserCheck,
  Hash,
  Briefcase,
  Tag,
  Truck,
  CheckCircle,
  ClipboardList,
  Clock,
  AlertTriangle,
  List,
  RotateCcw,
  Calculator,
  History,
  FileText,
  Eye,
  ChevronRight,
  Award,
  Copy,
  ExternalLink
} from 'lucide-react';

type Tab = 'customers' | 'orders';
type OrderSubTab = 'all' | 'pending' | 'active' | 'near_due' | 'closed';

interface OrderItem {
  service_id: string;
  service_name: string;
  unit_price: number;
  quantity: number;
  total_price: number;
  item_type: 'normal' | 'refund';
}

interface Employee {
  id: string;
  name: string;
  department: string;
  position: string;
  status: string;
}

interface Vendor {
  id: string;
  name: string;
  representative: string;
  phone: string;
  status: string;
}

interface VendorProduct {
  id: string;
  vendor_id: string;
  product_name: string;
  cost_price: number;
}

interface OrderVendorItem {
  vendor_id: string;
  vendor_product_id: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  item_type: 'normal' | 'refund';
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

interface IncentivePolicy {
  id: string;
  name: string;
  amount: number;
  description: string;
  is_active: boolean;
}

interface OrderIncentive {
  employee_id: string;
  policy_id: string;
  amount: number;
  quantity: number;
  notes: string;
}

export default function Sales() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<Tab>((searchParams.get('tab') as Tab) || 'customers');
  const [orderSubTab, setOrderSubTab] = useState<OrderSubTab>('all');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterCustomerId, setFilterCustomerId] = useState('');
  const [filterOrderDate, setFilterOrderDate] = useState(searchParams.get('dateFrom') || '');
  const [filterStartDateFrom, setFilterStartDateFrom] = useState('');
  const [filterStartDateTo, setFilterStartDateTo] = useState('');
  const [filterCompany, setFilterCompany] = useState('');
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [customerFormData, setCustomerFormData] = useState({
    name: '', company: '', email: '', phone: '', phone2: '', business_number: '', industry: '', business_type: '', address: '',
  });
  const [orderFormData, setOrderFormData] = useState({
    customer_id: '',
    assignee_id: '',
    order_date: new Date().toISOString().split('T')[0],
    start_date: '',
    due_date: '',
    notes: '',
    status: 'pending' as Order['status'],
  });
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [customerPrices, setCustomerPrices] = useState<Record<string, number>>({});
  const [customerServicePrices, setCustomerServicePrices] = useState<Record<string, string>>({});
  const [showPricingSection, setShowPricingSection] = useState(false);
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set());
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [vendorProductsMap, setVendorProductsMap] = useState<Record<string, VendorProduct[]>>({});
  const [orderVendorItems, setOrderVendorItems] = useState<OrderVendorItem[]>([]);
  const [orderIncentives, setOrderIncentives] = useState<OrderIncentive[]>([]);
  const [incentivePolicies, setIncentivePolicies] = useState<IncentivePolicy[]>([]);
  const [isLoadingOrderDetails, setIsLoadingOrderDetails] = useState(false);
  const [showLogModal, setShowLogModal] = useState(false);
  const [selectedOrderForLog, setSelectedOrderForLog] = useState<Order | null>(null);
  const [orderLogs, setOrderLogs] = useState<OrderEditLog[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);

  // 상세보기 모달용 state
  const [showCustomerDetailModal, setShowCustomerDetailModal] = useState(false);
  const [selectedCustomerForDetail, setSelectedCustomerForDetail] = useState<Customer | null>(null);
  const [customerOrders, setCustomerOrders] = useState<Order[]>([]);
  const [customerOrdersLoading, setCustomerOrdersLoading] = useState(false);
  const [showOrderDetailModal, setShowOrderDetailModal] = useState(false);
  const [selectedOrderForDetail, setSelectedOrderForDetail] = useState<Order | null>(null);
  const [orderDetailItems, setOrderDetailItems] = useState<any[]>([]);
  const [orderDetailVendorItems, setOrderDetailVendorItems] = useState<any[]>([]);
  const [orderDetailIncentives, setOrderDetailIncentives] = useState<any[]>([]);
  const [isLoadingOrderDetail, setIsLoadingOrderDetail] = useState(false);

  // 블로그 주문서 양식 관련 state
  const [showBlogFormModal, setShowBlogFormModal] = useState(false);
  const [blogFormTab, setBlogFormTab] = useState<'form' | 'list'>('form');
  const [blogFormList, setBlogFormList] = useState<any[]>([]);
  const [blogFormLoading, setBlogFormLoading] = useState(false);
  const [blogFormLink, setBlogFormLink] = useState('');
  const [blogFormOrderId, setBlogFormOrderId] = useState('');
  const [expandedFormId, setExpandedFormId] = useState<string | null>(null);

  // URL 파라미터 소비 후 정리
  useEffect(() => {
    if (searchParams.has('tab') || searchParams.has('dateFrom') || searchParams.has('dateTo')) {
      setSearchParams({}, { replace: true });
    }
  }, []);

  useEffect(() => { fetchData(); }, [activeTab, searchTerm]);

  // Load customer-specific prices when customer is selected in order form
  useEffect(() => {
    if (orderFormData.customer_id) {
      loadCustomerPrices(orderFormData.customer_id);
    } else {
      setCustomerPrices({});
    }
  }, [orderFormData.customer_id]);

  const loadCustomerPrices = async (customerId: string) => {
    try {
      const prices = await api.get<any[]>(`/sales/customers/${customerId}/prices`);
      const priceMap: Record<string, number> = {};
      prices.forEach((p: any) => {
        priceMap[p.service_id] = Number(p.price);
      });
      setCustomerPrices(priceMap);
    } catch {
      setCustomerPrices({});
    }
  };
  useEffect(() => { loadSupportData(); }, []);

  const loadSupportData = async () => {
    try {
      const [svcData, empData, custData, vendorData, ordersData, policyData] = await Promise.all([
        api.get<Service[]>('/services').catch(() => []),
        api.get<Employee[]>('/employees').catch(() => []),
        api.get<Customer[]>('/sales/customers').catch(() => []),
        api.get<Vendor[]>('/vendors').catch(() => []),
        api.get<Order[]>('/sales/orders').catch(() => []),
        api.get<IncentivePolicy[]>('/incentives/policies?active_only=true').catch(() => []),
      ]);
      setServices((svcData as Service[]).filter(s => s.status === 'active'));
      setEmployees(empData as Employee[]);
      setCustomers(custData as Customer[]);
      setVendors((vendorData as Vendor[]).filter(v => v.status === 'active'));
      setOrders(ordersData as Order[]);
      setIncentivePolicies(policyData as IncentivePolicy[]);
    } catch (error) {
      console.error('Failed to load support data:', error);
    }
  };

  // 고객별 활성화된 주문이 있는지 확인하는 함수
  const hasActiveOrders = (customerId: string): boolean => {
    return orders.some(
      order => order.customer_id === customerId &&
               (order.status === 'pending' || order.status === 'processing')
    );
  };

  const fetchData = async () => {
    setIsLoading(true);
    try {
      if (activeTab === 'customers') {
        const params = new URLSearchParams();
        if (searchTerm) params.append('search', searchTerm);
        const data = await api.get<Customer[]>(`/sales/customers?${params.toString()}`);
        setCustomers(data);
      } else {
        const data = await api.get<Order[]>('/sales/orders');
        setOrders(data);
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
      alert('데이터 조회 실패: ' + (error instanceof Error ? error.message : '알 수 없는 오류'));
    } finally {
      setIsLoading(false);
    }
  };

  const loadCustomerServicePrices = async (customerId: string) => {
    try {
      const prices = await api.get<any[]>(`/sales/customers/${customerId}/prices`);
      const priceMap: Record<string, string> = {};
      prices.forEach((p: any) => {
        priceMap[p.service_id] = String(p.price);
      });
      setCustomerServicePrices(priceMap);
    } catch {
      setCustomerServicePrices({});
    }
  };

  const openCustomerModal = (customer?: Customer) => {
    if (customer) {
      setEditingCustomer(customer);
      setCustomerFormData({ name: customer.name, company: customer.company || '', email: customer.email || '', phone: customer.phone || '', phone2: customer.phone2 || '', business_number: customer.business_number || '', industry: customer.industry || '', business_type: customer.business_type || '', address: customer.address || '' });
      loadCustomerServicePrices(customer.id);
      setShowPricingSection(true);
    } else {
      setEditingCustomer(null);
      setCustomerFormData({ name: '', company: '', email: '', phone: '', phone2: '', business_number: '', industry: '', business_type: '', address: '' });
      setCustomerServicePrices({});
      setShowPricingSection(false);
    }
    setShowCustomerModal(true);
  };

  const closeCustomerModal = () => { setShowCustomerModal(false); setEditingCustomer(null); setCustomerServicePrices({}); setShowPricingSection(false); };

  const handleCustomerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      let customerId: string;
      if (editingCustomer) {
        await api.put(`/sales/customers/${editingCustomer.id}`, customerFormData);
        customerId = editingCustomer.id;
      } else {
        const result = await api.post<any>('/sales/customers', customerFormData);
        customerId = result.id;
      }
      // 서비스별 단가 저장
      if (showPricingSection) {
        const prices = Object.entries(customerServicePrices)
          .map(([service_id, price]) => ({
            service_id,
            price: price === '' ? null : Number(price),
          }));
        if (prices.length > 0) {
          await api.post(`/sales/customers/${customerId}/prices`, { prices });
        }
      }
      closeCustomerModal(); fetchData(); loadSupportData();
    } catch (error) { alert(error instanceof Error ? error.message : '저장에 실패했습니다.'); }
  };

  const handleCustomerDelete = async (id: string) => {
    if (!confirm('정말 삭제하시겠습니까?')) return;
    try { await api.delete(`/sales/customers/${id}`); fetchData(); }
    catch (error) { alert(error instanceof Error ? error.message : '삭제에 실패했습니다.'); }
  };

  const formatDateForInput = (d: any) => d ? String(d).split('T')[0] : '';

  const openOrderModal = async (order?: Order) => {
    if (order) {
      // 먼저 로딩 상태 시작 (버튼 비활성화용)
      setIsLoadingOrderDetails(true);

      // 기존 주문 항목을 먼저 로드
      try {
        console.log('Loading order details for:', order.id);
        const detail = await api.get<any>(`/sales/orders/${order.id}`);
        console.log('Order detail response:', detail);
        console.log('Items from API:', detail.items);
        console.log('Vendor items from API:', detail.vendor_items);

        // 서비스 상품 항목 매핑
        let loadedItems: OrderItem[] = [];
        if (detail.items && Array.isArray(detail.items) && detail.items.length > 0) {
          loadedItems = detail.items.map((item: any) => ({
            service_id: item.item_id || '',
            service_name: item.item_name || '',
            unit_price: Number(item.unit_price) || 0,
            quantity: Number(item.quantity) || 1,
            total_price: Number(item.total_price) || 0,
            item_type: item.item_type || 'normal',
          }));
          console.log('Mapped items:', loadedItems);
        } else {
          console.log('No items found for this order');
        }

        // 업체상품 항목 매핑
        let loadedVendorItems: OrderVendorItem[] = [];
        if (detail.vendor_items && Array.isArray(detail.vendor_items) && detail.vendor_items.length > 0) {
          loadedVendorItems = detail.vendor_items.map((vi: any) => ({
            vendor_id: vi.vendor_id,
            vendor_product_id: vi.vendor_product_id,
            quantity: Number(vi.quantity) || 1,
            unit_price: Number(vi.unit_price) || 0,
            total_price: Number(vi.total_price) || 0,
            item_type: vi.item_type || 'normal',
          }));
          console.log('Mapped vendor items:', loadedVendorItems);

          // 업체 상품 목록 미리 로드
          const uniqueVendorIds = [...new Set(loadedVendorItems.map(i => i.vendor_id))];
          for (const vid of uniqueVendorIds) {
            await loadVendorProducts(vid);
          }
        } else {
          console.log('No vendor items found for this order');
        }

        // 인센티브 항목 매핑
        let loadedIncentives: OrderIncentive[] = [];
        if (detail.incentives && Array.isArray(detail.incentives) && detail.incentives.length > 0) {
          loadedIncentives = detail.incentives.map((inc: any) => ({
            employee_id: inc.employee_id || '',
            policy_id: inc.policy_id || '',
            amount: Number(inc.amount) || 0,
            quantity: Number(inc.quantity) || 1,
            notes: inc.notes || '',
          }));
        }

        // 모든 데이터 로드 완료 후 state 설정
        setEditingOrder(order);
        setOrderFormData({
          customer_id: order.customer_id,
          assignee_id: (order as any).assignee_id || '',
          order_date: formatDateForInput(order.order_date),
          start_date: formatDateForInput((order as any).start_date),
          due_date: formatDateForInput(order.due_date),
          notes: order.notes || '',
          status: order.status
        });
        setOrderItems(loadedItems);
        setOrderVendorItems(loadedVendorItems);
        setOrderIncentives(loadedIncentives);

        // 마지막에 모달 열기
        setShowOrderModal(true);
        setIsLoadingOrderDetails(false);
      } catch (error) {
        console.error('Failed to load order details:', error);
        alert('주문 상세 정보를 불러오는 데 실패했습니다: ' + (error instanceof Error ? error.message : '알 수 없는 오류'));
        setIsLoadingOrderDetails(false);
      }
    } else {
      setEditingOrder(null);
      setOrderFormData({ customer_id: '', assignee_id: '', order_date: new Date().toISOString().split('T')[0], start_date: '', due_date: '', notes: '', status: 'pending' });
      setOrderItems([]);
      setOrderVendorItems([]);
      setOrderIncentives([]);
      setShowOrderModal(true);
    }
  };

  const closeOrderModal = () => { setShowOrderModal(false); setEditingOrder(null); setOrderItems([]); setOrderVendorItems([]); setOrderIncentives([]); setIsLoadingOrderDetails(false); };

  // 고객목록에서 바로 주문등록 모달 열기
  const openOrderModalForCustomer = (customerId: string) => {
    setEditingOrder(null);
    setOrderFormData({
      customer_id: customerId,
      assignee_id: '',
      order_date: new Date().toISOString().split('T')[0],
      start_date: '',
      due_date: '',
      notes: '',
      status: 'pending'
    });
    setOrderItems([]);
    setOrderVendorItems([]);
    setOrderIncentives([]);
    setShowOrderModal(true);
  };

  const addOrderItem = (itemType: 'normal' | 'refund' = 'normal') => {
    setOrderItems([...orderItems, { service_id: '', service_name: '', unit_price: 0, quantity: 1, total_price: 0, item_type: itemType }]);
  };

  const updateOrderItem = (index: number, field: string, value: string) => {
    const updated = [...orderItems];
    if (field === 'service_id') {
      const service = services.find(s => s.id === value);
      if (service) {
        const price = customerPrices[service.id] !== undefined ? customerPrices[service.id] : Number(service.price);
        updated[index] = { ...updated[index], service_id: service.id, service_name: service.name, unit_price: price, total_price: price * updated[index].quantity };
      }
    } else if (field === 'unit_price') {
      const price = Number(value);
      updated[index] = { ...updated[index], unit_price: price, total_price: price * updated[index].quantity };
    } else if (field === 'quantity') {
      const qty = Number(value);
      updated[index] = { ...updated[index], quantity: qty, total_price: updated[index].unit_price * qty };
    }
    setOrderItems(updated);
  };

  const removeOrderItem = (index: number) => { setOrderItems(orderItems.filter((_, i) => i !== index)); };

  // 일반 항목 합계
  const normalItemsTotal = orderItems.filter(i => i.item_type === 'normal').reduce((sum, item) => sum + item.total_price, 0);
  // 환불 항목 합계
  const refundItemsTotal = orderItems.filter(i => i.item_type === 'refund').reduce((sum, item) => sum + item.total_price, 0);
  // 순매출 (일반 - 환불)
  const netTotal = normalItemsTotal - refundItemsTotal;

  // Client-side filtering for orders
  const filteredOrders = orders.filter((order) => {
    // 서브탭에 따라 상태 필터링 (전체 탭은 필터 안함)
    if (orderSubTab === 'pending' && order.status !== 'pending') return false;
    if (orderSubTab === 'active' && order.status !== 'processing') return false;
    if (orderSubTab === 'near_due' && order.status !== 'near_due') return false;
    if (orderSubTab === 'closed' && order.status !== 'completed') return false;
    if (filterStatus && order.status !== filterStatus) return false;
    if (filterCustomerId && order.customer_id !== filterCustomerId) return false;
    if (filterCompany) {
      const company = (order as any).customer_company || '';
      if (!company.toLowerCase().includes(filterCompany.toLowerCase())) return false;
    }
    if (filterOrderDate && String(order.order_date || '').substring(0, 10) !== filterOrderDate) return false;
    if (filterStartDateFrom) {
      const startDate = String((order as any).start_date || '').substring(0, 10);
      const dueDate = String((order as any).due_date || '').substring(0, 10);
      if (startDate && startDate < filterStartDateFrom && dueDate && dueDate < filterStartDateFrom) return false;
      if (!startDate && !dueDate) return false;
    }
    if (filterStartDateTo) {
      const startDate = String((order as any).start_date || '').substring(0, 10);
      if (startDate && startDate > filterStartDateTo) return false;
      if (!startDate) return false;
    }
    return true;
  });

  const pendingOrderCount = orders.filter(o => o.status === 'pending').length;
  const activeOrderCount = orders.filter(o => o.status === 'processing').length;
  const nearDueOrderCount = orders.filter(o => o.status === 'near_due').length;
  const closedOrderCount = orders.filter(o => o.status === 'completed').length;

  const uniqueCompanies = [...new Set(orders.map(o => (o as any).customer_company).filter(Boolean))];

  const handleOrderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingOrder && !orderFormData.customer_id) {
      alert('고객을 선택해주세요.');
      return;
    }
    try {
      const items = orderItems
        .filter(item => item.service_id)
        .map(item => ({
          item_id: item.service_id,
          item_name: item.service_name,
          quantity: item.quantity,
          unit_price: item.unit_price,
          item_type: item.item_type,
        }));
      const vendor_items = orderVendorItems
        .filter(vi => vi.vendor_id && vi.vendor_product_id)
        .map(vi => ({
          vendor_id: vi.vendor_id,
          vendor_product_id: vi.vendor_product_id,
          quantity: vi.quantity,
          unit_price: vi.unit_price,
          item_type: vi.item_type,
        }));
      const incentives = orderIncentives
        .filter(inc => inc.employee_id)
        .map(inc => ({
          employee_id: inc.employee_id,
          policy_id: inc.policy_id || null,
          amount: inc.amount,
          quantity: inc.quantity,
          notes: inc.notes || null,
        }));

      if (editingOrder) {
        await api.put(`/sales/orders/${editingOrder.id}`, {
          customer_id: orderFormData.customer_id,
          assignee_id: orderFormData.assignee_id || null,
          order_date: orderFormData.order_date,
          start_date: orderFormData.start_date || null,
          due_date: orderFormData.due_date || null,
          status: orderFormData.status,
          notes: orderFormData.notes || null,
          items,
          vendor_items,
          incentives,
        });
      } else {
        await api.post('/sales/orders', {
          customer_id: orderFormData.customer_id,
          assignee_id: orderFormData.assignee_id || null,
          order_date: orderFormData.order_date,
          start_date: orderFormData.start_date || null,
          due_date: orderFormData.due_date || null,
          notes: orderFormData.notes || null,
          items,
          vendor_items,
          incentives,
        });
      }
      closeOrderModal();
      fetchData();
    } catch (error) {
      console.error('Order submit error:', error);
      alert('주문 저장 실패: ' + (error instanceof Error ? error.message : '알 수 없는 오류'));
    }
  };

  const handleStatusChange = async (orderId: string, newStatus: string) => {
    try {
      await api.put(`/sales/orders/${orderId}`, { status: newStatus });
      fetchData();
    } catch (error) {
      alert('상태 변경 실패: ' + (error instanceof Error ? error.message : '알 수 없는 오류'));
    }
  };

  const handleOrderDelete = async (id: string) => {
    if (!confirm('정말 삭제하시겠습니까?')) return;
    try { await api.delete(`/sales/orders/${id}`); fetchData(); }
    catch (error) { alert(error instanceof Error ? error.message : '삭제에 실패했습니다.'); }
  };

  const handleBulkDelete = async () => {
    if (selectedOrders.size === 0) return;
    if (!confirm(`선택한 ${selectedOrders.size}건의 주문을 삭제하시겠습니까?`)) return;
    try {
      await api.post('/sales/orders/bulk-delete', { ids: Array.from(selectedOrders) });
      setSelectedOrders(new Set());
      fetchData();
    } catch (error) {
      alert(error instanceof Error ? error.message : '삭제에 실패했습니다.');
    }
  };

  const toggleOrderSelect = (id: string) => {
    setSelectedOrders(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedOrders.size === filteredOrders.length) {
      setSelectedOrders(new Set());
    } else {
      setSelectedOrders(new Set(filteredOrders.map(o => o.id)));
    }
  };

  const loadVendorProducts = async (vendorId: string) => {
    if (vendorProductsMap[vendorId]) return vendorProductsMap[vendorId];
    try {
      const data = await api.get<{ products: VendorProduct[] }>(`/vendors/${vendorId}`);
      const products = data.products || [];
      setVendorProductsMap(prev => ({ ...prev, [vendorId]: products }));
      return products;
    } catch { return []; }
  };

  const openLogModal = async (order: Order) => {
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

  // 고객 상세보기 모달 열기
  const openCustomerDetailModal = async (customer: Customer) => {
    setSelectedCustomerForDetail(customer);
    setShowCustomerDetailModal(true);
    setCustomerOrders([]);
    setCustomerOrdersLoading(true);
    try {
      const data = await api.get<Order[]>(`/sales/orders?customerId=${customer.id}`);
      setCustomerOrders(Array.isArray(data) ? data : []);
    } catch { setCustomerOrders([]); }
    finally { setCustomerOrdersLoading(false); }
  };

  const closeCustomerDetailModal = () => {
    setShowCustomerDetailModal(false);
    setSelectedCustomerForDetail(null);
    setCustomerOrders([]);
  };

  // 주문 상세보기 모달 열기
  const openOrderDetailModal = async (order: Order) => {
    setSelectedOrderForDetail(order);
    setShowOrderDetailModal(true);
    setIsLoadingOrderDetail(true);
    try {
      const detail = await api.get<any>(`/sales/orders/${order.id}`);
      setOrderDetailItems(detail.items || []);
      setOrderDetailVendorItems(detail.vendor_items || []);
      setOrderDetailIncentives(detail.incentives || []);
    } catch (error) {
      console.error('Failed to load order details:', error);
      setOrderDetailItems([]);
      setOrderDetailVendorItems([]);
      setOrderDetailIncentives([]);
    } finally {
      setIsLoadingOrderDetail(false);
    }
  };

  const closeOrderDetailModal = () => {
    setShowOrderDetailModal(false);
    setSelectedOrderForDetail(null);
    setOrderDetailItems([]);
    setOrderDetailVendorItems([]);
    setOrderDetailIncentives([]);
  };

  // 블로그 주문서 양식 - 주문에 블로그 상품이 포함되어 있는지 확인
  const hasBlogItems = (items: any[]) => {
    return items.some((item: any) => {
      const svc = services.find(s => s.id === (item.item_id || item.service_id));
      return svc && svc.is_blog;
    });
  };

  // 블로그 주문서 양식 - 모달 열기
  const openBlogFormModal = async (orderId: string, tab: 'form' | 'list' = 'form') => {
    setBlogFormLoading(true);
    setShowBlogFormModal(true);
    setBlogFormTab(tab);
    setBlogFormList([]);
    setBlogFormLink('');
    setBlogFormOrderId(orderId);
    setExpandedFormId(null);
    try {
      const forms = await api.get<any[]>(`/blog-order-form/order/${orderId}`);
      setBlogFormList(forms || []);
      // 양식 탭: 대기 중인 양식이 있으면 그 링크 보여주기, 없으면 새로 생성
      if (tab === 'form') {
        const pendingForm = (forms || []).find((f: any) => f.status === 'pending');
        if (pendingForm) {
          setBlogFormLink(`${window.location.origin}/order-form/${pendingForm.token}`);
        }
      }
    } catch (error) {
      console.error('Failed to load blog forms:', error);
      alert('주문서 양식을 불러오는데 실패했습니다.');
      setShowBlogFormModal(false);
    } finally {
      setBlogFormLoading(false);
    }
  };

  const closeBlogFormModal = () => {
    setShowBlogFormModal(false);
    setBlogFormList([]);
    setBlogFormLink('');
    setBlogFormOrderId('');
    setExpandedFormId(null);
  };

  // 새 양식 링크 생성
  const createNewBlogForm = async () => {
    if (!blogFormOrderId) return;
    try {
      const form = await api.post<any>('/blog-order-form', { order_id: blogFormOrderId });
      const link = `${window.location.origin}/order-form/${form.token}`;
      setBlogFormLink(link);
      setBlogFormList(prev => [form, ...prev]);
    } catch (error) {
      alert('양식 생성 실패: ' + (error instanceof Error ? error.message : '알 수 없는 오류'));
    }
  };

  const copyFormLink = async (link: string) => {
    try {
      await navigator.clipboard.writeText(link);
      alert('링크가 복사되었습니다.');
    } catch {
      const input = document.createElement('input');
      input.value = link;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      alert('링크가 복사되었습니다.');
    }
  };

  const resetBlogForm = async (formId: string) => {
    if (!confirm('양식을 초기화하시겠습니까? 업체가 다시 작성할 수 있습니다.')) return;
    try {
      const result = await api.put<any>(`/blog-order-form/${formId}/reset`, {});
      setBlogFormList(prev => prev.map(f => f.id === formId ? result : f));
    } catch (error) {
      alert('초기화 실패: ' + (error instanceof Error ? error.message : '알 수 없는 오류'));
    }
  };

  const deleteBlogForm = async (formId: string) => {
    if (!confirm('이 양식을 삭제하시겠습니까?')) return;
    try {
      await api.delete(`/blog-order-form/${formId}`);
      setBlogFormList(prev => prev.filter(f => f.id !== formId));
    } catch (error) {
      alert('삭제 실패: ' + (error instanceof Error ? error.message : '알 수 없는 오류'));
    }
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

  // 로그를 시간 기준으로 그룹화 (같은 초에 발생한 변경들을 하나로 묶음)
  const groupLogsByTime = (logs: OrderEditLog[]) => {
    const groups: { timestamp: string; logs: OrderEditLog[]; edited_by: string; action: string }[] = [];

    logs.forEach((log) => {
      // 초 단위까지만 비교 (밀리초 무시)
      const timestamp = log.created_at.substring(0, 19);
      const existingGroup = groups.find(g => g.timestamp === timestamp && g.edited_by === log.edited_by);

      if (existingGroup) {
        existingGroup.logs.push(log);
      } else {
        groups.push({
          timestamp,
          logs: [log],
          edited_by: log.edited_by,
          action: log.action
        });
      }
    });

    return groups;
  };

  // 인센티브 관리 함수
  const addOrderIncentive = () => {
    setOrderIncentives(prev => [...prev, { employee_id: '', policy_id: '', amount: 0, quantity: 1, notes: '' }]);
  };

  const removeOrderIncentive = (index: number) => {
    setOrderIncentives(prev => prev.filter((_, i) => i !== index));
  };

  const updateOrderIncentive = (index: number, field: string, value: string | number) => {
    setOrderIncentives(prev => {
      const items = [...prev];
      const item = { ...items[index] };
      if (field === 'policy_id') {
        item.policy_id = value as string;
        const policy = incentivePolicies.find(p => p.id === value);
        if (policy) {
          item.amount = Number(policy.amount);
        }
      } else if (field === 'employee_id') {
        item.employee_id = value as string;
      } else if (field === 'amount') {
        item.amount = Number(value) || 0;
      } else if (field === 'quantity') {
        item.quantity = Number(value) || 1;
      } else if (field === 'notes') {
        item.notes = value as string;
      }
      items[index] = item;
      return items;
    });
  };

  const incentivesTotal = orderIncentives.reduce((sum, inc) => sum + (inc.amount * inc.quantity), 0);

  const addOrderVendorItem = (itemType: 'normal' | 'refund' = 'normal') => {
    setOrderVendorItems(prev => [...prev, { vendor_id: '', vendor_product_id: '', quantity: 1, unit_price: 0, total_price: 0, item_type: itemType }]);
  };

  const removeOrderVendorItem = (index: number) => {
    setOrderVendorItems(prev => prev.filter((_, i) => i !== index));
  };

  const updateOrderVendorItem = async (index: number, field: string, value: string | number) => {
    setOrderVendorItems(prev => {
      const items = [...prev];
      const item = { ...items[index] };
      if (field === 'vendor_id') {
        item.vendor_id = value as string;
        item.vendor_product_id = '';
        item.unit_price = 0;
        item.total_price = 0;
        if (value) loadVendorProducts(value as string);
      } else if (field === 'vendor_product_id') {
        item.vendor_product_id = value as string;
        const prods = vendorProductsMap[item.vendor_id] || [];
        const prod = prods.find(p => p.id === value);
        if (prod) {
          item.unit_price = Number(prod.cost_price);
          item.total_price = Number(prod.cost_price) * item.quantity;
        }
      } else if (field === 'quantity') {
        item.quantity = Number(value) || 1;
        item.total_price = item.unit_price * item.quantity;
      } else if (field === 'unit_price') {
        item.unit_price = Number(value) || 0;
        item.total_price = item.unit_price * item.quantity;
      }
      items[index] = item;
      return items;
    });
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">영업관리</h1>
          <p className="text-slate-500 mt-1">고객 및 주문을 관리하세요</p>
        </div>
        <button onClick={() => activeTab === 'customers' ? openCustomerModal() : openOrderModal()} className="btn-primary">
          <Plus className="h-5 w-5 mr-2" />{activeTab === 'customers' ? '거래처 등록' : '주문 등록'}
        </button>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-2xl shadow-soft border border-slate-100 p-1.5">
        <nav className="flex gap-1">
          <button onClick={() => setActiveTab('customers')} className={`flex-1 py-3 px-4 rounded-xl font-medium text-sm flex items-center justify-center gap-2 transition-all duration-200 ${activeTab === 'customers' ? 'bg-primary-600 text-white shadow-lg shadow-primary-500/25' : 'text-slate-600 hover:bg-slate-50'}`}>
            <Users className="h-5 w-5" />고객 관리
          </button>
          <button onClick={() => setActiveTab('orders')} className={`flex-1 py-3 px-4 rounded-xl font-medium text-sm flex items-center justify-center gap-2 transition-all duration-200 ${activeTab === 'orders' ? 'bg-primary-600 text-white shadow-lg shadow-primary-500/25' : 'text-slate-600 hover:bg-slate-50'}`}>
            <ShoppingCart className="h-5 w-5" />주문 관리
          </button>
        </nav>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl shadow-soft border border-slate-100 p-5">
        {activeTab === 'customers' ? (
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-slate-400" />
              <input type="text" placeholder="고객명 또는 회사명으로 검색" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="input input-with-icon" />
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-3">
              <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="select min-w-[140px]">
                <option value="">전체 상태</option>
                {(orderSubTab === 'all' || orderSubTab === 'pending') && <option value="pending">대기</option>}
                {(orderSubTab === 'all' || orderSubTab === 'active') && <option value="processing">진행중</option>}
                {(orderSubTab === 'all' || orderSubTab === 'near_due') && <option value="near_due">종료임박</option>}
                {(orderSubTab === 'all' || orderSubTab === 'closed') && <option value="completed">종료</option>}
              </select>
              <select value={filterCustomerId} onChange={(e) => setFilterCustomerId(e.target.value)} className="select min-w-[140px]">
                <option value="">전체 고객</option>
                {customers.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
              </select>
              <select value={filterCompany} onChange={(e) => setFilterCompany(e.target.value)} className="select min-w-[140px]">
                <option value="">전체 거래처</option>
                {uniqueCompanies.map((company) => (<option key={company} value={company}>{company}</option>))}
              </select>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-slate-400" />
                <span className="text-sm font-medium text-slate-600 whitespace-nowrap">주문일자</span>
                <input type="date" value={filterOrderDate} onChange={(e) => setFilterOrderDate(e.target.value)} className="input py-2 px-3 text-sm" />
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-slate-400" />
                <span className="text-sm font-medium text-slate-600 whitespace-nowrap">시작일/마감일</span>
                <input type="date" value={filterStartDateFrom} onChange={(e) => setFilterStartDateFrom(e.target.value)} className="input py-2 px-3 text-sm" />
                <span className="text-slate-400">~</span>
                <input type="date" value={filterStartDateTo} onChange={(e) => setFilterStartDateTo(e.target.value)} className="input py-2 px-3 text-sm" />
              </div>
              {(filterStatus || filterCustomerId || filterCompany || filterOrderDate || filterStartDateFrom || filterStartDateTo) && (
                <button onClick={() => { setFilterStatus(''); setFilterCustomerId(''); setFilterCompany(''); setFilterOrderDate(''); setFilterStartDateFrom(''); setFilterStartDateTo(''); }} className="btn-ghost text-red-600 hover:text-red-700 hover:bg-red-50">
                  필터 초기화
                </button>
              )}
            </div>
            {(filterStatus || filterCustomerId || filterCompany || filterOrderDate || filterStartDateFrom || filterStartDateTo) && (
              <p className="text-sm text-slate-500 font-medium">검색 결과: {filteredOrders.length}건</p>
            )}
          </div>
        )}
      </div>

      {/* Customers - Mobile Cards */}
      {activeTab === 'customers' && (
        <>
          {/* 모바일 버튼형 목록 */}
          <div className="md:hidden space-y-2">
            {customers.map((customer) => (
              <button
                key={customer.id}
                onClick={() => openCustomerDetailModal(customer)}
                className="w-full bg-white rounded-xl shadow-soft border border-slate-100 p-4 active:scale-[0.98] transition-all hover:border-primary-200 hover:shadow-md text-left"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center shadow-sm flex-shrink-0">
                      <Building className="h-4 w-4 text-white" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-900 truncate">{customer.company || '-'}</span>
                        {hasActiveOrders(customer.id) ? (
                          <span className="px-1.5 py-0.5 text-[10px] rounded-full font-semibold bg-green-100 text-green-700 flex-shrink-0">
                            활성화
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.5 text-[10px] rounded-full font-semibold bg-slate-100 text-slate-500 flex-shrink-0">
                            비활성화
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-slate-500 truncate">{customer.name}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={(e) => { e.stopPropagation(); openOrderModalForCustomer(customer.id); }}
                      className="p-2 text-green-600 bg-green-50 hover:bg-green-100 rounded-lg transition-colors"
                      title="주문등록"
                    >
                      <ShoppingCart className="h-4 w-4" />
                    </button>
                    <ChevronRight className="h-5 w-5 text-slate-400" />
                  </div>
                </div>
              </button>
            ))}
            {customers.length === 0 && (
              <div className="bg-white rounded-2xl shadow-soft border border-slate-100 p-8 text-center">
                <Users className="mx-auto h-12 w-12 text-slate-300" />
                <p className="mt-3 font-medium text-slate-700">등록된 고객이 없습니다</p>
                <p className="text-sm text-slate-500 mt-1">새 고객을 등록하여 시작하세요</p>
              </div>
            )}
          </div>

          {/* 데스크톱 카드형 리스트 뷰 */}
          <div className="hidden md:block space-y-3">
            {customers.map((customer) => (
              <div
                key={customer.id}
                onClick={() => openCustomerDetailModal(customer)}
                className="group bg-white rounded-2xl border border-slate-200 p-5 cursor-pointer transition-all duration-200 hover:shadow-lg hover:border-primary-300 hover:scale-[1.01] active:scale-[0.99]"
              >
                <div className="flex items-center justify-between gap-4">
                  {/* 좌측: 회사 정보 */}
                  <div className="flex items-center gap-4 min-w-0 flex-1">
                    <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-primary-500 via-primary-600 to-primary-600 flex items-center justify-center shadow-lg shadow-primary-500/30 flex-shrink-0">
                      <Building className="h-6 w-6 text-white" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-bold text-lg text-slate-900 truncate">{customer.company || '-'}</h3>
                        <span className={`px-2.5 py-0.5 text-xs rounded-full font-semibold ${getStatusColor(customer.status)}`}>
                          {getStatusLabel(customer.status)}
                        </span>
                        {hasActiveOrders(customer.id) ? (
                          <span className="px-2.5 py-0.5 text-xs rounded-full font-semibold bg-green-100 text-green-700 border border-green-200">
                            주문 활성화
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 text-xs rounded-full font-semibold bg-slate-100 text-slate-500 border border-slate-200">
                            주문 없음
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-slate-500 mt-0.5">{customer.name} · {customer.business_number || '사업자번호 없음'}</p>
                    </div>
                  </div>

                  {/* 중앙: 상세 정보 */}
                  <div className="hidden lg:flex items-center gap-8 text-sm">
                    <div className="flex items-center gap-2 text-slate-600">
                      <Tag className="h-4 w-4 text-slate-400" />
                      <span>{customer.industry || '-'}</span>
                      {customer.business_type && <span className="text-slate-400">/ {customer.business_type}</span>}
                    </div>
                    <div className="flex items-center gap-2 text-slate-600">
                      <Phone className="h-4 w-4 text-slate-400" />
                      <span>{customer.phone || '-'}</span>
                    </div>
                    {customer.email && (
                      <div className="flex items-center gap-2 text-slate-600">
                        <Mail className="h-4 w-4 text-slate-400" />
                        <span className="truncate max-w-[180px]">{customer.email}</span>
                      </div>
                    )}
                  </div>

                  {/* 우측: 액션 버튼 */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => { e.stopPropagation(); openOrderModalForCustomer(customer.id); }}
                        className="p-2.5 text-slate-400 hover:text-green-600 hover:bg-green-50 rounded-xl transition-colors"
                        title="주문등록"
                      >
                        <ShoppingCart className="h-4 w-4" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); openCustomerModal(customer); }}
                        className="p-2.5 text-slate-400 hover:text-primary-600 hover:bg-primary-50 rounded-xl transition-colors"
                        title="수정"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleCustomerDelete(customer.id); }}
                        className="p-2.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                        title="삭제"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    <ChevronRight className="h-5 w-5 text-slate-300 group-hover:text-primary-500 transition-colors" />
                  </div>
                </div>
              </div>
            ))}
            {customers.length === 0 && (
              <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
                <div className="h-16 w-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
                  <Users className="h-8 w-8 text-slate-400" />
                </div>
                <p className="font-semibold text-slate-700">등록된 고객이 없습니다</p>
                <p className="text-sm text-slate-500 mt-1">새 고객을 등록하여 시작하세요</p>
              </div>
            )}
          </div>
        </>
      )}

      {/* Order Sub-Tabs */}
      {activeTab === 'orders' && (
        <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 sm:overflow-visible sm:flex-wrap">
          <button
            onClick={() => { setOrderSubTab('all'); setSelectedOrders(new Set()); setFilterStatus(''); }}
            className={`flex items-center px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${orderSubTab === 'all' ? 'bg-gradient-to-r from-primary-600 to-primary-500 text-white shadow-lg shadow-primary-500/25' : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'}`}
          >
            <List className="h-4 w-4 mr-2" />
            전체
            <span className={`ml-2 px-2 py-0.5 text-xs rounded-full font-semibold ${orderSubTab === 'all' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'}`}>{orders.length}</span>
          </button>
          <button
            onClick={() => { setOrderSubTab('pending'); setSelectedOrders(new Set()); setFilterStatus(''); }}
            className={`flex items-center px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${orderSubTab === 'pending' ? 'bg-gradient-to-r from-amber-500 to-yellow-500 text-white shadow-lg shadow-amber-500/25' : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'}`}
          >
            <Clock className="h-4 w-4 mr-2" />
            대기목록
            <span className={`ml-2 px-2 py-0.5 text-xs rounded-full font-semibold ${orderSubTab === 'pending' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'}`}>{pendingOrderCount}</span>
          </button>
          <button
            onClick={() => { setOrderSubTab('active'); setSelectedOrders(new Set()); setFilterStatus(''); }}
            className={`flex items-center px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${orderSubTab === 'active' ? 'bg-gradient-to-r from-primary-600 to-primary-500 text-white shadow-lg shadow-primary-500/25' : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'}`}
          >
            <ClipboardList className="h-4 w-4 mr-2" />
            주문목록
            <span className={`ml-2 px-2 py-0.5 text-xs rounded-full font-semibold ${orderSubTab === 'active' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'}`}>{activeOrderCount}</span>
          </button>
          <button
            onClick={() => { setOrderSubTab('near_due'); setSelectedOrders(new Set()); setFilterStatus(''); }}
            className={`flex items-center px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${orderSubTab === 'near_due' ? 'bg-gradient-to-r from-orange-600 to-orange-500 text-white shadow-lg shadow-orange-500/25' : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'}`}
          >
            <AlertTriangle className="h-4 w-4 mr-2" />
            종료임박
            <span className={`ml-2 px-2 py-0.5 text-xs rounded-full font-semibold ${orderSubTab === 'near_due' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'}`}>{nearDueOrderCount}</span>
          </button>
          <button
            onClick={() => { setOrderSubTab('closed'); setSelectedOrders(new Set()); setFilterStatus(''); }}
            className={`flex items-center px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${orderSubTab === 'closed' ? 'bg-gradient-to-r from-slate-700 to-slate-600 text-white shadow-lg shadow-slate-500/25' : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'}`}
          >
            <CheckCircle className="h-4 w-4 mr-2" />
            종료목록
            <span className={`ml-2 px-2 py-0.5 text-xs rounded-full font-semibold ${orderSubTab === 'closed' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'}`}>{closedOrderCount}</span>
          </button>
        </div>
      )}

      {/* Orders - Mobile Cards & Desktop Table */}
      {activeTab === 'orders' && (
        <>
          {/* 모바일 버튼형 목록 */}
          <div className="md:hidden space-y-2">
            {selectedOrders.size > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-center justify-between">
                <span className="text-sm text-red-700 font-semibold">{selectedOrders.size}건 선택됨</span>
                <div className="flex items-center gap-2">
                  <button onClick={() => setSelectedOrders(new Set())} className="text-sm text-slate-600 px-2 py-1">해제</button>
                  <button onClick={handleBulkDelete} className="text-sm text-red-600 font-medium px-2 py-1">삭제</button>
                </div>
              </div>
            )}
            {filteredOrders.map((order) => (
              <button
                key={order.id}
                onClick={() => openOrderDetailModal(order)}
                className={`w-full text-left bg-white rounded-xl shadow-soft border ${selectedOrders.has(order.id) ? 'border-primary-300 bg-primary-50/30' : 'border-slate-100'} p-4 active:scale-[0.98] transition-all hover:border-primary-200 hover:shadow-md`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <input
                      type="checkbox"
                      checked={selectedOrders.has(order.id)}
                      onChange={(e) => { e.stopPropagation(); toggleOrderSelect(order.id); }}
                      onClick={(e) => e.stopPropagation()}
                      className="h-4 w-4 text-primary-600 border-slate-300 rounded focus:ring-primary-500 cursor-pointer flex-shrink-0"
                    />
                    <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center flex-shrink-0">
                      <ShoppingCart className="h-4 w-4 text-white" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-slate-900 truncate">{(order as any).customer_company || order.customer_name}</div>
                      <div className="flex items-center gap-2 text-sm text-slate-500">
                        <span className="truncate">{(order as any).assignee_name || '담당자 미지정'}</span>
                        <span className="text-slate-300">|</span>
                        <span className="flex-shrink-0">{order.order_date ? formatDate(order.order_date) : '-'}</span>
                      </div>
                      {(order as any).items_summary && (
                        <div className="text-xs text-primary-600 mt-1 truncate">
                          {(order as any).items_summary}{parseInt((order as any).items_count) > 3 ? ` 외 ${parseInt((order as any).items_count) - 3}건` : ''} · {parseInt((order as any).total_quantity || 0)}개
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={`px-2.5 py-1 text-xs rounded-full font-semibold ${getStatusColor(order.status)}`}>
                      {getStatusLabel(order.status)}
                    </span>
                    <ChevronRight className="h-5 w-5 text-slate-400" />
                  </div>
                </div>
              </button>
            ))}
            {filteredOrders.length === 0 && (
              <div className="bg-white rounded-2xl shadow-soft border border-slate-100 p-8 text-center">
                <ShoppingCart className="mx-auto h-12 w-12 text-slate-300" />
                <p className="mt-3 font-medium text-slate-700">{orders.length > 0 ? '검색 결과가 없습니다' : '등록된 주문이 없습니다'}</p>
                <p className="text-sm text-slate-500 mt-1">{orders.length > 0 ? '다른 필터를 선택해보세요' : '새 주문을 등록하여 시작하세요'}</p>
              </div>
            )}
          </div>

          {/* 데스크톱 테이블형 리스트 뷰 */}
          <div className="hidden md:block">
            {/* 선택 항목 액션 바 */}
            {selectedOrders.size > 0 && (
              <div className="bg-gradient-to-r from-red-50 to-orange-50 rounded-xl border border-red-200 px-5 py-3 mb-3 flex items-center justify-between">
                <span className="text-sm text-red-700 font-semibold">{selectedOrders.size}건 선택됨</span>
                <div className="flex items-center gap-2">
                  <button onClick={() => setSelectedOrders(new Set())} className="px-3 py-1.5 text-sm text-slate-600 hover:bg-white rounded-lg transition-colors">선택 해제</button>
                  <button onClick={handleBulkDelete} className="px-3 py-1.5 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center gap-1.5">
                    <Trash2 className="h-4 w-4" />삭제
                  </button>
                </div>
              </div>
            )}

            {/* 테이블 */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-left">
                      <input
                        type="checkbox"
                        checked={filteredOrders.length > 0 && selectedOrders.size === filteredOrders.length}
                        onChange={toggleSelectAll}
                        className="h-4 w-4 text-primary-600 border-slate-300 rounded focus:ring-primary-500 cursor-pointer"
                      />
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">업체명</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">담당자</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">주문일자</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">상품명</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider">수량</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider">상태</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">금액</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider">관리</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredOrders.map((order) => (
                    <tr
                      key={order.id}
                      onClick={() => openOrderDetailModal(order)}
                      className={`group cursor-pointer transition-colors hover:bg-slate-50 ${
                        selectedOrders.has(order.id) ? 'bg-primary-50/50' : ''
                      }`}
                    >
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedOrders.has(order.id)}
                          onChange={() => toggleOrderSelect(order.id)}
                          className="h-4 w-4 text-primary-600 border-slate-300 rounded focus:ring-primary-500 cursor-pointer"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs text-slate-400">{order.order_number}</span>
                          <span className="font-medium text-slate-900 truncate max-w-[150px]">
                            {(order as any).customer_company || order.customer_name}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">
                        {(order as any).assignee_name || <span className="text-slate-400">미지정</span>}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">
                        {order.order_date ? formatDate(order.order_date) : '-'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm text-slate-900 truncate max-w-[200px]">
                          {(order as any).items_summary || <span className="text-slate-400">-</span>}
                          {parseInt((order as any).items_count) > 3 && (
                            <span className="text-slate-400 ml-1">외 {parseInt((order as any).items_count) - 3}건</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center text-sm text-slate-600">
                        {parseInt((order as any).total_quantity || 0).toLocaleString()}개
                      </td>
                      <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                        <select
                          value={order.status}
                          onChange={(e) => handleStatusChange(order.id, e.target.value)}
                          className={`px-2 py-1 text-xs rounded-full border-0 cursor-pointer font-semibold focus:ring-2 focus:ring-primary-500 ${getStatusColor(order.status)}`}
                        >
                          <option value="pending">대기</option>
                          <option value="processing">진행중</option>
                          <option value="near_due">종료임박</option>
                          <option value="completed">종료</option>
                        </select>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={`font-semibold ${order.total_amount < 0 ? 'text-red-600' : 'text-slate-900'}`}>
                          {order.total_amount < 0 ? '-' : ''}{formatCurrency(Math.abs(order.total_amount))}
                        </span>
                      </td>
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={() => openLogModal(order)} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded transition-colors" title="수정 내역">
                            <History className="h-4 w-4" />
                          </button>
                          <button onClick={() => openOrderModal(order)} disabled={isLoadingOrderDetails} className="p-1.5 text-slate-400 hover:text-primary-600 hover:bg-primary-50 rounded transition-colors disabled:opacity-50" title="수정">
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button onClick={() => handleOrderDelete(order.id)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors" title="삭제">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {filteredOrders.length === 0 && (
                <div className="p-12 text-center">
                  <ShoppingCart className="mx-auto h-12 w-12 text-slate-300" />
                  <p className="mt-3 font-medium text-slate-700">{orders.length > 0 ? '검색 결과가 없습니다' : '등록된 주문이 없습니다'}</p>
                  <p className="text-sm text-slate-500 mt-1">{orders.length > 0 ? '다른 필터를 선택해보세요' : '새 주문을 등록하여 시작하세요'}</p>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Customer Modal */}
      {showCustomerModal && (
        <>
          <div className="modal-overlay" onClick={closeCustomerModal} />
          <div className="modal-container">
            <div className="modal modal-lg animate-scale-in max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">{editingCustomer ? '거래처 수정' : '거래처 등록'}</h2>
                  <p className="text-sm text-slate-500 mt-1">{editingCustomer ? '거래처 정보를 수정하세요' : '새 거래처를 등록하세요'}</p>
                </div>
                <button onClick={closeCustomerModal} className="btn-icon"><X className="h-5 w-5" /></button>
              </div>
              <form onSubmit={handleCustomerSubmit}>
                <div className="modal-body space-y-5 overflow-y-auto max-h-[calc(90vh-220px)]">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div><label className="block text-sm font-medium text-slate-700 mb-2">대표자명 *</label><input type="text" value={customerFormData.name} onChange={(e) => setCustomerFormData({ ...customerFormData, name: e.target.value })} required className="input" placeholder="홍길동" /></div>
                  <div><label className="block text-sm font-medium text-slate-700 mb-2">업체명</label><input type="text" value={customerFormData.company} onChange={(e) => setCustomerFormData({ ...customerFormData, company: e.target.value })} className="input" placeholder="(주)회사명" /></div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div><label className="block text-sm font-medium text-slate-700 mb-2">연락처1</label><input type="tel" value={customerFormData.phone} onChange={(e) => setCustomerFormData({ ...customerFormData, phone: e.target.value })} placeholder="010-0000-0000" className="input" /></div>
                  <div><label className="block text-sm font-medium text-slate-700 mb-2">연락처2</label><input type="tel" value={customerFormData.phone2} onChange={(e) => setCustomerFormData({ ...customerFormData, phone2: e.target.value })} placeholder="02-0000-0000" className="input" /></div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div><label className="block text-sm font-medium text-slate-700 mb-2">이메일</label><input type="email" value={customerFormData.email} onChange={(e) => setCustomerFormData({ ...customerFormData, email: e.target.value })} className="input" placeholder="email@company.com" /></div>
                  <div><label className="block text-sm font-medium text-slate-700 mb-2">사업자등록번호</label><input type="text" value={customerFormData.business_number} onChange={(e) => setCustomerFormData({ ...customerFormData, business_number: e.target.value })} placeholder="000-00-00000" className="input" /></div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div><label className="block text-sm font-medium text-slate-700 mb-2">업종</label><input type="text" value={customerFormData.industry} onChange={(e) => setCustomerFormData({ ...customerFormData, industry: e.target.value })} placeholder="예: 소프트웨어 개발" className="input" /></div>
                  <div><label className="block text-sm font-medium text-slate-700 mb-2">업태</label><input type="text" value={customerFormData.business_type} onChange={(e) => setCustomerFormData({ ...customerFormData, business_type: e.target.value })} placeholder="예: 서비스업" className="input" /></div>
                </div>
                <div><label className="block text-sm font-medium text-slate-700 mb-2">사업장주소</label><input type="text" value={customerFormData.address} onChange={(e) => setCustomerFormData({ ...customerFormData, address: e.target.value })} className="input" placeholder="서울시 강남구..." /></div>

                {/* 서비스별 단가 설정 */}
                <div className="border-t pt-4 mt-4">
                  <button
                    type="button"
                    onClick={() => setShowPricingSection(!showPricingSection)}
                    className="flex items-center justify-between w-full text-left"
                  >
                    <span className="text-sm font-medium text-gray-900 flex items-center">
                      <Tag className="inline h-4 w-4 mr-1 text-primary-600" />
                      서비스별 단가 설정
                      {Object.values(customerServicePrices).filter(v => v !== '').length > 0 && (
                        <span className="ml-2 px-2 py-0.5 text-xs bg-primary-100 text-primary-700 rounded-full">
                          {Object.values(customerServicePrices).filter(v => v !== '').length}개 설정됨
                        </span>
                      )}
                    </span>
                    <span className="text-gray-400 text-sm">{showPricingSection ? '접기 ▲' : '펼치기 ▼'}</span>
                  </button>

                  {showPricingSection && services.length > 0 && (
                    <div className="mt-3 border rounded-lg overflow-hidden">
                      <table className="min-w-full divide-y divide-gray-200 text-sm">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">업체명</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">서비스명</th>
                            <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 w-28">기준가</th>
                            <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 w-32">업체 단가</th>
                            <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 w-16">차이</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {services.map((svc) => {
                            const custPrice = customerServicePrices[svc.id];
                            const hasCustomPrice = custPrice !== undefined && custPrice !== '';
                            const diff = hasCustomPrice ? Number(custPrice) - Number(svc.price) : 0;
                            return (
                              <tr key={svc.id} className={hasCustomPrice ? 'bg-blue-50/50' : ''}>
                                <td className="px-3 py-2 text-gray-500">{svc.category}</td>
                                <td className="px-3 py-2 font-medium text-gray-900">{svc.name}</td>
                                <td className="px-3 py-2 text-right text-gray-500">{Number(svc.price).toLocaleString()}원</td>
                                <td className="px-3 py-2">
                                  <input
                                    type="number"
                                    value={customerServicePrices[svc.id] ?? ''}
                                    onChange={(e) => setCustomerServicePrices({ ...customerServicePrices, [svc.id]: e.target.value })}
                                    placeholder="기준가 적용"
                                    min="0"
                                    className="w-full px-2 py-1 border rounded text-sm text-right focus:ring-1 focus:ring-primary-500"
                                  />
                                </td>
                                <td className="px-3 py-2 text-center">
                                  {hasCustomPrice && diff !== 0 && (
                                    <span className={`text-xs font-medium ${diff > 0 ? 'text-red-600' : 'text-blue-600'}`}>
                                      {diff > 0 ? '+' : ''}{diff.toLocaleString()}
                                    </span>
                                  )}
                                  {hasCustomPrice && diff === 0 && (
                                    <span className="text-xs text-gray-400">동일</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                      {services.length === 0 && (
                        <div className="text-center py-4 text-sm text-gray-400">등록된 서비스가 없습니다.</div>
                      )}
                    </div>
                  )}

                  {showPricingSection && services.length === 0 && (
                    <div className="mt-3 p-4 border border-dashed rounded-lg text-center text-sm text-gray-400">
                      등록된 서비스 상품이 없습니다. 서비스상품 메뉴에서 먼저 등록해주세요.
                    </div>
                  )}
                </div>

                </div>
                <div className="modal-footer">
                  <button type="button" onClick={closeCustomerModal} className="btn-secondary">취소</button>
                  <button type="submit" className="btn-primary">{editingCustomer ? '수정' : '등록'}</button>
                </div>
              </form>
            </div>
          </div>
        </>
      )}

      {/* Order Log Modal */}
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
                    주문번호: {selectedOrderForLog.order_number} | {(selectedOrderForLog as any).customer_company || selectedOrderForLog.customer_name}
                  </p>
                </div>
                <button onClick={closeLogModal} className="text-gray-400 hover:text-gray-600"><X className="h-6 w-6" /></button>
              </div>

              {isLoadingLogs ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
                </div>
              ) : orderLogs.length > 0 ? (
                <div className="space-y-4">
                  {groupLogsByTime(orderLogs).map((group, groupIndex) => {
                    const actionInfo = getActionLabel(group.action);
                    const hasRefundLog = group.logs.some(log => isRefundLog(log));
                    return (
                      <div key={groupIndex} className="border-2 border-gray-200 rounded-xl p-4 bg-white shadow-sm">
                        {/* 그룹 헤더 */}
                        <div className="flex items-center justify-between pb-3 mb-3 border-b border-gray-100">
                          <div className="flex items-center gap-2">
                            <span className={`px-2.5 py-1 text-xs font-semibold rounded-full ${actionInfo.color}`}>
                              {actionInfo.text}
                            </span>
                            {hasRefundLog && (
                              <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-orange-100 text-orange-700">
                                환불 포함
                              </span>
                            )}
                            <span className="text-sm text-gray-500">
                              {group.logs.length > 1 ? `${group.logs.length}개 항목 변경` : '1개 항목 변경'}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-gray-500">
                            <span className="flex items-center">
                              <Clock className="h-3.5 w-3.5 mr-1" />
                              {formatLogDate(group.logs[0].created_at)}
                            </span>
                            <span className="flex items-center">
                              <UserCheck className="h-3.5 w-3.5 mr-1" />
                              {group.edited_by}
                            </span>
                          </div>
                        </div>

                        {/* 그룹 내 개별 변경 항목들 */}
                        <div className="space-y-2">
                          {group.logs.map((log) => {
                            const showRefundBadge = isRefundLog(log);
                            return (
                              <div key={log.id} className="bg-gray-50 rounded-lg p-3">
                                <div className="flex items-center gap-2">
                                  {showRefundBadge && (
                                    <span className="px-1.5 py-0.5 text-xs font-medium rounded bg-orange-100 text-orange-600">
                                      환불
                                    </span>
                                  )}
                                  <span className="text-sm font-medium text-gray-800">{log.change_summary}</span>
                                </div>
                                {log.old_value && log.new_value && (
                                  <div className="mt-2 text-xs bg-white rounded p-2 border border-gray-200">
                                    <span className="text-red-600 line-through">{log.old_value}</span>
                                    <span className="mx-2 text-gray-400">→</span>
                                    <span className="text-green-600 font-medium">{log.new_value}</span>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
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

      {/* Order Modal */}
      {showOrderModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75" onClick={closeOrderModal} />
            <div className="relative bg-white rounded-xl shadow-xl max-w-2xl w-full mx-auto p-6 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-900">{editingOrder ? '주문 수정' : '주문 등록'}</h2>
                <button onClick={closeOrderModal} className="text-gray-400 hover:text-gray-600"><X className="h-6 w-6" /></button>
              </div>

              <form onSubmit={handleOrderSubmit} className="space-y-4">
                {editingOrder && (
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <span className="text-sm font-medium text-gray-700">주문번호: </span>
                    <span className="text-sm text-gray-900">{editingOrder.order_number}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1"><Building className="inline h-4 w-4 mr-1" />고객 *</label>
                    <select value={orderFormData.customer_id} onChange={(e) => setOrderFormData({ ...orderFormData, customer_id: e.target.value })} required className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500">
                      <option value="">고객 선택</option>
                      {customers.map((c) => (<option key={c.id} value={c.id}>{c.name} {c.company ? `(${c.company})` : ''}</option>))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1"><UserCheck className="inline h-4 w-4 mr-1" />담당자</label>
                    <select value={orderFormData.assignee_id} onChange={(e) => setOrderFormData({ ...orderFormData, assignee_id: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500">
                      <option value="">담당자 선택</option>
                      {employees.map((emp) => (<option key={emp.id} value={emp.id}>{emp.name} ({emp.department}/{emp.position})</option>))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div><label className="block text-sm font-medium text-gray-700 mb-1"><Calendar className="inline h-4 w-4 mr-1" />주문일 *</label><input type="date" value={orderFormData.order_date} onChange={(e) => setOrderFormData({ ...orderFormData, order_date: e.target.value })} required className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500" /></div>
                  <div><label className="block text-sm font-medium text-gray-700 mb-1"><Calendar className="inline h-4 w-4 mr-1" />시작일</label><input type="date" value={orderFormData.start_date} onChange={(e) => setOrderFormData({ ...orderFormData, start_date: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500" /></div>
                  <div><label className="block text-sm font-medium text-gray-700 mb-1"><Calendar className="inline h-4 w-4 mr-1" />마감일</label><input type="date" value={orderFormData.due_date} onChange={(e) => setOrderFormData({ ...orderFormData, due_date: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500" /></div>
                </div>

                {/* 서비스 상품 */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-gray-700">
                      <ShoppingCart className="inline h-4 w-4 mr-1" />
                      서비스 상품
                    </label>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => addOrderItem('normal')} className="inline-flex items-center px-3 py-1 text-xs bg-primary-50 text-primary-700 rounded-lg hover:bg-primary-100"><Plus className="h-3 w-3 mr-1" />상품 추가</button>
                      {editingOrder && (
                        <button type="button" onClick={() => addOrderItem('refund')} className="inline-flex items-center px-3 py-1 text-xs bg-red-50 text-red-700 rounded-lg hover:bg-red-100"><RotateCcw className="h-3 w-3 mr-1" />환불 추가</button>
                      )}
                    </div>
                  </div>

                  {isLoadingOrderDetails ? (
                    <div className="border border-dashed rounded-lg p-6 text-center">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600 mx-auto"></div>
                      <p className="mt-2 text-sm text-gray-500">주문 항목을 불러오는 중...</p>
                    </div>
                  ) : orderItems.length > 0 ? (
                    <div className="border rounded-lg overflow-hidden">
                      <table className="min-w-full divide-y divide-gray-200 text-sm">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 w-16">유형</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 w-24">공급사</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">서비스 상품</th>
                            <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 w-28">판매가</th>
                            <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 w-20">수량</th>
                            <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 w-28">합계</th>
                            <th className="px-3 py-2 w-10"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {orderItems.map((item, index) => (
                            <tr key={index} className={item.item_type === 'refund' ? 'bg-red-50/50' : ''}>
                              <td className="px-3 py-2">
                                <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${item.item_type === 'refund' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
                                  {item.item_type === 'refund' ? '환불' : '매출'}
                                </span>
                              </td>
                              <td className="px-3 py-2 text-xs text-slate-500">
                                {(() => { const svc = services.find(s => s.id === item.service_id); return svc?.vendor_name || '-'; })()}
                              </td>
                              <td className="px-3 py-2">
                                <select value={item.service_id} onChange={(e) => updateOrderItem(index, 'service_id', e.target.value)} className="w-full px-2 py-1 border rounded text-sm focus:ring-1 focus:ring-primary-500">
                                  <option value="">선택</option>
                                  {services.filter(s => s.category !== '업체상품').map(s => (<option key={s.id} value={s.id}>{s.name} ({s.category})</option>))}
                                </select>
                              </td>
                              <td className="px-3 py-2">
                                <input type="number" value={item.unit_price} onChange={(e) => updateOrderItem(index, 'unit_price', e.target.value)} min="0" className="w-full px-2 py-1 border rounded text-sm text-right focus:ring-1 focus:ring-primary-500" />
                              </td>
                              <td className="px-3 py-2">
                                <input type="number" value={item.quantity} onChange={(e) => updateOrderItem(index, 'quantity', e.target.value)} min="1" className="w-full px-2 py-1 border rounded text-sm text-center focus:ring-1 focus:ring-primary-500" />
                              </td>
                              <td className={`px-3 py-2 text-right font-medium ${item.item_type === 'refund' ? 'text-red-600' : ''}`}>
                                {item.item_type === 'refund' ? '-' : ''}{item.total_price.toLocaleString()}원
                              </td>
                              <td className="px-3 py-2"><button type="button" onClick={() => removeOrderItem(index)} className="text-red-500 hover:text-red-700"><X className="h-4 w-4" /></button></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <div className="px-3 py-3 border-t bg-gray-50 space-y-1">
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-gray-600">매출 합계</span>
                          <span className="font-medium text-blue-700">{normalItemsTotal.toLocaleString()}원</span>
                        </div>
                        {refundItemsTotal > 0 && (
                          <div className="flex justify-between items-center text-sm">
                            <span className="text-gray-600">환불 합계</span>
                            <span className="font-medium text-red-600">-{refundItemsTotal.toLocaleString()}원</span>
                          </div>
                        )}
                        <div className="flex justify-between items-center pt-2 border-t">
                          <span className="text-sm font-medium text-gray-700">순매출</span>
                          <span className={`text-lg font-bold ${netTotal < 0 ? 'text-red-700' : 'text-primary-700'}`}>
                            {netTotal < 0 ? '-' : ''}{Math.abs(netTotal).toLocaleString()}원
                          </span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="border border-dashed rounded-lg p-4 text-center text-sm text-gray-400">
                      서비스 상품을 추가해주세요
                    </div>
                  )}
                </div>

                {/* 업체상품 */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-gray-700">
                      <Truck className="inline h-4 w-4 mr-1" />
                      업체상품
                    </label>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => addOrderVendorItem('normal')} className="inline-flex items-center px-3 py-1 text-xs bg-orange-50 text-orange-700 rounded-lg hover:bg-orange-100"><Plus className="h-3 w-3 mr-1" />업체상품 추가</button>
                      {editingOrder && (
                        <button type="button" onClick={() => addOrderVendorItem('refund')} className="inline-flex items-center px-3 py-1 text-xs bg-red-50 text-red-700 rounded-lg hover:bg-red-100"><RotateCcw className="h-3 w-3 mr-1" />업체 환불</button>
                      )}
                    </div>
                  </div>

                  {isLoadingOrderDetails ? (
                    <div className="border border-dashed rounded-lg p-4 text-center">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-orange-600 mx-auto"></div>
                      <p className="mt-2 text-sm text-gray-500">업체상품을 불러오는 중...</p>
                    </div>
                  ) : orderVendorItems.length > 0 ? (
                    <div className="border rounded-lg overflow-hidden">
                      <table className="min-w-full divide-y divide-gray-200 text-sm">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 w-16">유형</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">업체</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">상품</th>
                            <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 w-20">수량</th>
                            <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 w-24">원가</th>
                            <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 w-28">합계</th>
                            <th className="px-3 py-2 w-10"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {orderVendorItems.map((vi, index) => {
                            const vendorProds = vendorProductsMap[vi.vendor_id] || [];
                            return (
                              <tr key={index} className={vi.item_type === 'refund' ? 'bg-red-50/50' : ''}>
                                <td className="px-3 py-2">
                                  <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${vi.item_type === 'refund' ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'}`}>
                                    {vi.item_type === 'refund' ? '환입' : '지출'}
                                  </span>
                                </td>
                                <td className="px-3 py-2">
                                  <select value={vi.vendor_id} onChange={(e) => updateOrderVendorItem(index, 'vendor_id', e.target.value)} className="w-full px-2 py-1 border rounded text-sm focus:ring-1 focus:ring-primary-500">
                                    <option value="">업체 선택</option>
                                    {vendors.map(v => (<option key={v.id} value={v.id}>{v.name}</option>))}
                                  </select>
                                </td>
                                <td className="px-3 py-2">
                                  <select value={vi.vendor_product_id} onChange={(e) => updateOrderVendorItem(index, 'vendor_product_id', e.target.value)} disabled={!vi.vendor_id} className="w-full px-2 py-1 border rounded text-sm focus:ring-1 focus:ring-primary-500 disabled:bg-gray-100">
                                    <option value="">상품 선택</option>
                                    {vendorProds.map(p => (<option key={p.id} value={p.id}>{p.product_name} {Number(p.cost_price) === 0 ? '(수기)' : ''}</option>))}
                                  </select>
                                </td>
                                <td className="px-3 py-2">
                                  <input type="number" value={vi.quantity} onChange={(e) => updateOrderVendorItem(index, 'quantity', e.target.value)} min="1" className="w-full px-2 py-1 border rounded text-sm text-center focus:ring-1 focus:ring-primary-500" />
                                </td>
                                <td className="px-3 py-2">
                                  {(() => {
                                    const prod = vendorProds.find(p => p.id === vi.vendor_product_id);
                                    const isManualPrice = prod && Number(prod.cost_price) === 0;
                                    return isManualPrice ? (
                                      <input type="number" value={vi.unit_price} onChange={(e) => updateOrderVendorItem(index, 'unit_price', e.target.value)} min="0" placeholder="원가 입력" className="w-full px-2 py-1 border border-orange-300 rounded text-sm text-right focus:ring-1 focus:ring-orange-500 bg-orange-50" />
                                    ) : (
                                      <span className="block text-right text-gray-500">{vi.unit_price ? vi.unit_price.toLocaleString() + '원' : '-'}</span>
                                    );
                                  })()}
                                </td>
                                <td className={`px-3 py-2 text-right font-medium ${vi.item_type === 'refund' ? 'text-green-600' : 'text-orange-600'}`}>
                                  {vi.item_type === 'refund' ? '+' : '-'}{vi.total_price ? vi.total_price.toLocaleString() + '원' : '-'}
                                </td>
                                <td className="px-3 py-2"><button type="button" onClick={() => removeOrderVendorItem(index)} className="text-red-500 hover:text-red-700"><X className="h-4 w-4" /></button></td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                      <div className="px-3 py-2 border-t bg-orange-50 space-y-1">
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-orange-700">업체상품 지출</span>
                          <span className="font-medium text-orange-700">-{orderVendorItems.filter(vi => vi.item_type === 'normal').reduce((sum, vi) => sum + vi.total_price, 0).toLocaleString()}원</span>
                        </div>
                        {orderVendorItems.filter(vi => vi.item_type === 'refund').length > 0 && (
                          <div className="flex justify-between items-center text-xs">
                            <span className="text-green-700">업체상품 환입</span>
                            <span className="font-medium text-green-600">+{orderVendorItems.filter(vi => vi.item_type === 'refund').reduce((sum, vi) => sum + vi.total_price, 0).toLocaleString()}원</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="border border-dashed rounded-lg p-3 text-center text-sm text-gray-400">
                      업체상품을 추가하려면 위 버튼을 클릭하세요
                    </div>
                  )}
                </div>

                {/* 인센티브 */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-gray-700">
                      <Award className="inline h-4 w-4 mr-1" />
                      인센티브
                    </label>
                    <button type="button" onClick={addOrderIncentive} className="inline-flex items-center px-3 py-1 text-xs bg-purple-50 text-purple-700 rounded-lg hover:bg-purple-100"><Plus className="h-3 w-3 mr-1" />인센티브 추가</button>
                  </div>

                  {orderIncentives.length > 0 ? (
                    <div className="border rounded-lg overflow-hidden">
                      <table className="min-w-full divide-y divide-gray-200 text-sm">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">직원</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">정책</th>
                            <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 w-24">단가</th>
                            <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 w-20">수량</th>
                            <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 w-28">합계</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">메모</th>
                            <th className="px-3 py-2 w-10"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {orderIncentives.map((inc, index) => (
                            <tr key={index} className="bg-purple-50/30">
                              <td className="px-3 py-2">
                                <select value={inc.employee_id} onChange={(e) => updateOrderIncentive(index, 'employee_id', e.target.value)} className="w-full px-2 py-1 border rounded text-sm focus:ring-1 focus:ring-purple-500">
                                  <option value="">직원 선택</option>
                                  {employees.filter(e => e.status === 'active').map(e => (<option key={e.id} value={e.id}>{e.name} ({e.department})</option>))}
                                </select>
                              </td>
                              <td className="px-3 py-2">
                                <select value={inc.policy_id} onChange={(e) => updateOrderIncentive(index, 'policy_id', e.target.value)} className="w-full px-2 py-1 border rounded text-sm focus:ring-1 focus:ring-purple-500">
                                  <option value="">직접 입력</option>
                                  {incentivePolicies.map(p => (<option key={p.id} value={p.id}>{p.name} ({Number(p.amount).toLocaleString()}원)</option>))}
                                </select>
                              </td>
                              <td className="px-3 py-2">
                                <input type="number" value={inc.amount} onChange={(e) => updateOrderIncentive(index, 'amount', e.target.value)} min="0" className="w-full px-2 py-1 border rounded text-sm text-right focus:ring-1 focus:ring-purple-500" placeholder="단가" />
                              </td>
                              <td className="px-3 py-2">
                                <input type="number" value={inc.quantity} onChange={(e) => updateOrderIncentive(index, 'quantity', e.target.value)} min="1" className="w-full px-2 py-1 border rounded text-sm text-center focus:ring-1 focus:ring-purple-500" />
                              </td>
                              <td className="px-3 py-2 text-right font-medium text-purple-700">
                                {(inc.amount * inc.quantity).toLocaleString()}원
                              </td>
                              <td className="px-3 py-2">
                                <input type="text" value={inc.notes} onChange={(e) => updateOrderIncentive(index, 'notes', e.target.value)} className="w-full px-2 py-1 border rounded text-sm focus:ring-1 focus:ring-purple-500" placeholder="메모" />
                              </td>
                              <td className="px-3 py-2"><button type="button" onClick={() => removeOrderIncentive(index)} className="text-red-500 hover:text-red-700"><X className="h-4 w-4" /></button></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <div className="px-3 py-2 border-t bg-purple-50 flex justify-between items-center text-xs">
                        <span className="text-purple-700">인센티브 합계</span>
                        <span className="font-medium text-purple-700">{incentivesTotal.toLocaleString()}원</span>
                      </div>
                    </div>
                  ) : (
                    <div className="border border-dashed rounded-lg p-3 text-center text-sm text-gray-400">
                      인센티브를 추가하려면 위 버튼을 클릭하세요
                    </div>
                  )}
                </div>

                {/* 정산 요약 */}
                {(orderItems.length > 0 || orderVendorItems.length > 0 || orderIncentives.length > 0) && (
                  <div className="p-4 bg-primary-50 rounded-lg border border-primary-200">
                    <h4 className="text-sm font-medium text-primary-800 mb-3 flex items-center">
                      <Calculator className="h-4 w-4 mr-1.5" />
                      정산 요약
                    </h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">서비스 순매출</span>
                        <span className={`font-medium ${netTotal >= 0 ? 'text-blue-700' : 'text-red-600'}`}>
                          {netTotal >= 0 ? '' : '-'}{Math.abs(netTotal).toLocaleString()}원
                        </span>
                      </div>
                      {orderVendorItems.length > 0 && (
                        <div className="flex justify-between text-xs text-gray-500">
                          <span>업체상품 순지출</span>
                          <span>
                            -{(orderVendorItems.filter(vi => vi.item_type === 'normal').reduce((sum, vi) => sum + vi.total_price, 0) - orderVendorItems.filter(vi => vi.item_type === 'refund').reduce((sum, vi) => sum + vi.total_price, 0)).toLocaleString()}원
                          </span>
                        </div>
                      )}
                      {orderIncentives.length > 0 && (
                        <div className="flex justify-between text-xs text-gray-500">
                          <span>인센티브</span>
                          <span>-{incentivesTotal.toLocaleString()}원</span>
                        </div>
                      )}
                      <div className="border-t border-primary-200 pt-2 flex justify-between">
                        <span className="font-medium text-primary-800">정산 대상 금액</span>
                        <span className="font-bold text-primary-700">
                          {(netTotal - (orderVendorItems.filter(vi => vi.item_type === 'normal').reduce((sum, vi) => sum + vi.total_price, 0) - orderVendorItems.filter(vi => vi.item_type === 'refund').reduce((sum, vi) => sum + vi.total_price, 0)) - incentivesTotal).toLocaleString()}원
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">상태</label>
                    <select value={orderFormData.status} onChange={(e) => setOrderFormData({ ...orderFormData, status: e.target.value as Order['status'] })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500">
                      <option value="pending">대기</option><option value="processing">진행중</option><option value="near_due">종료임박</option><option value="completed">종료</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">메모</label>
                    <input type="text" value={orderFormData.notes} onChange={(e) => setOrderFormData({ ...orderFormData, notes: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500" placeholder="메모 입력" />
                  </div>
                </div>

                <div className="flex justify-end space-x-3 pt-4">
                  <button type="button" onClick={closeOrderModal} className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">취소</button>
                  <button type="submit" className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700">{editingOrder ? '수정' : '등록'}</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Customer Detail Modal */}
      {showCustomerDetailModal && selectedCustomerForDetail && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75" onClick={closeCustomerDetailModal} />
            <div className="relative bg-white rounded-2xl shadow-xl max-w-2xl w-full mx-auto overflow-hidden max-h-[90vh] flex flex-col">
              {/* Header */}
              <div className="bg-gradient-to-br from-primary-500 to-primary-600 px-6 py-8 text-white">
                <button onClick={closeCustomerDetailModal} className="absolute top-4 right-4 text-white/80 hover:text-white">
                  <X className="h-6 w-6" />
                </button>
                <div className="flex items-center gap-4">
                  <div className="h-16 w-16 rounded-2xl bg-white/20 flex items-center justify-center">
                    <Building className="h-8 w-8 text-white" />
                  </div>
                  <div className="text-left">
                    <h2 className="text-xl font-bold">{selectedCustomerForDetail.company || selectedCustomerForDetail.name}</h2>
                    {selectedCustomerForDetail.company && (
                      <p className="text-white/80 text-sm mt-1">{selectedCustomerForDetail.name}</p>
                    )}
                    <span className={`inline-block mt-2 px-3 py-1 text-xs rounded-full font-semibold ${getStatusColor(selectedCustomerForDetail.status)}`}>
                      {getStatusLabel(selectedCustomerForDetail.status)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Content */}
              <div className="px-6 py-5 space-y-4">
                {selectedCustomerForDetail.business_number && (
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-slate-100 rounded-lg">
                      <Hash className="h-5 w-5 text-slate-600" />
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 uppercase tracking-wider">사업자번호</p>
                      <p className="font-medium text-slate-900">{selectedCustomerForDetail.business_number}</p>
                    </div>
                  </div>
                )}

                {(selectedCustomerForDetail.industry || selectedCustomerForDetail.business_type) && (
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-slate-100 rounded-lg">
                      <Briefcase className="h-5 w-5 text-slate-600" />
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 uppercase tracking-wider">업종/업태</p>
                      <p className="font-medium text-slate-900">{selectedCustomerForDetail.industry || '-'}</p>
                      <p className="text-sm text-slate-600">{selectedCustomerForDetail.business_type || '-'}</p>
                    </div>
                  </div>
                )}

                {(selectedCustomerForDetail.phone || selectedCustomerForDetail.phone2) && (
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-slate-100 rounded-lg">
                      <Phone className="h-5 w-5 text-slate-600" />
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 uppercase tracking-wider">연락처</p>
                      {selectedCustomerForDetail.phone && (
                        <a href={`tel:${selectedCustomerForDetail.phone}`} className="block font-medium text-primary-600 hover:text-primary-700">
                          {selectedCustomerForDetail.phone}
                        </a>
                      )}
                      {selectedCustomerForDetail.phone2 && (
                        <a href={`tel:${selectedCustomerForDetail.phone2}`} className="block text-sm text-primary-600 hover:text-primary-700">
                          {selectedCustomerForDetail.phone2}
                        </a>
                      )}
                    </div>
                  </div>
                )}

                {selectedCustomerForDetail.email && (
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-slate-100 rounded-lg">
                      <Mail className="h-5 w-5 text-slate-600" />
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 uppercase tracking-wider">이메일</p>
                      <a href={`mailto:${selectedCustomerForDetail.email}`} className="font-medium text-primary-600 hover:text-primary-700">
                        {selectedCustomerForDetail.email}
                      </a>
                    </div>
                  </div>
                )}

                {selectedCustomerForDetail.address && (
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-slate-100 rounded-lg">
                      <MapPin className="h-5 w-5 text-slate-600" />
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 uppercase tracking-wider">주소</p>
                      <p className="font-medium text-slate-900">{selectedCustomerForDetail.address}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* 주문 목록 */}
              <div className="px-6 py-4 border-t border-slate-100 flex-1 overflow-y-auto">
                <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                  <FileText className="h-4 w-4 text-primary-500" />
                  주문 목록
                  {!customerOrdersLoading && <span className="text-xs text-slate-400 font-normal">({customerOrders.length}건)</span>}
                </h3>
                {customerOrdersLoading ? (
                  <div className="flex items-center justify-center py-6">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-500" />
                  </div>
                ) : customerOrders.length === 0 ? (
                  <div className="text-center py-6 text-slate-400 text-sm">주문 내역이 없습니다</div>
                ) : (
                  <div className="border border-slate-200 rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200">
                          <th className="text-left px-3 py-2 text-xs font-medium text-slate-500">주문번호</th>
                          <th className="text-left px-3 py-2 text-xs font-medium text-slate-500">주문일</th>
                          <th className="text-right px-3 py-2 text-xs font-medium text-slate-500">금액</th>
                          <th className="text-center px-3 py-2 text-xs font-medium text-slate-500">상태</th>
                          <th className="text-left px-3 py-2 text-xs font-medium text-slate-500">담당자</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {customerOrders.map(order => (
                          <tr key={order.id} className="hover:bg-slate-50 cursor-pointer transition-colors"
                            onClick={() => { closeCustomerDetailModal(); setActiveTab('orders'); setTimeout(() => openOrderDetailModal(order), 100); }}>
                            <td className="px-3 py-2 font-mono text-xs text-slate-700">{order.order_number}</td>
                            <td className="px-3 py-2 text-xs text-slate-600">{formatDate(order.order_date)}</td>
                            <td className="px-3 py-2 text-xs text-right font-medium text-slate-800">{formatCurrency(Math.abs(order.total_amount))}</td>
                            <td className="px-3 py-2 text-center">
                              <span className={`inline-block px-2 py-0.5 text-[10px] rounded-full font-medium ${getStatusColor(order.status)}`}>
                                {getStatusLabel(order.status)}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-xs text-slate-600">{order.assignee_name || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex gap-3 flex-shrink-0">
                <button
                  onClick={() => { closeCustomerDetailModal(); openCustomerModal(selectedCustomerForDetail); }}
                  className="flex-1 py-2.5 bg-primary-600 text-white rounded-xl font-medium hover:bg-primary-700 transition-colors flex items-center justify-center gap-2"
                >
                  <Edit2 className="h-4 w-4" />수정하기
                </button>
                <button
                  onClick={closeCustomerDetailModal}
                  className="px-6 py-2.5 border border-slate-200 text-slate-700 rounded-xl font-medium hover:bg-slate-100 transition-colors"
                >
                  닫기
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Order Detail Modal */}
      {/* Blog Order Form Modal */}
      {showBlogFormModal && (
        <div className="fixed inset-0 z-[60] overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75" onClick={closeBlogFormModal} />
            <div className="relative bg-white rounded-2xl shadow-xl max-w-lg w-full mx-auto overflow-hidden max-h-[90vh] flex flex-col">
              {/* Header */}
              <div className={`px-6 py-5 text-white flex-shrink-0 ${blogFormTab === 'form' ? 'bg-gradient-to-br from-blue-600 to-indigo-600' : 'bg-gradient-to-br from-emerald-600 to-teal-600'}`}>
                <button onClick={closeBlogFormModal} className="absolute top-4 right-4 text-white/80 hover:text-white z-10">
                  <X className="h-6 w-6" />
                </button>
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-xl bg-white/20 flex items-center justify-center">
                    {blogFormTab === 'form' ? <ClipboardList className="h-6 w-6 text-white" /> : <List className="h-6 w-6 text-white" />}
                  </div>
                  <div className="text-left">
                    <h2 className="text-lg font-bold">{blogFormTab === 'form' ? '주문서 양식' : '주문서 목록'}</h2>
                    <p className="text-white/70 text-sm">{blogFormTab === 'form' ? '업체에 전달할 주문서 링크' : '접수 완료된 주문서'}</p>
                  </div>
                </div>
              </div>

              {/* Tab Navigation */}
              <div className="flex border-b border-slate-200 flex-shrink-0">
                <button
                  onClick={() => setBlogFormTab('form')}
                  className={`flex-1 py-3 text-sm font-medium transition-colors flex items-center justify-center gap-1.5 ${blogFormTab === 'form' ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}
                >
                  <ClipboardList className="h-4 w-4" />
                  주문서 양식
                  {blogFormList.filter(f => f.status === 'pending').length > 0 && (
                    <span className="ml-1 px-1.5 py-0.5 text-[10px] rounded-full bg-amber-100 text-amber-700 font-semibold">
                      {blogFormList.filter(f => f.status === 'pending').length}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => setBlogFormTab('list')}
                  className={`flex-1 py-3 text-sm font-medium transition-colors flex items-center justify-center gap-1.5 ${blogFormTab === 'list' ? 'text-emerald-600 border-b-2 border-emerald-600 bg-emerald-50/50' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}
                >
                  <CheckCircle className="h-4 w-4" />
                  주문서 목록
                  {blogFormList.filter(f => f.status === 'submitted').length > 0 && (
                    <span className="ml-1 px-1.5 py-0.5 text-[10px] rounded-full bg-emerald-100 text-emerald-700 font-semibold">
                      {blogFormList.filter(f => f.status === 'submitted').length}
                    </span>
                  )}
                </button>
              </div>

              {/* Content */}
              <div className="px-6 py-5 overflow-y-auto flex-1">
                {blogFormLoading ? (
                  <div className="py-10 text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto" />
                    <p className="mt-3 text-sm text-slate-500">불러오는 중...</p>
                  </div>
                ) : blogFormTab === 'form' ? (
                  /* ===== 주문서 양식 탭 ===== */
                  <div className="space-y-4">
                    {/* 새 양식 생성 또는 기존 대기 양식 링크 */}
                    {blogFormLink ? (
                      <div className="space-y-3">
                        <label className="block text-xs font-medium text-slate-500">공유 링크</label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            readOnly
                            value={blogFormLink}
                            className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-600"
                          />
                          <button
                            onClick={() => copyFormLink(blogFormLink)}
                            className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-1.5 flex-shrink-0"
                          >
                            <Copy className="h-4 w-4" />
                            <span className="text-sm">복사</span>
                          </button>
                          <a
                            href={blogFormLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3 py-2 border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 transition-colors flex items-center flex-shrink-0"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        </div>
                        <p className="text-xs text-slate-400">이 링크를 업체에게 전달하면 주문서를 작성할 수 있습니다.</p>
                      </div>
                    ) : (
                      <div className="text-center py-4">
                        <p className="text-sm text-slate-500 mb-3">새 주문서 양식 링크를 생성합니다.</p>
                      </div>
                    )}

                    <button
                      onClick={createNewBlogForm}
                      className="w-full py-2.5 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                    >
                      <Plus className="h-4 w-4" />
                      새 주문서 양식 생성
                    </button>

                    {/* 대기 중인 양식 목록 */}
                    {blogFormList.filter(f => f.status === 'pending').length > 0 && (
                      <div className="space-y-2 mt-4">
                        <h4 className="text-xs font-medium text-slate-500">대기 중인 양식</h4>
                        {blogFormList.filter(f => f.status === 'pending').map((form) => (
                          <div key={form.id} className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Clock className="h-4 w-4 text-amber-600" />
                                <span className="text-sm text-amber-800 font-medium">대기 중</span>
                                <span className="text-xs text-amber-600">
                                  {new Date(form.created_at).toLocaleDateString('ko-KR')}
                                </span>
                              </div>
                              <div className="flex gap-1">
                                <button
                                  onClick={() => copyFormLink(`${window.location.origin}/order-form/${form.token}`)}
                                  className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                                  title="링크 복사"
                                >
                                  <Copy className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  onClick={() => deleteBlogForm(form.id)}
                                  className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                                  title="삭제"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  /* ===== 주문서 목록 탭 (접수 완료) ===== */
                  <div className="space-y-3">
                    {blogFormList.filter(f => f.status === 'submitted').length === 0 ? (
                      <div className="py-10 text-center">
                        <div className="h-14 w-14 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-3">
                          <FileText className="h-7 w-7 text-slate-400" />
                        </div>
                        <p className="text-sm font-medium text-slate-600">접수된 주문서가 없습니다</p>
                        <p className="text-xs text-slate-400 mt-1">업체에서 양식을 제출하면 여기에 표시됩니다</p>
                      </div>
                    ) : (
                      blogFormList.filter(f => f.status === 'submitted').map((form) => (
                        <div key={form.id} className="border border-slate-200 rounded-xl overflow-hidden">
                          {/* 접수 헤더 - 클릭 시 펼침 */}
                          <button
                            onClick={() => setExpandedFormId(expandedFormId === form.id ? null : form.id)}
                            className="w-full px-4 py-3 bg-emerald-50 flex items-center justify-between hover:bg-emerald-100 transition-colors"
                          >
                            <div className="flex items-center gap-2">
                              <CheckCircle className="h-4 w-4 text-emerald-600" />
                              <span className="text-sm font-semibold text-emerald-800">
                                {form.company_name || form.business_name || '접수 완료'}
                              </span>
                              {form.contact_name && (
                                <span className="text-xs text-emerald-600">({form.contact_name})</span>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-emerald-600">
                                {form.submitted_at ? new Date(form.submitted_at).toLocaleDateString('ko-KR') : ''}
                              </span>
                              <ChevronRight className={`h-4 w-4 text-slate-400 transition-transform ${expandedFormId === form.id ? 'rotate-90' : ''}`} />
                            </div>
                          </button>

                          {/* 접수 내용 상세 */}
                          {expandedFormId === form.id && (
                            <div className="px-4 py-4 space-y-2.5 bg-white">
                              {form.campaign_name && (
                                <div className="flex justify-between text-sm">
                                  <span className="text-slate-500">캠페인명</span>
                                  <span className="font-medium text-slate-800">{form.campaign_name}</span>
                                </div>
                              )}
                              {form.company_name && (
                                <div className="flex justify-between text-sm">
                                  <span className="text-slate-500">업체명</span>
                                  <span className="font-medium text-slate-800">{form.company_name}</span>
                                </div>
                              )}
                              {form.contact_name && (
                                <div className="flex justify-between text-sm">
                                  <span className="text-slate-500">담당자</span>
                                  <span className="font-medium text-slate-800">{form.contact_name}</span>
                                </div>
                              )}
                              {form.contact_phone && (
                                <div className="flex justify-between text-sm">
                                  <span className="text-slate-500">연락처</span>
                                  <span className="font-medium text-slate-800">{form.contact_phone}</span>
                                </div>
                              )}
                              {form.business_name && (
                                <div className="flex justify-between text-sm">
                                  <span className="text-slate-500">상호명</span>
                                  <span className="font-medium text-slate-800">{form.business_name}</span>
                                </div>
                              )}
                              {form.place_url && (
                                <div className="flex justify-between text-sm">
                                  <span className="text-slate-500">플레이스 URL</span>
                                  <a href={form.place_url} target="_blank" rel="noopener noreferrer"
                                    className="text-blue-600 hover:text-blue-800 text-xs truncate max-w-[200px]">
                                    {form.place_url.replace(/^https?:\/\//, '').substring(0, 40)}
                                  </a>
                                </div>
                              )}
                              {form.main_keyword && (
                                <div className="flex justify-between text-sm">
                                  <span className="text-slate-500">메인키워드</span>
                                  <span className="font-medium text-slate-800">{form.main_keyword}</span>
                                </div>
                              )}
                              {form.hashtags && (
                                <div className="flex justify-between text-sm">
                                  <span className="text-slate-500">해시태그</span>
                                  <span className="font-medium text-slate-800">{form.hashtags}</span>
                                </div>
                              )}
                              {form.total_quantity && (
                                <div className="flex justify-between text-sm">
                                  <span className="text-slate-500">총 발행량</span>
                                  <span className="font-medium text-slate-800">{form.total_quantity}건</span>
                                </div>
                              )}
                              {form.daily_quantity && (
                                <div className="flex justify-between text-sm">
                                  <span className="text-slate-500">일 발행량</span>
                                  <span className="font-medium text-slate-800">{form.daily_quantity}건/일</span>
                                </div>
                              )}
                              {form.requested_date && (
                                <div className="flex justify-between text-sm">
                                  <span className="text-slate-500">발행요청일</span>
                                  <span className="font-medium text-slate-800">{String(form.requested_date).split('T')[0]}</span>
                                </div>
                              )}
                              {form.highlights && (
                                <div className="text-sm border-t border-slate-200 pt-2 mt-2">
                                  <span className="text-slate-500 block mb-1">강조사항</span>
                                  <p className="text-slate-800 whitespace-pre-line text-xs">{form.highlights}</p>
                                </div>
                              )}
                              {form.special_requests && (
                                <div className="text-sm border-t border-slate-200 pt-2 mt-2">
                                  <span className="text-slate-500 block mb-1">요청사항</span>
                                  <p className="text-slate-800 whitespace-pre-line text-xs">{form.special_requests}</p>
                                </div>
                              )}
                              <div className="flex gap-2 pt-2 border-t border-slate-100">
                                <button
                                  onClick={() => resetBlogForm(form.id)}
                                  className="flex-1 py-2 text-xs text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors flex items-center justify-center gap-1"
                                >
                                  <RotateCcw className="h-3 w-3" />초기화
                                </button>
                                <button
                                  onClick={() => deleteBlogForm(form.id)}
                                  className="px-3 py-2 text-xs text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors flex items-center gap-1"
                                >
                                  <Trash2 className="h-3 w-3" />삭제
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex-shrink-0">
                <button
                  onClick={closeBlogFormModal}
                  className="w-full py-2.5 border border-slate-200 text-slate-700 rounded-xl font-medium hover:bg-slate-100 transition-colors"
                >
                  닫기
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showOrderDetailModal && selectedOrderForDetail && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75" onClick={closeOrderDetailModal} />
            <div className="relative bg-white rounded-2xl shadow-xl max-w-lg w-full mx-auto overflow-hidden max-h-[90vh] flex flex-col">
              {/* Header */}
              <div className="bg-gradient-to-br from-primary-500 to-primary-600 px-6 py-6 text-white flex-shrink-0">
                <button onClick={closeOrderDetailModal} className="absolute top-4 right-4 text-white/80 hover:text-white">
                  <X className="h-6 w-6" />
                </button>
                <div className="flex items-center gap-4">
                  <div className="h-14 w-14 rounded-xl bg-white/20 flex items-center justify-center">
                    <ShoppingCart className="h-7 w-7 text-white" />
                  </div>
                  <div className="text-left">
                    <h2 className="text-lg font-bold">{selectedOrderForDetail.order_number}</h2>
                    <p className="text-white/80 text-sm">{(selectedOrderForDetail as any).customer_company || selectedOrderForDetail.customer_name}</p>
                  </div>
                </div>
                <div className="mt-4 flex items-center gap-2 flex-wrap">
                  <span className={`px-3 py-1 text-xs rounded-full font-semibold ${getStatusColor(selectedOrderForDetail.status)}`}>
                    {getStatusLabel(selectedOrderForDetail.status)}
                  </span>
                  <span className="text-white/80 text-sm">|</span>
                  <span className="text-white font-bold text-lg">
                    {selectedOrderForDetail.total_amount < 0 ? '-' : ''}{formatCurrency(Math.abs(selectedOrderForDetail.total_amount))}
                  </span>
                </div>
              </div>

              {/* Content */}
              <div className="px-6 py-5 space-y-4 overflow-y-auto flex-1">
                {/* 기본 정보 */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-slate-50 rounded-lg">
                    <p className="text-xs text-slate-500 mb-1">고객명</p>
                    <p className="font-medium text-slate-900">{selectedOrderForDetail.customer_name}</p>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-lg">
                    <p className="text-xs text-slate-500 mb-1">담당자</p>
                    <p className="font-medium text-slate-900">{(selectedOrderForDetail as any).assignee_name || '-'}</p>
                  </div>
                </div>

                {/* 날짜 정보 */}
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-slate-100 rounded-lg">
                    <Calendar className="h-5 w-5 text-slate-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">기간</p>
                    <div className="grid grid-cols-3 gap-2 text-sm">
                      <div>
                        <p className="text-slate-500">주문일</p>
                        <p className="font-medium">{selectedOrderForDetail.order_date ? formatDate(selectedOrderForDetail.order_date) : '-'}</p>
                      </div>
                      <div>
                        <p className="text-slate-500">시작일</p>
                        <p className="font-medium">{(selectedOrderForDetail as any).start_date ? formatDate((selectedOrderForDetail as any).start_date) : '-'}</p>
                      </div>
                      <div>
                        <p className="text-slate-500">마감일</p>
                        <p className="font-medium">{selectedOrderForDetail.due_date ? formatDate(selectedOrderForDetail.due_date) : '-'}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 서비스 상품 */}
                {isLoadingOrderDetail ? (
                  <div className="p-6 text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
                    <p className="mt-2 text-sm text-slate-500">상품 정보를 불러오는 중...</p>
                  </div>
                ) : (
                  <>
                    {orderDetailItems.length > 0 && (
                      <div>
                        <p className="text-xs text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                          <ShoppingCart className="h-3.5 w-3.5" />서비스 상품
                        </p>
                        <div className="border border-slate-200 rounded-lg overflow-hidden">
                          {orderDetailItems.map((item, idx) => (
                            <div key={idx} className={`px-3 py-2.5 ${idx !== 0 ? 'border-t border-slate-100' : ''} ${item.item_type === 'refund' ? 'bg-red-50/50' : ''}`}>
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                  <span className={`px-1.5 py-0.5 text-[10px] rounded font-medium flex-shrink-0 ${item.item_type === 'refund' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
                                    {item.item_type === 'refund' ? '환불' : '매출'}
                                  </span>
                                  <span className="text-sm font-medium text-slate-900 truncate">{item.item_name}</span>
                                  <span className="text-xs text-slate-400 flex-shrink-0">x{item.quantity}</span>
                                </div>
                                <span className={`font-medium flex-shrink-0 ml-2 ${item.item_type === 'refund' ? 'text-red-600' : 'text-slate-900'}`}>
                                  {item.item_type === 'refund' ? '-' : ''}{Number(item.total_price).toLocaleString()}원
                                </span>
                              </div>
                              {item.item_type === 'refund' && item.created_at && (
                                <div className="mt-1 ml-12 text-xs text-slate-500">
                                  요청일: {new Date(item.created_at).toLocaleDateString('ko-KR')}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {orderDetailVendorItems.length > 0 && (
                      <div>
                        <p className="text-xs text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                          <Truck className="h-3.5 w-3.5" />업체 상품
                        </p>
                        <div className="border border-orange-200 rounded-lg overflow-hidden bg-orange-50/30">
                          {orderDetailVendorItems.map((item, idx) => (
                            <div key={idx} className={`px-3 py-2.5 ${idx !== 0 ? 'border-t border-orange-100' : ''} ${item.item_type === 'refund' ? 'bg-green-50/50' : ''}`}>
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                  <span className={`px-1.5 py-0.5 text-[10px] rounded font-medium flex-shrink-0 ${item.item_type === 'refund' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                                    {item.item_type === 'refund' ? '환입' : '지출'}
                                  </span>
                                  <span className="text-sm font-medium text-slate-900 truncate">{item.vendor_name} {item.product_name ? `/ ${item.product_name}` : ''}</span>
                                  <span className="text-xs text-slate-400 flex-shrink-0">x{item.quantity}</span>
                                </div>
                                <span className={`font-medium flex-shrink-0 ml-2 ${item.item_type === 'refund' ? 'text-green-600' : 'text-orange-600'}`}>
                                  {item.item_type === 'refund' ? '+' : '-'}{Number(item.total_price).toLocaleString()}원
                                </span>
                              </div>
                              {item.item_type === 'refund' && item.created_at && (
                                <div className="mt-1 ml-12 text-xs text-slate-500">
                                  요청일: {new Date(item.created_at).toLocaleDateString('ko-KR')}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 인센티브 */}
                    {orderDetailIncentives.length > 0 && (
                      <div className="mt-4">
                        <p className="text-xs font-semibold text-slate-500 mb-2 flex items-center gap-1">
                          <Award className="h-3.5 w-3.5" />인센티브
                        </p>
                        <div className="space-y-2">
                          {orderDetailIncentives.map((inc: any, idx: number) => {
                            const qty = Number(inc.quantity) || 1;
                            const amt = Number(inc.amount) || 0;
                            return (
                              <div key={idx} className="flex items-center justify-between p-2 bg-purple-50 rounded-lg">
                                <div>
                                  <span className="text-sm font-medium text-purple-800">{inc.employee_name || '-'}</span>
                                  {inc.policy_name && <span className="text-xs text-purple-500 ml-2">({inc.policy_name})</span>}
                                  {qty > 1 && <span className="text-xs text-purple-600 ml-2">{amt.toLocaleString()}원 x {qty}</span>}
                                  {inc.notes && <span className="text-xs text-slate-500 ml-2">{inc.notes}</span>}
                                </div>
                                <span className="text-sm font-semibold text-purple-700">{(amt * qty).toLocaleString()}원</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* 합계 금액 */}
                    {(orderDetailItems.length > 0 || orderDetailVendorItems.length > 0 || orderDetailIncentives.length > 0) && (() => {
                      const salesTotal = orderDetailItems.filter(i => i.item_type !== 'refund').reduce((sum, i) => sum + Number(i.total_price), 0);
                      const refundTotal = orderDetailItems.filter(i => i.item_type === 'refund').reduce((sum, i) => sum + Number(i.total_price), 0);
                      const expenseTotal = orderDetailVendorItems.filter(i => i.item_type !== 'refund').reduce((sum, i) => sum + Number(i.total_price), 0);
                      const returnTotal = orderDetailVendorItems.filter(i => i.item_type === 'refund').reduce((sum, i) => sum + Number(i.total_price), 0);
                      const incTotal = orderDetailIncentives.reduce((sum: number, i: any) => sum + (Number(i.amount) * (Number(i.quantity) || 1)), 0);
                      const netSales = salesTotal - refundTotal;
                      const netExpense = expenseTotal - returnTotal;
                      return (
                        <div className="mt-4 p-3 bg-slate-100 rounded-lg space-y-3">
                          {/* 서비스 상품 합계 */}
                          {orderDetailItems.length > 0 && (
                            <div>
                              <p className="text-xs text-slate-500 mb-2">서비스 상품</p>
                              <div className="flex justify-between items-center mb-1">
                                <span className="text-sm text-slate-600">매출</span>
                                <span className="text-sm font-semibold text-blue-600">{salesTotal.toLocaleString()}원</span>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-sm text-slate-600">환불</span>
                                <span className="text-sm font-semibold text-red-600">-{refundTotal.toLocaleString()}원</span>
                              </div>
                            </div>
                          )}
                          {/* 업체 상품 합계 */}
                          {orderDetailVendorItems.length > 0 && (
                            <div>
                              <p className="text-xs text-slate-500 mb-2">업체 상품</p>
                              <div className="flex justify-between items-center mb-1">
                                <span className="text-sm text-slate-600">지출</span>
                                <span className="text-sm font-semibold text-orange-600">-{expenseTotal.toLocaleString()}원</span>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-sm text-slate-600">환입</span>
                                <span className="text-sm font-semibold text-green-600">+{returnTotal.toLocaleString()}원</span>
                              </div>
                            </div>
                          )}
                          {/* 인센티브 합계 */}
                          {orderDetailIncentives.length > 0 && (
                            <div>
                              <p className="text-xs text-slate-500 mb-2">인센티브</p>
                              <div className="flex justify-between items-center">
                                <span className="text-sm text-slate-600">인센티브 합계</span>
                                <span className="text-sm font-semibold text-purple-600">-{incTotal.toLocaleString()}원</span>
                              </div>
                            </div>
                          )}
                          {/* 총 합계 */}
                          <div className="border-t border-slate-300 pt-2">
                            <div className="flex justify-between items-center mb-1">
                              <span className="text-sm font-medium text-slate-700">순 매출</span>
                              <span className="text-sm font-bold text-slate-900">{netSales.toLocaleString()}원</span>
                            </div>
                            <div className="flex justify-between items-center mb-1">
                              <span className="text-sm font-medium text-slate-700">순 지출</span>
                              <span className="text-sm font-bold text-slate-900">-{netExpense.toLocaleString()}원</span>
                            </div>
                            {incTotal > 0 && (
                              <div className="flex justify-between items-center mb-1">
                                <span className="text-sm font-medium text-slate-700">인센티브</span>
                                <span className="text-sm font-bold text-slate-900">-{incTotal.toLocaleString()}원</span>
                              </div>
                            )}
                            <div className="flex justify-between items-center pt-1 border-t border-slate-200">
                              <span className="text-sm font-bold text-slate-900">총 수익</span>
                              <span className={`text-base font-bold ${(netSales - netExpense - incTotal) >= 0 ? 'text-blue-700' : 'text-red-600'}`}>
                                {(netSales - netExpense - incTotal).toLocaleString()}원
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })()}

                    {orderDetailItems.length === 0 && orderDetailVendorItems.length === 0 && (
                      <div className="p-4 text-center text-sm text-slate-500 bg-slate-50 rounded-lg">
                        등록된 상품이 없습니다
                      </div>
                    )}
                  </>
                )}

                {/* 메모 */}
                {selectedOrderForDetail.notes && (
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-slate-100 rounded-lg">
                      <FileText className="h-5 w-5 text-slate-600" />
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 uppercase tracking-wider">메모</p>
                      <p className="text-sm text-slate-700 mt-1">{selectedOrderForDetail.notes}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex-shrink-0 space-y-2">
                {/* 블로그 상품이 포함된 주문이면 주문서 양식/목록 버튼 표시 */}
                {hasBlogItems(orderDetailItems) && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => openBlogFormModal(selectedOrderForDetail.id, 'form')}
                      className="flex-1 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-medium hover:from-blue-700 hover:to-indigo-700 transition-all flex items-center justify-center gap-2 shadow-sm"
                    >
                      <ClipboardList className="h-4 w-4" />주문서 양식
                    </button>
                    <button
                      onClick={() => openBlogFormModal(selectedOrderForDetail.id, 'list')}
                      className="flex-1 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl font-medium hover:from-emerald-700 hover:to-teal-700 transition-all flex items-center justify-center gap-2 shadow-sm"
                    >
                      <List className="h-4 w-4" />주문서 목록
                    </button>
                  </div>
                )}
                <div className="flex gap-3">
                  <button
                    onClick={() => { closeOrderDetailModal(); openOrderModal(selectedOrderForDetail); }}
                    disabled={isLoadingOrderDetails}
                    className="flex-1 py-2.5 bg-primary-600 text-white rounded-xl font-medium hover:bg-primary-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <Edit2 className="h-4 w-4" />수정하기
                  </button>
                  <button
                    onClick={() => { closeOrderDetailModal(); openLogModal(selectedOrderForDetail); }}
                    className="px-4 py-2.5 border border-slate-200 text-slate-700 rounded-xl font-medium hover:bg-slate-100 transition-colors flex items-center gap-1"
                  >
                    <History className="h-4 w-4" />내역
                  </button>
                  <button
                    onClick={closeOrderDetailModal}
                    className="px-4 py-2.5 border border-slate-200 text-slate-700 rounded-xl font-medium hover:bg-slate-100 transition-colors"
                  >
                    닫기
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
