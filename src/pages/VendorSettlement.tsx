import React, { useEffect, useState } from 'react';
import { api } from '../utils/api';
import { formatCurrency, formatDate } from '../utils/format';
import {
  Truck,
  Calendar,
  ChevronDown,
  ChevronRight,
  Package,
  FileText,
  Filter,
  RotateCcw
} from 'lucide-react';

interface OrderDetail {
  order_id: string;
  order_number: string;
  customer_name: string;
  order_date: string;
  order_status: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  item_type: string;
}

interface ProductSummary {
  product_id: string;
  product_name: string;
  cost_price: number;
  total_quantity: number;
  total_amount: number;
  refund_quantity: number;
  refund_amount: number;
  net_amount: number;
  orders: OrderDetail[];
}

interface VendorSummary {
  vendor_id: string;
  vendor_name: string;
  representative: string;
  vendor_phone: string;
  total_amount: number;
  total_refund: number;
  net_amount: number;
  order_count: number;
  products: ProductSummary[];
}

export default function VendorSettlement() {
  const [vendors, setVendors] = useState<VendorSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [expandedVendors, setExpandedVendors] = useState<Set<string>>(new Set());
  const [expandedProducts, setExpandedProducts] = useState<Set<string>>(new Set());

  const fetchData = async () => {
    setLoading(true);
    try {
      let endpoint = '/vendors/settlement';
      const params = new URLSearchParams();
      if (periodStart) params.set('period_start', periodStart);
      if (periodEnd) params.set('period_end', periodEnd);
      const qs = params.toString();
      if (qs) endpoint += '?' + qs;
      const data = await api.get<VendorSummary[]>(endpoint);
      setVendors(data);
    } catch {
      setVendors([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleFilter = () => { fetchData(); };
  const handleReset = () => {
    setPeriodStart('');
    setPeriodEnd('');
    setTimeout(() => fetchData(), 0);
  };

  const toggleVendor = (id: string) => {
    setExpandedVendors(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleProduct = (key: string) => {
    setExpandedProducts(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const totals = vendors.reduce((acc, v) => ({
    amount: acc.amount + v.total_amount,
    refund: acc.refund + v.total_refund,
    net: acc.net + v.net_amount,
    orders: acc.orders + v.order_count
  }), { amount: 0, refund: 0, net: 0, orders: 0 });

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-rose-500 to-pink-500 rounded-xl flex items-center justify-center">
            <Truck className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">업체 정산</h1>
            <p className="text-xs text-gray-500">업체별 사용내역 취합 및 정산</p>
          </div>
        </div>
      </div>

      {/* Filter */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-center gap-3 flex-wrap">
          <Filter className="w-4 h-4 text-gray-400" />
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-gray-400" />
            <input type="date" value={periodStart} onChange={e => setPeriodStart(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm" />
            <span className="text-gray-400">~</span>
            <input type="date" value={periodEnd} onChange={e => setPeriodEnd(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm" />
          </div>
          <button onClick={handleFilter}
            className="px-4 py-1.5 bg-rose-500 text-white rounded-lg text-sm hover:bg-rose-600 transition-colors">
            조회
          </button>
          <button onClick={handleReset}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors flex items-center gap-1">
            <RotateCcw className="w-3 h-3" /> 초기화
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 mb-1">업체 수</p>
          <p className="text-2xl font-bold text-gray-900">{vendors.length}<span className="text-sm font-normal text-gray-400 ml-1">개</span></p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 mb-1">총 주문건</p>
          <p className="text-2xl font-bold text-blue-600">{totals.orders}<span className="text-sm font-normal text-gray-400 ml-1">건</span></p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 mb-1">총 지출액</p>
          <p className="text-2xl font-bold text-rose-600">{formatCurrency(totals.amount)}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 mb-1">정산 금액</p>
          <p className="text-2xl font-bold text-gray-900">{formatCurrency(totals.net)}</p>
          {totals.refund > 0 && <p className="text-xs text-green-600 mt-0.5">환입 {formatCurrency(totals.refund)}</p>}
        </div>
      </div>

      {/* Vendor List */}
      {loading ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400">불러오는 중...</div>
      ) : vendors.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400">
          조회된 업체 사용내역이 없습니다.
        </div>
      ) : (
        <div className="space-y-3">
          {vendors.map(vendor => {
            const isVendorOpen = expandedVendors.has(vendor.vendor_id);
            return (
              <div key={vendor.vendor_id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                {/* Vendor Header */}
                <button onClick={() => toggleVendor(vendor.vendor_id)}
                  className="w-full px-5 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-3">
                    {isVendorOpen ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                    <div className="w-8 h-8 bg-rose-100 rounded-lg flex items-center justify-center">
                      <Truck className="w-4 h-4 text-rose-600" />
                    </div>
                    <div className="text-left">
                      <p className="font-semibold text-gray-900">{vendor.vendor_name}</p>
                      <p className="text-xs text-gray-500">
                        {vendor.representative && <span>{vendor.representative}</span>}
                        {vendor.representative && vendor.vendor_phone && <span> · </span>}
                        {vendor.vendor_phone && <span>{vendor.vendor_phone}</span>}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-6 text-sm">
                    <div className="text-right">
                      <p className="text-xs text-gray-400">상품</p>
                      <p className="font-medium text-gray-700">{vendor.products.length}종</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-400">주문</p>
                      <p className="font-medium text-blue-600">{vendor.order_count}건</p>
                    </div>
                    <div className="text-right min-w-[100px]">
                      <p className="text-xs text-gray-400">정산금액</p>
                      <p className="font-bold text-gray-900">{formatCurrency(vendor.net_amount)}</p>
                    </div>
                  </div>
                </button>

                {/* Vendor Detail */}
                {isVendorOpen && (
                  <div className="border-t border-gray-100">
                    {/* Products Table */}
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 text-gray-500 text-xs">
                          <th className="text-left px-5 py-2.5 w-8"></th>
                          <th className="text-left px-3 py-2.5">상품명</th>
                          <th className="text-right px-3 py-2.5">단가</th>
                          <th className="text-right px-3 py-2.5">사용량</th>
                          <th className="text-right px-3 py-2.5">지출액</th>
                          <th className="text-right px-3 py-2.5">환입</th>
                          <th className="text-right px-5 py-2.5">정산액</th>
                        </tr>
                      </thead>
                      <tbody>
                        {vendor.products.map(product => {
                          const productKey = `${vendor.vendor_id}_${product.product_id}`;
                          const isProductOpen = expandedProducts.has(productKey);
                          return (
                            <React.Fragment key={product.product_id}>
                              <tr className="border-t border-gray-50 hover:bg-gray-50/50 cursor-pointer"
                                onClick={() => toggleProduct(productKey)}>
                                <td className="px-5 py-3">
                                  {isProductOpen ? <ChevronDown className="w-3.5 h-3.5 text-gray-400" /> : <ChevronRight className="w-3.5 h-3.5 text-gray-400" />}
                                </td>
                                <td className="px-3 py-3">
                                  <div className="flex items-center gap-2">
                                    <Package className="w-3.5 h-3.5 text-gray-400" />
                                    <span className="font-medium text-gray-800">{product.product_name}</span>
                                  </div>
                                </td>
                                <td className="px-3 py-3 text-right text-gray-600">{formatCurrency(product.cost_price)}</td>
                                <td className="px-3 py-3 text-right">
                                  <span className="font-semibold text-blue-600">{product.total_quantity}</span>
                                  <span className="text-gray-400 text-xs ml-0.5">건</span>
                                  {product.refund_quantity > 0 && (
                                    <span className="text-green-600 text-xs ml-1">(-{product.refund_quantity})</span>
                                  )}
                                </td>
                                <td className="px-3 py-3 text-right text-gray-700">{formatCurrency(product.total_amount)}</td>
                                <td className="px-3 py-3 text-right text-green-600">
                                  {product.refund_amount > 0 ? formatCurrency(product.refund_amount) : '-'}
                                </td>
                                <td className="px-5 py-3 text-right font-bold text-gray-900">{formatCurrency(product.net_amount)}</td>
                              </tr>

                              {/* Order Details */}
                              {isProductOpen && (
                                <tr>
                                  <td colSpan={7} className="px-0 py-0">
                                    <div className="bg-gray-50/80 mx-4 mb-3 rounded-lg overflow-hidden">
                                      <table className="w-full text-xs">
                                        <thead>
                                          <tr className="text-gray-400 border-b border-gray-200/60">
                                            <th className="text-left px-4 py-2">주문번호</th>
                                            <th className="text-left px-3 py-2">거래처</th>
                                            <th className="text-center px-3 py-2">주문일</th>
                                            <th className="text-center px-3 py-2">구분</th>
                                            <th className="text-right px-3 py-2">수량</th>
                                            <th className="text-right px-3 py-2">단가</th>
                                            <th className="text-right px-4 py-2">금액</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {product.orders.map((order, idx) => (
                                            <tr key={idx} className="border-t border-gray-200/40 hover:bg-white/60">
                                              <td className="px-4 py-2">
                                                <div className="flex items-center gap-1.5">
                                                  <FileText className="w-3 h-3 text-gray-300" />
                                                  <span className="text-gray-700 font-medium">{order.order_number}</span>
                                                </div>
                                              </td>
                                              <td className="px-3 py-2 text-gray-600">{order.customer_name || '-'}</td>
                                              <td className="px-3 py-2 text-center text-gray-500">{order.order_date ? formatDate(order.order_date) : '-'}</td>
                                              <td className="px-3 py-2 text-center">
                                                {order.item_type === 'refund' ? (
                                                  <span className="px-1.5 py-0.5 bg-green-100 text-green-700 rounded text-[10px] font-medium">환입</span>
                                                ) : (
                                                  <span className="px-1.5 py-0.5 bg-rose-100 text-rose-700 rounded text-[10px] font-medium">지출</span>
                                                )}
                                              </td>
                                              <td className="px-3 py-2 text-right text-gray-700">{order.quantity}</td>
                                              <td className="px-3 py-2 text-right text-gray-500">{formatCurrency(order.unit_price)}</td>
                                              <td className={`px-4 py-2 text-right font-medium ${order.item_type === 'refund' ? 'text-green-600' : 'text-gray-800'}`}>
                                                {order.item_type === 'refund' ? '+' : ''}{formatCurrency(order.total_price)}
                                              </td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          );
                        })}
                        {/* Vendor Total Row */}
                        <tr className="border-t-2 border-gray-200 bg-gray-50 font-semibold text-sm">
                          <td colSpan={3} className="px-5 py-3 text-gray-600">합계</td>
                          <td className="px-3 py-3 text-right text-blue-600">
                            {vendor.products.reduce((s, p) => s + p.total_quantity, 0)}건
                          </td>
                          <td className="px-3 py-3 text-right text-gray-700">{formatCurrency(vendor.total_amount)}</td>
                          <td className="px-3 py-3 text-right text-green-600">
                            {vendor.total_refund > 0 ? formatCurrency(vendor.total_refund) : '-'}
                          </td>
                          <td className="px-5 py-3 text-right text-gray-900">{formatCurrency(vendor.net_amount)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
