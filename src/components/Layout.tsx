import { useState } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard,
  Users,
  DollarSign,
  ShoppingCart,
  Briefcase,
  Truck,
  LogOut,
  Menu,
  X,
  Calculator,
  ChevronRight,
  Gift,
  FileText,
  ShieldCheck,
  BookOpen
} from 'lucide-react';

// roles: 접근 가능한 역할 목록. 빈 배열 = 모든 역할 접근 가능
const navigation = [
  { name: '대시보드', href: '/', icon: LayoutDashboard, color: 'from-primary-400 to-primary-600', roles: [] },
  { name: '인사관리', href: '/employees', icon: Users, color: 'from-primary-400 to-primary-600', roles: ['admin'] },
  { name: '재무/회계', href: '/finance', icon: DollarSign, color: 'from-primary-400 to-primary-600', roles: ['admin'] },
  { name: '서비스상품', href: '/services', icon: Briefcase, color: 'from-primary-400 to-primary-600', roles: ['admin', 'manager'] },
  { name: '업체상품', href: '/vendors', icon: Truck, color: 'from-primary-400 to-primary-600', roles: ['admin', 'manager'] },
  { name: '영업관리', href: '/sales', icon: ShoppingCart, color: 'from-primary-400 to-primary-600', roles: [] },
  { name: '정산관리', href: '/settlement', icon: Calculator, color: 'from-primary-400 to-primary-600', roles: [] },
  { name: '인센티브', href: '/incentives', icon: Gift, color: 'from-primary-400 to-primary-600', roles: [] },
  { name: '블로그 발행목록', href: '/blog-posts', icon: FileText, color: 'from-primary-400 to-primary-600', roles: ['admin', 'manager'] },
  { name: '계정관리', href: '/accounts', icon: ShieldCheck, color: 'from-primary-400 to-primary-600', roles: ['admin'] },
  { name: '사용 가이드', href: '/guide', icon: BookOpen, color: 'from-amber-400 to-orange-500', roles: [] },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/20 to-slate-100">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/60 backdrop-blur-sm lg:hidden animate-fade-in"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-72 transform transition-all duration-300 ease-out lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Sidebar background */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#0f172a] via-[#131c33] to-[#0c1425]" />
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wMiI+PGNpcmNsZSBjeD0iMzAiIGN5PSIzMCIgcj0iMiIvPjwvZz48L2c+PC9zdmc+')] opacity-50" />

        <div className="relative flex h-full flex-col">
          {/* Logo */}
          <div className="flex items-center justify-between px-6 py-5">
            <Link to="/" className="group flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center shadow-lg shadow-primary-500/30">
                <span className="text-sm font-black text-white">ML</span>
              </div>
              <div>
                <span className="text-base font-bold text-white group-hover:text-primary-300 transition-colors">마케팅 라운지</span>
                <span className="block text-[10px] tracking-wide text-slate-400 font-medium mt-0.5">통합 관리 시스템</span>
              </div>
            </Link>
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-all"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="mx-6 border-b border-slate-700/50" />

          {/* Navigation */}
          <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto scrollbar-hide">
            <p className="px-3 mb-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
              메뉴
            </p>
            {navigation.filter(item => item.roles.length === 0 || item.roles.includes(user?.role || '')).map((item) => {
              const isActive = location.pathname === item.href;
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={`group relative flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200 ${
                    isActive
                      ? 'bg-primary-500/15 text-white'
                      : 'text-slate-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  {/* Active indicator */}
                  {isActive && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-gradient-to-b from-primary-400 to-primary-600 rounded-r-full" />
                  )}

                  {/* Icon with gradient background on active */}
                  <div className={`relative flex items-center justify-center w-10 h-10 rounded-xl transition-all duration-200 ${
                    isActive
                      ? `bg-gradient-to-br ${item.color} shadow-lg`
                      : 'bg-slate-800/50 group-hover:bg-slate-700/50'
                  }`}>
                    <item.icon className={`h-5 w-5 transition-transform duration-200 ${
                      isActive ? 'text-white scale-110' : 'text-slate-400 group-hover:text-slate-200 group-hover:scale-105'
                    }`} />
                  </div>

                  <span className={`flex-1 font-medium transition-colors ${
                    isActive ? 'text-white' : ''
                  }`}>
                    {item.name}
                  </span>

                  {/* Arrow indicator */}
                  <ChevronRight className={`h-4 w-4 transition-all duration-200 ${
                    isActive
                      ? 'opacity-100 translate-x-0 text-primary-300'
                      : 'opacity-0 -translate-x-2 group-hover:opacity-50 group-hover:translate-x-0'
                  }`} />
                </Link>
              );
            })}
          </nav>

          {/* User info */}
          <div className="p-4 mx-4 mb-4 bg-slate-800/40 rounded-2xl border border-slate-700/30">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center shadow-lg">
                  <span className="text-sm font-bold text-white">
                    {user?.name?.charAt(0)}
                  </span>
                </div>
                <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-500 rounded-full border-2 border-[#131c33]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white truncate">{user?.name}</p>
                <p className="text-xs text-slate-400 truncate">
                  {user?.role === 'admin' ? '관리자' : user?.role === 'manager' ? '매니저' : '직원'} · {user?.email}
                </p>
              </div>
              <button
                onClick={logout}
                className="p-2.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition-all duration-200 group"
                title="로그아웃"
              >
                <LogOut className="h-5 w-5 group-hover:scale-110 transition-transform" />
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="lg:pl-72 min-h-screen">
        {/* Mobile header */}
        <header className="sticky top-0 z-30 flex h-16 items-center gap-4 bg-white/80 backdrop-blur-xl border-b border-slate-200/50 px-4 lg:hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2.5 rounded-xl hover:bg-slate-100 transition-colors"
          >
            <Menu className="h-5 w-5 text-slate-600" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center">
              <span className="text-[10px] font-black text-white">ML</span>
            </div>
            <span className="text-base font-bold text-slate-800">마케팅 라운지</span>
          </div>
        </header>

        {/* Page content */}
        <main className="p-4 lg:p-8">
          <div className="max-w-7xl mx-auto animate-fade-in">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
