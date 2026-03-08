import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
  FileText, Send, CheckCircle, AlertCircle, Calendar,
  Building, User, Phone, MapPin, Hash, MessageSquare, Star
} from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || '';

interface FormData {
  id: string;
  order_id: string;
  token: string;
  status: string;
  order_number: string;
  order_date: string;
  customer_name: string;
  customer_company: string;
  campaign_name: string;
  company_name: string;
  contact_name: string;
  contact_phone: string;
  business_name: string;
  place_url: string;
  main_keyword: string;
  hashtags: string;
  total_quantity: number | null;
  daily_quantity: number | null;
  requested_date: string;
  highlights: string;
  special_requests: string;
  submitted_at: string;
  created_at: string;
}

export default function BlogOrderForm() {
  const { token } = useParams<{ token: string }>();
  const [formInfo, setFormInfo] = useState<FormData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const [formValues, setFormValues] = useState({
    campaign_name: '',
    company_name: '',
    contact_name: '',
    contact_phone: '',
    business_name: '',
    place_url: '',
    main_keyword: '',
    hashtags: '',
    total_quantity: '',
    daily_quantity: '',
    requested_date: '',
    highlights: '',
    special_requests: '',
  });

  useEffect(() => {
    if (!token) return;
    fetch(`${API_BASE}/api/blog-order-form/${token}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) setError(d.error);
        else {
          setFormInfo(d);
          if (d.status === 'submitted') {
            setSubmitted(true);
            setFormValues({
              campaign_name: d.campaign_name || '',
              company_name: d.company_name || '',
              contact_name: d.contact_name || '',
              contact_phone: d.contact_phone || '',
              business_name: d.business_name || '',
              place_url: d.place_url || '',
              main_keyword: d.main_keyword || '',
              hashtags: d.hashtags || '',
              total_quantity: d.total_quantity ? String(d.total_quantity) : '',
              daily_quantity: d.daily_quantity ? String(d.daily_quantity) : '',
              requested_date: d.requested_date ? d.requested_date.split('T')[0] : '',
              highlights: d.highlights || '',
              special_requests: d.special_requests || '',
            });
          } else {
            // 미리 고객 정보 채우기
            setFormValues(prev => ({
              ...prev,
              company_name: d.customer_company || d.customer_name || '',
            }));
          }
        }
      })
      .catch(() => setError('데이터를 불러올 수 없습니다.'))
      .finally(() => setLoading(false));
  }, [token]);

  const handleChange = (field: string, value: string) => {
    setFormValues(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    // 유효성 검사
    if (!formValues.company_name.trim()) {
      alert('업체명을 입력해주세요.');
      return;
    }
    if (!formValues.contact_name.trim()) {
      alert('담당자명을 입력해주세요.');
      return;
    }
    if (!formValues.contact_phone.trim()) {
      alert('연락처를 입력해주세요.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/api/blog-order-form/${token}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formValues,
          total_quantity: formValues.total_quantity ? Number(formValues.total_quantity) : null,
          daily_quantity: formValues.daily_quantity ? Number(formValues.daily_quantity) : null,
          requested_date: formValues.requested_date || null,
        }),
      });
      const data = await res.json();
      if (data.error) {
        alert(data.error);
      } else {
        setSubmitted(true);
      }
    } catch {
      alert('제출 중 오류가 발생했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500" />
      </div>
    );
  }

  if (error || !formInfo) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
        <div className="bg-white rounded-2xl shadow-lg p-10 text-center max-w-md">
          <AlertCircle className="h-16 w-16 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-slate-800 mb-2">접근할 수 없습니다</h2>
          <p className="text-slate-500">{error || '유효하지 않은 링크입니다.'}</p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
        <header className="bg-white border-b border-slate-200 shadow-sm">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 py-5">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl shadow-md">
                <FileText className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900">블로그 주문서</h1>
                <p className="text-xs text-slate-400">주문번호: {formInfo.order_number}</p>
              </div>
            </div>
          </div>
        </header>

        <main className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
          <div className="bg-white rounded-2xl shadow-lg p-10 text-center">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="h-10 w-10 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-3">주문서가 제출되었습니다</h2>
            <p className="text-slate-500 mb-8">
              작성해 주셔서 감사합니다. 담당자가 확인 후 연락드리겠습니다.
            </p>

            <div className="bg-slate-50 rounded-xl p-6 text-left space-y-3">
              <h3 className="text-sm font-semibold text-slate-700 mb-4">제출 내용 요약</h3>
              {formValues.campaign_name && (
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">캠페인명</span>
                  <span className="font-medium text-slate-800">{formValues.campaign_name}</span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">업체명</span>
                <span className="font-medium text-slate-800">{formValues.company_name}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">담당자</span>
                <span className="font-medium text-slate-800">{formValues.contact_name} ({formValues.contact_phone})</span>
              </div>
              {formValues.business_name && (
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">상호명</span>
                  <span className="font-medium text-slate-800">{formValues.business_name}</span>
                </div>
              )}
              {formValues.main_keyword && (
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">메인키워드</span>
                  <span className="font-medium text-slate-800">{formValues.main_keyword}</span>
                </div>
              )}
              {formValues.total_quantity && (
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">총 발행량</span>
                  <span className="font-medium text-slate-800">{formValues.total_quantity}건</span>
                </div>
              )}
              {formValues.daily_quantity && (
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">일 발행량</span>
                  <span className="font-medium text-slate-800">{formValues.daily_quantity}건</span>
                </div>
              )}
              {formValues.requested_date && (
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">발행요청일</span>
                  <span className="font-medium text-slate-800">{formValues.requested_date}</span>
                </div>
              )}
            </div>
          </div>
        </main>

        <footer className="border-t border-slate-200 bg-white mt-10">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4 text-center text-xs text-slate-400">
            이 페이지는 주문서 작성 링크를 통해 제공됩니다
          </div>
        </footer>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* 헤더 */}
      <header className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl shadow-md">
              <FileText className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">블로그 주문서 작성</h1>
              <p className="text-xs text-slate-400">주문번호: {formInfo.order_number} | {formInfo.customer_company || formInfo.customer_name}</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* 기본 정보 */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 bg-gradient-to-r from-blue-50 to-white border-b border-slate-100">
              <h2 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                <Building className="h-4 w-4 text-blue-600" />
                기본 정보
              </h2>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">캠페인명</label>
                <input
                  type="text"
                  value={formValues.campaign_name}
                  onChange={(e) => handleChange('campaign_name', e.target.value)}
                  placeholder="캠페인명을 입력해주세요"
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    업체명 <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Building className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input
                      type="text"
                      required
                      value={formValues.company_name}
                      onChange={(e) => handleChange('company_name', e.target.value)}
                      placeholder="업체명"
                      className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    담당자명 <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input
                      type="text"
                      required
                      value={formValues.contact_name}
                      onChange={(e) => handleChange('contact_name', e.target.value)}
                      placeholder="담당자명"
                      className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    연락처 <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input
                      type="tel"
                      required
                      value={formValues.contact_phone}
                      onChange={(e) => handleChange('contact_phone', e.target.value)}
                      placeholder="010-0000-0000"
                      className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">상호명</label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input
                      type="text"
                      value={formValues.business_name}
                      onChange={(e) => handleChange('business_name', e.target.value)}
                      placeholder="상호명"
                      className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 블로그 정보 */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 bg-gradient-to-r from-indigo-50 to-white border-b border-slate-100">
              <h2 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                <Hash className="h-4 w-4 text-indigo-600" />
                블로그 정보
              </h2>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">플레이스 URL</label>
                <input
                  type="url"
                  value={formValues.place_url}
                  onChange={(e) => handleChange('place_url', e.target.value)}
                  placeholder="https://map.naver.com/..."
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">메인키워드</label>
                  <input
                    type="text"
                    value={formValues.main_keyword}
                    onChange={(e) => handleChange('main_keyword', e.target.value)}
                    placeholder="메인 키워드"
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">희망 해시태그</label>
                  <input
                    type="text"
                    value={formValues.hashtags}
                    onChange={(e) => handleChange('hashtags', e.target.value)}
                    placeholder="#태그1 #태그2 #태그3"
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* 발행 정보 */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 bg-gradient-to-r from-emerald-50 to-white border-b border-slate-100">
              <h2 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                <Calendar className="h-4 w-4 text-emerald-600" />
                발행 정보
              </h2>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">총 발행량</label>
                  <input
                    type="number"
                    min="0"
                    value={formValues.total_quantity}
                    onChange={(e) => handleChange('total_quantity', e.target.value)}
                    placeholder="건수"
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">일 발행량</label>
                  <input
                    type="number"
                    min="0"
                    value={formValues.daily_quantity}
                    onChange={(e) => handleChange('daily_quantity', e.target.value)}
                    placeholder="건수/일"
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">발행요청일</label>
                  <input
                    type="date"
                    value={formValues.requested_date}
                    onChange={(e) => handleChange('requested_date', e.target.value)}
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* 강조사항 & 요청사항 */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 bg-gradient-to-r from-amber-50 to-white border-b border-slate-100">
              <h2 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                <Star className="h-4 w-4 text-amber-600" />
                추가 정보
              </h2>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  업체 강조사항 <span className="text-slate-400 text-xs">(5가지 이상 권장)</span>
                </label>
                <textarea
                  value={formValues.highlights}
                  onChange={(e) => handleChange('highlights', e.target.value)}
                  rows={5}
                  placeholder={"1. \n2. \n3. \n4. \n5. "}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-y"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  <MessageSquare className="inline h-3.5 w-3.5 mr-1" />
                  요청사항
                </label>
                <textarea
                  value={formValues.special_requests}
                  onChange={(e) => handleChange('special_requests', e.target.value)}
                  rows={3}
                  placeholder="추가 요청사항을 입력해주세요"
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-y"
                />
              </div>
            </div>
          </div>

          {/* 제출 버튼 */}
          <div className="flex justify-center pt-2 pb-6">
            <button
              type="submit"
              disabled={submitting}
              className="px-8 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl hover:from-blue-700 hover:to-indigo-700 transition-all disabled:opacity-50 flex items-center gap-2 text-base"
            >
              {submitting ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
                  제출 중...
                </>
              ) : (
                <>
                  <Send className="h-5 w-5" />
                  주문서 제출
                </>
              )}
            </button>
          </div>
        </form>
      </main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4 text-center text-xs text-slate-400">
          이 페이지는 주문서 작성 링크를 통해 제공됩니다
        </div>
      </footer>
    </div>
  );
}
