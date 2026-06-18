'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getIdToken } from 'firebase/auth';
import { auth } from '@/lib/firebase';

const GRADE_OPTIONS = [
  { value: 1, label: '중1' },
  { value: 2, label: '중2' },
  { value: 3, label: '중3' },
];

const INQUIRY_CATEGORIES = ['일반 문의', '오류/버그', '정답 정정', '콘텐츠 요청', '학교 추가', '포인트/상점 관련', '기타'];

export default function SettingsPage() {
  const { user, profile, refreshProfile } = useAuth();
  const [tab, setTab] = useState<'profile' | 'inquiry'>('profile');

  // 프로필 설정 상태
  const [selectedSchool, setSelectedSchool] = useState<string>('');
  const [selectedGrade, setSelectedGrade] = useState<number | ''>('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  // 문의 상태
  const [inquiryCategory, setInquiryCategory] = useState(INQUIRY_CATEGORIES[0]);
  const [inquirySubject, setInquirySubject] = useState('');
  const [inquiryMessage, setInquiryMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [inquiryError, setInquiryError] = useState('');

  // 프로필 설정 초기화
  const handleProfileTab = () => {
    setTab('profile');
    if (profile) {
      setSelectedSchool(profile.school ?? '');
      setSelectedGrade(profile.gradeLevel ?? '');
    }
  };

  async function handleSaveProfile() {
    if (!user) return;
    setSaving(true);
    setError('');
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        school: selectedSchool || null,
        gradeLevel: selectedGrade || null,
      });
      await refreshProfile();
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch {
      setError('저장에 실패했습니다. 다시 시도해 주세요.');
    } finally {
      setSaving(false);
    }
  }

  async function handleInquiry(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setInquiryError('');
    try {
      const token = await getIdToken(auth.currentUser!);
      const res = await fetch('/api/inquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          category: inquiryCategory,
          subject: inquirySubject.trim(),
          message: inquiryMessage.trim(),
          nickname: profile?.nickname ?? '',
          email: profile?.email ?? '',
        }),
      });
      if (!res.ok) throw new Error();
      setSubmitted(true);
      setTimeout(() => {
        setSubmitted(false);
        setInquirySubject('');
        setInquiryMessage('');
        setInquiryCategory(INQUIRY_CATEGORIES[0]);
      }, 1500);
    } catch {
      setInquiryError('전송에 실패했습니다. 다시 시도해 주세요.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">⚙️ 설정</h1>
        <p className="text-gray-500 text-sm mt-1">프로필 설정 및 문의</p>
      </div>

      {/* 탭 */}
      <div className="flex gap-2">
        <button
          onClick={handleProfileTab}
          className={`px-4 py-2 rounded-xl text-sm font-medium transition ${
            tab === 'profile'
              ? 'bg-indigo-600 text-white'
              : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
          }`}
        >
          📋 프로필 설정
        </button>
        <button
          onClick={() => setTab('inquiry')}
          className={`px-4 py-2 rounded-xl text-sm font-medium transition ${
            tab === 'inquiry'
              ? 'bg-indigo-600 text-white'
              : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
          }`}
        >
          💬 문의하기
        </button>
      </div>

      {/* 프로필 설정 탭 */}
      {tab === 'profile' && (
        <div className="max-w-lg">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-6">
            {/* 학교 입력 */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">내 학교</label>
              <input
                type="text"
                value={selectedSchool}
                onChange={e => setSelectedSchool(e.target.value)}
                placeholder="학교명 입력 (예: 서울중학교)"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-300"
              />
              <p className="text-xs text-gray-400 mt-1.5">
                시험 탭에서 해당 학교 시험이 자동 선택됩니다.
              </p>
            </div>

            {/* 학년 선택 */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">내 학년</label>
              <select
                value={selectedGrade}
                onChange={e => setSelectedGrade(e.target.value ? Number(e.target.value) : '')}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white"
              >
                <option value="">학년을 선택하세요</option>
                {GRADE_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              <p className="text-xs text-gray-400 mt-1.5">
                연습문제 탭에서 해당 학년 문제가 우선 표시됩니다.
              </p>
            </div>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
            )}

            <button
              onClick={handleSaveProfile}
              disabled={saving}
              className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition text-sm"
            >
              {saving ? '저장 중...' : saved ? '✅ 저장됨' : '저장하기'}
            </button>
          </div>

          {/* 현재 설정 미리보기 */}
          {(profile?.school || profile?.gradeLevel) && (
            <div className="mt-4 bg-indigo-50 border border-indigo-100 rounded-xl p-4 text-sm text-indigo-700">
              <p className="font-semibold mb-1">현재 설정</p>
              {profile.school && <p>🏫 학교: {profile.school}</p>}
              {profile.gradeLevel && <p>📚 학년: 중{profile.gradeLevel}</p>}
            </div>
          )}
        </div>
      )}

      {/* 문의하기 탭 */}
      {tab === 'inquiry' && (
        <div className="max-w-lg">
          {submitted ? (
            <div className="text-center py-16 space-y-4">
              <div className="text-6xl">✅</div>
              <h2 className="text-lg font-bold text-gray-800">문의가 접수되었습니다</h2>
              <p className="text-gray-500 text-sm">빠르게 확인 후 답변드리겠습니다.</p>
            </div>
          ) : (
            <form onSubmit={handleInquiry} className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-4">
              <div className="bg-gray-50 rounded-xl px-4 py-3 text-sm text-gray-600 space-y-0.5">
                <p>👤 <strong>{profile?.nickname}</strong></p>
                {profile?.email && <p className="text-xs text-gray-400">📧 {profile.email}</p>}
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">문의 유형</label>
                <select
                  value={inquiryCategory}
                  onChange={e => setInquiryCategory(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white"
                >
                  {INQUIRY_CATEGORIES.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">제목</label>
                <input
                  type="text"
                  value={inquirySubject}
                  onChange={e => setInquirySubject(e.target.value)}
                  required
                  placeholder="문의 제목을 입력하세요"
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">내용</label>
                <textarea
                  value={inquiryMessage}
                  onChange={e => setInquiryMessage(e.target.value)}
                  required
                  rows={6}
                  placeholder="문의 내용을 자세히 입력해주세요..."
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none"
                />
              </div>

              {inquiryError && (
                <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{inquiryError}</p>
              )}

              <button
                type="submit"
                disabled={submitting || !inquirySubject.trim() || !inquiryMessage.trim()}
                className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition text-sm"
              >
                {submitting ? '전송 중...' : '문의 보내기'}
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
