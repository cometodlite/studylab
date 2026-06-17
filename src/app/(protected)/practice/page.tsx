'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { DIFFICULTY_RULES, Difficulty } from '@/lib/points';
import { useAuth } from '@/contexts/AuthContext';

interface ExamMeta {
  id: string;
  title: string;
  description: string;
  grade: number | null;
  unit: string | null;
  difficulty: Difficulty | null;
  questionCount: number;
}

const DIFFICULTY_COLOR: Record<Difficulty, string> = {
  '기본':   'bg-green-100 text-green-700',
  '유형별': 'bg-blue-100 text-blue-700',
  '심화':   'bg-orange-100 text-orange-700',
  '킬러':   'bg-red-100 text-red-700',
};

const GRADE_LABEL: Record<number, string> = { 1: '중1', 2: '중2', 3: '중3' };

export default function PracticeListPage() {
  const { profile } = useAuth();
  const [tab, setTab] = useState<'practice' | 'school'>('practice');
  const [exams, setExams] = useState<ExamMeta[]>([]);
  const [loading, setLoading] = useState(true);

  const [gradeFilter, setGradeFilter] = useState<string>('');
  const [unitFilter, setUnitFilter] = useState<string>('');
  const [diffFilter, setDiffFilter] = useState<string>('');

  // Pre-fill grade filter from profile
  useEffect(() => {
    if (profile?.gradeLevel) {
      setGradeFilter(String(profile.gradeLevel));
    }
  }, [profile?.gradeLevel]);

  useEffect(() => {
    fetch('/api/exams')
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(data => { setExams(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const grades = [...new Set(exams.map(e => e.grade).filter(Boolean))].sort() as number[];
  const units = [...new Set(
    exams.filter(e => !gradeFilter || String(e.grade) === gradeFilter).map(e => e.unit).filter(Boolean)
  )] as string[];

  const filteredExams = exams.filter(e => {
    if (gradeFilter && String(e.grade) !== gradeFilter) return false;
    if (unitFilter && e.unit !== unitFilter) return false;
    if (diffFilter && e.difficulty !== diffFilter) return false;
    return true;
  });

  function maxPoints(d: Difficulty | null, count: number) {
    if (!d) return null;
    const r = DIFFICULTY_RULES[d];
    return r.perQuestion * count + r.complete + r.bonusPerfect;
  }

  if (loading) return <div className="text-center py-20 text-gray-400">불러오는 중...</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">✏️ 문제 풀이</h1>
        <p className="text-gray-500 text-sm mt-1">문제를 풀고 포인트를 획득하세요.</p>
      </div>

      {/* 탭 */}
      <div className="flex border-b border-gray-200 gap-1">
        {[
          { key: 'practice', label: '단원별 연습문제' },
          { key: 'school', label: '내신 대비 문제' },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key as 'practice' | 'school')}
            className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition -mb-px ${
              tab === t.key
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'practice' ? (
        <div className="space-y-5">
          {/* 필터 */}
          <div className="flex flex-wrap gap-2">
            <select
              value={gradeFilter}
              onChange={e => { setGradeFilter(e.target.value); setUnitFilter(''); }}
              className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-300"
            >
              <option value="">전체 학년</option>
              {grades.map(g => <option key={g} value={String(g)}>{GRADE_LABEL[g] ?? `${g}학년`}</option>)}
            </select>

            <select
              value={unitFilter}
              onChange={e => setUnitFilter(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-300"
            >
              <option value="">전체 단원</option>
              {units.map(u => <option key={u} value={u}>{u}</option>)}
            </select>

            <select
              value={diffFilter}
              onChange={e => setDiffFilter(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-300"
            >
              <option value="">전체 난이도</option>
              {(['기본', '유형별', '심화', '킬러'] as Difficulty[]).map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>

          <div className="grid gap-4">
            {filteredExams.map(exam => {
              const mp = maxPoints(exam.difficulty, exam.questionCount);
              return (
                <div key={exam.id} className="bg-white rounded-xl border border-gray-200 p-5 flex items-center justify-between shadow-sm">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      {exam.grade && (
                        <span className="text-xs bg-gray-100 text-gray-600 rounded-full px-2 py-0.5 font-medium">
                          {GRADE_LABEL[exam.grade] ?? `${exam.grade}학년`}
                        </span>
                      )}
                      {exam.unit && (
                        <span className="text-xs bg-indigo-50 text-indigo-600 rounded-full px-2 py-0.5 font-medium">
                          {exam.unit}
                        </span>
                      )}
                      {exam.difficulty && (
                        <span className={`text-xs rounded-full px-2 py-0.5 font-semibold ${DIFFICULTY_COLOR[exam.difficulty]}`}>
                          {exam.difficulty}
                        </span>
                      )}
                    </div>
                    <h2 className="font-bold text-gray-800">{exam.title}</h2>
                    {exam.description && <p className="text-gray-500 text-sm mt-0.5 truncate">{exam.description}</p>}
                    <div className="flex items-center gap-3 mt-1.5">
                      <span className="text-indigo-500 text-sm font-medium">{exam.questionCount}문제</span>
                      {mp !== null && (
                        <span className="text-green-600 text-sm font-medium">만점 최대 {mp.toLocaleString()}p</span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 ml-4 shrink-0">
                    <Link
                      href={`/practice/${exam.id}?shuffle=1`}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-4 py-2 rounded-xl transition text-center"
                    >
                      시작
                    </Link>
                  </div>
                </div>
              );
            })}

            {filteredExams.length === 0 && (
              <div className="text-center py-16 text-gray-400">
                <div className="text-4xl mb-3">📭</div>
                <p>해당 조건의 문제집이 없습니다.</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="text-center py-24 text-gray-400">
          <div className="text-5xl mb-4">📝</div>
          <p className="font-semibold text-gray-500">곧 출시됩니다</p>
          <p className="text-sm mt-1">내신 대비 문제를 준비 중입니다.</p>
        </div>
      )}
    </div>
  );
}
