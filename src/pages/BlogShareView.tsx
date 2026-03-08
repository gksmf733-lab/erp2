import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { FileText, ExternalLink, Clock, PenTool, CheckCircle, Eye, AlertCircle } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || '';

interface SharedPost {
  id: string;
  keyword: string;
  blog_url: string;
  publish_status: string;
  publish_date: string;
  due_date: string;
  order_number: string;
  order_date: string;
  customer_name: string;
  customer_company: string;
  service_name: string;
  assignee_name: string;
  writer_names: string;
}

interface ShareData {
  title: string;
  created_at: string;
  posts: SharedPost[];
  stats: { total: number; pending: number; writing: number; published: number; confirmed: number };
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  pending: { label: '대기', color: 'text-slate-600', bg: 'bg-slate-100', icon: Clock },
  writing: { label: '작성중', color: 'text-blue-600', bg: 'bg-blue-100', icon: PenTool },
  published: { label: '발행완료', color: 'text-emerald-600', bg: 'bg-emerald-100', icon: CheckCircle },
  confirmed: { label: '확인완료', color: 'text-purple-600', bg: 'bg-purple-100', icon: Eye },
};

interface OrderGroup {
  order_number: string;
  customer: string;
  assignee_name: string;
  writer_names: string;
  order_date: string;
  posts: SharedPost[];
}

