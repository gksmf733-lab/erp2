import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { TrendingUp, ExternalLink, Calendar, Shield, CheckCircle, Clock } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || '';

interface RankEntry {
  track_date: string;
  rank: number | null;
}

interface ShareData {
  title: string;
  created_at: string;
  post: {
    keyword: string;
    blog_url: string;
    customer_name: string;
    customer_company: string;
    service_name: string;
    order_number: string;
    order_date: string;
    created_at: string;
    base_days: number;
    guarantee_days: number;
  };
  rank_entries: RankEntry[];
}

export default function RankShareView() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<ShareData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) return;
    fetch(`${API_BASE}/api/rank-share/${token}`)
      .then(r => {
        if (!r.ok) throw new Error(r.status === 410 ? '만료된 링크입니다.' : '유효하지 않은 링크입니다.');
        return r.json();
      })
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-600" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-50 flex items-center justify-center">
        <div className="bg-white rounded-2xl shadow-lg p-8 text-center max-w-sm">
          <Shield className="h-12 w-12 mx-auto mb-3 text-slate-300" />
          <p className="text-lg font-semibold text-slate-700">{error || '데이터를 불러올 수 없습니다.'}</p>
        </div>
      </div>
    );
  }

  const { post, rank_entries } = data;
  const baseDays = post.base_days || 30;
  const guaranteeDays = post.guarantee_days || 25;
  const completed = rank_entries.filter(e => e.rank !== null && e.rank !== undefined).length;
  const remaining = Math.max(0, guaranteeDays - completed);

  // 날짜 배열 생성 (rank_entries 기반)
  const generateDates = (): string[] => {
    if (rank_entries.length === 0) return [];
    const firstDate = rank_entries[0].track_date.split('T')[0];
    const start = new Date(firstDate);
    return Array.from({ length: baseDays }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d.toISOString().split('T')[0];
    });
  };

  const dates = generateDates();
  const grid = dates.map(dateStr => {
    const entry = rank_entries.find(e => e.track_date.split('T')[0] === dateStr);
    return { date: dateStr, rank: entry ? entry.rank : null };
  });

  const rows: typeof grid[] = [];
  for (let i = 0; i < grid.length; i += 10) {
    rows.push(grid.slice(i, i + 10));
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-50 py-8 px-4">
      <div className="max-w-5xl mx-auto space-y-5">
        {/* 헤더 */}
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
          <div className="bg-gradient-to-r from-purple-600 to-indigo-600 px-6 py-5">
            <div className="flex items-center gap-3">
              <TrendingUp className="h-6 w-6 text-white/80" />
              <div>
                <h1 className="text-xl font-bold text-white">{data.title}</h1>
                <p className="text-purple-200 text-sm mt-0.5">순위추적 현황</p>
              </div>
            </div>
          </div>

          <div className="p-6 space-y-5">
            {/* 기본 정보 */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 bg-slate-50 rounded-lg">
                <p className="text-[10px] text-slate-400 uppercase">접수일</p>
                <p className="text-sm font-medium text-slate-800">{post.created_at ? post.created_at.split('T')[0] : '-'}</p>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg">
                <p className="text-[10px] text-slate-400 uppercase">업체명</p>
                <p className="text-sm font-medium text-slate-800">{post.customer_company || post.customer_name || '-'}</p>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg">
                <p className="text-[10px] text-slate-400 uppercase">메인키워드</p>
                <p className="text-sm font-medium text-slate-800">{post.keyword || '-'}</p>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg">
                <p className="text-[10px] text-slate-400 uppercase">발행링크</p>
                {post.blog_url ? (
                  <a href={post.blog_url} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:text-blue-800 truncate block flex items-center gap-1">
                    {post.blog_url.replace(/^https?:\/\//, '').substring(0, 25)}...
                    <ExternalLink className="h-3 w-3 flex-shrink-0" />
                  </a>
                ) : <p className="text-sm text-slate-400">-</p>}
              </div>
            </div>

            {/* 보장 현황 */}
            <div className="grid grid-cols-4 gap-3">
              <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg">
                <p className="text-[10px] text-purple-500 font-medium mb-1">기준일수</p>
                <p className="text-lg font-bold text-purple-800">{baseDays}<span className="text-sm font-normal text-purple-500 ml-0.5">일</span></p>
              </div>
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-[10px] text-blue-500 font-medium mb-1">보장일수</p>
                <p className="text-lg font-bold text-blue-800">{guaranteeDays}<span className="text-sm font-normal text-blue-500 ml-0.5">일</span></p>
              </div>
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
                <p className="text-[10px] text-emerald-500 font-medium mb-1">보장완료</p>
                <p className="text-lg font-bold text-emerald-700 flex items-center gap-1">
                  {completed}<span className="text-sm font-normal text-emerald-500">일</span>
                  <CheckCircle className="h-4 w-4 text-emerald-400" />
                </p>
              </div>
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-[10px] text-amber-500 font-medium mb-1">보장 잔여일수</p>
                <p className={`text-lg font-bold flex items-center gap-1 ${remaining <= 3 ? 'text-red-600' : 'text-amber-700'}`}>
                  {remaining}<span className="text-sm font-normal text-amber-500">일</span>
                  <Clock className="h-4 w-4 text-amber-400" />
                </p>
              </div>
            </div>

            {/* 순위 그리드 */}
            {rows.length > 0 ? (
              (() => {
                // 종료예정일 계산: 이미 입력된 순위 + 나머지는 순차 진행 가정
                const filledCount = grid.filter(g => g.rank !== null && g.rank !== undefined).length;
                let endDateIdx = -1;
                if (filledCount >= guaranteeDays) {
                  let cnt = 0;
                  for (let idx = 0; idx < grid.length; idx++) {
                    if (grid[idx].rank !== null && grid[idx].rank !== undefined) {
                      cnt++;
                      if (cnt === guaranteeDays) { endDateIdx = idx; break; }
                    }
                  }
                } else {
                  // 미달: 그리드의 guaranteeDays번째 셀 (모든 셀이 순차 채워진다고 가정)
                  endDateIdx = Math.min(guaranteeDays - 1, grid.length - 1);
                }
                return (
                  <div className="space-y-1">
                    {rows.map((row, rowIdx) => (
                      <div key={rowIdx} className="border border-slate-200 rounded-lg overflow-hidden">
                        {/* 날짜 행 */}
                        <div className="grid grid-cols-10 bg-slate-50 border-b border-slate-200">
                          {row.map((cell, i) => {
                            const globalIdx = rowIdx * 10 + i;
                            const d = new Date(cell.date);
                            const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                            const isEndDate = globalIdx === endDateIdx;
                            return (
                              <div key={i} className={`px-1 py-1.5 text-center text-[11px] font-medium border-r border-slate-200 last:border-r-0 ${isEndDate ? 'bg-red-100 text-red-700' : isWeekend ? 'text-red-500 bg-red-50/50' : 'text-slate-600'}`}>
                                {d.getMonth() + 1}/{d.getDate()}
                                {isEndDate && <div className="text-[9px] text-red-600 font-bold leading-none">종료예정</div>}
                              </div>
                            );
                          })}
                        </div>
                        {/* 순위 행 */}
                        <div className="grid grid-cols-10">
                          {row.map((cell, i) => {
                            const globalIdx = rowIdx * 10 + i;
                            const hasRank = cell.rank !== null && cell.rank !== undefined;
                            const isEndDate = globalIdx === endDateIdx;
                            return (
                              <div key={i} className={`text-center py-2 text-sm font-medium border-r border-slate-200 last:border-r-0 ${isEndDate ? 'bg-red-50' : ''} ${hasRank ? 'text-purple-700 bg-purple-50/30' : 'text-slate-300'}`}>
                                {hasRank ? <>{cell.rank}<span className="text-[10px] text-purple-400 ml-0.5">위</span></> : '-'}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()
            ) : (
              <div className="text-center py-10 text-slate-400">
                <Calendar className="h-10 w-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">아직 순위 데이터가 없습니다</p>
              </div>
            )}
          </div>
        </div>

        {/* 푸터 */}
        <div className="text-center text-xs text-slate-400 py-2">
          공유일: {data.created_at ? data.created_at.split('T')[0] : '-'}
        </div>
      </div>
    </div>
  );
}
