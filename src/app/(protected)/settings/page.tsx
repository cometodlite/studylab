'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

interface SchoolExamMeta {
  school: string;
  category: string;
}

const GRADE_OPTIONS = [
  { value: 1, label: '중1' },
  { value: 2, label: '중2' },
  { value: 3, label: '중3' },
];

export default function SettingsPage() {
  const { user, profile, refreshProfile } = useAuth();
  const [schools, setSchools] = useState<string[]>([]);
  const [selectedSchool, setSelectedSchool] = useState<string>('');
  const [selectedGrade, setSelectedGrade] = useState<number | ''>('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/school-exams')
      .then(r => r.json())
      .then((data: SchoolExamMeta[]) => {
        const unique = [...new Set(data.filter(e => e.category === '학교').map(e => e.school))];
        setSchools(unique);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (profile) {
      setSelectedSchool(profile.school ?? '');
      setSelectedGrade(profile.gradeLevel ?? '');
    }
  }, [profile]);

  async function handleSave() {
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

  return (
    <div className="space-y-6 max-w-lg">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">⚙️ 설정</h1>
        <p className="text-gray-500 text-sm mt-1">학교 및 학년을 설정하면 맞춤 콘텐츠를 제공합니다.</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-6">
        {/* 학교 선택 */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">내 학교</label>
          <select
            value={selectedSchool}
            onChange={e => setSelectedSchool(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white"
          >
            <option value="">학교를 선택하세요</option>
            {schools.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <p className="text-xs text-gray-400 mt-1.5">
            설정 시 시험 탭에서 해당 학교 시험이 자동 선택됩니다.
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
            설정 시 연습문제 탭에서 해당 학년 문제가 우선 표시됩니다.
          </p>
        </div>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
        )}

        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition text-sm"
        >
          {saving ? '저장 중...' : saved ? '✅ 저장됨' : '저장하기'}
        </button>
      </div>

      {/* 현재 설정 미리보기 */}
      {(profile?.school || profile?.gradeLevel) && (
        <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 text-sm text-indigo-700">
          <p className="font-semibold mb-1">현재 설정</p>
          {profile.school && <p>🏫 학교: {profile.school}</p>}
          {profile.gradeLevel && <p>📚 학년: 중{profile.gradeLevel}</p>}
        </div>
      )}
    </div>
  );
}
