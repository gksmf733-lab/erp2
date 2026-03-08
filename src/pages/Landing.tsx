import { useState } from 'react';
import { Wifi, Phone, Shield, Zap, Clock, CheckCircle, ChevronDown, ChevronUp, Send, MapPin, MessageCircle } from 'lucide-react';

interface InquiryForm {
  name: string;
  phone: string;
  address: string;
  plan: string;
  moveDate: string;
  currentProvider: string;
  message: string;
}

const plans = [
  {
    id: 'light',
    name: '라이트',
    speed: '100Mbps',
    price: '22,000',
    features: ['기본 인터넷', 'Wi-Fi 공유기 제공', '기본 설치비 무료'],
    popular: false,
  },
  {
    id: 'standard',
    name: '스탠다드',
    speed: '500Mbps',
    price: '33,000',
    features: ['고속 인터넷', '프리미엄 공유기 제공', '기본 설치비 무료', 'TV 결합 할인'],
    popular: true,
  },
  {
    id: 'premium',
    name: '프리미엄',
    speed: '1Gbps',
    price: '44,000',
    features: ['초고속 인터넷', '최신 Wi-Fi 6 공유기', '기본 설치비 무료', 'TV+모바일 결합 할인', '넷플릭스 6개월 무료'],
    popular: false,
  },
  {
    id: 'giga',
    name: '기가 프리미엄',
    speed: '10Gbps',
    price: '55,000',
    features: ['10기가 초고속', 'Wi-Fi 6E 공유기', '기본 설치비 무료', '전 상품 결합 할인', '넷플릭스 12개월 무료', '보안 서비스 무료'],
    popular: false,
  },
];

const faqs = [
  {
    q: '설치까지 얼마나 걸리나요?',
    a: '신청 후 보통 2~3 영업일 이내에 설치 기사님이 방문합니다. 원하시는 날짜와 시간을 지정할 수 있습니다.',
  },
  {
    q: '약정 기간은 어떻게 되나요?',
    a: '기본 약정은 3년이며, 약정 기간에 따라 할인 혜택이 달라집니다. 무약정 상품도 선택 가능합니다.',
  },
  {
    q: '기존 통신사에서 변경할 때 위약금이 있나요?',
    a: '기존 통신사 약정에 따라 위약금이 발생할 수 있습니다. 상담 시 위약금 대납 혜택에 대해 안내드립니다.',
  },
  {
    q: 'TV나 모바일과 결합할 수 있나요?',
    a: '네, 인터넷+TV, 인터넷+모바일, 인터넷+TV+모바일 결합 상품 모두 가능합니다. 결합 시 추가 할인이 적용됩니다.',
  },
  {
    q: '설치 후 속도가 느리면 어떻게 하나요?',
    a: '설치 후 7일 이내 속도 불만족 시 무료로 플랜 변경 또는 해지가 가능합니다. A/S도 무료로 제공됩니다.',
  },
];

