import { useState } from 'react';
import {
  BookOpen, LayoutDashboard, Users, DollarSign, Briefcase, Truck,
  ShoppingCart, Calculator, Gift, FileText, ShieldCheck, ChevronDown, ChevronRight,
  Search, ArrowRight
} from 'lucide-react';

interface GuideSection {
  id: string;
  title: string;
  icon: React.ElementType;
  color: string;
  summary: string;
  features: { title: string; description: string }[];
  steps?: { step: string; detail: string }[];
  tips?: string[];
}

const guides: GuideSection[] = [
  {
    id: 'dashboard',
    title: '대시보드',
    icon: LayoutDashboard,
    color: 'from-amber-500 to-orange-600',
    summary: '전체 사업 현황을 한눈에 파악할 수 있는 메인 화면입니다.',
    features: [
      { title: '요약 카드', description: '이번 달 매출, 주문 수, 당일 접수, 미수금 등 핵심 지표를 실시간으로 확인합니다.' },
      { title: '당일 접수', description: '오늘 접수된 주문 건수를 표시합니다. 클릭하면 영업관리 페이지로 이동하며, 오늘 날짜로 필터가 자동 적용됩니다.' },
      { title: '매출 차트', description: '월별/일별 매출 추이를 차트로 확인합니다.' },
      { title: '최근 활동', description: '최근 주문, 거래, 마감일 등 주요 활동 내역을 표시합니다.' },
    ],
    tips: [
      '매니저/직원 계정은 본인이 담당하는 데이터만 표시됩니다.',
      '당일 접수 카드를 클릭하면 오늘 접수 주문만 바로 확인할 수 있습니다.',
    ],
  },
  {
    id: 'sales',
    title: '영업관리',
    icon: ShoppingCart,
    color: 'from-blue-500 to-indigo-600',
    summary: '주문 등록, 관리, 고객 관리를 수행합니다.',
    features: [
      { title: '주문 등록', description: '고객, 서비스 상품, 업체 상품을 선택하여 새 주문을 등록합니다. 주문번호는 자동 생성됩니다.' },
      { title: '주문 목록', description: '등록된 주문을 리스트로 확인하며, 상태별/고객별/담당자별로 필터링할 수 있습니다.' },
      { title: '주문일자 필터', description: '주문일자(단일 날짜)와 시작일/마감일(범위) 필터로 원하는 기간의 주문을 검색합니다.' },
      { title: '고객 관리', description: '고객 탭에서 고객 정보(이름, 회사, 연락처)를 등록하고 관리합니다.' },
    ],
    steps: [
      { step: '주문 등록', detail: '"새 주문" 버튼 클릭 → 고객 선택 → 서비스/업체 상품 추가 → 담당자 지정 → 저장' },
      { step: '주문 수정', detail: '주문 목록에서 해당 주문 클릭 → 상세 화면에서 수정 → 저장' },
      { step: '상태 변경', detail: '주문 상세에서 상태(대기/진행/완료/취소)를 변경합니다.' },
    ],
    tips: [
      '블로그 서비스 상품이 포함된 주문은 블로그 발행목록에 자동 등록됩니다.',
      '주문에 업체 상품을 추가하면 정산관리에서 업체별 정산 시 자동으로 반영됩니다.',
    ],
  },
  {
    id: 'settlement',
    title: '정산관리',
    icon: Calculator,
    color: 'from-emerald-500 to-teal-600',
    summary: '정산 기간별 매출, 업체 지출, 인센티브를 집계하고 정산서를 생성합니다.',
    features: [
      { title: '정산 요약', description: '선택한 기간의 총 매출, 업체 지출, 인센티브, 순이익을 한눈에 확인합니다.' },
      { title: '주문별 정산', description: '각 주문의 매출, 업체 비용, 인센티브를 3단 구조로 상세하게 확인합니다.' },
      { title: '정산서 생성', description: '기간을 설정하고 정산서를 생성하면 해당 기간의 모든 주문이 정산에 포함됩니다.' },
      { title: '일괄 정산', description: '여러 주문을 선택하여 한 번에 정산 처리할 수 있습니다.' },
    ],
    steps: [
      { step: '정산 조회', detail: '기간(시작일~종료일) 설정 → 조회 클릭 → 요약 및 주문별 상세 확인' },
      { step: '정산서 생성', detail: '"정산서 생성" 버튼 클릭 → 기간 및 제목 입력 → 생성' },
    ],
    tips: [
      '매니저/직원 계정은 본인이 담당자로 배정된 주문만 표시됩니다.',
      '정산에는 업체 지출과 인센티브가 모두 포함되어 순이익이 계산됩니다.',
    ],
  },
  {
    id: 'incentives',
    title: '인센티브',
    icon: Gift,
    color: 'from-purple-500 to-violet-600',
    summary: '직원 인센티브 정책을 설정하고 주문별 인센티브를 관리합니다.',
    features: [
      { title: '인센티브 정책', description: '직원별 인센티브 기준(상품, 단가, 조건)을 정책으로 등록합니다.' },
      { title: '직원별 집계', description: '직원별로 발생한 인센티브 총액을 확인하고, 정책별 상품/수량/합계를 볼 수 있습니다.' },
      { title: '주문 인센티브', description: '각 주문에 배정된 인센티브 내역을 확인하고 관리합니다.' },
    ],
    steps: [
      { step: '정책 등록', detail: '"정책 추가" → 직원 선택 → 상품 및 인센티브 금액 설정 → 저장' },
      { step: '집계 확인', detail: '"직원별 집계" 탭에서 직원을 선택하면 정책별 상세 내역을 확인할 수 있습니다.' },
    ],
    tips: [
      '직원 계정은 본인의 인센티브만 볼 수 있습니다.',
      '인센티브는 정산관리의 비용 항목에 자동 포함됩니다.',
    ],
  },
  {
    id: 'blog-posts',
    title: '블로그 발행목록',
    icon: FileText,
    color: 'from-teal-500 to-cyan-600',
    summary: '블로그 포스트의 발행 현황을 추적하고, 외부 거래처에 공유할 수 있습니다.',
    features: [
      { title: '주문별 보기', description: '주문번호로 그룹핑된 블로그 포스트를 확인합니다. 주문을 클릭하면 상세 팝업이 열립니다.' },
      { title: '추적 발행', description: '개별 포스트를 한눈에 볼 수 있는 테이블입니다. 키워드, URL, 상태를 직접 수정할 수 있습니다.' },
      { title: '외부 공유', description: '공유 버튼으로 외부 거래처에 발행 현황 링크를 생성할 수 있습니다. 로그인 없이 조회 가능합니다.' },
      { title: '항목별 공유', description: '체크박스로 특정 주문만 선택하여 해당 항목만 포함된 공유 링크를 생성합니다.' },
      { title: '상태 관리', description: '대기 → 작성중 → 발행완료 → 확인완료 순서로 진행 상태를 관리합니다.' },
    ],
    steps: [
      { step: '발행 추적', detail: '"추적 발행" 탭에서 키워드, 블로그 URL, 상태, 발행일을 직접 입력하고 저장합니다.' },
      { step: '외부 공유', detail: '공유할 주문 선택(체크박스) → "공유" 또는 "선택 항목 공유" 클릭 → 제목 확인 → "링크 생성" → 복사하여 전달' },
      { step: '수동 등록', detail: '"수동 등록" 버튼으로 주문 외 블로그 포스트를 직접 등록할 수 있습니다.' },
    ],
    tips: [
      '블로그 서비스 상품이 포함된 주문을 등록하면 자동으로 발행목록에 추가됩니다.',
      '공유 링크 생성 시 제목이 "업체명 날짜 건수 블로그 발행목록" 형태로 자동 생성됩니다.',
      '공유 링크에 만료 기간(7일/30일/90일/무제한)을 설정할 수 있습니다.',
    ],
  },
  {
    id: 'services',
    title: '서비스상품',
    icon: Briefcase,
    color: 'from-orange-500 to-amber-600',
    summary: '제공하는 서비스 상품을 등록하고 관리합니다.',
    features: [
      { title: '서비스 등록', description: '서비스명, 카테고리, 가격, 단위 등을 입력하여 상품을 등록합니다.' },
      { title: '블로그 추적', description: '블로그 관련 서비스는 "블로그 발행 추적" 체크를 활성화하면, 주문 시 자동으로 발행목록에 등록됩니다.' },
      { title: '업체 연계', description: '서비스 상품에 업체 상품을 연계하여 원가를 관리합니다.' },
    ],
    tips: [
      '서비스 코드는 자동 생성됩니다 (SVC-0001 형태).',
      '서비스명에 "블로그", "포스팅" 등이 포함되면 자동으로 블로그 추적이 활성화됩니다.',
    ],
  },
  {
    id: 'vendors',
    title: '업체상품',
    icon: Truck,
    color: 'from-slate-500 to-gray-600',
    summary: '외주 업체와 업체 상품을 등록하고 관리합니다.',
    features: [
      { title: '업체 등록', description: '업체명, 대표자명, 연락처를 입력하여 업체를 등록합니다.' },
      { title: '상품 관리', description: '각 업체의 상품(원가 포함)을 등록하면, 서비스 상품으로 자동 연계됩니다.' },
      { title: '업체 정산', description: '업체별 사용 내역을 기간별로 조회하여 정산 데이터를 확인합니다.' },
    ],
    steps: [
      { step: '업체 등록', detail: '"업체 추가" → 업체명/대표자/연락처 입력 → 상품 추가(상품명, 원가) → 저장' },
      { step: '업체 정산 조회', detail: '"업체 정산" 탭 → 기간 설정 → 업체별 사용 내역 및 금액 확인' },
    ],
    tips: [
      '업체 상품을 추가하면 서비스 상품에 자동으로 등록됩니다.',
      '업체 수정 시 상품을 추가/삭제하면 연계된 서비스 상품도 갱신됩니다.',
    ],
  },
  {
    id: 'employees',
    title: '인사관리',
    icon: Users,
    color: 'from-sky-500 to-blue-600',
    summary: '직원 정보를 등록하고 관리합니다. (관리자 전용)',
    features: [
      { title: '직원 등록', description: '이름, 부서, 직급, 연락처, 입사일 등 직원 정보를 등록합니다.' },
      { title: '직원 목록', description: '전체 직원 목록을 확인하고, 부서별로 필터링하거나 검색할 수 있습니다.' },
      { title: '상태 관리', description: '재직/퇴직 상태를 관리합니다.' },
    ],
    tips: [
      '여기서 등록한 직원이 영업관리의 담당자, 인센티브 대상 등으로 사용됩니다.',
      '관리자만 접근 가능합니다.',
    ],
  },
  {
    id: 'finance',
    title: '재무/회계',
    icon: DollarSign,
    color: 'from-green-500 to-emerald-600',
    summary: '수입/지출 거래를 관리하고 재무 현황을 파악합니다. (관리자 전용)',
    features: [
      { title: '거래 등록', description: '수입/지출 거래를 등록합니다. 주문과 연계된 거래는 자동으로 생성됩니다.' },
      { title: '재무 요약', description: '총 수입, 총 지출, 순이익을 기간별로 확인합니다.' },
      { title: '거래 내역', description: '모든 거래를 카테고리별, 기간별로 필터링하여 조회합니다.' },
    ],
    tips: ['관리자만 접근 가능합니다.'],
  },
  {
    id: 'accounts',
    title: '계정관리',
    icon: ShieldCheck,
    color: 'from-red-500 to-rose-600',
    summary: '직원 로그인 계정을 생성하고 역할을 관리합니다. (관리자 전용)',
    features: [
      { title: '계정 생성', description: '이메일, 비밀번호, 역할(관리자/매니저/직원)을 설정하여 계정을 만듭니다.' },
      { title: '직원 연동', description: '계정에 직원을 연결하면 해당 직원의 담당 데이터만 볼 수 있게 됩니다.' },
      { title: '역할 권한', description: '관리자: 전체 접근 / 매니저: 서비스·업체·블로그 + 본인 담당 데이터 / 직원: 본인 데이터만' },
    ],
    steps: [
      { step: '계정 생성', detail: '"계정 추가" → 이름/이메일/비밀번호 입력 → 역할 선택 → 직원 연결(선택) → 저장' },
    ],
    tips: [
      '관리자만 접근 가능합니다.',
      '직원을 연결해야 본인 데이터 필터링이 적용됩니다.',
    ],
  },
];

