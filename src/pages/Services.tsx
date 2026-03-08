import { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { Service, Customer } from '../types';
import { Plus, Search, Edit2, Trash2, X, Briefcase, Tag, ToggleLeft, ToggleRight, DollarSign, Building, Truck, ChevronDown, ChevronUp, Package, FileText, Shield } from 'lucide-react';

interface ServicePrice {
  id: string;
  service_id: string;
  customer_id: string;
  customer_name: string;
  customer_company: string;
  price: number;
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

interface FormVendorItem {
  vendor_id: string;
  vendor_product_id: string;
  quantity: number;
}

export default function Services() {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [customCategories, setCustomCategories] = useState<string[]>([]);
  const [customUnits, setCustomUnits] = useState<string[]>([]);
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [showNewUnit, setShowNewUnit] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newUnitName, setNewUnitName] = useState('');
  const [form, setForm] = useState({
    service_code: '',
    name: '',
    category: '',
    description: '',
    price: 0,
    unit: '',
    duration: '',
    status: 'active' as 'active' | 'inactive',
    is_blog: false,
    is_monthly_guarantee: false,
  });
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [editCategoryValue, setEditCategoryValue] = useState('');
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [renamingCategory, setRenamingCategory] = useState<string | null>(null);
  const [renameCategoryValue, setRenameCategoryValue] = useState('');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [showPriceModal, setShowPriceModal] = useState(false);
  const [pricingService, setPricingService] = useState<Service | null>(null);
  const [servicePrices, setServicePrices] = useState<ServicePrice[]>([]);
  const [priceForm, setPriceForm] = useState({ customer_id: '', price: 0 });
  const [pricesLoading, setPricesLoading] = useState(false);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [vendorProductsMap, setVendorProductsMap] = useState<Record<string, VendorProduct[]>>({});
  const [formVendorItems, setFormVendorItems] = useState<FormVendorItem[]>([]);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  // DB에 있는 업체명 + 사용자가 추가한 업체명 합치기
  const dbCategories = [...new Set(services.map(s => s.category))].filter(Boolean).sort();
  const allCategories = [...new Set([...dbCategories, ...customCategories])].sort();

  // 단위도 동일하게
  const defaultUnits = ['건', '시간', '일', '월', '년', '회', '페이지', '개', '세트'];
  const dbUnits = [...new Set(services.map(s => s.unit))].filter(Boolean);
  const allUnits = [...new Set([...defaultUnits, ...dbUnits, ...customUnits])].sort();

  useEffect(() => {
    fetchServices();
    loadCustomers();
    loadVendors();
  }, [search, categoryFilter]);

  async function loadCustomers() {
    try {
      const data = await api.get<Customer[]>('/sales/customers');
      setCustomers(data);
    } catch { /* ignore */ }
  }

  async function loadVendors() {
    try {
      const data = await api.get<Vendor[]>('/vendors');
      setVendors(data.filter(v => v.status === 'active'));
    } catch { /* ignore */ }
  }

  async function loadVendorProducts(vendorId: string) {
    if (vendorProductsMap[vendorId]) return vendorProductsMap[vendorId];
    try {
      const data = await api.get<{ products: VendorProduct[] }>(`/vendors/${vendorId}`);
      const products = data.products || [];
      setVendorProductsMap(prev => ({ ...prev, [vendorId]: products }));
      return products;
    } catch {
      return [];
    }
  }

  async function fetchServices() {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (categoryFilter) params.append('category', categoryFilter);
      const queryStr = params.toString();
      const data = await api.get<Service[]>(`/services${queryStr ? `?${queryStr}` : ''}`);
      setServices(data);
    } catch (error) {
      console.error('Failed to fetch services:', error);
    } finally {
      setLoading(false);
    }
  }

  function openCreateModal() {
    setEditingService(null);
    setShowNewCategory(false);
    setShowNewUnit(false);
    setNewCategoryName('');
    setNewUnitName('');
    setForm({
      service_code: '',
      name: '',
      category: allCategories[0] || '',
      description: '',
      price: 0,
      unit: allUnits[0] || '건',
      duration: '',
      status: 'active',
      is_blog: false,
      is_monthly_guarantee: false,
    });
    setFormVendorItems([]);
    setShowModal(true);
  }

  async function openEditModal(service: Service) {
    setEditingService(service);
    setShowNewCategory(false);
    setShowNewUnit(false);
    setNewCategoryName('');
    setNewUnitName('');
    setForm({
      service_code: service.service_code,
      name: service.name,
      category: service.category,
      description: service.description || '',
      price: service.price,
      unit: service.unit,
      duration: service.duration || '',
      status: service.status,
      is_blog: service.is_blog || false,
      is_monthly_guarantee: (service as any).is_monthly_guarantee || false,
    });
    setFormVendorItems([]);
    setShowModal(true);
    // 서비스 상세 조회하여 업체상품 정보 로드
    try {
      const detail = await api.get<any>(`/services/${service.id}`);
      if (detail.vendor_items && detail.vendor_items.length > 0) {
        const items: FormVendorItem[] = detail.vendor_items.map((vi: any) => ({
          vendor_id: vi.vendor_id,
          vendor_product_id: vi.vendor_product_id,
          quantity: vi.quantity || 1,
        }));
        setFormVendorItems(items);
        // 업체별 상품 로드
        const uniqueVendorIds = [...new Set(items.map(i => i.vendor_id))];
        for (const vid of uniqueVendorIds) {
          await loadVendorProducts(vid);
        }
      }
    } catch { /* ignore */ }
  }

  function handleAddCategory() {
    const trimmed = newCategoryName.trim();
    if (!trimmed) return;
    if (!allCategories.includes(trimmed)) {
      setCustomCategories(prev => [...prev, trimmed]);
    }
    setForm({ ...form, category: trimmed });
    setNewCategoryName('');
    setShowNewCategory(false);
  }

  function handleAddUnit() {
    const trimmed = newUnitName.trim();
    if (!trimmed) return;
    if (!allUnits.includes(trimmed)) {
      setCustomUnits(prev => [...prev, trimmed]);
    }
    setForm({ ...form, unit: trimmed });
    setNewUnitName('');
    setShowNewUnit(false);
  }

  function addVendorItemRow() {
    setFormVendorItems(prev => [...prev, { vendor_id: '', vendor_product_id: '', quantity: 1 }]);
  }

  function removeVendorItemRow(index: number) {
    setFormVendorItems(prev => prev.filter((_, i) => i !== index));
  }

  async function updateVendorItem(index: number, field: string, value: string | number) {
    setFormVendorItems(prev => {
      const items = [...prev];
      items[index] = { ...items[index], [field]: value };
      if (field === 'vendor_id') {
        items[index].vendor_product_id = '';
        if (value) loadVendorProducts(value as string);
      }
      return items;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const payload = {
        ...form,
        vendor_items: formVendorItems.filter(vi => vi.vendor_id && vi.vendor_product_id),
      };
      if (editingService) {
        await api.put(`/services/${editingService.id}`, payload);
      } else {
        await api.post('/services', payload);
      }
      setShowModal(false);
      fetchServices();
    } catch (error) {
      console.error('Failed to save service:', error);
      alert('저장에 실패했습니다.');
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('이 서비스를 삭제하시겠습니까?')) return;
    try {
      await api.delete(`/services/${id}`);
      fetchServices();
    } catch (error) {
      console.error('Failed to delete service:', error);
      alert('삭제에 실패했습니다.');
    }
  }

  async function openPriceModal(service: Service) {
    setPricingService(service);
    setPriceForm({ customer_id: '', price: Number(service.price) });
    setShowPriceModal(true);
    setPricesLoading(true);
    try {
      const data = await api.get<ServicePrice[]>(`/services/${service.id}/prices`);
      setServicePrices(data);
    } catch { setServicePrices([]); }
    finally { setPricesLoading(false); }
  }

  async function handlePriceSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!pricingService || !priceForm.customer_id) return;
    try {
      const data = await api.post<ServicePrice[]>(`/services/${pricingService.id}/prices`, priceForm);
      setServicePrices(data);
      setPriceForm({ customer_id: '', price: Number(pricingService.price) });
    } catch (error) {
      alert('저장에 실패했습니다.');
    }
  }

  async function handlePriceDelete(priceId: string) {
    if (!pricingService) return;
    try {
      await api.delete(`/services/${pricingService.id}/prices/${priceId}`);
      setServicePrices(servicePrices.filter(p => p.id !== priceId));
    } catch { alert('삭제에 실패했습니다.'); }
  }

  async function toggleStatus(service: Service) {
    try {
      await api.put(`/services/${service.id}`, {
        ...service,
        status: service.status === 'active' ? 'inactive' : 'active',
      });
      fetchServices();
    } catch (error) {
      console.error('Failed to toggle status:', error);
    }
  }

  async function handleCategoryChange(service: Service, newCategory: string) {
    if (newCategory === service.category) {
      setEditingCategory(null);
      return;
    }
    try {
      await api.put(`/services/${service.id}`, { ...service, category: newCategory });
      setEditingCategory(null);
      fetchServices();
    } catch {
      alert('업체명 변경에 실패했습니다.');
    }
  }

  async function handleCategoryRename(oldName: string, newName: string) {
    const trimmed = newName.trim();
    if (!trimmed || trimmed === oldName) {
      setRenamingCategory(null);
      return;
    }
    try {
      const affectedServices = services.filter(s => s.category === oldName);
      for (const svc of affectedServices) {
        await api.put(`/services/${svc.id}`, { ...svc, category: trimmed });
      }
      if (form.category === oldName) {
        setForm({ ...form, category: trimmed });
      }
      setRenamingCategory(null);
      fetchServices();
    } catch {
      alert('업체명 변경에 실패했습니다.');
    }
  }

  async function handleCategoryDelete(catName: string) {
    const affectedCount = services.filter(s => s.category === catName).length;
    if (affectedCount > 0) {
      if (!confirm(`"${catName}" 업체에 ${affectedCount}개의 서비스가 있습니다.\n해당 서비스의 업체명이 비워집니다. 삭제하시겠습니까?`)) return;
      try {
        const affectedServices = services.filter(s => s.category === catName);
        for (const svc of affectedServices) {
          await api.put(`/services/${svc.id}`, { ...svc, category: '' });
        }
        if (form.category === catName) {
          setForm({ ...form, category: '' });
        }
        setCustomCategories(prev => prev.filter(c => c !== catName));
        fetchServices();
      } catch {
        alert('업체 삭제에 실패했습니다.');
      }
    } else {
      setCustomCategories(prev => prev.filter(c => c !== catName));
    }
  }

  const activeCount = services.filter(s => s.status === 'active').length;
  const categories = [...new Set(services.map(s => s.category))];

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">서비스 상품 관리</h1>
          <p className="mt-1 text-sm text-gray-500">서비스 상품을 등록하고 관리합니다.</p>
        </div>
        <button
          onClick={openCreateModal}
          className="flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
        >
          <Plus className="h-5 w-5 mr-1" />
          서비스 등록
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Briefcase className="h-6 w-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm text-gray-500">전체 서비스</p>
              <p className="text-2xl font-bold text-gray-900">{services.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg">
              <ToggleRight className="h-6 w-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm text-gray-500">활성 서비스</p>
              <p className="text-2xl font-bold text-green-600">{activeCount}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center">
            <div className="p-2 bg-gray-100 rounded-lg">
              <Tag className="h-6 w-6 text-gray-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm text-gray-500">업체 수</p>
              <p className="text-2xl font-bold text-gray-900">{categories.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="서비스명, 설명 검색..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          >
            <option value="">전체 업체</option>
            {allCategories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Accordion by Category */}
      <div className="space-y-3">
        {loading ? (
          <div className="bg-white rounded-lg shadow flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          </div>
        ) : services.length === 0 ? (
          <div className="bg-white rounded-lg shadow text-center py-12 text-gray-500">
            <Briefcase className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <p>등록된 서비스가 없습니다.</p>
            <button onClick={openCreateModal} className="mt-2 text-primary-600 hover:underline">
              첫 서비스를 등록해보세요
            </button>
          </div>
        ) : (
          <>
            {/* 업체상품 섹션 - 업체별 그룹핑 */}
            {(() => {
              const vendorProducts = services.filter(s => s.category === '업체상품');
              const vendorGroups = vendorProducts.reduce((acc, s) => {
                const vendorName = s.vendor_name || '미분류 업체';
                if (!acc[vendorName]) acc[vendorName] = [];
                acc[vendorName].push(s);
                return acc;
              }, {} as Record<string, typeof services>);

              if (Object.keys(vendorGroups).length > 0) {
                return (
                  <div className="mb-6">
                    <div className="flex items-center gap-2 mb-3">
                      <Truck className="h-5 w-5 text-orange-600" />
                      <h2 className="text-lg font-semibold text-gray-900">업체상품</h2>
                      <span className="text-sm text-gray-500">({vendorProducts.length}개)</span>
                    </div>
                    <div className="space-y-2">
                      {Object.entries(vendorGroups).sort(([a], [b]) => a.localeCompare(b)).map(([vendorName, vendorServices]) => {
                        const isExpanded = expandedCategories.has(`vendor-${vendorName}`);
                        const activeCount = vendorServices.filter(s => s.status === 'active').length;

                        return (
                          <div key={`vendor-${vendorName}`} className="bg-white rounded-lg shadow overflow-hidden">
                            <button
                              onClick={() => {
                                setExpandedCategories(prev => {
                                  const newSet = new Set(prev);
                                  const key = `vendor-${vendorName}`;
                                  if (newSet.has(key)) newSet.delete(key);
                                  else newSet.add(key);
                                  return newSet;
                                });
                              }}
                              className="w-full px-4 py-3 flex items-center justify-between hover:bg-orange-50 transition-colors"
                            >
                              <div className="flex items-center gap-3">
                                <div className="p-2 bg-orange-100 rounded-lg">
                                  <Truck className="h-5 w-5 text-orange-600" />
                                </div>
                                <div className="text-left">
                                  <h3 className="text-base font-semibold text-gray-900">{vendorName}</h3>
                                  <p className="text-xs text-gray-500">
                                    {vendorServices.length}개 상품 · 활성 {activeCount}개
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-gray-400 hidden sm:inline">
                                  {vendorServices.reduce((sum, s) => sum + Number(s.price), 0).toLocaleString()}원 합계
                                </span>
                                {isExpanded ? <ChevronUp className="h-5 w-5 text-gray-400" /> : <ChevronDown className="h-5 w-5 text-gray-400" />}
                              </div>
                            </button>
                            {isExpanded && (
                              <div className="border-t divide-y divide-gray-100">
                                {vendorServices.map(service => (
                                  <div key={service.id} className="px-4 py-3 hover:bg-gray-50 flex items-center justify-between gap-4">
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2">
                                        <Package className="h-4 w-4 text-orange-400" />
                                        <span className="text-sm font-medium text-gray-900">{service.name}</span>
                                        <button
                                          onClick={() => toggleStatus(service)}
                                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium cursor-pointer transition-colors ${
                                            service.status === 'active' ? 'bg-green-100 text-green-800 hover:bg-green-200' : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                                          }`}
                                        >
                                          {service.status === 'active' ? '활성' : '비활성'}
                                        </button>
                                        {service.is_blog && (
                                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-blue-100 text-blue-700">
                                            <FileText className="h-2.5 w-2.5" />발행추적
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                      <div className="text-right">
                                        <div className="text-sm font-medium text-gray-900">{Number(service.price).toLocaleString()}원</div>
                                        <div className="text-xs text-gray-500">/{service.unit}</div>
                                      </div>
                                      <div className="flex items-center gap-1">
                                        <button onClick={() => openPriceModal(service)} className="p-1.5 text-green-600 hover:text-green-900 hover:bg-green-50 rounded" title="업체별 단가"><DollarSign className="h-4 w-4" /></button>
                                        <button onClick={() => openEditModal(service)} className="p-1.5 text-primary-600 hover:text-primary-900 hover:bg-primary-50 rounded" title="수정"><Edit2 className="h-4 w-4" /></button>
                                        <button onClick={() => handleDelete(service.id)} className="p-1.5 text-red-600 hover:text-red-900 hover:bg-red-50 rounded" title="삭제"><Trash2 className="h-4 w-4" /></button>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              }
              return null;
            })()}

            {/* 일반 서비스 섹션 - 카테고리별 그룹핑 */}
            {(() => {
              const normalServices = services.filter(s => s.category !== '업체상품');
              const categoryGroups = [...new Set(normalServices.map(s => s.category || '미분류'))].sort();

              if (categoryGroups.length > 0) {
                return (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <Briefcase className="h-5 w-5 text-blue-600" />
                      <h2 className="text-lg font-semibold text-gray-900">서비스상품</h2>
                      <span className="text-sm text-gray-500">({normalServices.length}개)</span>
                    </div>
                    <div className="space-y-2">
                      {categoryGroups.map(category => {
                        const categoryServices = normalServices.filter(s => (s.category || '미분류') === category);
                        const isExpanded = expandedCategories.has(category);
                        const activeCount = categoryServices.filter(s => s.status === 'active').length;

                        return (
                          <div key={category} className="bg-white rounded-lg shadow overflow-hidden">
                            <button
                              onClick={() => {
                                setExpandedCategories(prev => {
                                  const newSet = new Set(prev);
                                  if (newSet.has(category)) newSet.delete(category);
                                  else newSet.add(category);
                                  return newSet;
                                });
                              }}
                              className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
                            >
                              <div className="flex items-center gap-3">
                                <div className="p-2 bg-blue-100 rounded-lg">
                                  <Building className="h-5 w-5 text-blue-600" />
                                </div>
                                <div className="text-left">
                                  <h3 className="text-base font-semibold text-gray-900">{category}</h3>
                                  <p className="text-xs text-gray-500">
                                    {categoryServices.length}개 서비스 · 활성 {activeCount}개
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-gray-400 hidden sm:inline">
                                  {categoryServices.reduce((sum, s) => sum + Number(s.price), 0).toLocaleString()}원 합계
                                </span>
                                {isExpanded ? <ChevronUp className="h-5 w-5 text-gray-400" /> : <ChevronDown className="h-5 w-5 text-gray-400" />}
                              </div>
                            </button>
                            {isExpanded && (
                              <div className="border-t divide-y divide-gray-100">
                                {categoryServices.map(service => (
                                  <div key={service.id} className="px-4 py-3 hover:bg-gray-50 flex items-center justify-between gap-4">
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2">
                                        <span className="text-sm font-medium text-gray-900">{service.name}</span>
                                        <button
                                          onClick={() => toggleStatus(service)}
                                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium cursor-pointer transition-colors ${
                                            service.status === 'active' ? 'bg-green-100 text-green-800 hover:bg-green-200' : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                                          }`}
                                        >
                                          {service.status === 'active' ? '활성' : '비활성'}
                                        </button>
                                        {service.is_blog && (
                                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-blue-100 text-blue-700">
                                            <FileText className="h-2.5 w-2.5" />발행추적
                                          </span>
                                        )}
                                      </div>
                                      {service.description && (
                                        <p className="text-xs text-gray-500 truncate mt-0.5">{service.description}</p>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-4">
                                      <div className="text-right">
                                        <div className="text-sm font-medium text-gray-900">{Number(service.price).toLocaleString()}원</div>
                                        <div className="text-xs text-gray-500">/{service.unit} {service.duration && `· ${service.duration}`}</div>
                                      </div>
                                      <div className="flex items-center gap-1">
                                        <button onClick={() => openPriceModal(service)} className="p-1.5 text-green-600 hover:text-green-900 hover:bg-green-50 rounded" title="업체별 단가"><DollarSign className="h-4 w-4" /></button>
                                        <button onClick={() => openEditModal(service)} className="p-1.5 text-primary-600 hover:text-primary-900 hover:bg-primary-50 rounded" title="수정"><Edit2 className="h-4 w-4" /></button>
                                        <button onClick={() => handleDelete(service.id)} className="p-1.5 text-red-600 hover:text-red-900 hover:bg-red-50 rounded" title="삭제"><Trash2 className="h-4 w-4" /></button>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              }
              return null;
            })()}
          </>
        )}
      </div>

      {/* Price Modal */}
      {showPriceModal && pricingService && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75" onClick={() => setShowPriceModal(false)} />
            <div className="relative bg-white rounded-lg shadow-xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">업체별 단가 설정</h3>
                  <p className="text-sm text-gray-500">{pricingService.name} (기본가: {Number(pricingService.price).toLocaleString()}원)</p>
                </div>
                <button onClick={() => setShowPriceModal(false)} className="text-gray-400 hover:text-gray-600">
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Add price form */}
              <form onSubmit={handlePriceSubmit} className="mb-4 p-4 bg-gray-50 rounded-lg">
                <div className="flex gap-3 items-end">
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-700 mb-1"><Building className="inline h-4 w-4 mr-1" />업체 선택</label>
                    <select value={priceForm.customer_id} onChange={(e) => setPriceForm({ ...priceForm, customer_id: e.target.value })} required className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 text-sm">
                      <option value="">업체 선택</option>
                      {customers.filter(c => !servicePrices.some(sp => sp.customer_id === c.id)).map(c => (
                        <option key={c.id} value={c.id}>{c.company ? `${c.company} (${c.name})` : c.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="w-40">
                    <label className="block text-sm font-medium text-gray-700 mb-1">단가 (원)</label>
                    <input type="number" value={priceForm.price} onChange={(e) => setPriceForm({ ...priceForm, price: Number(e.target.value) })} min="0" className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 text-sm" />
                  </div>
                  <button type="submit" className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm whitespace-nowrap">
                    <Plus className="inline h-4 w-4 mr-1" />추가
                  </button>
                </div>
              </form>

              {/* Price list */}
              {pricesLoading ? (
                <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600"></div></div>
              ) : servicePrices.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <DollarSign className="h-10 w-10 mx-auto mb-2" />
                  <p className="text-sm">등록된 업체별 단가가 없습니다.</p>
                  <p className="text-xs mt-1">기본가({Number(pricingService.price).toLocaleString()}원)가 적용됩니다.</p>
                </div>
              ) : (
                <div className="border rounded-lg overflow-hidden">
                  <table className="min-w-full divide-y divide-gray-200 text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">업체명</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">대표자</th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">적용 단가</th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">기본가 대비</th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 w-16">관리</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {servicePrices.map((sp) => {
                        const diff = Number(sp.price) - Number(pricingService.price);
                        return (
                          <tr key={sp.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 font-medium text-gray-900">{sp.customer_company || '-'}</td>
                            <td className="px-4 py-3 text-gray-500">{sp.customer_name}</td>
                            <td className="px-4 py-3 text-right font-medium">{Number(sp.price).toLocaleString()}원</td>
                            <td className={`px-4 py-3 text-right text-xs ${diff > 0 ? 'text-red-600' : diff < 0 ? 'text-blue-600' : 'text-gray-400'}`}>
                              {diff > 0 ? '+' : ''}{diff.toLocaleString()}원
                            </td>
                            <td className="px-4 py-3 text-right">
                              <button onClick={() => handlePriceDelete(sp.id)} className="text-red-500 hover:text-red-700"><Trash2 className="h-4 w-4" /></button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75" onClick={() => setShowModal(false)} />
            <div className="relative bg-white rounded-lg shadow-xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">
                  {editingService ? '서비스 수정' : '서비스 등록'}
                </h3>
                <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">업체명 *</label>
                    {showNewCategory ? (
                      <div className="flex gap-1">
                        <input
                          type="text"
                          value={newCategoryName}
                          onChange={(e) => setNewCategoryName(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddCategory(); } }}
                          placeholder="새 업체명"
                          autoFocus
                          className="flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 text-sm"
                        />
                        <button
                          type="button"
                          onClick={handleAddCategory}
                          className="px-3 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm"
                        >
                          추가
                        </button>
                        <button
                          type="button"
                          onClick={() => { setShowNewCategory(false); setNewCategoryName(''); }}
                          className="px-2 py-2 border rounded-lg hover:bg-gray-50 text-sm"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex gap-1">
                        <div className="flex-1 relative">
                          <button
                            type="button"
                            onClick={() => setShowCategoryDropdown(!showCategoryDropdown)}
                            className="w-full px-3 py-2 border rounded-lg text-left bg-white focus:ring-2 focus:ring-primary-500 flex items-center justify-between"
                          >
                            <span className={form.category ? 'text-gray-900' : 'text-gray-400'}>{form.category || '업체명 선택'}</span>
                            <span className="text-gray-400 text-xs">▼</span>
                          </button>
                          {showCategoryDropdown && (
                            <div className="absolute z-20 mt-1 w-full bg-white border rounded-lg shadow-lg max-h-60 overflow-y-auto">
                              <div
                                onClick={() => { setForm({ ...form, category: '' }); setShowCategoryDropdown(false); }}
                                className="px-3 py-2 text-sm text-gray-400 hover:bg-gray-50 cursor-pointer"
                              >업체명 선택</div>
                              {allCategories.map(cat => (
                                <div key={cat} className="flex items-center hover:bg-gray-50 group">
                                  {renamingCategory === cat ? (
                                    <div className="flex-1 flex items-center gap-1 px-2 py-1">
                                      <input
                                        type="text"
                                        value={renameCategoryValue}
                                        onChange={(e) => setRenameCategoryValue(e.target.value)}
                                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleCategoryRename(cat, renameCategoryValue); } if (e.key === 'Escape') setRenamingCategory(null); }}
                                        autoFocus
                                        className="flex-1 px-2 py-1 border rounded text-sm focus:ring-1 focus:ring-primary-500"
                                      />
                                      <button type="button" onClick={() => handleCategoryRename(cat, renameCategoryValue)} className="px-2 py-1 bg-primary-600 text-white rounded text-xs">확인</button>
                                      <button type="button" onClick={() => setRenamingCategory(null)} className="px-1 py-1 text-gray-400 hover:text-gray-600"><X className="h-3 w-3" /></button>
                                    </div>
                                  ) : (
                                    <>
                                      <div
                                        onClick={() => { setForm({ ...form, category: cat }); setShowCategoryDropdown(false); }}
                                        className={`flex-1 px-3 py-2 text-sm cursor-pointer ${form.category === cat ? 'text-primary-700 font-semibold bg-primary-50' : 'text-gray-700'}`}
                                      >{cat}</div>
                                      <div className="flex items-center gap-0.5 pr-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button type="button" onClick={(e) => { e.stopPropagation(); setRenamingCategory(cat); setRenameCategoryValue(cat); }} className="p-1 text-gray-400 hover:text-primary-600" title="이름 수정"><Edit2 className="h-3 w-3" /></button>
                                        <button type="button" onClick={(e) => { e.stopPropagation(); setShowCategoryDropdown(false); handleCategoryDelete(cat); }} className="p-1 text-gray-400 hover:text-red-600" title="삭제"><Trash2 className="h-3 w-3" /></button>
                                      </div>
                                    </>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => { setShowCategoryDropdown(false); setShowNewCategory(true); }}
                          className="px-3 py-2 border rounded-lg hover:bg-gray-50 text-primary-600"
                          title="새 업체 추가"
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">서비스명 *</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => {
                      const name = e.target.value;
                      const blogKeywords = ['블로그', '포스팅', '포스트', 'blog'];
                      const nowHas = blogKeywords.some(k => name.toLowerCase().includes(k));
                      const prevHad = blogKeywords.some(k => form.name.toLowerCase().includes(k));
                      setForm({ ...form, name, ...(nowHas && !prevHad ? { is_blog: true } : {}) });
                    }}
                    placeholder="서비스 상품명"
                    required
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">설명</label>
                  <textarea
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    placeholder="서비스에 대한 설명"
                    rows={3}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">가격 (원)</label>
                    <input
                      type="number"
                      value={form.price}
                      onChange={(e) => setForm({ ...form, price: Number(e.target.value) })}
                      min="0"
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">단위</label>
                    {showNewUnit ? (
                      <div className="flex gap-1">
                        <input
                          type="text"
                          value={newUnitName}
                          onChange={(e) => setNewUnitName(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddUnit(); } }}
                          placeholder="새 단위"
                          autoFocus
                          className="flex-1 px-2 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 text-sm"
                        />
                        <button
                          type="button"
                          onClick={handleAddUnit}
                          className="px-2 py-2 bg-primary-600 text-white rounded-lg text-xs"
                        >
                          추가
                        </button>
                        <button
                          type="button"
                          onClick={() => { setShowNewUnit(false); setNewUnitName(''); }}
                          className="px-1 py-2 border rounded-lg hover:bg-gray-50"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex gap-1">
                        <select
                          value={form.unit}
                          onChange={(e) => setForm({ ...form, unit: e.target.value })}
                          className="flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
                        >
                          <option value="">단위 선택</option>
                          {allUnits.map(u => (
                            <option key={u} value={u}>{u}</option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => setShowNewUnit(true)}
                          className="px-2 py-2 border rounded-lg hover:bg-gray-50 text-primary-600"
                          title="새 단위 추가"
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">소요시간</label>
                    <input
                      type="text"
                      value={form.duration}
                      onChange={(e) => setForm({ ...form, duration: e.target.value })}
                      placeholder="예: 2주"
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">상태</label>
                  <select
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value as 'active' | 'inactive' })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="active">활성</option>
                    <option value="inactive">비활성</option>
                  </select>
                </div>
                <div className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <label className="flex items-center gap-2 cursor-pointer select-none flex-1">
                    <input
                      type="checkbox"
                      checked={form.is_blog}
                      onChange={(e) => setForm({ ...form, is_blog: e.target.checked })}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <FileText className="h-4 w-4 text-blue-600" />
                    <span className="text-sm font-medium text-blue-800">블로그 발행 추적</span>
                  </label>
                  <span className="text-xs text-blue-500">주문 시 블로그 발행목록에 자동 등록됩니다</span>
                </div>
                {form.is_blog && (
                  <div className="flex items-center gap-3 p-3 bg-purple-50 border border-purple-200 rounded-lg">
                    <label className="flex items-center gap-2 cursor-pointer select-none flex-1">
                      <input
                        type="checkbox"
                        checked={form.is_monthly_guarantee}
                        onChange={(e) => setForm({ ...form, is_monthly_guarantee: e.target.checked })}
                        className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                      />
                      <Shield className="h-4 w-4 text-purple-600" />
                      <span className="text-sm font-medium text-purple-800">월보장 순위추적</span>
                    </label>
                    <span className="text-xs text-purple-500">순위추적 기능이 활성화됩니다</span>
                  </div>
                )}
                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-4 py-2 border rounded-lg hover:bg-gray-50"
                  >
                    취소
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                  >
                    {editingService ? '수정' : '등록'}
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