export default function Landing() {
  const [form, setForm] = useState<InquiryForm>({
    name: '',
    phone: '',
    address: '',
    plan: '',
    moveDate: '',
    currentProvider: '',
    message: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handlePlanSelect = (planId: string) => {
    setSelectedPlan(planId);
    setForm({ ...form, plan: planId });
    document.getElementById('inquiry-form')?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!form.name || !form.phone) {
      setError('이름과 연락처는 필수 입력 항목입니다.');
      return;
    }

    const phoneRegex = /^01[0-9]-?\d{3,4}-?\d{4}$/;
    if (!phoneRegex.test(form.phone.replace(/-/g, '').replace(/^01/, '01'))) {
      setError('올바른 휴대폰 번호를 입력해주세요.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/inquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || '문의 접수에 실패했습니다.');
      }

      setSubmitted(true);
    } catch (err: any) {
      setError(err.message || '문의 접수 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-blue-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 md:p-12 max-w-lg w-full text-center">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-10 h-10 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-3">문의가 접수되었습니다!</h2>
          <p className="text-gray-600 mb-6">
            빠른 시간 내에 전문 상담사가 연락드리겠습니다.<br />
            상담 가능 시간: 평일 09:00 ~ 18:00
          </p>
          <button
            onClick={() => {
              setSubmitted(false);
              setForm({ name: '', phone: '', address: '', plan: '', moveDate: '', currentProvider: '', message: '' });
              setSelectedPlan(null);
            }}
            className="bg-primary-600 text-white px-6 py-3 rounded-lg hover:bg-primary-700 transition-colors font-medium"
          >
            돌아가기
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section */}
      <header className="relative bg-gradient-to-br from-primary-600 via-primary-700 to-primary-900 text-white overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-10 left-10 w-72 h-72 bg-white rounded-full blur-3xl" />
          <div className="absolute bottom-10 right-10 w-96 h-96 bg-blue-300 rounded-full blur-3xl" />
        </div>
        <nav className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Wifi className="w-8 h-8" />
            <span className="text-xl font-bold">인터넷 가입센터</span>
          </div>
          <a
            href="tel:1588-0000"
            className="flex items-center gap-2 bg-white/20 backdrop-blur-sm px-4 py-2 rounded-full hover:bg-white/30 transition-colors"
          >
            <Phone className="w-4 h-4" />
            <span className="font-medium">1588-0000</span>
          </a>
        </nav>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24">
          <div className="max-w-3xl">
            <div className="inline-block bg-yellow-400 text-yellow-900 text-sm font-bold px-4 py-1.5 rounded-full mb-6">
              2월 특별 프로모션 진행 중
            </div>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold leading-tight mb-6">
              초고속 인터넷<br />
              <span className="text-blue-200">최대 50% 할인</span>
            </h1>
            <p className="text-lg md:text-xl text-blue-100 mb-8 leading-relaxed">
              빠르고 안정적인 인터넷을 합리적인 가격에!<br />
              지금 가입 문의하시면 설치비 무료 + 추가 사은품까지
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <a
                href="#inquiry-form"
                className="inline-flex items-center justify-center gap-2 bg-white text-primary-700 px-8 py-4 rounded-xl font-bold text-lg hover:bg-blue-50 transition-colors shadow-lg"
              >
                <Send className="w-5 h-5" />
                무료 상담 신청
              </a>
              <a
                href="#plans"
                className="inline-flex items-center justify-center gap-2 border-2 border-white/50 text-white px-8 py-4 rounded-xl font-bold text-lg hover:bg-white/10 transition-colors"
              >
                요금제 보기
              </a>
            </div>
          </div>
        </div>
      </header>

      {/* Benefits Section */}
      <section className="py-16 md:py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-4">왜 저희를 선택해야 할까요?</h2>
          <p className="text-center text-gray-500 mb-12 max-w-2xl mx-auto">
            10년 이상의 경험과 전문성으로 최적의 인터넷 환경을 제공합니다
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              { icon: Zap, title: '초고속 인터넷', desc: '최대 10Gbps 광랜으로 끊김 없는 인터넷 환경을 제공합니다' },
              { icon: Shield, title: '무료 보안 서비스', desc: '악성코드, 해킹으로부터 안전한 보안 서비스를 무료 제공합니다' },
              { icon: Clock, title: '24시간 기술지원', desc: '언제든지 A/S 요청 가능하며 당일 출동 서비스를 지원합니다' },
              { icon: MessageCircle, title: '전문 상담 서비스', desc: '고객 맞춤형 상품 추천으로 최적의 요금제를 안내합니다' },
            ].map((item, i) => (
              <div
                key={i}
                className="bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow border border-gray-100"
              >
                <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center mb-4">
                  <item.icon className="w-6 h-6 text-primary-600" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">{item.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Plans Section */}
      <section id="plans" className="py-16 md:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-4">요금제 안내</h2>
          <p className="text-center text-gray-500 mb-12 max-w-2xl mx-auto">
            사용 환경에 맞는 최적의 요금제를 선택하세요. 결합 할인 적용 시 더욱 저렴하게 이용 가능합니다.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {plans.map((plan) => (
              <div
                key={plan.id}
                className={`relative rounded-2xl p-6 border-2 transition-all cursor-pointer ${
                  selectedPlan === plan.id
                    ? 'border-primary-500 bg-primary-50 shadow-lg scale-[1.02]'
                    : plan.popular
                    ? 'border-primary-300 bg-white shadow-md'
                    : 'border-gray-200 bg-white hover:border-primary-200 hover:shadow-md'
                }`}
                onClick={() => handlePlanSelect(plan.id)}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary-600 text-white text-xs font-bold px-4 py-1 rounded-full">
                    인기
                  </div>
                )}
                <div className="text-center mb-4">
                  <h3 className="text-xl font-bold text-gray-900 mb-1">{plan.name}</h3>
                  <p className="text-primary-600 font-semibold">{plan.speed}</p>
                </div>
                <div className="text-center mb-6">
                  <span className="text-3xl font-extrabold text-gray-900">{plan.price}</span>
                  <span className="text-gray-500 text-sm">원/월</span>
                </div>
                <ul className="space-y-2 mb-6">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                      <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                      {feature}
                    </li>
                  ))}
                </ul>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handlePlanSelect(plan.id);
                  }}
                  className={`w-full py-3 rounded-lg font-medium transition-colors ${
                    selectedPlan === plan.id
                      ? 'bg-primary-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-primary-600 hover:text-white'
                  }`}
                >
                  {selectedPlan === plan.id ? '선택됨' : '선택하기'}
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Inquiry Form Section */}
      <section id="inquiry-form" className="py-16 md:py-20 bg-gradient-to-br from-primary-50 via-white to-blue-50">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-4">무료 상담 신청</h2>
          <p className="text-center text-gray-500 mb-10">
            아래 양식을 작성해주시면 전문 상담사가 빠르게 연락드립니다
          </p>

          <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-lg p-6 md:p-10">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6 text-sm">
                {error}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  이름 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  placeholder="홍길동"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  연락처 <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  name="phone"
                  value={form.phone}
                  onChange={handleChange}
                  placeholder="010-1234-5678"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all"
                />
              </div>
            </div>

            <div className="mt-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <MapPin className="w-4 h-4 inline mr-1" />
                설치 주소
              </label>
              <input
                type="text"
                name="address"
                value={form.address}
                onChange={handleChange}
                placeholder="서울시 강남구 테헤란로 123 OO아파트 101동 1001호"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">희망 요금제</label>
                <select
                  name="plan"
                  value={form.plan}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all bg-white"
                >
                  <option value="">선택해주세요</option>
                  {plans.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.speed})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">희망 설치일</label>
                <input
                  type="date"
                  name="moveDate"
                  value={form.moveDate}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">현재 통신사</label>
                <select
                  name="currentProvider"
                  value={form.currentProvider}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all bg-white"
                >
                  <option value="">선택해주세요</option>
                  <option value="kt">KT</option>
                  <option value="skt">SK브로드밴드</option>
                  <option value="lg">LG유플러스</option>
                  <option value="other">기타</option>
                  <option value="new">신규 가입</option>
                </select>
              </div>
            </div>

            <div className="mt-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">추가 문의사항</label>
              <textarea
                name="message"
                value={form.message}
                onChange={handleChange}
                rows={4}
                placeholder="궁금한 점이나 요청사항을 자유롭게 작성해주세요"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all resize-none"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full mt-8 bg-primary-600 text-white py-4 rounded-xl font-bold text-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
                  접수 중...
                </>
              ) : (
                <>
                  <Send className="w-5 h-5" />
                  무료 상담 신청하기
                </>
              )}
            </button>

            <p className="text-center text-xs text-gray-400 mt-4">
              상담 신청 시 개인정보 수집 및 이용에 동의하는 것으로 간주합니다.
            </p>
          </form>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-16 md:py-20">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-4">자주 묻는 질문</h2>
          <p className="text-center text-gray-500 mb-10">궁금한 점이 있으시면 아래에서 확인해보세요</p>
          <div className="space-y-3">
            {faqs.map((faq, i) => (
              <div
                key={i}
                className="border border-gray-200 rounded-xl overflow-hidden"
              >
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between p-5 text-left hover:bg-gray-50 transition-colors"
                >
                  <span className="font-medium text-gray-900">{faq.q}</span>
                  {openFaq === i ? (
                    <ChevronUp className="w-5 h-5 text-gray-400 flex-shrink-0" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-gray-400 flex-shrink-0" />
                  )}
                </button>
                {openFaq === i && (
                  <div className="px-5 pb-5 text-gray-600 text-sm leading-relaxed border-t border-gray-100 pt-4">
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 bg-primary-700">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">지금 바로 상담 받으세요!</h2>
          <p className="text-blue-200 mb-8 text-lg">
            전화 한 통이면 최적의 인터넷 상품을 추천받을 수 있습니다
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href="tel:1588-0000"
              className="inline-flex items-center justify-center gap-2 bg-white text-primary-700 px-8 py-4 rounded-xl font-bold text-lg hover:bg-blue-50 transition-colors"
            >
              <Phone className="w-5 h-5" />
              1588-0000 전화 상담
            </a>
            <a
              href="#inquiry-form"
              className="inline-flex items-center justify-center gap-2 border-2 border-white text-white px-8 py-4 rounded-xl font-bold text-lg hover:bg-white/10 transition-colors"
            >
              <Send className="w-5 h-5" />
              온라인 상담 신청
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2">
              <Wifi className="w-5 h-5" />
              <span className="font-semibold text-white">인터넷 가입센터</span>
            </div>
            <div className="text-sm text-center md:text-right">
              <p>상담시간: 평일 09:00 ~ 18:00 (주말/공휴일 휴무)</p>
              <p className="mt-1">대표번호: 1588-0000 | 이메일: contact@internet-center.co.kr</p>
            </div>
          </div>
          <div className="border-t border-gray-800 mt-6 pt-6 text-center text-xs">
            &copy; 2026 인터넷 가입센터. All rights reserved.
          </div>
        </div>
      </footer>

      {/* Floating CTA Button (Mobile) */}
      <div className="fixed bottom-6 right-6 md:hidden z-50">
        <a
          href="tel:1588-0000"
          className="flex items-center justify-center w-14 h-14 bg-primary-600 text-white rounded-full shadow-lg hover:bg-primary-700 transition-colors"
        >
          <Phone className="w-6 h-6" />
        </a>
      </div>
    </div>
  );
}
