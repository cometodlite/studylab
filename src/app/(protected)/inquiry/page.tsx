'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getIdToken } from 'firebase/auth';
import { auth } from '@/lib/firebase';

const CATEGORIES = ['일반 문의', '오류/버그', '콘텐츠 요청', '포인트/상점 관련', '기타'];

export default function InquiryPage() {
  const { profile } = useAuth();
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const token = await getIdToken(auth.currentUser!);
      const res = await fetch('/api/inquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          category,
          subject: subject.trim(),
          message: message.trim(),
          nickname: profile?.nickname ?? '',
          email: profile?.email ?? '',
        }),
      });
      if (!res.ok) throw new Error();
      setSubmitted(true);
    } catch {
      setError('전송에 실패했습니다. 다시 시도해 주세요.');
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="text-center py-24 space-y-4">
        <div className="text-6xl">✅</div>
        <h2 className="text-xl font-bold text-gray-800">문의가 접수되었습니다</h2>
        <p className="text-gray-500 text-sm">빠르게 확인 후 답변드리겠습니다.</p>
        <button
          onClick={() => { setSubmitted(false); setSubject(''); setMessage(''); }}
          className="text-indigo-600 text-sm hover:underline"
        >
          새 문의 작성하기
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-lg">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">💬 문의하기</h1>
        <p className="text-gray-500 text-sm mt-1">궁금한 점이나 불편한 점을 알려주세요.</p>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-4">
        <div className="bg-gray-50 rounded-xl px-4 py-3 text-sm text-gray-600 space-y-0.5">
          <p>👤 <strong>{profile?.nickname}</strong></p>
          {profile?.email && <p className="text-xs text-gray-400">📧 {profile.email}</p>}
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">문의 유형</label>
          <select
            value={category}
            onChange={e => setCategory(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white"
          >
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">제목</label>
          <input
            type="text"
            value={subject}
            onChange={e => setSubject(e.target.value)}
            required
            placeholder="문의 제목을 입력하세요"
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-300"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">내용</label>
          <textarea
            value={message}
            onChange={e => setMessage(e.target.value)}
            required
            rows={6}
            placeholder="문의 내용을 자세히 입력해주세요..."
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none"
          />
        </div>

        {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

        <button
          type="submit"
          disabled={submitting || !subject.trim() || !message.trim()}
          className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition text-sm"
        >
          {submitting ? '전송 중...' : '문의 보내기'}
        </button>
      </form>
    </div>
  );
}
