'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { DIFFICULTY_RULES, Difficulty } from '@/lib/points';

interface ExamMeta {
  id: string;
  title: string;
  description: string;
  grade: number | null;
  unit: string | null;
  difficulty: Difficulty | null;
  questionCount: number;
}

interface SchoolExamMeta {
  id: string;
  title: string;
  school: string;
  grade: number;
  subject: string;
  sheet: number;
  difficulty: string;
  totalScore: number;
  mcCount: number;
  essayCount: number;
}

const DIFFICULTY_COLOR: Record<Difficulty, string> = {
  '기본':   'bg-green-100 text-green-700',
  '유형별': 'bg-blue-100 text-blue-700',
  '심화':   'bg-orange-100 text-orange-700',
  '킬러':   'bg-red-100 text-red-700',
};

const SUBJECT_COLORS: Record<string, { bg: string; text: string; border: string; icon: string }> = {
  역사: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', icon: '📜' },
  수학: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', icon: '📐' },
  과학: { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200', icon: '🔬' },
};

const SHEET_ICON = ['🌱', '📗', '📘', '📙', '🔥'];
const GRADE_LABEL: Record<number, string> = { 1: '중1', 2: '중2', 3: '중3' };

export default function PracticeListPage() {
  const [tab, setTab] = useState<'practice' | 'school'>('practice');
  const [exams, setExams] = useState<ExamMeta[]>([]);
  const [schoolExams, setSchoolExams] = useState<SchoolExamMeta[]>([]);
  const [loading, setLoading] = useState(true);

  // 연습문제 필터
  const [gradeFilter, setGradeFilter] = useState<string>('');
  const [unitFilter, setUnitFilter] = useState<string>('');
  const [diffFilter, setDiffFilter] = useState<string>('');

  // 내신기출 필터
  const [subjectFilter, setSubjectFilter] = useState<string>('');

  useEffect(() => {
    Promise.all([
      fetch('/api/exams').then(r => r.json()).catch(() => []),
      fetch('/api/school-exams').then(r => r.json()).catch(() => []),
    ]).then(([e, s]) => {
      setExams(Array.isArray(e) ? e : []);
      setSchoolExams(Array.isArray(s) ? s : []);
      setLoading(false);
    });
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

  const schoolSubjects = [...new Set(schoolExams.map(s => s.subject))];
  const filteredSchool = subjectFilter ? schoolExams.filter(s => s.subject === subjectFilter) : schoolExams;
  const schoolBySubject: Record<string, SchoolExamMeta[]> = {};
  for (const s of filteredSchool) {
    if (!schoolBySubject[s.subject]) schoolBySubject[s.subject] = [];
    schoolBySubject[s.subject].push(s);
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
          { key: 'school', label: '단원별 내신기출' },
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
        <div className="space-y-5">
          {/* 과목 필터 */}
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => setSubjectFilter('')}
              className={`px-3 py-1.5 text-sm font-medium rounded-full border transition ${!subjectFilter ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-300'}`}>
              전체
            </button>
            {schoolSubjects.map(s => {
              const col = SUBJECT_COLORS[s];
              return (
                <button key={s} onClick={() => setSubjectFilter(s)}
                  className={`px-3 py-1.5 text-sm font-medium rounded-full border transition ${
                    subjectFilter === s
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-300'
                  }`}>
                  {col?.icon ?? ''} {s}
                </button>
              );
            })}
          </div>

          {Object.keys(schoolBySubject).length === 0 ? (
            <p className="text-center text-gray-400 py-12">내신기출 문제가 없습니다.</p>
          ) : (
            Object.entries(schoolBySubject).map(([subject, list]) => {
              const col = SUBJECT_COLORS[subject] ?? { bg: 'bg-gray-50', text: 'text-gray-700', border: 'border-gray-200', icon: '📄' };
              return (
                <div key={subject} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className={`px-5 py-3 ${col.bg} border-b ${col.border}`}>
                    <h3 className={`font-bold ${col.text}`}>{col.icon} {subject}</h3>
                  </div>
                  <div className="divide-y divide-gray-50">
                    {list.map((exam, i) => (
                      <Link key={exam.id} href={`/exam/${exam.id}`}
                        className="flex items-center justify-between px-5 py-3.5 hover:bg-indigo-50 transition group">
                        <div className="flex items-center gap-2.5">
                          <span className="text-xl">{SHEET_ICON[i % SHEET_ICON.length]}</span>
                          <div>
                            <p className="text-gray-800 text-sm font-semibold group-hover:text-indigo-700 transition leading-snug">
                              {exam.title}
                            </p>
                            <p className="text-xs text-gray-400 mt-0.5">
                              {GRADE_LABEL[exam.grade] ?? `${exam.grade}학년`} · {exam.mcCount}객관식 + {exam.essayCount}주관식 · {exam.totalScore}점
                            </p>
                          </div>
                        </div>
                        <span className="text-xs text-gray-400 shrink-0 ml-3">풀기 →</span>
                      </Link>
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