export default function Guide() {
  const [expandedId, setExpandedId] = useState<string | null>('dashboard');
  const [searchText, setSearchText] = useState('');

  const filtered = searchText
    ? guides.filter(g =>
        g.title.includes(searchText) ||
        g.summary.includes(searchText) ||
        g.features.some(f => f.title.includes(searchText) || f.description.includes(searchText))
      )
    : guides;

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl shadow-lg">
              <BookOpen className="h-6 w-6 text-white" />
            </div>
            사용 가이드
          </h1>
          <p className="text-slate-500 mt-1">ERP 시스템의 각 메뉴별 사용 방법을 안내합니다</p>
        </div>
      </div>

      {/* 검색 */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="기능 검색..."
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* 빠른 이동 */}
      <div className="flex flex-wrap gap-2">
        {guides.map(g => {
          const Icon = g.icon;
          return (
            <button
              key={g.id}
              onClick={() => { setExpandedId(g.id); setSearchText(''); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                expandedId === g.id
                  ? 'bg-amber-100 text-amber-800 border border-amber-200'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {g.title}
            </button>
          );
        })}
      </div>

      {/* 가이드 목록 */}
      <div className="space-y-3">
        {filtered.map(guide => {
          const isExpanded = expandedId === guide.id;
          const Icon = guide.icon;

          return (
            <div key={guide.id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              {/* 헤더 */}
              <button
                onClick={() => setExpandedId(isExpanded ? null : guide.id)}
                className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-slate-50/50 transition-colors"
              >
                <div className={`p-2 rounded-lg bg-gradient-to-br ${guide.color} shadow-sm`}>
                  <Icon className="h-5 w-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-slate-900">{guide.title}</h3>
                  <p className="text-sm text-slate-500 mt-0.5">{guide.summary}</p>
                </div>
                <div className={`transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}>
                  <ChevronRight className="h-5 w-5 text-slate-400" />
                </div>
              </button>

              {/* 상세 내용 */}
              {isExpanded && (
                <div className="px-5 pb-5 border-t border-slate-100">
                  {/* 주요 기능 */}
                  <div className="mt-4">
                    <h4 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                      <span className="w-1.5 h-1.5 bg-amber-500 rounded-full" />
                      주요 기능
                    </h4>
                    <div className="grid gap-2">
                      {guide.features.map((f, i) => (
                        <div key={i} className="flex gap-3 p-3 bg-slate-50 rounded-lg">
                          <span className="flex-shrink-0 w-6 h-6 bg-amber-100 text-amber-700 rounded-full flex items-center justify-center text-xs font-bold">{i + 1}</span>
                          <div>
                            <p className="text-sm font-medium text-slate-800">{f.title}</p>
                            <p className="text-xs text-slate-500 mt-0.5">{f.description}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* 사용 순서 */}
                  {guide.steps && guide.steps.length > 0 && (
                    <div className="mt-5">
                      <h4 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                        <span className="w-1.5 h-1.5 bg-blue-500 rounded-full" />
                        사용 방법
                      </h4>
                      <div className="space-y-2">
                        {guide.steps.map((s, i) => (
                          <div key={i} className="flex items-start gap-3 p-3 bg-blue-50/50 rounded-lg border border-blue-100/50">
                            <ArrowRight className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
                            <div>
                              <p className="text-sm font-medium text-blue-800">{s.step}</p>
                              <p className="text-xs text-blue-600/80 mt-0.5">{s.detail}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 팁 */}
                  {guide.tips && guide.tips.length > 0 && (
                    <div className="mt-5">
                      <h4 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                        <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                        참고사항
                      </h4>
                      <div className="bg-emerald-50/50 rounded-lg border border-emerald-100/50 p-3 space-y-1.5">
                        {guide.tips.map((tip, i) => (
                          <p key={i} className="text-xs text-emerald-700 flex items-start gap-2">
                            <span className="text-emerald-400 mt-0.5">•</span>
                            {tip}
                          </p>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
