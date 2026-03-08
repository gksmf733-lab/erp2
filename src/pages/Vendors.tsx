import { useEffect, useState } from 'react';
import { api } from '../utils/api';
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  X,
  Truck,
  Phone,
  User,
  Package,
  ChevronDown,
  ChevronUp,
  CheckSquare,
} from 'lucide-react';

interface VendorProduct {
  id?: string;
  product_name: string;
  cost_price: number;
}

interface Vendor {
  id: string;
  name: string;
  representative: string;
  phone: string;
  status: string;
  product_count: number;
  products?: VendorProduct[];
  created_at: string;
}

export default function Vendors() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);
  const [expandedVendor, setExpandedVendor] = useState<string | null>(null);
  const [expandedProducts, setExpandedProducts] = useState<VendorProduct[]>([]);
  const [selectedVendors, setSelectedVendors] = useState<Set<string>>(new Set());

  const [formData, setFormData] = useState({ name: '', representative: '', phone: '' });
  const [formProducts, setFormProducts] = useState<VendorProduct[]>([]);

  useEffect(() => { fetchVendors(); }, []);

  const fetchVendors = async () => {
    setIsLoading(true);
    try {
      const data = await api.get<Vendor[]>('/vendors');
      setVendors(data);
    } catch (error) {
      console.error('Failed to fetch vendors:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const openModal = async (vendor?: Vendor) => {
    if (vendor) {
      setEditingVendor(vendor);
      setFormData({ name: vendor.name, representative: vendor.representative || '', phone: vendor.phone || '' });
      try {
        const detail = await api.get<any>(`/vendors/${vendor.id}`);
        setFormProducts(detail.products?.map((p: any) => ({ product_name: p.product_name, cost_price: Number(p.cost_price) })) || []);
      } catch {
        setFormProducts([]);
      }
    } else {
      setEditingVendor(null);
      setFormData({ name: '', representative: '', phone: '' });
      setFormProducts([]);
    }
    setShowModal(true);
  };

  const closeModal = () => { setShowModal(false); setEditingVendor(null); setFormProducts([]); };

  const addProduct = () => {
    setFormProducts([...formProducts, { product_name: '', cost_price: 0 }]);
  };

  const updateProduct = (index: number, field: string, value: string) => {
    const updated = [...formProducts];
    if (field === 'product_name') {
      updated[index] = { ...updated[index], product_name: value };
    } else if (field === 'cost_price') {
      updated[index] = { ...updated[index], cost_price: Number(value) };
    }
    setFormProducts(updated);
  };

  const removeProduct = (index: number) => {
    setFormProducts(formProducts.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        ...formData,
        products: formProducts.filter(p => p.product_name.trim()),
      };
      if (editingVendor) {
        await api.put(`/vendors/${editingVendor.id}`, payload);
      } else {
        await api.post('/vendors', payload);
      }
      closeModal();
      fetchVendors();
    } catch (error) {
      alert(error instanceof Error ? error.message : '저장에 실패했습니다.');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('업체와 소속 상품이 모두 삭제됩니다. 계속하시겠습니까?')) return;
    try {
      await api.delete(`/vendors/${id}`);
      if (expandedVendor === id) setExpandedVendor(null);
      fetchVendors();
    } catch (error) {
      alert(error instanceof Error ? error.message : '삭제에 실패했습니다.');
    }
  };

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedVendors);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedVendors(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedVendors.size === filteredVendors.length) {
      setSelectedVendors(new Set());
    } else {
      setSelectedVendors(new Set(filteredVendors.map(v => v.id)));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedVendors.size === 0) return;
    if (!confirm(`선택한 ${selectedVendors.size}개의 업체를 삭제하시겠습니까? 소속 상품도 모두 삭제됩니다.`)) return;

    try {
      const ids = Array.from(selectedVendors);
      await api.post('/vendors/bulk-delete', { ids });
      setSelectedVendors(new Set());
      setExpandedVendor(null);
      fetchVendors();
    } catch (error) {
      alert(error instanceof Error ? error.message : '삭제에 실패했습니다.');
    }
  };

  const toggleExpand = async (vendorId: string) => {
    if (expandedVendor === vendorId) {
      setExpandedVendor(null);
      setExpandedProducts([]);
      return;
    }
    try {
      const detail = await api.get<any>(`/vendors/${vendorId}`);
      setExpandedProducts(detail.products || []);
      setExpandedVendor(vendorId);
    } catch {
      setExpandedProducts([]);
      setExpandedVendor(vendorId);
    }
  };

  const filteredVendors = vendors.filter(v =>
    !searchTerm || v.name.toLowerCase().includes(searchTerm.toLowerCase()) || (v.representative || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (isLoading) {
    return (<div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div></div>);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900">업체상품</h1>
        <button onClick={() => openModal()} className="inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors">
          <Plus className="h-5 w-5 mr-2" />업체 등록
        </button>
      </div>

      {/* 검색 */}
      <div className="bg-white rounded-xl shadow-sm p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input type="text" placeholder="업체명 또는 대표자명으로 검색" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent" />
        </div>
      </div>

      {/* 업체 목록 */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {/* 선택된 항목 액션 바 */}
        {selectedVendors.size > 0 && (
          <div className="flex items-center justify-between px-6 py-3 bg-primary-50 border-b border-primary-100">
            <div className="flex items-center gap-2">
              <CheckSquare className="h-5 w-5 text-primary-600" />
              <span className="text-sm font-medium text-primary-700">
                {selectedVendors.size}개 선택됨
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSelectedVendors(new Set())}
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
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase w-12">
                  <input
                    type="checkbox"
                    checked={filteredVendors.length > 0 && selectedVendors.size === filteredVendors.length}
                    onChange={toggleSelectAll}
                    className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                  />
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">업체명</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">대표자명</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">연락처</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">상품 수</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">관리</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredVendors.map((vendor) => (
                <>
                  <tr
                    key={vendor.id}
                    className={`hover:bg-gray-50 cursor-pointer ${selectedVendors.has(vendor.id) ? 'bg-primary-50/50' : ''} ${expandedVendor === vendor.id ? 'bg-orange-50' : ''}`}
                    onClick={() => toggleExpand(vendor.id)}
                  >
                    <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedVendors.has(vendor.id)}
                        onChange={() => toggleSelect(vendor.id)}
                        className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="h-10 w-10 rounded-full bg-orange-100 flex items-center justify-center">
                          <Truck className="h-5 w-5 text-orange-600" />
                        </div>
                        <div className="ml-4 flex items-center gap-2">
                          <div className="text-sm font-medium text-gray-900">{vendor.name}</div>
                          {expandedVendor === vendor.id ? (
                            <ChevronUp className="h-4 w-4 text-gray-400" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-gray-400" />
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{vendor.representative || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{vendor.phone || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded-full">{vendor.product_count}개</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium" onClick={(e) => e.stopPropagation()}>
                      <button onClick={() => openModal(vendor)} className="text-primary-600 hover:text-primary-900 mr-3"><Edit2 className="h-4 w-4" /></button>
                      <button onClick={() => handleDelete(vendor.id)} className="text-red-600 hover:text-red-900"><Trash2 className="h-4 w-4" /></button>
                    </td>
                  </tr>
                  {expandedVendor === vendor.id && (
                    <tr key={`${vendor.id}-products`}>
                      <td colSpan={6} className="px-6 py-0">
                        <div className="ml-16 mb-4 mt-1">
                          {expandedProducts.length > 0 ? (
                            <table className="min-w-full divide-y divide-gray-100 text-sm">
                              <thead>
                                <tr>
                                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-400">상품명</th>
                                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-400">원가</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-100">
                                {expandedProducts.map((p, i) => (
                                  <tr key={i}>
                                    <td className="px-3 py-2 text-gray-700"><Package className="inline h-3.5 w-3.5 mr-1.5 text-gray-400" />{p.product_name}</td>
                                    <td className="px-3 py-2 text-right text-gray-700">{Number(p.cost_price).toLocaleString()}원</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          ) : (
                            <p className="text-sm text-gray-400 py-2">등록된 상품이 없습니다.</p>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
        {filteredVendors.length === 0 && (
          <div className="text-center py-12">
            <Truck className="mx-auto h-12 w-12 text-gray-400" />
            <p className="mt-4 text-gray-500">{vendors.length > 0 ? '검색 결과가 없습니다.' : '등록된 업체가 없습니다.'}</p>
          </div>
        )}
      </div>

      {/* 업체 등록/수정 모달 */}
      {showModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75" onClick={closeModal} />
            <div className="relative bg-white rounded-xl shadow-xl max-w-lg w-full mx-auto p-6 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-900">{editingVendor ? '업체 수정' : '업체 등록'}</h2>
                <button onClick={closeModal} className="text-gray-400 hover:text-gray-600"><X className="h-6 w-6" /></button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1"><Truck className="inline h-4 w-4 mr-1" />업체명 *</label>
                  <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1"><User className="inline h-4 w-4 mr-1" />대표자명</label>
                    <input type="text" value={formData.representative} onChange={(e) => setFormData({ ...formData, representative: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1"><Phone className="inline h-4 w-4 mr-1" />연락처</label>
                    <input type="tel" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} placeholder="010-0000-0000" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500" />
                  </div>
                </div>

                {/* 상품 목록 */}
                <div className="border-t pt-4 mt-4">
                  <div className="flex items-center justify-between mb-3">
                    <label className="text-sm font-medium text-gray-900 flex items-center"><Package className="inline h-4 w-4 mr-1 text-primary-600" />상품 목록</label>
                    <button type="button" onClick={addProduct} className="inline-flex items-center px-3 py-1 text-xs bg-primary-50 text-primary-700 rounded-lg hover:bg-primary-100">
                      <Plus className="h-3 w-3 mr-1" />상품 추가
                    </button>
                  </div>

                  {formProducts.length > 0 ? (
                    <div className="border rounded-lg overflow-hidden">
                      <table className="min-w-full divide-y divide-gray-200 text-sm">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">상품명</th>
                            <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 w-32">원가</th>
                            <th className="px-3 py-2 w-10"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {formProducts.map((p, index) => (
                            <tr key={index}>
                              <td className="px-3 py-2">
                                <input type="text" value={p.product_name} onChange={(e) => updateProduct(index, 'product_name', e.target.value)} placeholder="상품명 입력" className="w-full px-2 py-1 border rounded text-sm focus:ring-1 focus:ring-primary-500" />
                              </td>
                              <td className="px-3 py-2">
                                <input type="number" value={p.cost_price} onChange={(e) => updateProduct(index, 'cost_price', e.target.value)} min="0" className="w-full px-2 py-1 border rounded text-sm text-right focus:ring-1 focus:ring-primary-500" />
                              </td>
                              <td className="px-3 py-2">
                                <button type="button" onClick={() => removeProduct(index)} className="text-red-500 hover:text-red-700"><X className="h-4 w-4" /></button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="border border-dashed rounded-lg p-4 text-center text-sm text-gray-400">
                      상품을 추가해주세요
                    </div>
                  )}
                </div>

                <div className="flex justify-end space-x-3 pt-4">
                  <button type="button" onClick={closeModal} className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">취소</button>
                  <button type="submit" className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700">{editingVendor ? '수정' : '등록'}</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