export default function BlogShareView() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<ShareData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) return;
    fetch(`${API_BASE}/api/blog-share/${token}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) setError(d.error);
        else setData(d);
      })
      .catch(() => setError('데이터를 불러올 수 없습니다.'))
      .finally(() => setLoading(false));
  }, [token]);

  const fmt = (d: string) => d ? d.split('T')[0] : '-';

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-teal-500" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="bg-white rounded-2xl shadow-lg p-10 text-center max-w-md">
          <AlertCircle className="h-16 w-16 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-slate-800 mb-2">접근할 수 없습니다</h2>
          <p className="text-slate-500">{error || '유효하지 않은 링크입니다.'}</p>
        </div>
      </div>
    );
  }

  // 주문번호별 그룹핑
  const orderGroups: OrderGroup[] = (() => {
    const map = new Map<string, OrderGroup>();
    data.posts.forEach(post => {
      const key = post.order_number || post.id;
      if (!map.has(key)) {
        map.set(key, {
          order_number: post.order_number || '-',
          customer: post.customer_company || post.customer_name || '-',
          assignee_name: post.assignee_name || '-',
          writer_names: post.writer_names || '-',
          order_date: post.order_date || '',
          posts: [],
        });
      }
      map.get(key)!.posts.push(post);
    });
    return Array.from(map.values());
  })();

  const completionRate = data.stats.total > 0
    ? Math.round(((data.stats.published + data.stats.confirmed) / data.stats.total) * 100)
    : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* 헤더 */}
      <header className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-teal-500 to-cyan-600 rounded-xl shadow-md">
              <FileText className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">{data.title}</h1>
              <p className="text-xs text-slate-400 mt-0.5">공유일: {fmt(data.created_at)}</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* 통계 */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
            <p className="text-xs font-medium text-slate-500 mb-1">전체</p>
            <p className="text-2xl font-bold text-slate-700">{data.stats.total}</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
            <p className="text-xs font-medium text-slate-500 mb-1">대기</p>
            <p className="text-2xl font-bold text-slate-500">{data.stats.pending}</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
            <p className="text-xs font-medium text-slate-500 mb-1">작성중</p>
            <p className="text-2xl font-bold text-blue-600">{data.stats.writing}</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
            <p className="text-xs font-medium text-slate-500 mb-1">발행완료</p>
            <p className="text-2xl font-bold text-emerald-600">{data.stats.published}</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
            <p className="text-xs font-medium text-slate-500 mb-1">확인완료</p>
            <p className="text-2xl font-bold text-purple-600">{data.stats.confirmed}</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
            <p className="text-xs font-medium text-slate-500 mb-1">완료율</p>
            <p className="text-2xl font-bold text-teal-600">{completionRate}%</p>
          </div>
        </div>

        {/* 주문별 테이블 */}
        {orderGroups.map((group) => {
          const statusCounts: Record<string, number> = {};
          group.posts.forEach(p => { statusCounts[p.publish_status] = (statusCounts[p.publish_status] || 0) + 1; });

          return (
            <div key={group.order_number} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              {/* 주문 헤더 */}
              <div className="px-5 py-4 bg-gradient-to-r from-slate-50 to-white border-b border-slate-100 flex flex-wrap items-center gap-3">
                <span className="text-sm font-mono bg-teal-50 text-teal-700 px-2.5 py-1 rounded-lg font-semibold">{group.order_number}</span>
                <span className="font-semibold text-slate-800">{group.customer}</span>
                <span className="text-xs text-slate-400">|</span>
                <span className="text-sm text-slate-500">담당: {group.assignee_name}</span>
                <span className="text-xs text-slate-400">|</span>
                <span className="text-sm text-slate-500">작가: {group.writer_names}</span>
                <span className="text-xs text-slate-400">|</span>
                <span className="text-sm text-slate-500">접수: {fmt(group.order_date)}</span>
                <div className="ml-auto flex gap-1.5">
                  {Object.entries(statusCounts).map(([status, count]) => {
                    const sc = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
                    return (
                      <span key={status} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${sc.bg} ${sc.color}`}>
                        {sc.label} {count}
                      </span>
                    );
                  })}
                </div>
              </div>

              {/* 포스트 테이블 */}
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/50">
                    <th className="text-left px-5 py-2.5 font-medium text-slate-500 text-xs">서비스</th>
                    <th className="text-left px-5 py-2.5 font-medium text-slate-500 text-xs">키워드</th>
                    <th className="text-left px-5 py-2.5 font-medium text-slate-500 text-xs">발행URL</th>
                    <th className="text-left px-5 py-2.5 font-medium text-slate-500 text-xs">발행일</th>
                    <th className="text-left px-5 py-2.5 font-medium text-slate-500 text-xs">상태</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {group.posts.map((post) => {
                    const sc = STATUS_CONFIG[post.publish_status] || STATUS_CONFIG.pending;
                    const StatusIcon = sc.icon;
                    return (
                      <tr key={post.id} className="hover:bg-slate-50/30">
                        <td className="px-5 py-3 text-slate-600">{post.service_name || '-'}</td>
                        <td className="px-5 py-3">
                          {post.keyword ? (
                            <span className="inline-block bg-amber-50 text-amber-700 px-2 py-0.5 rounded text-xs font-medium">{post.keyword}</span>
                          ) : <span className="text-slate-300">-</span>}
                        </td>
                        <td className="px-5 py-3">
                          {post.blog_url ? (
                            <a href={post.blog_url} target="_blank" rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-teal-600 hover:text-teal-800 text-xs">
                              <ExternalLink className="h-3 w-3" />
                              <span className="truncate max-w-[250px]">{post.blog_url.replace(/^https?:\/\//, '').substring(0, 50)}</span>
                            </a>
                          ) : <span className="text-slate-300">-</span>}
                        </td>
                        <td className="px-5 py-3 text-xs text-slate-500">{fmt(post.publish_date)}</td>
                        <td className="px-5 py-3">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${sc.bg} ${sc.color}`}>
                            <StatusIcon className="h-3 w-3" />
                            {sc.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          );
        })}

        {data.posts.length === 0 && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-16 text-center text-slate-400">
            <FileText className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>등록된 블로그 발행 건이 없습니다</p>
          </div>
        )}
      </main>

      <footer className="border-t border-slate-200 bg-white mt-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 text-center text-xs text-slate-400">
          이 페이지는 공유 링크를 통해 제공됩니다
        </div>
      </footer>
    </div>
  );
}
