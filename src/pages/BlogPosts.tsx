import { useState, useEffect, useCallback } from 'react';
import { FileText, Search, Filter, ExternalLink, Clock, PenTool, CheckCircle, Eye, Plus, Edit2, Trash2, Save, X, RefreshCw, ChevronDown, ChevronRight, Users, List, LayoutGrid, Share2, Copy, Link, Check, Shield, ArrowLeft, TrendingUp } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || '';

interface BlogPost {
  id: string;
  order_id: string;
  order_item_id: string;
  customer_id: string;
  service_id: string;
  title: string;
  blog_url: string;
  keyword: string;
  publish_status: 'pending' | 'writing' | 'published' | 'confirmed';
  publish_date: string;
  due_date: string;
  assigned_to: string;
  notes: string;
  created_at: string;
  updated_at: string;
  order_number: string;
  order_date: string;
  order_status: string;
  customer_name: string;
  customer_company: string;
  service_name: string;
  service_category: string;
  assigned_name: string;
  assignee_name: string;
  writer_names: string;
}

interface OrderGroup {
  order_number: string;
  order_id: string;
  customer: string;
  assignee_name: string;
  writer_names: string;
  order_date: string;
  posts: BlogPost[];
}

interface Stats {
  total: number;
  pending_count: number;
  writing_count: number;
  published_count: number;
  confirmed_count: number;
}

interface Employee {
  id: string;
  name: string;
  department: string;
}

interface Customer {
  id: string;
  name: string;
  company: string;
}

interface RankEntry {
  id?: string;
  blog_post_id: string;
  track_date: string;
  rank: number | null;
}

function getToken() {
  return localStorage.getItem('token') || '';
}

