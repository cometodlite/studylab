'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { getIdToken } from 'firebase/auth';
import { auth } from '@/lib/firebase';

interface AdminCoupon {
  id: string;
  name: string;
  description: string;
  pointsCost: number;
  thumbnailUrl: string | null;
  totalStock: number;
  availableStock: number;
}

interface AdminInquiry {
  _id: string;
  uid: string;
  nickname: string;
  email: string;
  category: string;
  subject: string;
  message: string;
  status: 'new' | 'read' | 'resolved';
  createdAt: { seconds: number };
}

type InquiryStatus = AdminInquiry['status'];
type InquiryFilter = InquiryStatus | 'all';

const inquiryStatusOptions: Array<{ value: InquiryStatus; label: string }> = [
  { value: 'new', label: '신규' },
  { value: 'read', label: '읽음' },
  { value: 'resolved', label: '해결됨' },
];

interface AdminStats {
  totalUsers: number;
  activeUsers24h: number;
  todayExamAttempts: number;
  pendingInquiries: number;
  statsTopExams: Array<{
    examTitle: string;
    attempts: number;
    avgScore: number;
  }>;
}

interface ExamFile {
  filename: string;
  id: string;
  title: string;
  questionCount: number;
}

type ExamQuestionType = 'mc' | 'short' | 'essay';

interface ExamQuestion {
  id: number;
  type: ExamQuestionType;
  score: number;
  question: string;
  choices?: string[];
  answer?: number | string;
  expectedAnswer?: string;
  explanation?: string;
  rubric?: string;
}

interface ExamContent {
  id: string;
  title: string;
  category?: string;
  school?: string;
  grade?: number;
  subject?: string;
  sheet?: number;
  difficulty?: string;
  timeLimit: number;
  totalScore: number;
  questions: ExamQuestion[];
  [key: string]: unknown;
}

interface ExamPrResult {
  branch: string;
  commitSha: string;
  pullRequestUrl: string;
}

type AdminTab = 'stats' | 'coupons' | 'upload' | 'debug' | 'inquiries' | 'exam-dev';

