import { useEffect, useState } from 'react';
import { api } from '../utils/api';
import { formatCurrency, formatNumber, formatDate, getStatusColor, getStatusLabel } from '../utils/format';
import { DashboardSummary, Order, Transaction } from '../types';
import {
  DollarSign,
  ShoppingCart,
  TrendingUp,
  TrendingDown,
  Calculator,
  ArrowRight,
  ArrowUpRight,
  Calendar,
  Activity,
  Package,
  Clock,
  AlertTriangle,
  ClipboardList,
  Gift,
  Truck
} from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend,
  Area,
  AreaChart
} from 'recharts';

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

interface ExtendedOrder extends Order {
  customer_company?: string;
  assignee_name?: string;
  items_summary?: string;
  total_quantity?: number;
}

interface GroupedTransaction {
  reference_id: string;
  order_number: string;
  customer_company?: string;
  customer_name?: string;
  income: number;
  expense: number;
  refund: number;
  date: string;
}

interface NewService {
  id: string;
  name: string;
  category: string;
  price: number;
  status: string;
  created_at: string;
}

interface UpcomingDeadline {
  id: string;
  order_number: string;
  total_amount: number;
  status: string;
  due_date: string;
  customer_name: string;
  customer_company: string;
  assignee_name: string;
  items_summary: string;
}

interface RecentData {
  recentOrders: ExtendedOrder[];
  recentTransactions: GroupedTransaction[];
  newServices: NewService[];
  upcomingDeadlines: UpcomingDeadline[];
}