function apiFetch(path: string, options?: RequestInit) {
  return fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getToken()}`,
      ...options?.headers,
    },
  }).then(r => r.json());
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  pending: { label: '대기', color: 'text-slate-600', bg: 'bg-slate-100', icon: Clock },
  writing: { label: '작성중', color: 'text-blue-600', bg: 'bg-blue-100', icon: PenTool },
  published: { label: '발행완료', color: 'text-emerald-600', bg: 'bg-emerald-100', icon: CheckCircle },
  confirmed: { label: '확인완료', color: 'text-purple-600', bg: 'bg-purple-100', icon: Eye },
};

export default function BlogPosts() {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, pending_count: 0, writing_count: 0, published_count: 0, confirmed_count: 0 });
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);

  const [viewMode, setViewMode] = useState<'group' | 'monthly' | 'tracking'>('group');

  // 월보장 순위추적 관련 state
  const [monthlyPosts, setMonthlyPosts] = useState<BlogPost[]>([]);
  const [monthlyLoading, setMonthlyLoading] = useState(false);
  const [selectedMonthlyPost, setSelectedMonthlyPost] = useState<BlogPost | null>(null);
  const [rankEntries, setRankEntries] = useState<RankEntry[]>([]);
  const [rankStartDate, setRankStartDate] = useState('');
  const [rankDates, setRankDates] = useState<string[]>([]);
  const [rankSaving, setRankSaving] = useState(false);
  const [baseDays, setBaseDays] = useState(30);
  const [guaranteeDays, setGuaranteeDays] = useState(25);
  const [rankShareLinks, setRankShareLinks] = useState<{ id: string; token: string; title: string; created_at: string; expires_at: string }[]>([]);
  const [rankShareExpires, setRankShareExpires] = useState('30');
  const [rankShareLink, setRankShareLink] = useState('');
  const [rankShareCopied, setRankShareCopied] = useState(false);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterCustomer, setFilterCustomer] = useState('');
  const [filterAssignee, setFilterAssignee] = useState('');
  const [searchText, setSearchText] = useState('');

  // 선택 (공유용)
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(new Set());

  // 팝업
  const [selectedGroup, setSelectedGroup] = useState<OrderGroup | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<BlogPost>>({});

  // 수동 추가 모달
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState({
    customer_id: '', service_id: '', title: '', blog_url: '', keyword: '',
    publish_status: 'pending', due_date: '', assigned_to: '', notes: ''
  });
  // 일괄 등록 (엑셀 그리드)
  const [bulkRows, setBulkRows] = useState<{ keyword: string; blog_url: string }[]>(
    Array.from({ length: 10 }, () => ({ keyword: '', blog_url: '' }))
  );
  const [bulkMode, setBulkMode] = useState(true);
  // 일괄 수정
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBulkEditModal, setShowBulkEditModal] = useState(false);
  const [bulkEditMode, setBulkEditMode] = useState<'common' | 'each'>('common');
  const [bulkEditCommon, setBulkEditCommon] = useState({ publish_status: '', publish_date: '', assigned_to: '', due_date: '' });
  // 추적 발행 인라인 편집 (엑셀 그리드)
  const [trackingEdits, setTrackingEdits] = useState<Record<string, { keyword: string; blog_url: string; publish_status: string; publish_date: string }>>({});
  const [dirtyIds, setDirtyIds] = useState<Set<string>>(new Set());
  const [savingTracking, setSavingTracking] = useState(false);
  const [bulkEditRows, setBulkEditRows] = useState<{ id: string; keyword: string; blog_url: string; order_number: string; customer: string }[]>([]);
  const [bulkEditPaste, setBulkEditPaste] = useState('');
  // 팝업 인라인 편집 + 드래그 선택
  type PopupEditRow = { keyword: string; blog_url: string; publish_status: string; publish_date: string };
  const [popupEdits, setPopupEdits] = useState<Record<string, PopupEditRow>>({});
  const [popupDirtyIds, setPopupDirtyIds] = useState<Set<string>>(new Set());
  const [savingPopup, setSavingPopup] = useState(false);
  // 드래그 셀 선택: { row, col } 좌표
  type CellPos = { row: number; col: number };
  const [dragStart, setDragStart] = useState<CellPos | null>(null);
  const [dragEnd, setDragEnd] = useState<CellPos | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [showPopupBulkEdit, setShowPopupBulkEdit] = useState(false);
  const [popupBulkValue, setPopupBulkValue] = useState('');
  // 날짜 자동채움 드래그 (엑셀 fill handle)
  const [fillDragStart, setFillDragStart] = useState<number | null>(null); // 시작 row
  const [fillDragEnd, setFillDragEnd] = useState<number | null>(null);
  const [isFillDragging, setIsFillDragging] = useState(false);
  const [fillSourceDate, setFillSourceDate] = useState('');

  // 공유 링크
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareTitle, setShareTitle] = useState('블로그 발행 현황');
  const [shareExpires, setShareExpires] = useState('30');
  const [shareFilterCustomer, setShareFilterCustomer] = useState('');
  const [shareFilterStatus, setShareFilterStatus] = useState('');
  const [generatedLink, setGeneratedLink] = useState('');
  const [copied, setCopied] = useState(false);
  const [shareLinks, setShareLinks] = useState<{ id: string; token: string; title: string; created_at: string; expires_at: string }[]>([]);

  const generateShareTitle = () => {
    const today = new Date().toISOString().split('T')[0].replace(/-/g, '');
    if (selectedOrderIds.size > 0) {
      const groups = orderGroups.filter(g => selectedOrderIds.has(g.order_number));
      const customers = [...new Set(groups.map(g => g.customer))];
      const totalPosts = groups.reduce((sum, g) => sum + g.posts.length, 0);
      return `${customers.join(', ')} ${today} ${totalPosts}건 블로그 발행목록`;
    }
    // 전체 공유
    const customers = [...new Set(orderGroups.map(g => g.customer))];
    const label = customers.length <= 2 ? customers.join(', ') : `${customers[0]} 외 ${customers.length - 1}곳`;
    return `${label} ${today} ${posts.length}건 블로그 발행목록`;
  };

  const openShareModal = () => {
    setShareTitle(generateShareTitle());
    setGeneratedLink('');
    fetchShareLinks();
    setShowShareModal(true);
  };

  const fetchShareLinks = async () => {
    try {
      const data = await apiFetch('/api/blog-share/list');
      setShareLinks(Array.isArray(data) ? data : []);
    } catch { /* ignore */ }
  };

  const createShareLink = async () => {
    const body: Record<string, string> = { title: shareTitle };
    if (shareFilterCustomer) body.filter_customer_id = shareFilterCustomer;
    if (shareFilterStatus) body.filter_status = shareFilterStatus;
    if (shareExpires && shareExpires !== '0') body.expires_days = shareExpires;

    // 선택된 주문이 있으면 해당 주문의 order_id만 포함
    if (selectedOrderIds.size > 0) {
      const selectedGroups = orderGroups.filter(g => selectedOrderIds.has(g.order_number));
      const orderIds = selectedGroups.map(g => g.order_id).filter(Boolean);
      if (orderIds.length > 0) body.filter_order_ids = orderIds.join(',');
    }

    const result = await apiFetch('/api/blog-share', { method: 'POST', body: JSON.stringify(body) });
    if (result.token) {
      const link = `${window.location.origin}/share/blog/${result.token}`;
      setGeneratedLink(link);
      fetchShareLinks();
    }
  };

  const deleteShareLink = async (id: string) => {
    await apiFetch(`/api/blog-share/${id}`, { method: 'DELETE' });
    fetchShareLinks();
  };

  const copyLink = (link: string) => {
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const toggleShareOrderSelect = (orderNumber: string) => {
    setSelectedOrderIds(prev => {
      const next = new Set(prev);
      if (next.has(orderNumber)) next.delete(orderNumber);
      else next.add(orderNumber);
      return next;
    });
  };

  const toggleShareSelectAll = () => {
    if (selectedOrderIds.size === orderGroups.length) {
      setSelectedOrderIds(new Set());
    } else {
      setSelectedOrderIds(new Set(orderGroups.map(g => g.order_number)));
    }
  };
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterStatus) params.set('publish_status', filterStatus);
      if (filterCustomer) params.set('customer_id', filterCustomer);
      if (filterAssignee) params.set('assigned_to', filterAssignee);
      if (searchText) params.set('search', searchText);

      const [postsData, statsData] = await Promise.all([
        apiFetch(`/api/blog?${params.toString()}`),
        apiFetch('/api/blog/stats'),
      ]);
      const pArr = Array.isArray(postsData) ? postsData : [];
      setPosts(pArr);
      setStats(statsData || { total: 0, pending_count: 0, writing_count: 0, published_count: 0, confirmed_count: 0 });
      // 인라인 편집 초기화
      const edits: Record<string, { keyword: string; blog_url: string; publish_status: string; publish_date: string }> = {};
      pArr.forEach((p: BlogPost) => {
        edits[p.id] = { keyword: p.keyword || '', blog_url: p.blog_url || '', publish_status: p.publish_status || 'pending', publish_date: p.publish_date ? p.publish_date.split('T')[0] : '' };
      });
      setTrackingEdits(edits);
      setDirtyIds(new Set());
    } catch (e) {
      console.error('Error fetching blog data:', e);
    }
    setLoading(false);
  }, [filterStatus, filterCustomer, filterAssignee, searchText]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    Promise.all([
      apiFetch('/api/employees'),
      apiFetch('/api/sales/customers'),
    ]).then(([empData, custData]) => {
      setEmployees(Array.isArray(empData) ? empData.filter((e: Employee & { status?: string }) => e.status === 'active') : []);
      setCustomers(Array.isArray(custData) ? custData : []);
    });
  }, []);

  // 월보장 포스트 불러오기
  const fetchMonthlyPosts = useCallback(async () => {
    setMonthlyLoading(true);
    try {
      const data = await apiFetch('/api/blog/monthly-posts');
      setMonthlyPosts(Array.isArray(data) ? data : []);
    } catch { setMonthlyPosts([]); }
    finally { setMonthlyLoading(false); }
  }, []);

  useEffect(() => {
    if (viewMode === 'monthly') fetchMonthlyPosts();
  }, [viewMode, fetchMonthlyPosts]);

  // 순위 기록 불러오기
  const loadRankEntries = async (postId: string) => {
    try {
      const data = await apiFetch(`/api/blog/rank-tracking/${postId}`);
      setRankEntries(Array.isArray(data) ? data : []);
    } catch { setRankEntries([]); }
  };

  // 월보장 포스트 클릭
  const openMonthlyDetail = async (post: BlogPost) => {
    setSelectedMonthlyPost(post);
    setRankStartDate('');
    setRankDates([]);
    setBaseDays((post as any).base_days || 30);
    setGuaranteeDays((post as any).guarantee_days || 25);
    setRankShareLink('');
    setRankShareLinks([]);
    await loadRankEntries(post.id);
    fetchRankShareLinks(post.id);
  };

  // 시작 날짜로부터 n일 배열 생성
  const generateDatesFrom = (startDate: string, count: number): string[] => {
    const start = new Date(startDate);
    return Array.from({ length: count }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d.toISOString().split('T')[0];
    });
  };

  // 날짜 배열 기반 그리드 생성
  const generateRankGrid = (): { date: string; rank: number | null }[] => {
    if (rankDates.length === 0) return [];
    return rankDates.map(dateStr => {
      const existing = rankEntries.find(e => e.track_date.split('T')[0] === dateStr);
      return { date: dateStr, rank: existing ? existing.rank : null };
    });
  };

  // 보장완료 일수 계산 (순위 입력된 날짜 수)
  const guaranteeCompleted = rankEntries.filter(e => e.rank !== null && e.rank !== undefined).length;
  const guaranteeRemaining = Math.max(0, guaranteeDays - guaranteeCompleted);

  // 특정 셀 날짜 수동 변경: 해당 셀 이후만 +1일씩 재계산
  const handleRankDateChange = (globalIdx: number, newDate: string) => {
    if (!newDate) return;
    setRankDates(prev => {
      const next = [...prev];
      next[globalIdx] = newDate;
      const base = new Date(newDate);
      for (let i = globalIdx + 1; i < next.length; i++) {
        const d = new Date(base);
        d.setDate(base.getDate() + (i - globalIdx));
        next[i] = d.toISOString().split('T')[0];
      }
      return next;
    });
  };

  // 기준일수/보장일수 저장
  const saveGuaranteeSettings = async (newBaseDays: number, newGuaranteeDays: number) => {
    if (!selectedMonthlyPost) return;
    await apiFetch(`/api/blog/guarantee-settings/${selectedMonthlyPost.id}`, {
      method: 'PUT',
      body: JSON.stringify({ base_days: newBaseDays, guarantee_days: newGuaranteeDays }),
    });
  };

  // 순위추적 공유 링크
  const fetchRankShareLinks = async (postId: string) => {
    try {
      const data = await apiFetch(`/api/rank-share/list/${postId}`);
      setRankShareLinks(Array.isArray(data) ? data : []);
    } catch { setRankShareLinks([]); }
  };

  const createRankShareLink = async () => {
    if (!selectedMonthlyPost) return;
    const customer = selectedMonthlyPost.customer_company || selectedMonthlyPost.customer_name || '';
    const keyword = selectedMonthlyPost.keyword || '';
    const title = `${customer} - ${keyword} 순위추적`;
    const body = { blog_post_id: selectedMonthlyPost.id, title, expires_days: rankShareExpires !== '0' ? parseInt(rankShareExpires) : undefined };
    const result = await apiFetch('/api/rank-share', { method: 'POST', body: JSON.stringify(body) });
    if (result.token) {
      const link = `${window.location.origin}/share/rank/${result.token}`;
      setRankShareLink(link);
      fetchRankShareLinks(selectedMonthlyPost.id);
    }
  };

  const deleteRankShareLink = async (id: string) => {
    if (!selectedMonthlyPost) return;
    await apiFetch(`/api/rank-share/${id}`, { method: 'DELETE' });
    fetchRankShareLinks(selectedMonthlyPost.id);
  };

  const copyRankShareLink = (link: string) => {
    navigator.clipboard.writeText(link);
    setRankShareCopied(true);
    setTimeout(() => setRankShareCopied(false), 2000);
  };

  // 순위 저장
  const saveRankEntries = async (entries: { date: string; rank: number | null }[]) => {
    if (!selectedMonthlyPost) return;
    setRankSaving(true);
    try {
      const payload = entries.map(e => ({ track_date: e.date, rank: e.rank }));
      await apiFetch('/api/blog/rank-tracking', {
        method: 'POST',
        body: JSON.stringify({ blog_post_id: selectedMonthlyPost.id, entries: payload }),
      });
      await loadRankEntries(selectedMonthlyPost.id);
    } catch { alert('저장 실패'); }
    finally { setRankSaving(false); }
  };

  // 주문번호별 그룹핑
  const orderGroups: OrderGroup[] = (() => {
    const map = new Map<string, OrderGroup>();
    posts.forEach(post => {
      const key = post.order_number || post.id;
      if (!map.has(key)) {
        map.set(key, {
          order_number: post.order_number || '-',
          order_id: post.order_id,
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

  const startEdit = (post: BlogPost) => {
    setEditingId(post.id);
    setEditForm({
      keyword: post.keyword || '',
      blog_url: post.blog_url || '',
      publish_status: post.publish_status,
      publish_date: post.publish_date ? post.publish_date.split('T')[0] : '',
      assigned_to: post.assigned_to || '',
      notes: post.notes || '',
    });
  };

  const saveEdit = async () => {
    if (!editingId) return;
    await apiFetch(`/api/blog/${editingId}`, { method: 'PUT', body: JSON.stringify(editForm) });
    setEditingId(null);
    fetchData();
  };

  const deletePost = async (id: string) => {
    if (!confirm('이 블로그 포스트를 삭제하시겠습니까?')) return;
    await apiFetch(`/api/blog/${id}`, { method: 'DELETE' });
    fetchData();
    // 팝업 내 삭제 시 그룹 업데이트
    if (selectedGroup) {
      const updated = selectedGroup.posts.filter(p => p.id !== id);
      if (updated.length === 0) setSelectedGroup(null);
      else setSelectedGroup({ ...selectedGroup, posts: updated });
    }
  };

  const quickStatusChange = async (id: string, newStatus: string) => {
    await apiFetch(`/api/blog/${id}`, { method: 'PUT', body: JSON.stringify({ publish_status: newStatus }) });
    fetchData();
  };

  const handleAdd = async () => {
    await apiFetch('/api/blog', { method: 'POST', body: JSON.stringify(addForm) });
    setShowAddModal(false);
    setAddForm({ customer_id: '', service_id: '', title: '', blog_url: '', keyword: '', publish_status: 'pending', due_date: '', assigned_to: '', notes: '' });
    fetchData();
  };

  const handleGridPaste = (e: React.ClipboardEvent, startRow: number, startCol: 'keyword' | 'blog_url') => {
    e.preventDefault();
    const text = e.clipboardData.getData('text');
    const lines = text.split('\n').filter(l => l.trim());
    setBulkRows(prev => {
      const next = [...prev];
      // 필요한 만큼 행 추가
      while (next.length < startRow + lines.length) {
        next.push({ keyword: '', blog_url: '' });
      }
      lines.forEach((line, i) => {
        const parts = line.split('\t');
        const rowIdx = startRow + i;
        if (startCol === 'keyword') {
          next[rowIdx] = { ...next[rowIdx], keyword: parts[0]?.trim() || '' };
          if (parts[1] !== undefined) next[rowIdx].blog_url = parts[1].trim();
        } else {
          next[rowIdx] = { ...next[rowIdx], blog_url: parts[0]?.trim() || '' };
        }
      });
      return next;
    });
  };

  const updateBulkRow = (index: number, field: 'keyword' | 'blog_url', value: string) => {
    setBulkRows(prev => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const addBulkGridRows = (count: number) => {
    setBulkRows(prev => [...prev, ...Array.from({ length: count }, () => ({ keyword: '', blog_url: '' }))]);
  };

  const filledBulkRows = bulkRows.filter(r => r.keyword.trim() || r.blog_url.trim());

  const handleBulkAdd = async () => {
    if (filledBulkRows.length === 0) return;
    const items = filledBulkRows.map(row => ({
      keyword: row.keyword || null,
      blog_url: row.blog_url || null,
    }));
    await apiFetch('/api/blog/bulk', {
      method: 'POST',
      body: JSON.stringify({
        items,
        customer_id: addForm.customer_id || null,
        assigned_to: addForm.assigned_to || null,
        publish_status: addForm.publish_status || 'pending',
        due_date: addForm.due_date || null,
      }),
    });
    setShowAddModal(false);
    setBulkRows(Array.from({ length: 10 }, () => ({ keyword: '', blog_url: '' })));
    setAddForm({ customer_id: '', service_id: '', title: '', blog_url: '', keyword: '', publish_status: 'pending', due_date: '', assigned_to: '', notes: '' });
    fetchData();
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const toggleSelectAll = () => {
    if (selectedIds.size === posts.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(posts.map(p => p.id)));
  };

  const openBulkEdit = () => {
    const selected = posts.filter(p => selectedIds.has(p.id));
    setBulkEditRows(selected.map(p => ({
      id: p.id,
      keyword: p.keyword || '',
      blog_url: p.blog_url || '',
      order_number: p.order_number || '-',
      customer: p.customer_company || p.customer_name || '-',
    })));
    setBulkEditCommon({ publish_status: '', publish_date: '', assigned_to: '', due_date: '' });
    setBulkEditPaste('');
    setBulkEditMode('common');
    setShowBulkEditModal(true);
  };

  const handleBulkEditPaste = (text: string) => {
    setBulkEditPaste(text);
    const lines = text.split('\n').filter(l => l.trim());
    setBulkEditRows(prev => {
      const next = [...prev];
      lines.forEach((line, i) => {
        if (i >= next.length) return;
        const parts = line.split('\t');
        if (parts[0] !== undefined) next[i] = { ...next[i], keyword: parts[0].trim() };
        if (parts[1] !== undefined) next[i] = { ...next[i], blog_url: parts[1].trim() };
      });
      return next;
    });
  };

  const handleBulkEditSave = async () => {
    if (bulkEditMode === 'common') {
      const updates: Record<string, string | null> = {};
      if (bulkEditCommon.publish_status) updates.publish_status = bulkEditCommon.publish_status;
      if (bulkEditCommon.publish_date) updates.publish_date = bulkEditCommon.publish_date;
      if (bulkEditCommon.assigned_to) updates.assigned_to = bulkEditCommon.assigned_to;
      if (bulkEditCommon.due_date) updates.due_date = bulkEditCommon.due_date;
      if (Object.keys(updates).length === 0) { alert('변경할 항목을 선택해주세요.'); return; }
      await apiFetch('/api/blog/bulk', {
        method: 'PUT',
        body: JSON.stringify({ ids: bulkEditRows.map(r => r.id), updates }),
      });
    } else {
      const items = bulkEditRows.map(r => ({
        id: r.id,
        keyword: r.keyword,
        blog_url: r.blog_url,
      }));
      await apiFetch('/api/blog/bulk-each', {
        method: 'PUT',
        body: JSON.stringify({ items }),
      });
    }
    setShowBulkEditModal(false);
    setSelectedIds(new Set());
    fetchData();
  };

  const updateTrackingCell = (id: string, field: 'keyword' | 'blog_url' | 'publish_status' | 'publish_date', value: string) => {
    setTrackingEdits(prev => ({ ...prev, [id]: { ...prev[id], [field]: value } }));
    setDirtyIds(prev => new Set(prev).add(id));
  };

  const handleTrackingPaste = (e: React.ClipboardEvent, startIdx: number, field: 'keyword' | 'blog_url') => {
    e.preventDefault();
    const text = e.clipboardData.getData('text');
    const lines = text.split('\n').filter(l => l.trim());
    setTrackingEdits(prev => {
      const next = { ...prev };
      lines.forEach((line, i) => {
        const rowIdx = startIdx + i;
        if (rowIdx >= posts.length) return;
        const postId = posts[rowIdx].id;
        const parts = line.split('\t');
        if (field === 'keyword') {
          next[postId] = { ...next[postId], keyword: parts[0]?.trim() || '' };
          if (parts[1] !== undefined) next[postId] = { ...next[postId], blog_url: parts[1].trim() };
        } else {
          next[postId] = { ...next[postId], blog_url: parts[0]?.trim() || '' };
        }
        setDirtyIds(prev2 => new Set(prev2).add(postId));
      });
      return next;
    });
  };

  const saveTrackingEdits = async () => {
    if (dirtyIds.size === 0) return;
    setSavingTracking(true);
    const items = Array.from(dirtyIds).map(id => ({
      id,
      keyword: trackingEdits[id]?.keyword,
      blog_url: trackingEdits[id]?.blog_url,
      publish_status: trackingEdits[id]?.publish_status,
      publish_date: trackingEdits[id]?.publish_date || null,
    }));
    await apiFetch('/api/blog/bulk-each', { method: 'PUT', body: JSON.stringify({ items }) });
    setSavingTracking(false);
    fetchData();
  };

  // 팝업 편집 초기화
  const initPopupEdits = (group: OrderGroup) => {
    const edits: Record<string, PopupEditRow> = {};
    group.posts.forEach(p => {
      edits[p.id] = { keyword: p.keyword || '', blog_url: p.blog_url || '', publish_status: p.publish_status || 'pending', publish_date: p.publish_date ? p.publish_date.split('T')[0] : '' };
    });
    setPopupEdits(edits);
    setPopupDirtyIds(new Set());
    setDragStart(null);
    setDragEnd(null);
    setIsDragging(false);
  };

  const updatePopupCell = (id: string, field: keyof PopupEditRow, value: string) => {
    setPopupEdits(prev => ({ ...prev, [id]: { ...prev[id], [field]: value } }));
    setPopupDirtyIds(prev => new Set(prev).add(id));
  };

  const handlePopupPaste = (e: React.ClipboardEvent, startIdx: number, field: 'keyword' | 'blog_url', groupPosts: BlogPost[]) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text');
    const lines = text.split('\n').filter(l => l.trim());
    setPopupEdits(prev => {
      const next = { ...prev };
      lines.forEach((line, i) => {
        const rowIdx = startIdx + i;
        if (rowIdx >= groupPosts.length) return;
        const postId = groupPosts[rowIdx].id;
        const parts = line.split('\t');
        if (field === 'keyword') {
          next[postId] = { ...next[postId], keyword: parts[0]?.trim() || '' };
          if (parts[1] !== undefined) next[postId] = { ...next[postId], blog_url: parts[1].trim() };
        } else {
          next[postId] = { ...next[postId], blog_url: parts[0]?.trim() || '' };
        }
        setPopupDirtyIds(prev2 => new Set(prev2).add(postId));
      });
      return next;
    });
  };

  const savePopupEdits = async () => {
    if (popupDirtyIds.size === 0) return;
    setSavingPopup(true);
    const items = Array.from(popupDirtyIds).map(id => ({
      id, keyword: popupEdits[id]?.keyword, blog_url: popupEdits[id]?.blog_url,
      publish_status: popupEdits[id]?.publish_status, publish_date: popupEdits[id]?.publish_date || null,
    }));
    await apiFetch('/api/blog/bulk-each', { method: 'PUT', body: JSON.stringify({ items }) });
    setSavingPopup(false);
    setPopupDirtyIds(new Set());
    fetchData();
  };

  // 드래그 선택 헬퍼
  const POPUP_COLS = ['keyword', 'blog_url', 'publish_date', 'publish_status'] as const;
  const getSelectedRange = () => {
    if (!dragStart || !dragEnd) return null;
    const r1 = Math.min(dragStart.row, dragEnd.row);
    const r2 = Math.max(dragStart.row, dragEnd.row);
    const c1 = Math.min(dragStart.col, dragEnd.col);
    const c2 = Math.max(dragStart.col, dragEnd.col);
    return { r1, r2, c1, c2 };
  };
  const isCellSelected = (row: number, col: number) => {
    const range = getSelectedRange();
    if (!range) return false;
    return row >= range.r1 && row <= range.r2 && col >= range.c1 && col <= range.c2;
  };
  const handleCellMouseDown = (row: number, col: number) => {
    setDragStart({ row, col });
    setDragEnd({ row, col });
    setIsDragging(true);
  };
  const handleCellMouseEnter = (row: number, col: number) => {
    if (isDragging) setDragEnd({ row, col });
  };
  const handleCellMouseUp = () => {
    setIsDragging(false);
  };

  const applyBulkValueToSelection = (groupPosts: BlogPost[]) => {
    const range = getSelectedRange();
    if (!range || !popupBulkValue) return;
    setPopupEdits(prev => {
      const next = { ...prev };
      for (let r = range.r1; r <= range.r2; r++) {
        if (r >= groupPosts.length) break;
        const postId = groupPosts[r].id;
        for (let c = range.c1; c <= range.c2; c++) {
          const field = POPUP_COLS[c];
          if (field) next[postId] = { ...next[postId], [field]: popupBulkValue };
        }
        setPopupDirtyIds(prev2 => new Set(prev2).add(postId));
      }
      return next;
    });
    setShowPopupBulkEdit(false);
    setPopupBulkValue('');
  };

  const getSelectedCellCount = () => {
    const range = getSelectedRange();
    if (!range) return 0;
    return (range.r2 - range.r1 + 1) * (range.c2 - range.c1 + 1);
  };

  // 날짜 자동채움 핸들러
  const addDays = (dateStr: string, days: number) => {
    const d = new Date(dateStr);
    d.setDate(d.getDate() + days);
    return d.toISOString().split('T')[0];
  };

  const handleFillDragStart = (rowIdx: number, dateValue: string) => {
    if (!dateValue) return;
    setFillDragStart(rowIdx);
    setFillDragEnd(rowIdx);
    setFillSourceDate(dateValue);
    setIsFillDragging(true);
  };

  const handleFillDragEnter = (rowIdx: number) => {
    if (isFillDragging) setFillDragEnd(rowIdx);
  };

  const handleFillDragEnd = (groupPosts: BlogPost[]) => {
    if (!isFillDragging || fillDragStart === null || fillDragEnd === null || !fillSourceDate) {
      setIsFillDragging(false);
      return;
    }
    const start = fillDragStart;
    const end = fillDragEnd;
    const dir = end >= start ? 1 : -1;
    setPopupEdits(prev => {
      const next = { ...prev };
      for (let r = start; r !== end + dir; r += dir) {
        if (r < 0 || r >= groupPosts.length) break;
        const postId = groupPosts[r].id;
        const offset = (r - start) * dir;
        next[postId] = { ...next[postId], publish_date: addDays(fillSourceDate, offset) };
        setPopupDirtyIds(prev2 => new Set(prev2).add(postId));
      }
      return next;
    });
    setIsFillDragging(false);
    setFillDragStart(null);
    setFillDragEnd(null);
  };

  const isFillTarget = (rowIdx: number) => {
    if (!isFillDragging || fillDragStart === null || fillDragEnd === null) return false;
    const min = Math.min(fillDragStart, fillDragEnd);
    const max = Math.max(fillDragStart, fillDragEnd);
    return rowIdx >= min && rowIdx <= max && rowIdx !== fillDragStart;
  };

  const getFillPreviewDate = (rowIdx: number) => {
    if (!isFillDragging || fillDragStart === null || !fillSourceDate) return '';
    const offset = rowIdx - fillDragStart;
    return addDays(fillSourceDate, offset);
  };

  const handleFillDragEndTracking = () => {
    if (!isFillDragging || fillDragStart === null || fillDragEnd === null || !fillSourceDate) {
      setIsFillDragging(false);
      return;
    }
    const start = fillDragStart;
    const end = fillDragEnd;
    const dir = end >= start ? 1 : -1;
    setTrackingEdits(prev => {
      const next = { ...prev };
      for (let r = start; r !== end + dir; r += dir) {
        if (r < 0 || r >= posts.length) break;
        const postId = posts[r].id;
        const offset = (r - start) * dir;
        next[postId] = { ...next[postId], publish_date: addDays(fillSourceDate, offset) };
        setDirtyIds(prev2 => new Set(prev2).add(postId));
      }
      return next;
    });
    setIsFillDragging(false);
    setFillDragStart(null);
    setFillDragEnd(null);
  };

  const fmt = (d: string) => d ? d.split('T')[0] : '-';

  const getGroupStatusSummary = (group: OrderGroup) => {
    const counts: Record<string, number> = {};
    group.posts.forEach(p => {
      counts[p.publish_status] = (counts[p.publish_status] || 0) + 1;
    });
    return counts;
  };

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-teal-500 to-cyan-600 rounded-xl shadow-lg">
              <FileText className="h-6 w-6 text-white" />
            </div>
            블로그 발행목록
          </h1>
          <p className="text-slate-500 mt-1">주문번호별로 묶어서 관리합니다</p>
        </div>
        <div className="flex gap-2">
          <button onClick={fetchData} className="px-3 py-2 text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50">
            <RefreshCw className="h-4 w-4" />
          </button>
          <button onClick={openShareModal} className="flex items-center gap-2 px-4 py-2 text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50">
            <Share2 className="h-4 w-4" />
            공유
          </button>
          <button onClick={() => setShowAddModal(true)} className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-teal-500 to-cyan-600 text-white rounded-lg hover:from-teal-600 hover:to-cyan-700 shadow-md">
            <Plus className="h-4 w-4" />
            수동 등록
          </button>
        </div>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: '전체', count: stats.total, textColor: 'text-slate-600' },
          { label: '대기', count: stats.pending_count, textColor: 'text-slate-500' },
          { label: '작성중', count: stats.writing_count, textColor: 'text-blue-600' },
          { label: '발행완료', count: stats.published_count, textColor: 'text-emerald-600' },
          { label: '확인완료', count: stats.confirmed_count, textColor: 'text-purple-600' },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
            <p className="text-xs font-medium text-slate-500 mb-1">{s.label}</p>
            <p className={`text-2xl font-bold ${s.textColor}`}>{s.count}</p>
          </div>
        ))}
      </div>

      {/* 필터 */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
        <div className="flex flex-wrap gap-3 items-center">
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Filter className="h-4 w-4" />
            필터
          </div>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-500">
            <option value="">전체 상태</option>
            <option value="pending">대기</option>
            <option value="writing">작성중</option>
            <option value="published">발행완료</option>
            <option value="confirmed">확인완료</option>
          </select>
          <select value={filterCustomer} onChange={e => setFilterCustomer(e.target.value)} className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-500">
            <option value="">전체 고객</option>
            {customers.map(c => <option key={c.id} value={c.id}>{c.company || c.name}</option>)}
          </select>
          <select value={filterAssignee} onChange={e => setFilterAssignee(e.target.value)} className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-500">
            <option value="">전체 담당자</option>
            {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input type="text" placeholder="키워드, URL, 고객명 검색..." value={searchText} onChange={e => setSearchText(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-500" />
          </div>
        </div>
      </div>

      {/* 뷰 모드 탭 */}
      <div className="flex gap-2">
        <button
          onClick={() => setViewMode('group')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${viewMode === 'group' ? 'bg-teal-600 text-white shadow-md' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}>
          <LayoutGrid className="h-4 w-4" />
          주문별 보기
        </button>
        <button
          onClick={() => setViewMode('monthly')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${viewMode === 'monthly' ? 'bg-purple-600 text-white shadow-md' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}>
          <Shield className="h-4 w-4" />
          월보장 순위추적
        </button>
        <button
          onClick={() => setViewMode('tracking')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${viewMode === 'tracking' ? 'bg-teal-600 text-white shadow-md' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}>
          <List className="h-4 w-4" />
          추적 발행
        </button>
        {viewMode === 'group' && selectedOrderIds.size > 0 && (
          <button
            onClick={openShareModal}
            className="ml-auto flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 shadow-md">
            <Share2 className="h-4 w-4" />
            선택 항목 공유 ({selectedOrderIds.size}건)
          </button>
        )}
      </div>

      {/* 월보장 순위추적 탭 */}
      {viewMode === 'monthly' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          {monthlyLoading ? (
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500" />
            </div>
          ) : selectedMonthlyPost ? (
            /* 순위추적 상세 */
            <div className="p-5 space-y-5">
              {/* 헤더 */}
              <div className="flex items-center gap-3">
                <button onClick={() => { setSelectedMonthlyPost(null); setRankEntries([]); setRankStartDate(''); setRankDates([]); }}
                  className="p-2 rounded-lg hover:bg-slate-100 transition-colors">
                  <ArrowLeft className="h-5 w-5 text-slate-600" />
                </button>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">순위 추적</h3>
                  <p className="text-sm text-slate-500">{selectedMonthlyPost.order_number}</p>
                </div>
              </div>

              {/* 기본 정보 카드 */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 bg-slate-50 rounded-lg">
                  <p className="text-[10px] text-slate-400 uppercase">접수일</p>
                  <p className="text-sm font-medium text-slate-800">{selectedMonthlyPost.created_at ? selectedMonthlyPost.created_at.split('T')[0] : '-'}</p>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg">
                  <p className="text-[10px] text-slate-400 uppercase">업체명</p>
                  <p className="text-sm font-medium text-slate-800">{selectedMonthlyPost.customer_company || selectedMonthlyPost.customer_name || '-'}</p>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg">
                  <p className="text-[10px] text-slate-400 uppercase">메인키워드</p>
                  <p className="text-sm font-medium text-slate-800">{selectedMonthlyPost.keyword || '-'}</p>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg">
                  <p className="text-[10px] text-slate-400 uppercase">발행링크</p>
                  {selectedMonthlyPost.blog_url ? (
                    <a href={selectedMonthlyPost.blog_url} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:text-blue-800 truncate block">{selectedMonthlyPost.blog_url.replace(/^https?:\/\//, '').substring(0, 30)}...</a>
                  ) : <p className="text-sm text-slate-400">-</p>}
                </div>
              </div>

              {/* 기준일수 / 보장일수 / 보장완료 / 잔여 */}
              <div className="grid grid-cols-4 gap-3">
                <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg">
                  <p className="text-[10px] text-purple-500 font-medium mb-1">기준일수</p>
                  <div className="flex items-center gap-1">
                    <input
                      type="number" min="1" max="90"
                      value={baseDays}
                      onChange={(e) => {
                        const v = Math.max(1, parseInt(e.target.value) || 30);
                        setBaseDays(v);
                        saveGuaranteeSettings(v, guaranteeDays);
                        if (rankStartDate) setRankDates(generateDatesFrom(rankStartDate, v));
                      }}
                      className="w-14 px-2 py-1 text-center text-sm font-bold text-purple-800 border border-purple-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                    />
                    <span className="text-sm text-purple-600">일</span>
                  </div>
                </div>
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-[10px] text-blue-500 font-medium mb-1">보장일수</p>
                  <div className="flex items-center gap-1">
                    <input
                      type="number" min="1" max="90"
                      value={guaranteeDays}
                      onChange={(e) => {
                        const v = Math.max(1, parseInt(e.target.value) || 25);
                        setGuaranteeDays(v);
                        saveGuaranteeSettings(baseDays, v);
                      }}
                      className="w-14 px-2 py-1 text-center text-sm font-bold text-blue-800 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="text-sm text-blue-600">일</span>
                  </div>
                </div>
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
                  <p className="text-[10px] text-emerald-500 font-medium mb-1">보장완료</p>
                  <p className="text-lg font-bold text-emerald-700">{guaranteeCompleted}<span className="text-sm font-normal text-emerald-500 ml-0.5">일</span></p>
                </div>
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <p className="text-[10px] text-amber-500 font-medium mb-1">보장 잔여일수</p>
                  <p className={`text-lg font-bold ${guaranteeRemaining <= 3 ? 'text-red-600' : 'text-amber-700'}`}>{guaranteeRemaining}<span className="text-sm font-normal text-amber-500 ml-0.5">일</span></p>
                </div>
              </div>

              {/* 시작일 입력 */}
              <div className="flex items-center gap-3 p-3 bg-purple-50 border border-purple-200 rounded-lg">
                <label className="text-sm font-medium text-purple-800">시작 날짜</label>
                <input
                  type="date"
                  value={rankStartDate}
                  onChange={(e) => {
                    const v = e.target.value;
                    setRankStartDate(v);
                    if (v) setRankDates(generateDatesFrom(v, baseDays));
                  }}
                  className="px-3 py-1.5 border border-purple-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500"
                />
                <span className="text-xs text-purple-500">첫 칸 날짜를 입력하면 {baseDays}일이 자동 생성됩니다</span>
              </div>

              {/* 10일 x n줄 순위 입력 그리드 */}
              {rankDates.length > 0 && (() => {
                const grid = generateRankGrid();
                const rows: typeof grid[] = [];
                for (let i = 0; i < grid.length; i += 10) {
                  rows.push(grid.slice(i, i + 10));
                }
                // 종료예정일 계산: 이미 입력된 순위 + 나머지는 순차 진행 가정
                const filledCount = grid.filter(g => g.rank !== null && g.rank !== undefined).length;
                let endDateIdx = -1;
                if (filledCount >= guaranteeDays) {
                  // 이미 보장일수만큼 채워짐 → 실제 guaranteeDays번째 순위 입력 셀
                  let cnt = 0;
                  for (let i = 0; i < grid.length; i++) {
                    if (grid[i].rank !== null && grid[i].rank !== undefined) {
                      cnt++;
                      if (cnt === guaranteeDays) { endDateIdx = i; break; }
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
                                {globalIdx === 0 ? (
                                  <span className="text-[11px]">{d.getMonth() + 1}/{d.getDate()}</span>
                                ) : (
                                  <input
                                    type="date"
                                    value={cell.date}
                                    onChange={(e) => handleRankDateChange(globalIdx, e.target.value)}
                                    className={`w-full bg-transparent text-center text-[11px] border-0 p-0 focus:ring-0 cursor-pointer ${isEndDate ? 'text-red-700 font-bold' : ''}`}
                                    style={{ colorScheme: 'light' }}
                                  />
                                )}
                                {isEndDate && <div className="text-[9px] text-red-600 font-bold leading-none">종료예정</div>}
                              </div>
                            );
                          })}
                        </div>
                        {/* 순위 입력 행 */}
                        <div className="grid grid-cols-10">
                          {row.map((cell, i) => {
                            const globalIdx = rowIdx * 10 + i;
                            const isEndDate = globalIdx === endDateIdx;
                            const hasRank = cell.rank !== null && cell.rank !== undefined;
                            return (
                              <div key={i} className={`border-r border-slate-200 last:border-r-0 relative ${isEndDate ? 'bg-red-50' : ''}`}>
                                <div className="relative">
                                  <input
                                    type="number"
                                    min="0"
                                    value={hasRank ? cell.rank : ''}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      const newGrid = generateRankGrid();
                                      newGrid[globalIdx].rank = val === '' ? null : parseInt(val);
                                      const updated = newGrid.filter(g => g.rank !== null).map(g => ({
                                        blog_post_id: selectedMonthlyPost!.id,
                                        track_date: g.date,
                                        rank: g.rank,
                                      }));
                                      setRankEntries(updated as RankEntry[]);
                                    }}
                                    placeholder="-"
                                    className={`w-full text-center py-2 text-sm font-medium border-0 focus:ring-2 focus:ring-purple-500 focus:z-10 relative ${isEndDate ? 'bg-red-50' : ''} ${hasRank ? 'pr-4' : ''}`}
                                  />
                                  {hasRank && <span className="absolute right-1 top-1/2 -translate-y-1/2 text-[10px] text-purple-400 pointer-events-none">위</span>}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                    <div className="flex justify-end pt-2">
                      <button
                        onClick={() => saveRankEntries(generateRankGrid())}
                        disabled={rankSaving}
                        className="px-5 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                      >
                        {rankSaving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                        순위 저장
                      </button>
                    </div>
                  </div>
                );
              })()}

              {/* 외부 공유 */}
              <div className="border border-slate-200 rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                    <Share2 className="h-4 w-4 text-purple-500" />
                    외부 공유
                  </h4>
                  <div className="flex items-center gap-2">
                    <select value={rankShareExpires} onChange={e => setRankShareExpires(e.target.value)}
                      className="px-2 py-1 text-xs border border-slate-300 rounded-lg">
                      <option value="7">7일</option>
                      <option value="30">30일</option>
                      <option value="90">90일</option>
                      <option value="0">무제한</option>
                    </select>
                    <button onClick={createRankShareLink}
                      className="px-3 py-1.5 bg-purple-600 text-white text-xs font-medium rounded-lg hover:bg-purple-700 flex items-center gap-1">
                      <Link className="h-3.5 w-3.5" />
                      링크 생성
                    </button>
                  </div>
                </div>

                {rankShareLink && (
                  <div className="flex items-center gap-2 p-2.5 bg-purple-50 border border-purple-200 rounded-lg">
                    <input readOnly value={rankShareLink} className="flex-1 px-2 py-1 bg-white border border-purple-300 rounded text-xs text-slate-700" />
                    <button onClick={() => copyRankShareLink(rankShareLink)}
                      className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${rankShareCopied ? 'bg-emerald-500 text-white' : 'bg-purple-600 text-white hover:bg-purple-700'}`}>
                      {rankShareCopied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                )}

                {rankShareLinks.length > 0 && (
                  <div className="space-y-1.5">
                    {rankShareLinks.map(link => {
                      const isExpired = link.expires_at && new Date(link.expires_at) < new Date();
                      const url = `${window.location.origin}/share/rank/${link.token}`;
                      return (
                        <div key={link.id} className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs ${isExpired ? 'bg-slate-50 border-slate-200 opacity-50' : 'bg-white border-slate-200'}`}>
                          <div className="flex-1 min-w-0">
                            <p className="text-slate-600 truncate">{link.title || '순위추적 공유'}</p>
                            <p className="text-[10px] text-slate-400">
                              {link.created_at?.split('T')[0]}
                              {link.expires_at ? ` · ${link.expires_at.split('T')[0]} 만료` : ' · 무제한'}
                              {isExpired && ' (만료됨)'}
                            </p>
                          </div>
                          {!isExpired && (
                            <button onClick={() => copyRankShareLink(url)} className="p-1 text-slate-400 hover:text-purple-600 rounded" title="복사">
                              <Copy className="h-3.5 w-3.5" />
                            </button>
                          )}
                          <button onClick={() => deleteRankShareLink(link.id)} className="p-1 text-slate-400 hover:text-red-500 rounded" title="삭제">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* 기존 입력된 순위 없고, 시작일도 없으면 안내 */}
              {!rankStartDate && rankEntries.length === 0 && (
                <div className="text-center py-8 text-slate-400">
                  <TrendingUp className="h-10 w-10 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">시작 날짜를 입력하면 30일 순위 입력표가 생성됩니다</p>
                </div>
              )}

              {/* 기존 데이터가 있으면 자동으로 시작일+날짜배열 설정 */}
              {!rankStartDate && rankEntries.length > 0 && (() => {
                const firstDate = rankEntries[0].track_date.split('T')[0];
                setTimeout(() => {
                  setRankStartDate(firstDate);
                  setRankDates(generateDatesFrom(firstDate, baseDays));
                }, 0);
                return null;
              })()}
            </div>
          ) : monthlyPosts.length === 0 ? (
            <div className="text-center py-20 text-slate-400">
              <Shield className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>월보장 상품 발행 건이 없습니다</p>
              <p className="text-xs mt-1">서비스상품에서 '월보장 순위추적'을 체크하세요</p>
            </div>
          ) : (
            /* 월보장 목록 */
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-purple-50 border-b border-purple-200">
                    <th className="px-4 py-3 text-left text-xs font-medium text-purple-700">접수일</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-purple-700">업체명</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-purple-700">메인키워드</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-purple-700">발행링크</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-purple-700">주문번호</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-purple-700">상태</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {monthlyPosts.map(post => (
                    <tr key={post.id} onClick={() => openMonthlyDetail(post)} className="hover:bg-purple-50/50 cursor-pointer transition-colors">
                      <td className="px-4 py-3 text-sm text-slate-600">{post.created_at ? post.created_at.split('T')[0] : '-'}</td>
                      <td className="px-4 py-3 text-sm font-medium text-slate-900">{post.customer_company || post.customer_name || '-'}</td>
                      <td className="px-4 py-3 text-sm text-slate-800">{post.keyword || '-'}</td>
                      <td className="px-4 py-3 text-sm">
                        {post.blog_url ? (
                          <a href={post.blog_url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
                            className="text-blue-600 hover:text-blue-800 truncate block max-w-[200px]">
                            {post.blog_url.replace(/^https?:\/\//, '').substring(0, 30)}
                          </a>
                        ) : <span className="text-slate-400">-</span>}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-500">{post.order_number || '-'}</td>
                      <td className="px-4 py-3 text-center">
                        {(() => { const cfg = STATUS_CONFIG[post.publish_status] || STATUS_CONFIG.pending; return (
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full font-medium ${cfg.bg} ${cfg.color}`}>{cfg.label}</span>
                        ); })()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* 테이블 */}
      {viewMode !== 'monthly' && <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-500" />
          </div>
        ) : (viewMode === 'group' ? orderGroups.length === 0 : posts.length === 0) ? (
          <div className="text-center py-20 text-slate-400">
            <FileText className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>등록된 블로그 발행 건이 없습니다</p>
          </div>
        ) : viewMode === 'group' ? (
          /* 주문별 그룹 보기 */
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="w-10 px-3 py-3">
                    <input type="checkbox" checked={orderGroups.length > 0 && selectedOrderIds.size === orderGroups.length}
                      onChange={toggleShareSelectAll} className="rounded border-slate-300 text-teal-600 focus:ring-teal-500" />
                  </th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">주문번호</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">고객</th>
                  <th className="text-center px-4 py-3 font-semibold text-slate-600">건수</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">영업담당자</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">원고작가</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">접수일</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">상태</th>
                  <th className="text-center px-4 py-3 font-semibold text-slate-600">상세</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {orderGroups.map((group) => {
                  const statusCounts = getGroupStatusSummary(group);
                  return (
                    <tr key={group.order_number} className={`hover:bg-slate-50/50 cursor-pointer transition-colors ${selectedOrderIds.has(group.order_number) ? 'bg-teal-50/40' : ''}`} onClick={() => { setSelectedGroup(group); initPopupEdits(group); }}>
                      <td className="px-3 py-3" onClick={e => e.stopPropagation()}>
                        <input type="checkbox" checked={selectedOrderIds.has(group.order_number)}
                          onChange={() => toggleShareOrderSelect(group.order_number)}
                          className="rounded border-slate-300 text-teal-600 focus:ring-teal-500" />
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs font-mono bg-slate-100 px-2 py-0.5 rounded">{group.order_number}</span>
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-700">{group.customer}</td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex px-2 py-0.5 text-xs font-medium rounded-full bg-teal-100 text-teal-700">{group.posts.length}건</span>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{group.assignee_name}</td>
                      <td className="px-4 py-3 text-slate-600">{group.writer_names}</td>
                      <td className="px-4 py-3 text-xs text-slate-500">{fmt(group.order_date)}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {Object.entries(statusCounts).map(([status, count]) => {
                            const sc = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
                            return (
                              <span key={status} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${sc.bg} ${sc.color}`}>
                                {sc.label} {count}
                              </span>
                            );
                          })}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <ChevronRight className="h-4 w-4 text-slate-400 mx-auto" />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          /* 추적 발행 보기 - 엑셀 스타일 그리드 */
          <div className="overflow-x-auto" onMouseUp={() => { if (isFillDragging) handleFillDragEndTracking(); }}>
            {/* 액션바 */}
            <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50 border-b border-slate-200">
              <div className="flex items-center gap-3">
                {selectedIds.size > 0 && (
                  <>
                    <span className="text-sm font-medium text-teal-700">{selectedIds.size}건 선택</span>
                    <button onClick={openBulkEdit} className="px-3 py-1.5 text-xs font-medium bg-teal-600 text-white rounded-lg hover:bg-teal-700">일괄 수정</button>
                    <button onClick={() => setSelectedIds(new Set())} className="px-3 py-1.5 text-xs font-medium text-slate-500 bg-white border border-slate-200 rounded-lg hover:bg-slate-50">선택 해제</button>
                  </>
                )}
              </div>
              <div className="flex items-center gap-2">
                {dirtyIds.size > 0 && (
                  <span className="text-xs text-amber-600 font-medium">{dirtyIds.size}건 수정됨</span>
                )}
                <button onClick={saveTrackingEdits} disabled={dirtyIds.size === 0 || savingTracking}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${dirtyIds.size > 0 ? 'bg-teal-600 text-white hover:bg-teal-700' : 'bg-slate-100 text-slate-400 cursor-not-allowed'}`}>
                  <Save className="h-3.5 w-3.5" />
                  {savingTracking ? '저장중...' : '저장'}
                </button>
              </div>
            </div>
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-300">
                  <th className="w-10 px-2 py-2 border-r border-slate-300">
                    <input type="checkbox" checked={posts.length > 0 && selectedIds.size === posts.length} onChange={toggleSelectAll}
                      className="rounded border-slate-300 text-teal-600 focus:ring-teal-500" />
                  </th>
                  <th className="w-8 px-1 py-2 text-[10px] text-slate-400 border-r border-slate-300"></th>
                  <th className="text-left px-2 py-2 text-xs font-semibold text-slate-500 border-r border-slate-300">주문번호</th>
                  <th className="text-left px-2 py-2 text-xs font-semibold text-slate-500 border-r border-slate-300">고객</th>
                  <th className="text-left px-2 py-2 text-xs font-semibold text-slate-600 border-r border-slate-300 bg-blue-50/50">키워드</th>
                  <th className="text-left px-2 py-2 text-xs font-semibold text-slate-600 border-r border-slate-300 bg-blue-50/50">발행URL</th>
                  <th className="text-left px-2 py-2 text-xs font-semibold text-slate-500 border-r border-slate-300">담당자</th>
                  <th className="text-left px-2 py-2 text-xs font-semibold text-slate-500 border-r border-slate-300">작가</th>
                  <th className="text-left px-2 py-2 text-xs font-semibold text-slate-600 border-r border-slate-300 bg-blue-50/50">발행일</th>
                  <th className="text-left px-2 py-2 text-xs font-semibold text-slate-600 border-r border-slate-300 bg-blue-50/50">상태</th>
                  <th className="w-10 px-2 py-2 text-xs font-semibold text-slate-500"></th>
                </tr>
              </thead>
              <tbody>
                {posts.map((post, idx) => {
                  const edit = trackingEdits[post.id] || { keyword: '', blog_url: '', publish_status: 'pending', publish_date: '' };
                  const isDirty = dirtyIds.has(post.id);
                  return (
                    <tr key={post.id} className={isDirty ? 'bg-amber-50/40' : selectedIds.has(post.id) ? 'bg-teal-50/30' : ''}>
                      <td className="px-2 py-0 border-r border-b border-slate-200 text-center">
                        <input type="checkbox" checked={selectedIds.has(post.id)} onChange={() => toggleSelect(post.id)} className="rounded border-slate-300 text-teal-600" />
                      </td>
                      <td className="px-1 py-0 text-[10px] text-slate-400 text-center border-r border-b border-slate-200 bg-slate-50 select-none">{idx + 1}</td>
                      <td className="px-2 py-0 border-r border-b border-slate-200">
                        <span className="text-[11px] font-mono text-slate-500">{post.order_number || '-'}</span>
                      </td>
                      <td className="px-2 py-0 border-r border-b border-slate-200">
                        <span className="text-xs text-slate-600 truncate block max-w-[100px]">{post.customer_company || post.customer_name || '-'}</span>
                      </td>
                      <td className="p-0 border-r border-b border-slate-200">
                        <input
                          value={edit.keyword}
                          onChange={e => updateTrackingCell(post.id, 'keyword', e.target.value)}
                          onPaste={e => handleTrackingPaste(e, idx, 'keyword')}
                          className="w-full px-2 py-1.5 text-sm border-0 outline-none focus:bg-blue-50 bg-transparent"
                          placeholder="키워드"
                        />
                      </td>
                      <td className="p-0 border-r border-b border-slate-200">
                        <input
                          value={edit.blog_url}
                          onChange={e => updateTrackingCell(post.id, 'blog_url', e.target.value)}
                          onPaste={e => handleTrackingPaste(e, idx, 'blog_url')}
                          className="w-full px-2 py-1.5 text-sm border-0 outline-none focus:bg-blue-50 bg-transparent"
                          placeholder="https://..."
                        />
                      </td>
                      <td className="px-2 py-0 border-r border-b border-slate-200">
                        <span className="text-xs text-slate-500">{post.assignee_name || '-'}</span>
                      </td>
                      <td className="px-2 py-0 border-r border-b border-slate-200">
                        <span className="text-xs text-slate-500">{post.writer_names || '-'}</span>
                      </td>
                      <td className={`p-0 border-r border-b border-slate-200 relative ${isFillTarget(idx) ? 'bg-green-100 outline outline-2 outline-green-400 -outline-offset-1' : ''}`}
                        onMouseEnter={() => handleFillDragEnter(idx)}>
                        <div className="flex items-center">
                          <input type="date" value={isFillTarget(idx) ? getFillPreviewDate(idx) : edit.publish_date}
                            onChange={e => updateTrackingCell(post.id, 'publish_date', e.target.value)}
                            className={`w-full px-1 py-1 text-xs border-0 outline-none focus:bg-blue-50 bg-transparent ${isFillTarget(idx) ? 'text-green-700 font-medium' : ''}`}
                          />
                          {edit.publish_date && !isFillDragging && (
                            <div
                              className="absolute right-0 bottom-0 w-3 h-3 bg-teal-600 cursor-crosshair z-10 border border-white"
                              title="드래그하여 날짜 자동채움"
                              onMouseDown={e => { e.stopPropagation(); e.preventDefault(); handleFillDragStart(idx, edit.publish_date); }}
                            />
                          )}
                        </div>
                      </td>
                      <td className="p-0 border-r border-b border-slate-200">
                        <select value={edit.publish_status}
                          onChange={e => updateTrackingCell(post.id, 'publish_status', e.target.value)}
                          className="w-full px-1 py-1.5 text-xs border-0 outline-none focus:bg-blue-50 bg-transparent cursor-pointer">
                          <option value="pending">대기</option>
                          <option value="writing">작성중</option>
                          <option value="published">발행완료</option>
                          <option value="confirmed">확인완료</option>
                        </select>
                      </td>
                      <td className="px-1 py-0 border-b border-slate-200 text-center">
                        <button onClick={() => deletePost(post.id)} className="p-1 text-slate-300 hover:text-red-500">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>}

      {/* 주문 상세 팝업 - 엑셀 스타일 그리드 */}
      {selectedGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={() => { setSelectedGroup(null); setDragStart(null); setDragEnd(null); }}
          onMouseUp={() => { handleCellMouseUp(); if (isFillDragging && selectedGroup) handleFillDragEnd(selectedGroup.posts); }}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-5xl mx-4 max-h-[90vh] overflow-hidden" onClick={e => e.stopPropagation()}>
            {/* 헤더 */}
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-gradient-to-r from-teal-500 to-cyan-600">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <span className="bg-white/20 px-2 py-0.5 rounded text-sm font-mono">{selectedGroup.order_number}</span>
                  {selectedGroup.customer}
                </h2>
                <p className="text-teal-100 text-sm mt-1">
                  영업담당: {selectedGroup.assignee_name} · 원고작가: {selectedGroup.writer_names} · 접수일: {fmt(selectedGroup.order_date)} · {selectedGroup.posts.length}건
                </p>
              </div>
              <button onClick={() => { setSelectedGroup(null); setDragStart(null); setDragEnd(null); }} className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-lg">
                <X className="h-5 w-5" />
              </button>
            </div>
            {/* 액션바 */}
            <div className="flex items-center justify-between px-4 py-2 bg-slate-50 border-b border-slate-200">
              <div className="flex items-center gap-2">
                {getSelectedCellCount() > 1 && (
                  <>
                    <span className="text-xs font-medium text-blue-600">{getSelectedCellCount()}개 셀 선택됨</span>
                    <button onClick={() => setShowPopupBulkEdit(true)}
                      className="px-3 py-1 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                      선택 영역 일괄 입력
                    </button>
                    <button onClick={() => { setDragStart(null); setDragEnd(null); }}
                      className="px-2 py-1 text-xs text-slate-400 hover:text-slate-600">해제</button>
                  </>
                )}
                <span className="text-[10px] text-slate-400">셀을 드래그하여 범위 선택 후 일괄 입력할 수 있습니다</span>
              </div>
              <div className="flex items-center gap-2">
                {popupDirtyIds.size > 0 && <span className="text-xs text-amber-600 font-medium">{popupDirtyIds.size}건 수정됨</span>}
                <button onClick={savePopupEdits} disabled={popupDirtyIds.size === 0 || savingPopup}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg ${popupDirtyIds.size > 0 ? 'bg-teal-600 text-white hover:bg-teal-700' : 'bg-slate-100 text-slate-400 cursor-not-allowed'}`}>
                  <Save className="h-3.5 w-3.5" />
                  {savingPopup ? '저장중...' : '저장'}
                </button>
              </div>
            </div>
            {/* 그리드 */}
            <div className="overflow-auto max-h-[calc(90vh-150px)]" onMouseUp={() => { handleCellMouseUp(); if (isFillDragging && selectedGroup) handleFillDragEnd(selectedGroup.posts); }}>
              <table className="w-full text-sm border-collapse select-none">
                <thead className="bg-slate-100 sticky top-0 z-10">
                  <tr>
                    <th className="w-8 px-1 py-2 text-[10px] text-slate-400 border-b border-r border-slate-300"></th>
                    <th className="text-left px-2 py-2 text-xs font-semibold text-slate-500 border-b border-r border-slate-300">서비스</th>
                    <th className="text-left px-2 py-2 text-xs font-semibold text-slate-600 border-b border-r border-slate-300 bg-blue-50/50">키워드</th>
                    <th className="text-left px-2 py-2 text-xs font-semibold text-slate-600 border-b border-r border-slate-300 bg-blue-50/50">발행URL</th>
                    <th className="text-left px-2 py-2 text-xs font-semibold text-slate-600 border-b border-r border-slate-300 bg-blue-50/50">발행일</th>
                    <th className="text-left px-2 py-2 text-xs font-semibold text-slate-600 border-b border-r border-slate-300 bg-blue-50/50">상태</th>
                    <th className="w-10 px-2 py-2 border-b border-slate-300"></th>
                  </tr>
                </thead>
                <tbody>
                  {selectedGroup.posts.map((post, rowIdx) => {
                    const edit = popupEdits[post.id] || { keyword: '', blog_url: '', publish_status: 'pending', publish_date: '' };
                    const isDirty = popupDirtyIds.has(post.id);
                    return (
                      <tr key={post.id} className={isDirty ? 'bg-amber-50/40' : ''}>
                        <td className="px-1 py-0 text-[10px] text-slate-400 text-center border-r border-b border-slate-200 bg-slate-50">{rowIdx + 1}</td>
                        <td className="px-2 py-1.5 border-r border-b border-slate-200 text-xs text-slate-500">{post.service_name || '-'}</td>
                        <td className={`p-0 border-r border-b border-slate-200 ${isCellSelected(rowIdx, 0) ? 'bg-blue-100 outline outline-2 outline-blue-400 -outline-offset-1' : ''}`}
                          onMouseDown={() => handleCellMouseDown(rowIdx, 0)} onMouseEnter={() => handleCellMouseEnter(rowIdx, 0)}>
                          <input value={edit.keyword}
                            onChange={e => updatePopupCell(post.id, 'keyword', e.target.value)}
                            onPaste={e => handlePopupPaste(e, rowIdx, 'keyword', selectedGroup.posts)}
                            className="w-full px-2 py-1.5 text-sm border-0 outline-none bg-transparent"
                            placeholder="키워드" onClick={e => e.stopPropagation()} />
                        </td>
                        <td className={`p-0 border-r border-b border-slate-200 ${isCellSelected(rowIdx, 1) ? 'bg-blue-100 outline outline-2 outline-blue-400 -outline-offset-1' : ''}`}
                          onMouseDown={() => handleCellMouseDown(rowIdx, 1)} onMouseEnter={() => handleCellMouseEnter(rowIdx, 1)}>
                          <input value={edit.blog_url}
                            onChange={e => updatePopupCell(post.id, 'blog_url', e.target.value)}
                            onPaste={e => handlePopupPaste(e, rowIdx, 'blog_url', selectedGroup.posts)}
                            className="w-full px-2 py-1.5 text-sm border-0 outline-none bg-transparent"
                            placeholder="https://..." onClick={e => e.stopPropagation()} />
                        </td>
                        <td className={`p-0 border-r border-b border-slate-200 relative ${isFillTarget(rowIdx) ? 'bg-green-100 outline outline-2 outline-green-400 -outline-offset-1' : isCellSelected(rowIdx, 2) ? 'bg-blue-100 outline outline-2 outline-blue-400 -outline-offset-1' : ''}`}
                          onMouseDown={() => handleCellMouseDown(rowIdx, 2)} onMouseEnter={() => { handleCellMouseEnter(rowIdx, 2); handleFillDragEnter(rowIdx); }}>
                          <div className="flex items-center">
                            <input type="date" value={isFillTarget(rowIdx) ? getFillPreviewDate(rowIdx) : edit.publish_date}
                              onChange={e => updatePopupCell(post.id, 'publish_date', e.target.value)}
                              className={`w-full px-1 py-1 text-xs border-0 outline-none bg-transparent ${isFillTarget(rowIdx) ? 'text-green-700 font-medium' : ''}`}
                              onClick={e => e.stopPropagation()} />
                            {/* 날짜 자동채움 핸들 */}
                            {edit.publish_date && !isFillDragging && (
                              <div
                                className="absolute right-0 bottom-0 w-3 h-3 bg-teal-600 cursor-crosshair z-10 border border-white"
                                title="드래그하여 날짜 자동채움"
                                onMouseDown={e => { e.stopPropagation(); e.preventDefault(); handleFillDragStart(rowIdx, edit.publish_date); }}
                              />
                            )}
                          </div>
                        </td>
                        <td className={`p-0 border-r border-b border-slate-200 ${isCellSelected(rowIdx, 3) ? 'bg-blue-100 outline outline-2 outline-blue-400 -outline-offset-1' : ''}`}
                          onMouseDown={() => handleCellMouseDown(rowIdx, 3)} onMouseEnter={() => handleCellMouseEnter(rowIdx, 3)}>
                          <select value={edit.publish_status}
                            onChange={e => updatePopupCell(post.id, 'publish_status', e.target.value)}
                            className="w-full px-1 py-1.5 text-xs border-0 outline-none bg-transparent cursor-pointer"
                            onClick={e => e.stopPropagation()}>
                            <option value="pending">대기</option>
                            <option value="writing">작성중</option>
                            <option value="published">발행완료</option>
                            <option value="confirmed">확인완료</option>
                          </select>
                        </td>
                        <td className="px-1 py-0 border-b border-slate-200 text-center">
                          <button onClick={() => deletePost(post.id)} className="p-1 text-slate-300 hover:text-red-500">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 드래그 선택 일괄 입력 미니 모달 */}
      {showPopupBulkEdit && selectedGroup && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30" onClick={() => setShowPopupBulkEdit(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm mx-4 p-5" onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-bold text-slate-800 mb-3">선택 영역 일괄 입력 ({getSelectedCellCount()}개 셀)</h3>
            {(() => {
              const range = getSelectedRange();
              const cols = range ? POPUP_COLS.slice(range.c1, range.c2 + 1) : [];
              const isStatusOnly = cols.length === 1 && cols[0] === 'publish_status';
              return isStatusOnly ? (
                <select value={popupBulkValue} onChange={e => setPopupBulkValue(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm mb-3" autoFocus>
                  <option value="">선택...</option>
                  <option value="pending">대기</option>
                  <option value="writing">작성중</option>
                  <option value="published">발행완료</option>
                  <option value="confirmed">확인완료</option>
                </select>
              ) : (
                <input value={popupBulkValue} onChange={e => setPopupBulkValue(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm mb-3"
                  placeholder="입력할 값..." autoFocus
                  onKeyDown={e => { if (e.key === 'Enter') applyBulkValueToSelection(selectedGroup.posts); }} />
              );
            })()}
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowPopupBulkEdit(false)} className="px-3 py-1.5 text-xs text-slate-500 bg-slate-100 rounded-lg">취소</button>
              <button onClick={() => applyBulkValueToSelection(selectedGroup.posts)}
                className="px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700">적용</button>
            </div>
          </div>
        </div>
      )}

      {/* 등록 모달 (단건/일괄) */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-200">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-slate-900">블로그 포스트 등록</h2>
                <div className="flex bg-slate-100 rounded-lg p-0.5">
                  <button onClick={() => setBulkMode(true)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${bulkMode ? 'bg-white text-teal-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                    일괄 등록
                  </button>
                  <button onClick={() => setBulkMode(false)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${!bulkMode ? 'bg-white text-teal-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                    단건 등록
                  </button>
                </div>
              </div>
            </div>
            <div className="p-6 space-y-4">
              {/* 공통 필드 */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">고객</label>
                  <select value={addForm.customer_id} onChange={e => setAddForm({ ...addForm, customer_id: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg">
                    <option value="">선택안함</option>
                    {customers.map(c => <option key={c.id} value={c.id}>{c.company || c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">담당자</label>
                  <select value={addForm.assigned_to} onChange={e => setAddForm({ ...addForm, assigned_to: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg">
                    <option value="">미지정</option>
                    {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">상태</label>
                  <select value={addForm.publish_status} onChange={e => setAddForm({ ...addForm, publish_status: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg">
                    <option value="pending">대기</option>
                    <option value="writing">작성중</option>
                    <option value="published">발행완료</option>
                    <option value="confirmed">확인완료</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">마감일</label>
                  <input type="date" value={addForm.due_date} onChange={e => setAddForm({ ...addForm, due_date: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
                </div>
              </div>

              {bulkMode ? (
                <>
                  {/* 엑셀 스타일 그리드 */}
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-slate-500">셀에 직접 입력하거나, 엑셀에서 복사(Ctrl+C) 후 셀에 붙여넣기(Ctrl+V) 하세요.</p>
                    {filledBulkRows.length > 0 && (
                      <span className="text-xs font-medium text-teal-600">{filledBulkRows.length}건 입력됨</span>
                    )}
                  </div>
                  <div className="border border-slate-300 rounded-lg overflow-hidden">
                    <div className="max-h-[320px] overflow-y-auto">
                      <table className="w-full text-sm border-collapse">
                        <thead className="bg-slate-100 sticky top-0 z-10">
                          <tr>
                            <th className="w-10 px-2 py-2 text-xs font-semibold text-slate-500 border-b border-r border-slate-300 bg-slate-100"></th>
                            <th className="text-left px-2 py-2 text-xs font-semibold text-slate-600 border-b border-r border-slate-300 bg-slate-100">A. 키워드</th>
                            <th className="text-left px-2 py-2 text-xs font-semibold text-slate-600 border-b border-slate-300 bg-slate-100">B. URL</th>
                          </tr>
                        </thead>
                        <tbody>
                          {bulkRows.map((row, i) => (
                            <tr key={i} className={row.keyword.trim() || row.blog_url.trim() ? 'bg-teal-50/30' : ''}>
                              <td className="px-2 py-0 text-[10px] text-slate-400 text-center border-r border-b border-slate-200 bg-slate-50 select-none">{i + 1}</td>
                              <td className="p-0 border-r border-b border-slate-200">
                                <input
                                  value={row.keyword}
                                  onChange={e => updateBulkRow(i, 'keyword', e.target.value)}
                                  onPaste={e => handleGridPaste(e, i, 'keyword')}
                                  className="w-full px-2 py-1.5 text-sm border-0 outline-none focus:bg-blue-50 bg-transparent"
                                  placeholder={i === 0 ? '키워드 입력...' : ''}
                                />
                              </td>
                              <td className="p-0 border-b border-slate-200">
                                <input
                                  value={row.blog_url}
                                  onChange={e => updateBulkRow(i, 'blog_url', e.target.value)}
                                  onPaste={e => handleGridPaste(e, i, 'blog_url')}
                                  className="w-full px-2 py-1.5 text-sm border-0 outline-none focus:bg-blue-50 bg-transparent"
                                  placeholder={i === 0 ? 'https://...' : ''}
                                />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => addBulkGridRows(5)} className="text-xs text-teal-600 hover:text-teal-800 font-medium">
                      + 5행 추가
                    </button>
                    <button onClick={() => addBulkGridRows(10)} className="text-xs text-teal-600 hover:text-teal-800 font-medium">
                      + 10행 추가
                    </button>
                    <span className="mx-1 text-slate-300">|</span>
                    <button onClick={() => setBulkRows(Array.from({ length: 10 }, () => ({ keyword: '', blog_url: '' })))} className="text-xs text-slate-400 hover:text-red-500 font-medium">
                      전체 초기화
                    </button>
                  </div>
                </>
              ) : (
                <>
                  {/* 단건 등록 */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">키워드</label>
                    <input value={addForm.keyword} onChange={e => setAddForm({ ...addForm, keyword: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg" placeholder="검색 키워드" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">블로그 URL</label>
                    <input value={addForm.blog_url} onChange={e => setAddForm({ ...addForm, blog_url: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg" placeholder="https://blog.naver.com/..." />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">메모</label>
                    <textarea value={addForm.notes} onChange={e => setAddForm({ ...addForm, notes: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg" rows={2} placeholder="참고사항" />
                  </div>
                </>
              )}
            </div>
            <div className="p-6 border-t border-slate-200 flex justify-end gap-3">
              <button onClick={() => { setShowAddModal(false); setBulkRows(Array.from({ length: 10 }, () => ({ keyword: '', blog_url: '' }))); }} className="px-4 py-2 text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200">취소</button>
              {bulkMode ? (
                <button onClick={handleBulkAdd} disabled={filledBulkRows.length === 0}
                  className="px-4 py-2 bg-gradient-to-r from-teal-500 to-cyan-600 text-white rounded-lg hover:from-teal-600 hover:to-cyan-700 disabled:opacity-50 disabled:cursor-not-allowed">
                  {filledBulkRows.length}건 일괄 등록
                </button>
              ) : (
                <button onClick={handleAdd} className="px-4 py-2 bg-gradient-to-r from-teal-500 to-cyan-600 text-white rounded-lg hover:from-teal-600 hover:to-cyan-700">등록</button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 일괄 수정 모달 */}
      {showBulkEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setShowBulkEditModal(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl mx-4 max-h-[90vh] overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-gradient-to-r from-teal-500 to-cyan-600">
              <h2 className="text-lg font-bold text-white">{bulkEditRows.length}건 일괄 수정</h2>
              <button onClick={() => setShowBulkEditModal(false)} className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-lg">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-5 space-y-4 overflow-y-auto max-h-[calc(90vh-160px)]">
              {/* 모드 전환 */}
              <div className="flex bg-slate-100 rounded-lg p-0.5 w-fit">
                <button onClick={() => setBulkEditMode('common')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${bulkEditMode === 'common' ? 'bg-white text-teal-700 shadow-sm' : 'text-slate-500'}`}>
                  공통값 일괄 변경
                </button>
                <button onClick={() => setBulkEditMode('each')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${bulkEditMode === 'each' ? 'bg-white text-teal-700 shadow-sm' : 'text-slate-500'}`}>
                  개별값 수정 (붙여넣기)
                </button>
              </div>

              {bulkEditMode === 'common' ? (
                <>
                  <p className="text-xs text-slate-500">선택된 {bulkEditRows.length}건에 아래 값을 일괄 적용합니다. 변경할 항목만 선택하세요.</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">상태 변경</label>
                      <select value={bulkEditCommon.publish_status} onChange={e => setBulkEditCommon({ ...bulkEditCommon, publish_status: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm">
                        <option value="">변경 안함</option>
                        <option value="pending">대기</option>
                        <option value="writing">작성중</option>
                        <option value="published">발행완료</option>
                        <option value="confirmed">확인완료</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">발행일 변경</label>
                      <input type="date" value={bulkEditCommon.publish_date} onChange={e => setBulkEditCommon({ ...bulkEditCommon, publish_date: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">담당자 변경</label>
                      <select value={bulkEditCommon.assigned_to} onChange={e => setBulkEditCommon({ ...bulkEditCommon, assigned_to: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm">
                        <option value="">변경 안함</option>
                        {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">마감일 변경</label>
                      <input type="date" value={bulkEditCommon.due_date} onChange={e => setBulkEditCommon({ ...bulkEditCommon, due_date: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
                    </div>
                  </div>
                  <div className="border border-slate-200 rounded-lg overflow-hidden max-h-48 overflow-y-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-slate-50 sticky top-0">
                        <tr>
                          <th className="text-left px-3 py-2 text-slate-500">#</th>
                          <th className="text-left px-3 py-2 text-slate-500">주문번호</th>
                          <th className="text-left px-3 py-2 text-slate-500">고객</th>
                          <th className="text-left px-3 py-2 text-slate-500">키워드</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {bulkEditRows.map((row, i) => (
                          <tr key={row.id}>
                            <td className="px-3 py-1.5 text-slate-400">{i + 1}</td>
                            <td className="px-3 py-1.5 font-mono text-slate-500">{row.order_number}</td>
                            <td className="px-3 py-1.5 text-slate-600">{row.customer}</td>
                            <td className="px-3 py-1.5 text-slate-700">{row.keyword || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-xs text-slate-500">엑셀에서 키워드/URL을 복사해서 붙여넣으면 선택된 항목 순서대로 적용됩니다.</p>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      키워드 / URL 붙여넣기
                      <span className="text-xs text-slate-400 ml-2">(키워드 [탭] URL, 행 순서대로 매칭)</span>
                    </label>
                    <textarea
                      value={bulkEditPaste}
                      onChange={e => handleBulkEditPaste(e.target.value)}
                      onPaste={e => { e.preventDefault(); handleBulkEditPaste(e.clipboardData.getData('text')); }}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono text-sm"
                      rows={4}
                      placeholder={"키워드1\thttps://blog.url/1\n키워드2\thttps://blog.url/2"}
                    />
                  </div>
                  <div className="border border-slate-200 rounded-lg overflow-hidden max-h-56 overflow-y-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-slate-50 sticky top-0">
                        <tr>
                          <th className="text-left px-3 py-2 text-slate-500">#</th>
                          <th className="text-left px-3 py-2 text-slate-500">주문번호</th>
                          <th className="text-left px-3 py-2 text-slate-500">고객</th>
                          <th className="text-left px-3 py-2 text-slate-500">키워드</th>
                          <th className="text-left px-3 py-2 text-slate-500">URL</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {bulkEditRows.map((row, i) => (
                          <tr key={row.id}>
                            <td className="px-3 py-1.5 text-slate-400">{i + 1}</td>
                            <td className="px-3 py-1.5 font-mono text-slate-500">{row.order_number}</td>
                            <td className="px-3 py-1.5 text-slate-600">{row.customer}</td>
                            <td className="px-3 py-1.5">
                              <input value={row.keyword} onChange={e => {
                                const next = [...bulkEditRows]; next[i] = { ...next[i], keyword: e.target.value }; setBulkEditRows(next);
                              }} className="w-full px-1.5 py-0.5 border border-slate-200 rounded text-xs" />
                            </td>
                            <td className="px-3 py-1.5">
                              <input value={row.blog_url} onChange={e => {
                                const next = [...bulkEditRows]; next[i] = { ...next[i], blog_url: e.target.value }; setBulkEditRows(next);
                              }} className="w-full px-1.5 py-0.5 border border-slate-200 rounded text-xs" />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
            <div className="p-5 border-t border-slate-200 flex justify-end gap-3">
              <button onClick={() => setShowBulkEditModal(false)} className="px-4 py-2 text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200">취소</button>
              <button onClick={handleBulkEditSave} className="px-4 py-2 bg-gradient-to-r from-teal-500 to-cyan-600 text-white rounded-lg hover:from-teal-600 hover:to-cyan-700">
                {bulkEditRows.length}건 수정 적용
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 공유 링크 모달 */}
      {showShareModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setShowShareModal(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Share2 className="h-5 w-5 text-teal-600" />
                공유 링크 관리
              </h2>
              <button onClick={() => setShowShareModal(false)} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* 새 링크 생성 */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-slate-700">새 공유 링크 생성</h3>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">제목</label>
                  <input value={shareTitle} onChange={e => setShareTitle(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" placeholder="블로그 발행 현황" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">고객 필터</label>
                    <select value={shareFilterCustomer} onChange={e => setShareFilterCustomer(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm">
                      <option value="">전체</option>
                      {customers.map(c => <option key={c.id} value={c.id}>{c.company || c.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">상태 필터</label>
                    <select value={shareFilterStatus} onChange={e => setShareFilterStatus(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm">
                      <option value="">전체</option>
                      <option value="pending">대기</option>
                      <option value="writing">작성중</option>
                      <option value="published">발행완료</option>
                      <option value="confirmed">확인완료</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">만료 기간</label>
                  <select value={shareExpires} onChange={e => setShareExpires(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm">
                    <option value="7">7일</option>
                    <option value="30">30일</option>
                    <option value="90">90일</option>
                    <option value="0">무제한</option>
                  </select>
                </div>
                <button onClick={createShareLink}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-teal-500 to-cyan-600 text-white rounded-lg hover:from-teal-600 hover:to-cyan-700 font-medium text-sm">
                  <Link className="h-4 w-4" />
                  링크 생성
                </button>
              </div>

              {/* 생성된 링크 */}
              {generatedLink && (
                <div className="bg-teal-50 border border-teal-200 rounded-lg p-4">
                  <p className="text-xs font-medium text-teal-700 mb-2">공유 링크가 생성되었습니다</p>
                  <div className="flex items-center gap-2">
                    <input readOnly value={generatedLink}
                      className="flex-1 px-3 py-2 bg-white border border-teal-300 rounded-lg text-xs text-slate-700" />
                    <button onClick={() => copyLink(generatedLink)}
                      className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${copied ? 'bg-emerald-500 text-white' : 'bg-teal-600 text-white hover:bg-teal-700'}`}>
                      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              )}

              {/* 기존 링크 목록 */}
              {shareLinks.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-slate-700 mt-4">생성된 링크 목록</h3>
                  {shareLinks.map(link => {
                    const isExpired = link.expires_at && new Date(link.expires_at) < new Date();
                    const shareUrl = `${window.location.origin}/share/blog/${link.token}`;
                    return (
                      <div key={link.id} className={`flex items-center gap-3 p-3 rounded-lg border ${isExpired ? 'bg-slate-50 border-slate-200 opacity-60' : 'bg-white border-slate-200'}`}>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-700 truncate">{link.title || '제목 없음'}</p>
                          <p className="text-[11px] text-slate-400">
                            {link.created_at?.split('T')[0]} 생성
                            {link.expires_at ? ` · ${link.expires_at.split('T')[0]} 만료` : ' · 무제한'}
                            {isExpired && ' (만료됨)'}
                          </p>
                        </div>
                        {!isExpired && (
                          <button onClick={() => copyLink(shareUrl)} className="p-1.5 text-slate-400 hover:text-teal-600 hover:bg-teal-50 rounded-lg" title="복사">
                            <Copy className="h-4 w-4" />
                          </button>
                        )}
                        <button onClick={() => deleteShareLink(link.id)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg" title="삭제">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