export default function AdminPage() {
  const { profile } = useAuth();
  const router = useRouter();
  const [coupons, setCoupons] = useState<AdminCoupon[]>([]);
  const [debugHistory, setDebugHistory] = useState<{id:string;date:string;category:string;description:string;files:string[]}[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<AdminTab>('stats');

  const [stats, setStats] = useState<AdminStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);

  const [inquiries, setInquiries] = useState<AdminInquiry[]>([]);
  const [inquiriesLoading, setInquiriesLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [inquiryFilter, setInquiryFilter] = useState<InquiryFilter>('all');
  const [statusDrafts, setStatusDrafts] = useState<Record<string, InquiryStatus>>({});

  // 문제 개발 탭 상태
  const [examFiles, setExamFiles] = useState<ExamFile[]>([]);
  const [selectedExam, setSelectedExam] = useState<ExamContent | null>(null);
  const [selectedExamFile, setSelectedExamFile] = useState<string | null>(null);
  const [examLoading, setExamLoading] = useState(false);
  const [examSaveLoading, setExamSaveLoading] = useState(false);
  const [examValidationErrors, setExamValidationErrors] = useState<string[]>([]);
  const [examChangeSummary, setExamChangeSummary] = useState('');
  const [examPrResult, setExamPrResult] = useState<ExamPrResult | null>(null);
  const [examSaveError, setExamSaveError] = useState('');

  // 새 쿠폰 폼
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newPoints, setNewPoints] = useState('');
  const [newThumb, setNewThumb] = useState('');
  const [creating, setCreating] = useState(false);

  // 기프티콘 업로드 폼
  const [uploadCouponId, setUploadCouponId] = useState('');
  const [uploadFiles, setUploadFiles] = useState<FileList | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState('');

  useEffect(() => {
    if (profile && profile.role !== 'admin') router.replace('/dashboard');
    if (profile?.role === 'admin') {
      loadCoupons();
      loadStats();
      getIdToken(auth.currentUser!).then(token =>
        fetch('/api/admin/debug-history', { headers: { Authorization: `Bearer ${token}` } })
          .then(r => r.json()).then(data => setDebugHistory(data)).catch(() => {})
      );
    }
  }, [profile]);

  async function getToken() {
    return getIdToken(auth.currentUser!);
  }

  async function loadCoupons() {
    const token = await getToken();
    const res = await fetch('/api/admin/coupons', { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    setCoupons(data);
    setLoading(false);
  }

  async function handleCreateCoupon(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    const token = await getToken();
    await fetch('/api/admin/coupons', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name: newName, description: newDesc, pointsCost: Number(newPoints), thumbnailUrl: newThumb || null }),
    });
    setNewName(''); setNewDesc(''); setNewPoints(''); setNewThumb('');
    setCreating(false);
    await loadCoupons();
  }

  async function loadStats() {
    try {
      const token = await getToken();
      setStatsLoading(true);
      const res = await fetch('/api/admin/stats', { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      setStats(data);
    } catch (e) {
      console.error('[stats] load error:', e);
    } finally {
      setStatsLoading(false);
    }
  }

  async function loadInquiries() {
    const token = await getToken();
    setInquiriesLoading(true);
    const res = await fetch('/api/admin/inquiries', { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    setInquiries(Array.isArray(data) ? data : []);
    setInquiriesLoading(false);
  }

  async function updateInquiryStatus(id: string, status: InquiryStatus) {
    const token = await getToken();
    await fetch(`/api/admin/inquiries/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ status }),
    });
    setInquiries(prev => prev.map(i => i._id === id ? { ...i, status } : i));
    setStatusDrafts(prev => ({ ...prev, [id]: status }));
  }

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!uploadFiles || !uploadCouponId) return;
    setUploading(true);
    setUploadMsg('');
    const token = await getToken();
    const fd = new FormData();
    fd.append('couponId', uploadCouponId);
    Array.from(uploadFiles).forEach(f => fd.append('images', f));
    const res = await fetch('/api/admin/upload', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd });
    const data = await res.json();
    setUploadMsg(`✅ ${data.uploaded}개 업로드 완료`);
    setUploading(false);
    await loadCoupons();
  }

  async function loadExamFiles() {
    try {
      const token = await getToken();
      setExamLoading(true);
      const res = await fetch('/api/admin/exam-files', { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) {
        console.error('[exam-dev] API error:', res.status, res.statusText);
        setExamFiles([]);
        return;
      }
      const data = await res.json();
      setExamFiles(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('[exam-dev] fetch error:', err);
      setExamFiles([]);
    } finally {
      setExamLoading(false);
    }
  }

  async function loadExamContent(filename: string) {
    const token = await getToken();
    const res = await fetch('/api/admin/exam-files', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ filename }),
    });
    const data = await res.json();
    setSelectedExam(data as ExamContent);
    setSelectedExamFile(filename);
    setExamValidationErrors([]);
    setExamChangeSummary('');
    setExamPrResult(null);
    setExamSaveError('');
  }

  function updateExamField<K extends keyof ExamContent>(field: K, value: ExamContent[K]) {
    setSelectedExam(prev => prev ? { ...prev, [field]: value } : prev);
  }

  function updateQuestion(index: number, patch: Partial<ExamQuestion>) {
    setSelectedExam(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        questions: prev.questions.map((question, qi) => qi === index ? { ...question, ...patch } : question),
      };
    });
  }

  function updateChoice(questionIndex: number, choiceIndex: number, value: string) {
    setSelectedExam(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        questions: prev.questions.map((question, qi) => {
          if (qi !== questionIndex) return question;
          const choices = [...(question.choices ?? [])];
          choices[choiceIndex] = value;
          return { ...question, choices };
        }),
      };
    });
  }

  function validateExamDraft(exam: ExamContent | null): string[] {
    const errors: string[] = [];
    if (!exam) return ['시험을 선택해 주세요.'];
    if (!exam.id?.trim()) errors.push('id는 필수입니다.');
    if (!exam.title?.trim()) errors.push('제목은 필수입니다.');
    if (!Number.isFinite(exam.timeLimit) || exam.timeLimit <= 0) errors.push('제한시간은 1 이상의 숫자여야 합니다.');
    if (!Number.isFinite(exam.totalScore) || exam.totalScore <= 0) errors.push('총점은 1 이상의 숫자여야 합니다.');
    if (!Array.isArray(exam.questions) || exam.questions.length === 0) errors.push('문제가 1개 이상 필요합니다.');

    const scoreSum = exam.questions.reduce((sum, question) => sum + (Number.isFinite(question.score) ? question.score : 0), 0);
    if (scoreSum !== exam.totalScore) errors.push(`문제 점수 합계(${scoreSum})와 총점(${exam.totalScore})이 일치해야 합니다.`);

    exam.questions.forEach((question, index) => {
      const label = `Q${index + 1}`;
      if (!['mc', 'short', 'essay'].includes(question.type)) errors.push(`${label}: 지원하지 않는 문제 유형입니다.`);
      if (!Number.isFinite(question.score) || question.score <= 0) errors.push(`${label}: 점수는 1 이상의 숫자여야 합니다.`);
      if (!question.question?.trim()) errors.push(`${label}: 문제 본문은 필수입니다.`);

      if (question.type === 'mc') {
        const choices = question.choices ?? [];
        if (choices.length < 2) errors.push(`${label}: 객관식은 선택지가 2개 이상이어야 합니다.`);
        if (choices.some(choice => !choice.trim())) errors.push(`${label}: 선택지는 비어 있을 수 없습니다.`);
        if (typeof question.answer !== 'number' || question.answer < 0 || question.answer >= choices.length) {
          errors.push(`${label}: 정답은 선택지 범위 안이어야 합니다.`);
        }
      } else {
        const answer = typeof question.answer === 'string' ? question.answer.trim() : '';
        const expectedAnswer = question.expectedAnswer?.trim() ?? '';
        if (!answer && !expectedAnswer) errors.push(`${label}: 주관식/서술형은 모범답안 또는 기대답안이 필요합니다.`);
      }
    });

    return errors;
  }

  async function handleCreateExamPr() {
    const errors = validateExamDraft(selectedExam);
    setExamValidationErrors(errors);
    setExamPrResult(null);
    setExamSaveError('');
    if (errors.length > 0 || !selectedExam || !selectedExamFile) return;

    if (!examChangeSummary.trim()) {
      setExamValidationErrors(['변경 메모를 입력해 주세요.']);
      return;
    }

    setExamSaveLoading(true);
    try {
      const token = await getToken();
      const res = await fetch('/api/admin/exam-files', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          filename: selectedExamFile,
          exam: selectedExam,
          changeSummary: examChangeSummary.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        const details = Array.isArray(data.details) ? data.details.join('\n') : data.error;
        throw new Error(details || '검토 PR 생성에 실패했습니다.');
      }
      setExamPrResult(data as ExamPrResult);
    } catch (error) {
      setExamSaveError(error instanceof Error ? error.message : '검토 PR 생성에 실패했습니다.');
    } finally {
      setExamSaveLoading(false);
    }
  }

  function selectTab(nextTab: AdminTab) {
    setTab(nextTab);
    if (nextTab === 'stats' && !stats) loadStats();
    if (nextTab === 'inquiries' && inquiries.length === 0) loadInquiries();
    if (nextTab === 'exam-dev' && examFiles.length === 0) loadExamFiles();
  }

  const inquiryCounts = {
    all: inquiries.length,
    new: inquiries.filter(i => i.status === 'new').length,
    read: inquiries.filter(i => i.status === 'read').length,
    resolved: inquiries.filter(i => i.status === 'resolved').length,
  };
  const filteredInquiries = inquiryFilter === 'all'
    ? inquiries
    : inquiries.filter(i => i.status === inquiryFilter);
  const inquiryFilterOptions: Array<{ value: InquiryFilter; label: string }> = [
    { value: 'all', label: `All (${inquiryCounts.all})` },
    { value: 'new', label: `New (${inquiryCounts.new})` },
    { value: 'read', label: `Read (${inquiryCounts.read})` },
    { value: 'resolved', label: `Resolved (${inquiryCounts.resolved})` },
  ];

  function renderExamEditor() {
    if (!selectedExam) return null;

    const labelClass = 'text-xs font-semibold text-gray-600';
    const inputClass = 'mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-normal text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-400';
    const scoreSum = selectedExam.questions.reduce((sum, question) => sum + question.score, 0);

    return (
      <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm space-y-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h2 className="font-bold text-gray-800 text-lg">시험 콘텐츠 편집</h2>
            <p className="text-xs text-gray-400 mt-1 font-mono">{selectedExamFile}</p>
          </div>
          <div className="text-xs text-gray-500">점수 합계 {scoreSum} / {selectedExam.totalScore}</div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 border-t border-gray-100 pt-4">
          <label className={labelClass}>제목<input value={selectedExam.title} onChange={e => updateExamField('title', e.target.value)} className={inputClass} /></label>
          <label className={labelClass}>학교<input value={selectedExam.school ?? ''} onChange={e => updateExamField('school', e.target.value)} className={inputClass} /></label>
          <label className={labelClass}>학년<input type="number" value={selectedExam.grade ?? 0} onChange={e => updateExamField('grade', Number(e.target.value))} className={inputClass} /></label>
          <label className={labelClass}>과목<input value={selectedExam.subject ?? ''} onChange={e => updateExamField('subject', e.target.value)} className={inputClass} /></label>
          <label className={labelClass}>난이도<input value={selectedExam.difficulty ?? ''} onChange={e => updateExamField('difficulty', e.target.value)} className={inputClass} /></label>
          <label className={labelClass}>회차<input type="number" value={selectedExam.sheet ?? 0} onChange={e => updateExamField('sheet', Number(e.target.value))} className={inputClass} /></label>
          <label className={labelClass}>제한시간<input type="number" min="1" value={selectedExam.timeLimit} onChange={e => updateExamField('timeLimit', Number(e.target.value))} className={inputClass} /></label>
          <label className={labelClass}>총점<input type="number" min="1" value={selectedExam.totalScore} onChange={e => updateExamField('totalScore', Number(e.target.value))} className={inputClass} /></label>
        </div>

        <div className="border-t border-gray-100 pt-4 space-y-4 max-h-[44rem] overflow-y-auto pr-1">
          {selectedExam.questions.map((question, qi) => (
            <div key={`${question.id}-${qi}`} className="rounded-xl border border-gray-200 p-4 space-y-3">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-indigo-600">Q{question.id}</span>
                  <span className="text-xs rounded-full bg-gray-100 text-gray-600 px-2 py-0.5">{question.type}</span>
                </div>
                <label className={`${labelClass} flex items-center gap-2`}>
                  점수
                  <input type="number" min="1" value={question.score} onChange={e => updateQuestion(qi, { score: Number(e.target.value) })} className="w-20 border border-gray-300 rounded-lg px-2 py-1 text-xs font-normal text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-400" />
                </label>
              </div>

              <label className={`${labelClass} block`}>
                문제
                <textarea value={question.question} onChange={e => updateQuestion(qi, { question: e.target.value })} rows={3} className={inputClass} />
              </label>

              {question.type === 'mc' && (
                <div className="space-y-2">
                  <p className={labelClass}>선택지</p>
                  {(question.choices ?? []).map((choice, ci) => (
                    <div key={ci} className="flex items-center gap-2">
                      <span className="text-xs text-gray-400 w-6">{ci + 1}</span>
                      <input value={choice} onChange={e => updateChoice(qi, ci, e.target.value)} className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-400" />
                    </div>
                  ))}
                  <label className={`${labelClass} block`}>
                    정답
                    <select value={typeof question.answer === 'number' ? question.answer : 0} onChange={e => updateQuestion(qi, { answer: Number(e.target.value) })} className={inputClass}>
                      {(question.choices ?? []).map((choice, ci) => <option key={ci} value={ci}>{ci + 1}. {choice || '빈 선택지'}</option>)}
                    </select>
                  </label>
                </div>
              )}

              {question.type !== 'mc' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <label className={labelClass}>모범답안<textarea value={typeof question.answer === 'string' ? question.answer : ''} onChange={e => updateQuestion(qi, { answer: e.target.value })} rows={3} className={inputClass} /></label>
                  <label className={labelClass}>기대답안<textarea value={question.expectedAnswer ?? ''} onChange={e => updateQuestion(qi, { expectedAnswer: e.target.value })} rows={3} className={inputClass} /></label>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <label className={labelClass}>해설<textarea value={question.explanation ?? ''} onChange={e => updateQuestion(qi, { explanation: e.target.value })} rows={3} className={inputClass} /></label>
                <label className={labelClass}>채점기준<textarea value={question.rubric ?? ''} onChange={e => updateQuestion(qi, { rubric: e.target.value })} rows={3} className={inputClass} /></label>
              </div>
            </div>
          ))}
        </div>

        <div className="border-t border-gray-100 pt-4 space-y-3">
          <label className={`${labelClass} block`}>
            변경 메모
            <textarea value={examChangeSummary} onChange={e => setExamChangeSummary(e.target.value)} rows={2} className={inputClass} />
          </label>

          {examValidationErrors.length > 0 && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 space-y-1">
              {examValidationErrors.map(error => <p key={error}>{error}</p>)}
            </div>
          )}

          {examSaveError && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 whitespace-pre-wrap">{examSaveError}</div>}

          {examPrResult && (
            <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-700 space-y-1">
              <p>검토 PR이 생성되었습니다.</p>
              <a href={examPrResult.pullRequestUrl} target="_blank" rel="noreferrer" className="font-semibold underline">{examPrResult.pullRequestUrl}</a>
              <p className="font-mono text-green-600">{examPrResult.branch} · {examPrResult.commitSha.slice(0, 8)}</p>
            </div>
          )}

          <button onClick={handleCreateExamPr} disabled={examSaveLoading} className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-5 py-2 rounded-xl text-sm transition disabled:opacity-50">
            {examSaveLoading ? 'PR 생성 중...' : '검토 PR 생성'}
          </button>
        </div>
      </div>
    );
  }

  if (!profile || profile.role !== 'admin') return null;
  if (loading) return <div className="text-center py-20 text-gray-400">불러오는 중...</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">🛠️ 관리자 패널</h1>
      </div>

      <div className="flex gap-2 flex-wrap">
        {([['stats', '📊 통계'], ['coupons', '🎁 쿠폰 관리'], ['upload', '⬆️ 기프티콘 업로드'], ['debug', '🐛 디버그 수정 내역'], ['inquiries', `💬 문의 내역${inquiries.filter(i => i.status === 'new').length > 0 ? ` (${inquiries.filter(i => i.status === 'new').length})` : ''}`], ['exam-dev', '📝 문제 개발']] as Array<[AdminTab, string]>).map(([t, label]) => (
          <button
            key={t}
            onClick={() => selectTab(t)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition ${tab === t ? 'bg-indigo-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'stats' && (
        <div className="space-y-6">
          {statsLoading ? (
            <div className="text-center py-20 text-gray-400">불러오는 중...</div>
          ) : stats ? (
            <>
              {/* 통계 카드 */}
              <div className="grid grid-cols-4 gap-4">
                <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                  <p className="text-xs text-gray-500 font-semibold mb-2">📊 총 가입자</p>
                  <p className="text-3xl font-bold text-indigo-600">{stats.totalUsers.toLocaleString()}</p>
                  <p className="text-xs text-gray-400 mt-2">명</p>
                </div>
                <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                  <p className="text-xs text-gray-500 font-semibold mb-2">👥 활성 사용자</p>
                  <p className="text-3xl font-bold text-indigo-600">{stats.activeUsers24h.toLocaleString()}</p>
                  <p className="text-xs text-gray-400 mt-2">24시간</p>
                </div>
                <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                  <p className="text-xs text-gray-500 font-semibold mb-2">📝 오늘 응시</p>
                  <p className="text-3xl font-bold text-indigo-600">{stats.todayExamAttempts.toLocaleString()}</p>
                  <p className="text-xs text-gray-400 mt-2">건</p>
                </div>
                <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                  <p className="text-xs text-gray-500 font-semibold mb-2">💬 미해결 문의</p>
                  <p className="text-3xl font-bold text-red-600">{stats.pendingInquiries.toLocaleString()}</p>
                  <p className="text-xs text-gray-400 mt-2">건</p>
                </div>
              </div>

              {/* 시험별 통계 테이블 */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-200 bg-gray-50">
                  <h2 className="font-semibold text-gray-800">시험별 통계</h2>
                </div>
                {stats.statsTopExams.length === 0 ? (
                  <div className="text-center py-10 text-gray-400">
                    <p>시험 응시 데이터가 없습니다.</p>
                  </div>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="text-left px-5 py-3 text-gray-600 font-semibold">시험명</th>
                        <th className="text-right px-5 py-3 text-gray-600 font-semibold">응시자</th>
                        <th className="text-right px-5 py-3 text-gray-600 font-semibold">평균 점수</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {stats.statsTopExams.map((exam, idx) => (
                        <tr key={idx} className="hover:bg-gray-50">
                          <td className="px-5 py-3 font-medium text-gray-800 truncate">{exam.examTitle}</td>
                          <td className="px-5 py-3 text-right text-gray-600">{exam.attempts.toLocaleString()}명</td>
                          <td className="px-5 py-3 text-right font-semibold text-indigo-600">{exam.avgScore.toFixed(1)}점</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </>
          ) : (
            <div className="text-center py-20 text-gray-400">통계를 불러올 수 없습니다.</div>
          )}
        </div>
      )}

      {tab === 'coupons' && (
        <div className="space-y-5">
          {/* 새 쿠폰 생성 */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
            <h2 className="font-semibold text-gray-700 mb-4">새 쿠폰 종류 추가</h2>
            <form onSubmit={handleCreateCoupon} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <input
                  value={newName} onChange={e => setNewName(e.target.value)} required
                  placeholder="쿠폰 이름 (예: 스타벅스 5천원)"
                  className="border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
                <input
                  value={newPoints} onChange={e => setNewPoints(e.target.value)} required type="number" min="1"
                  placeholder="포인트 비용"
                  className="border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
              </div>
              <input
                value={newDesc} onChange={e => setNewDesc(e.target.value)}
                placeholder="설명 (선택)"
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
              <input
                value={newThumb} onChange={e => setNewThumb(e.target.value)}
                placeholder="썸네일 URL (선택)"
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
              <button
                type="submit" disabled={creating}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-5 py-2 rounded-xl text-sm transition disabled:opacity-50"
              >
                {creating ? '추가 중...' : '쿠폰 추가'}
              </button>
            </form>
          </div>

          {/* 쿠폰 목록 */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 text-gray-600 font-semibold">쿠폰명</th>
                  <th className="text-right px-4 py-3 text-gray-600 font-semibold">포인트</th>
                  <th className="text-right px-4 py-3 text-gray-600 font-semibold">재고</th>
                  <th className="text-right px-4 py-3 text-gray-600 font-semibold">ID</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {coupons.map(c => (
                  <tr key={c.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-800">
                      {c.name}
                      {c.description && <span className="text-gray-400 text-xs ml-2">{c.description}</span>}
                    </td>
                    <td className="px-4 py-3 text-right text-indigo-600 font-semibold">{c.pointsCost.toLocaleString()}p</td>
                    <td className="px-4 py-3 text-right">
                      <span className={`font-semibold ${c.availableStock === 0 ? 'text-red-500' : 'text-green-600'}`}>
                        {c.availableStock}
                      </span>
                      <span className="text-gray-400"> / {c.totalStock}</span>
                    </td>
                    <td className="px-4 py-3 text-right text-gray-400 text-xs font-mono">{c.id.slice(0, 8)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'upload' && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm space-y-4">
          <h2 className="font-semibold text-gray-700">기프티콘 이미지 업로드</h2>
          <p className="text-sm text-gray-500">카카오 기프티콘 사진을 업로드하면 상점 재고로 등록됩니다.</p>

          <form onSubmit={handleUpload} className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">쿠폰 선택</label>
              <select
                value={uploadCouponId}
                onChange={e => setUploadCouponId(e.target.value)}
                required
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              >
                <option value="">-- 쿠폰을 선택하세요 --</option>
                {coupons.map(c => (
                  <option key={c.id} value={c.id}>{c.name} ({c.pointsCost}p)</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">기프티콘 이미지 (여러 장 가능)</label>
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={e => setUploadFiles(e.target.files)}
                required
                className="w-full text-sm text-gray-600 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
              />
            </div>
            {uploadMsg && <p className="text-green-600 text-sm">{uploadMsg}</p>}
            <button
              type="submit" disabled={uploading || !uploadFiles || !uploadCouponId}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-5 py-2 rounded-xl text-sm transition disabled:opacity-50"
            >
              {uploading ? '업로드 중...' : '업로드'}
            </button>
          </form>
        </div>
      )}

      {tab === 'inquiries' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <p className="text-sm text-gray-500">총 {inquiries.length}건 · 신규 {inquiries.filter(i => i.status === 'new').length}건</p>
            <button onClick={loadInquiries} className="text-xs text-indigo-600 hover:underline">새로고침</button>
          </div>

          <div className="flex gap-2 flex-wrap">
            {inquiryFilterOptions.map(option => (
              <button
                key={option.value}
                onClick={() => setInquiryFilter(option.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  inquiryFilter === option.value
                    ? 'bg-indigo-600 text-white'
                    : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>

          {inquiriesLoading ? (
            <div className="text-center py-10 text-gray-400">불러오는 중...</div>
          ) : inquiries.length === 0 ? (
            <div className="text-center py-10 text-gray-400">문의 내역이 없습니다.</div>
          ) : filteredInquiries.length === 0 ? (
            <div className="text-center py-10 text-gray-400">선택한 상태의 문의가 없습니다.</div>
          ) : (
            filteredInquiries.map(inq => {
              const isExpanded = expandedId === inq._id;
              const selectedStatus = statusDrafts[inq._id] ?? inq.status;
              const date = inq.createdAt?.seconds
                ? new Date(inq.createdAt.seconds * 1000).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                : '';
              const statusMeta = {
                new: { label: '신규', cls: 'bg-red-100 text-red-600' },
                read: { label: '읽음', cls: 'bg-gray-100 text-gray-500' },
                resolved: { label: '해결됨', cls: 'bg-green-100 text-green-600' },
              }[inq.status] ?? { label: inq.status, cls: 'bg-gray-100 text-gray-500' };

              return (
                <div key={inq._id} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                  <button
                    className="w-full text-left px-5 py-4 hover:bg-gray-50 transition"
                    onClick={() => {
                      setExpandedId(isExpanded ? null : inq._id);
                      if (inq.status === 'new') updateInquiryStatus(inq._id, 'read');
                    }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className={`text-xs font-semibold rounded-full px-2 py-0.5 ${statusMeta.cls}`}>
                            {statusMeta.label}
                          </span>
                          <span className="text-xs bg-indigo-50 text-indigo-600 rounded-full px-2 py-0.5">{inq.category}</span>
                          <span className="text-xs text-gray-400">{date}</span>
                        </div>
                        <p className="font-semibold text-gray-800 text-sm truncate">{inq.subject}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{inq.nickname} {inq.email && `· ${inq.email}`}</p>
                      </div>
                      <svg className={`w-4 h-4 text-gray-400 shrink-0 mt-1 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                        fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="border-t border-gray-100 px-5 py-4 space-y-3">
                      <p className="text-sm text-gray-700 whitespace-pre-wrap">{inq.message}</p>
                      <div className="text-xs text-gray-500">
                        이메일: {inq.email || '없음'}
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <select
                          value={selectedStatus}
                          onChange={e => setStatusDrafts(prev => ({ ...prev, [inq._id]: e.target.value as InquiryStatus }))}
                          className="border border-gray-300 rounded-lg px-3 py-1.5 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                        >
                          {inquiryStatusOptions.map(option => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                          ))}
                        </select>
                        <button
                          onClick={() => updateInquiryStatus(inq._id, selectedStatus)}
                          disabled={selectedStatus === inq.status}
                          className="text-xs px-3 py-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          상태 변경
                        </button>
                        {inq.status === 'new' && (
                          <span className="text-xs text-gray-400">펼치면 자동으로 읽음 처리됩니다.</span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {tab === 'debug' && (
        <div className="space-y-3">
          <p className="text-sm text-gray-500">총 {debugHistory.length}건의 수정 내역</p>
          {debugHistory.length === 0 ? (
            <div className="text-center py-10 text-gray-400">수정 내역이 없습니다.</div>
          ) : (
            [...debugHistory].reverse().map(entry => (
              <div key={entry.id} className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                  <span className={`text-xs font-semibold rounded-full px-2 py-0.5 ${
                    entry.category === 'answer_fix' ? 'bg-red-100 text-red-600' :
                    entry.category === 'question_fix' ? 'bg-orange-100 text-orange-600' :
                    entry.category === 'json_fix' ? 'bg-yellow-100 text-yellow-600' :
                    'bg-blue-100 text-blue-600'
                  }`}>
                    {entry.category === 'answer_fix' ? '정답 수정' :
                     entry.category === 'question_fix' ? '문제 수정' :
                     entry.category === 'json_fix' ? 'JSON 수정' : '기능 추가'}
                  </span>
                  <span className="text-xs text-gray-400">{entry.date}</span>
                </div>
                <p className="text-sm text-gray-700 mb-2">{entry.description}</p>
                <div className="flex flex-wrap gap-1">
                  {entry.files.map(f => (
                    <span key={f} className="text-xs font-mono bg-gray-50 text-gray-500 rounded px-2 py-0.5">{f.split('/').pop()}</span>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'exam-dev' && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* 파일 목록 */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
              <h2 className="font-semibold text-gray-700 mb-3">문제 파일</h2>
              {examLoading ? (
                <p className="text-gray-400 text-sm">불러오는 중...</p>
              ) : examFiles.length === 0 ? (
                <p className="text-gray-400 text-sm">파일이 없습니다.</p>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {examFiles.map((file, idx) => (
                    <button
                      key={idx}
                      onClick={() => loadExamContent(file.filename)}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm transition ${
                        selectedExamFile === file.filename
                          ? 'bg-indigo-100 text-indigo-700 font-medium'
                          : 'hover:bg-gray-50 text-gray-700'
                      }`}
                    >
                      <p className="font-medium">{file.title}</p>
                      <p className="text-xs text-gray-500">{file.questionCount}문제</p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 문제 미리보기 */}
          <div className="lg:col-span-3">
            {selectedExam ? renderExamEditor() : (
              <div className="text-center py-20 text-gray-400">
                <div className="text-4xl mb-2">📝</div>
                <p>파일을 선택하면 문제를 볼 수 있습니다.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