interface ChartsData {
  ordersByStatus: { status: string; count: number }[];
  expensesByCategory: { category: string; total: number }[];
  monthlySales: { month: string; total: number }[];
  monthlyFinance: { month: string; income: number; expense: number }[];
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white/95 backdrop-blur-sm px-4 py-3 rounded-xl shadow-lg border border-slate-100">
        <p className="text-sm font-semibold text-slate-900 mb-1">{label}</p>
        {payload.map((entry: any, index: number) => (
          <p key={index} className="text-sm" style={{ color: entry.color }}>
            {entry.name}: {formatCurrency(entry.value)}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export default function Dashboard() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [recentData, setRecentData] = useState<RecentData | null>(null);
  const [chartsData, setChartsData] = useState<ChartsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    const results = await Promise.allSettled([
      api.get<DashboardSummary>('/dashboard/summary'),
      api.get<RecentData>('/dashboard/recent'),
      api.get<ChartsData>('/dashboard/charts'),
    ]);
    if (results[0].status === 'fulfilled') setSummary(results[0].value);
    else console.error('Failed to fetch summary:', results[0].reason);
    if (results[1].status === 'fulfilled') setRecentData(results[1].value);
    else console.error('Failed to fetch recent:', results[1].reason);
    if (results[2].status === 'fulfilled') setChartsData(results[2].value);
    else console.error('Failed to fetch charts:', results[2].reason);
    setIsLoading(false);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center">
          <div className="relative">
            <div className="w-16 h-16 border-4 border-primary-200 rounded-full animate-spin border-t-primary-600 mx-auto"></div>
            <Activity className="absolute inset-0 m-auto h-6 w-6 text-primary-600" />
          </div>
          <p className="mt-4 text-sm text-slate-500 font-medium">데이터를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  const periodLabel = summary?.period || '';
  const monthLabel = periodLabel ? `${periodLabel.split('-')[1]}월` : '당월';

  const statCards = [
    {
      title: '당일 접수',
      value: formatNumber(summary?.sales?.todayOrders || 0),
      suffix: '건',
      icon: ClipboardList,
      gradient: 'from-blue-500 to-cyan-500',
      bgGradient: 'from-blue-50 to-cyan-50',
      link: (() => {
        const today = new Date().toISOString().split('T')[0];
        return `/sales?tab=orders&dateFrom=${today}`;
      })()
    },
    {
      title: `${monthLabel} 매출`,
      value: formatCurrency(summary?.sales.totalSales || 0),
      icon: TrendingUp,
      gradient: 'from-emerald-500 to-teal-500',
      bgGradient: 'from-emerald-50 to-teal-50',
      link: '/sales'
    },
    {
      title: `${monthLabel} 정산예정`,
      value: formatCurrency(summary?.settlement.expected || 0),
      icon: Calculator,
      gradient: 'from-amber-500 to-orange-500',
      bgGradient: 'from-amber-50 to-orange-50',
      link: '/settlement'
    },
    {
      title: '대기 주문',
      value: formatNumber(summary?.sales.pendingOrders || 0),
      suffix: '건',
      icon: ShoppingCart,
      gradient: 'from-primary-400 to-primary-600',
      bgGradient: 'from-primary-50 to-primary-100',
      link: '/sales'
    },
  ];

  const financeCards = [
    {
      title: `${monthLabel} 매출`,
      value: summary?.finance.income || 0,
      icon: TrendingUp,
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-50',
      iconBg: 'bg-emerald-100',
      breakdown: null as { label: string; value: number; color: string }[] | null,
    },
    {
      title: `${monthLabel} 지출`,
      value: summary?.finance.expense || 0,
      icon: TrendingDown,
      color: 'text-rose-600',
      bgColor: 'bg-rose-50',
      iconBg: 'bg-rose-100',
      breakdown: [
        { label: '업체지출', value: summary?.finance.vendorExpense || 0, color: 'text-rose-500' },
        { label: '인센티브', value: summary?.finance.incentive || 0, color: 'text-purple-500' },
        { label: '환불', value: summary?.finance.refund || 0, color: 'text-amber-500' },
      ].filter(item => item.value > 0),
    },
    {
      title: `${monthLabel} 순수익`,
      value: summary?.finance.balance || 0,
      icon: DollarSign,
      color: (summary?.finance.balance || 0) >= 0 ? 'text-primary-600' : 'text-rose-600',
      bgColor: (summary?.finance.balance || 0) >= 0 ? 'bg-primary-50' : 'bg-rose-50',
      iconBg: (summary?.finance.balance || 0) >= 0 ? 'bg-primary-100' : 'bg-rose-100',
      breakdown: null as { label: string; value: number; color: string }[] | null,
    },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">대시보드</h1>
          <p className="text-slate-500 mt-1 flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            {new Date().toLocaleDateString('ko-KR', { dateStyle: 'full' })}
          </p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {statCards.map((stat, index) => (
          <Link
            key={stat.title}
            to={stat.link}
            className="group relative overflow-hidden bg-white rounded-2xl p-6 shadow-soft border border-slate-100 hover:shadow-soft-lg hover:-translate-y-1 transition-all duration-300"
            style={{ animationDelay: `${index * 75}ms` }}
          >
            {/* Background gradient overlay */}
            <div className={`absolute inset-0 bg-gradient-to-br ${stat.bgGradient} opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />

            <div className="relative">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-500">{stat.title}</p>
                  <p className="text-2xl font-bold text-slate-900 mt-2">
                    {stat.value}
                    {stat.suffix && <span className="text-lg font-normal text-slate-500 ml-1">{stat.suffix}</span>}
                  </p>
                </div>
                <div className={`p-3 rounded-xl bg-gradient-to-br ${stat.gradient} shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                  <stat.icon className="h-5 w-5 text-white" />
                </div>
              </div>

              <div className="mt-4 flex items-center text-sm text-slate-500 group-hover:text-primary-600 transition-colors">
                <span>자세히 보기</span>
                <ArrowUpRight className="h-4 w-4 ml-1 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Finance Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {financeCards.map((card, index) => (
          <div
            key={card.title}
            className={`${card.bgColor} rounded-2xl p-6 border border-slate-100 transition-all duration-300 hover:shadow-soft`}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-slate-700">{card.title}</h2>
              <div className={`p-2.5 rounded-xl ${card.iconBg}`}>
                <card.icon className={`h-5 w-5 ${card.color}`} />
              </div>
            </div>
            <p className={`text-3xl font-bold ${card.color}`}>
              {formatCurrency(card.value)}
            </p>
            {card.breakdown && card.breakdown.length > 0 && (
              <div className="mt-3 pt-3 border-t border-slate-200/50 space-y-1">
                {card.breakdown.map(item => (
                  <div key={item.label} className="flex items-center justify-between text-sm">
                    <span className="text-slate-500">{item.label}</span>
                    <span className={`font-medium ${item.color}`}>{formatCurrency(item.value)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Finance Chart */}
        <div className="bg-white rounded-2xl shadow-soft border border-slate-100 p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-6">월별 매출/지출</h2>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartsData?.monthlyFinance || []}>
                <defs>
                  <linearGradient id="incomeGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="expenseGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v / 1000000).toFixed(0)}M`} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ paddingTop: '20px' }} />
                <Area type="monotone" dataKey="income" stroke="#10b981" strokeWidth={2} fill="url(#incomeGradient)" name="매출" />
                <Area type="monotone" dataKey="expense" stroke="#ef4444" strokeWidth={2} fill="url(#expenseGradient)" name="지출" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Orders by Status */}
        <div className="bg-white rounded-2xl shadow-soft border border-slate-100 p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-6">주문 현황</h2>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartsData?.ordersByStatus || []}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={4}
                  dataKey="count"
                  nameKey="status"
                >
                  {chartsData?.ordersByStatus?.map((_, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={COLORS[index % COLORS.length]}
                      stroke="none"
                    />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number, name: string) => [value + '건', getStatusLabel(name)]}
                  contentStyle={{
                    backgroundColor: 'rgba(255, 255, 255, 0.95)',
                    backdropFilter: 'blur(8px)',
                    border: 'none',
                    borderRadius: '12px',
                    boxShadow: '0 10px 40px -10px rgba(0, 0, 0, 0.1)'
                  }}
                />
                <Legend
                  formatter={(value) => getStatusLabel(value)}
                  wrapperStyle={{ paddingTop: '20px' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Monthly Sales */}
        <div className="bg-white rounded-2xl shadow-soft border border-slate-100 p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-6">월별 매출</h2>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartsData?.monthlySales || []}>
                <defs>
                  <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#6366f1" />
                    <stop offset="100%" stopColor="#8b5cf6" />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v / 1000000).toFixed(0)}M`} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="total" fill="url(#salesGradient)" name="매출" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Expenses by Category */}
        <div className="bg-white rounded-2xl shadow-soft border border-slate-100 p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-6">카테고리별 지출</h2>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartsData?.expensesByCategory || []} layout="vertical">
                <defs>
                  <linearGradient id="expenseCategoryGradient" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#8b5cf6" />
                    <stop offset="100%" stopColor="#a78bfa" />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v / 1000000).toFixed(0)}M`} />
                <YAxis dataKey="category" type="category" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} width={60} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="total" fill="url(#expenseCategoryGradient)" name="지출" radius={[0, 8, 8, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* New Services & Upcoming Deadlines */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 신규 등록 서비스상품 */}
        <div className="bg-white rounded-2xl shadow-soft border border-slate-100 overflow-hidden">
          <div className="flex items-center justify-between p-6 border-b border-slate-100">
            <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
              <Package className="h-5 w-5 text-teal-500" />
              신규 서비스상품
            </h2>
            <Link
              to="/services"
              className="text-sm font-medium text-primary-600 hover:text-primary-700 flex items-center gap-1 group"
            >
              전체보기
              <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>
          {recentData?.newServices?.length ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">서비스명</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">카테고리</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">가격</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider">등록일</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {recentData.newServices.map((svc) => (
                    <tr key={svc.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-900 truncate max-w-[160px]" title={svc.name}>{svc.name}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-slate-600">{svc.category || '-'}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="font-semibold text-slate-900">{formatCurrency(svc.price)}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="text-xs text-slate-500">{formatDate(svc.created_at)}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-8 text-center text-slate-500">
              <Package className="h-10 w-10 mx-auto text-slate-300 mb-3" />
              <p>등록된 서비스가 없습니다.</p>
            </div>
          )}
        </div>

        {/* 마감예정 목록 */}
        <div className="bg-white rounded-2xl shadow-soft border border-slate-100 overflow-hidden">
          <div className="flex items-center justify-between p-6 border-b border-slate-100">
            <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              마감예정
            </h2>
            <Link
              to="/sales"
              className="text-sm font-medium text-primary-600 hover:text-primary-700 flex items-center gap-1 group"
            >
              전체보기
              <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>
          {recentData?.upcomingDeadlines?.length ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">업체명</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">주문상품</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">담당자</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider">마감일</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider">상태</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {recentData.upcomingDeadlines.map((order) => {
                    const dueDate = new Date(order.due_date);
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    const diffDays = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                    const isOverdue = diffDays < 0;
                    const isUrgent = diffDays >= 0 && diffDays <= 1;
                    return (
                      <tr key={order.id} className={`hover:bg-slate-50/50 transition-colors ${isOverdue ? 'bg-red-50/50' : isUrgent ? 'bg-amber-50/30' : ''}`}>
                        <td className="px-4 py-3">
                          <p className="font-medium text-slate-900 truncate max-w-[120px]" title={order.customer_company || order.customer_name || '-'}>
                            {order.customer_company || order.customer_name || '-'}
                          </p>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-sm text-slate-700 truncate max-w-[140px]" title={order.items_summary || '-'}>{order.items_summary || '-'}</p>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm text-slate-600">{order.assignee_name || '-'}</span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <Clock className={`h-3.5 w-3.5 ${isOverdue ? 'text-red-500' : isUrgent ? 'text-amber-500' : 'text-slate-400'}`} />
                            <span className={`text-xs font-medium ${isOverdue ? 'text-red-600' : isUrgent ? 'text-amber-600' : 'text-slate-600'}`}>
                              {formatDate(order.due_date)}
                              {isOverdue && <span className="ml-1 text-red-500">(지남)</span>}
                              {isUrgent && <span className="ml-1 text-amber-500">(임박)</span>}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(order.status)}`}>
                            {getStatusLabel(order.status)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-8 text-center text-slate-500">
              <Clock className="h-10 w-10 mx-auto text-slate-300 mb-3" />
              <p>마감예정 주문이 없습니다.</p>
            </div>
          )}
        </div>
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Orders - 병렬 테이블 */}
        <div className="bg-white rounded-2xl shadow-soft border border-slate-100 overflow-hidden">
          <div className="flex items-center justify-between p-6 border-b border-slate-100">
            <h2 className="text-lg font-semibold text-slate-900">최근 주문</h2>
            <Link
              to="/sales"
              className="text-sm font-medium text-primary-600 hover:text-primary-700 flex items-center gap-1 group"
            >
              전체보기
              <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>
          {recentData?.recentOrders?.length ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">업체명</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">담당자</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">주문상품</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider">수량</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">금액</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider">상태</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {recentData.recentOrders.map((order) => (
                    <tr key={order.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-900 truncate max-w-[120px]" title={order.customer_company || order.customer_name || '-'}>
                          {order.customer_company || order.customer_name || '-'}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm text-slate-600 truncate max-w-[80px]" title={order.assignee_name || order.customer_name || '-'}>
                          {order.assignee_name || order.customer_name || '-'}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm text-slate-700 truncate max-w-[150px]" title={order.items_summary || '-'}>
                          {order.items_summary || '-'}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="text-sm font-medium text-slate-900">{formatNumber(order.total_quantity || 0)}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="font-semibold text-slate-900">{formatCurrency(order.total_amount)}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(order.status)}`}>
                          {getStatusLabel(order.status)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-8 text-center text-slate-500">
              <ShoppingCart className="h-10 w-10 mx-auto text-slate-300 mb-3" />
              <p>최근 주문이 없습니다.</p>
            </div>
          )}
        </div>

        {/* Recent Transactions - 주문별 매출/지출 묶어서 표시 */}
        <div className="bg-white rounded-2xl shadow-soft border border-slate-100 overflow-hidden">
          <div className="flex items-center justify-between p-6 border-b border-slate-100">
            <h2 className="text-lg font-semibold text-slate-900">최근 거래내역</h2>
            <Link
              to="/finance"
              className="text-sm font-medium text-primary-600 hover:text-primary-700 flex items-center gap-1 group"
            >
              전체보기
              <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>
          <div className="divide-y divide-slate-100">
            {recentData?.recentTransactions?.length ? (
              recentData.recentTransactions.map((txn) => (
                <div key={txn.reference_id} className="p-4 hover:bg-slate-50/50 transition-colors">
                  {/* 주문 정보 헤더 */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-primary-50">
                        <ShoppingCart className="h-4 w-4 text-primary-600" />
                      </div>
                      <div>
                        <p className="font-medium text-slate-900">
                          {txn.order_number ? `주문 ${txn.order_number}` : '거래'}
                        </p>
                        <p className="text-sm text-slate-500">
                          {txn.customer_company || txn.customer_name || '-'}
                        </p>
                      </div>
                    </div>
                    <p className="text-xs text-slate-500">{txn.date ? formatDate(txn.date) : ''}</p>
                  </div>
                  {/* 매출/지출 상세 */}
                  <div className="flex items-center gap-4 ml-11">
                    {txn.income > 0 && (
                      <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 rounded-lg">
                        <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />
                        <span className="text-sm font-semibold text-emerald-600">
                          +{formatCurrency(txn.income)}
                        </span>
                      </div>
                    )}
                    {txn.expense > 0 && (
                      <div className="flex items-center gap-2 px-3 py-1.5 bg-rose-50 rounded-lg">
                        <TrendingDown className="h-3.5 w-3.5 text-rose-600" />
                        <span className="text-sm font-semibold text-rose-600">
                          업체: -{formatCurrency(txn.expense)}
                        </span>
                      </div>
                    )}
                    {txn.refund > 0 && (
                      <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 rounded-lg">
                        <TrendingDown className="h-3.5 w-3.5 text-amber-600" />
                        <span className="text-sm font-semibold text-amber-600">
                          환불: -{formatCurrency(txn.refund)}
                        </span>
                      </div>
                    )}
                    {(txn.income > 0 || txn.expense > 0 || txn.refund > 0) && (
                      <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 rounded-lg">
                        <DollarSign className="h-3.5 w-3.5 text-slate-600" />
                        <span className={`text-sm font-semibold ${txn.income - txn.expense - txn.refund >= 0 ? 'text-primary-600' : 'text-rose-600'}`}>
                          순이익: {formatCurrency(txn.income - txn.expense - txn.refund)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="p-8 text-center text-slate-500">
                <DollarSign className="h-10 w-10 mx-auto text-slate-300 mb-3" />
                <p>최근 거래내역이 없습니다.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
