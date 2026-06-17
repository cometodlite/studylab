'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface ExamMeta {
  id: string;
  title: string;
  grade: number | null;
  unit: string | null;
  difficulty: string | null;
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

const DIFF_COLOR: Record<string, string> = {
  기본: 'bg-green-100 text-green-700',
  유형별: 'bg-blue-100 text-blue-700',
  심화: 'bg-orange-100 text-orange-700',
  킬러: 'bg-red-100 text-red-700',
};

const SHEET_ICON = ['🌱', '📗', '📘', '📙', '🔥'];

const SUBJECT_COLORS: Record<string, { bg: string; text: string; border: string; icon: string }> = {
  역사: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', icon: '📜' },
  수학: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', icon: '📐' },
  과학: { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200', icon: '🔬' },
};

const GRADE_LABEL: Record<number, string> = { 1: '중1', 2: '중2', 3: '중3' };

export default function WorkbooksPage() {
  const [tab, setTab] = useState<'nj' | 'school'>('nj');
  const [exams, setExams] = useState<ExamMeta[]>([]);
  const [schoolExams, setSchoolExams] = useState<SchoolExamMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [gradeFilter, setGradeFilter] = useState<string>('');
  const [unitFilter, setUnitFilter] = useState<string>('');
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

  // ── n제 문제집 ─────────────────────────────────────────────────
  const grades = [...new Set(exams.map(e => e.grade).filter(Boolean))].sort() as number[];
  const units = [...new Set(
    exams.filter(e => !gradeFilter || String(e.grade) === gradeFilter).map(e => e.unit).filter(Boolean)
  )];

  const filteredExams = exams.filter(e => {
    if (gradeFilter && String(e.grade) !== gradeFilter) return false;
    if (unitFilter && e.unit !== unitFilter) return false;
    return true;
  });

  // Group by unit
  const examsByUnit: Record<string, ExamMeta[]> = {};
  for (const e of filteredExams) {
    const key = e.unit ?? '기타';
    if (!examsByUnit[key]) examsByUnit[key] = [];
    examsByUnit[key].push(e);
  }
  const DIFF_ORDER = ['기본', '유형별', '심화', '킬러'];
  for (const unit of Object.keys(examsByUnit)) {
    examsByUnit[unit].sort((a, b) => {
      const ai = DIFF_ORDER.indexOf(a.difficulty ?? '');
      const bi = DIFF_ORDER.indexOf(b.difficulty ?? '');
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    });
  }

  // ── 단원별 내신기출 ────────────────────────────────────────────
  const schoolSubjects = [...new Set(schoolExams.map(s => s.subject))];
  const filteredSchool = subjectFilter
    ? schoolExams.filter(s => s.subject === subjectFilter)
    : schoolExams;
  const schoolBySubject: Record<string, SchoolExamMeta[]> = {};
  for (const s of filteredSchool) {
    if (!schoolBySubject[s.subject]) schoolBySubject[s.subject] = [];
    schoolBySubject[s.subject].push(s);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">📒 문제집</h1>
        <p className="text-gray-500 text-sm mt-1">단원별 집중 훈련 문제집과 내신기출 문제를 풀어보세요.</p>
      </div>

      {/* 탭 */}
      <div className="flex border-b border-gray-200 gap-1">
        {[
          { key: 'nj', label: '스터디랩스 n제 문제집' },
          { key: 'school', label: '단원별 내신기출 문제집' },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key as 'nj' | 'school')}
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

      {loading ? (
        <div className="text-center py-16 text-gray-400">불러오는 중...</div>
      ) : tab === 'nj' ? (
        /* ── n제 문제집 ── */
        <div className="space-y-5">
          {/* 필터 */}
          <div className="flex gap-2 flex-wrap">
            <select
              value={gradeFilter}
              onChange={e => { setGradeFilter(e.target.value); setUnitFilter(''); }}
              className="px-3 py-1.5 text-sm border border-gray-200 rounded-xl bg-white text-gray-700 focus:outline-none focus:border-indigo-300"
            >
              <option value="">전체 학년</option>
              {grades.map(g => <option key={g} value={String(g)}>{GRADE_LABEL[g] ?? `${g}학년`}</option>)}
            </select>
            {gradeFilter && (
              <select
                value={unitFilter}
                onChange={e => setUnitFilter(e.target.value)}
                className="px-3 py-1.5 text-sm border border-gray-200 rounded-xl bg-white text-gray-700 focus:outline-none focus:border-indigo-300"
              >
                <option value="">전체 단원</option>
                {units.map(u => <option key={u!} value={u!}>{u}</option>)}
              </select>
            )}
          </div>

          {Object.keys(examsByUnit).length === 0 ? (
            <p className="text-center text-gray-400 py-12">해당 조건에 맞는 문제집이 없습니다.</p>
          ) : (
            Object.entries(examsByUnit).map(([unit, list]) => (
              <div key={unit} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-5 py-3 bg-gray-50 border-b border-gray-100">
                  <h3 className="font-bold text-gray-700">{unit}</h3>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {GRADE_LABEL[list[0].grade ?? 0] ?? ''} · {list.length}종
                  </p>
                </div>
                <div className="divide-y divide-gray-50">
                  {list.map(exam => (
                    <Link key={exam.id} href={`/practice/${exam.id}`}
                      className="flex items-center justify-between px-5 py-3.5 hover:bg-indigo-50 transition group">
                      <div>
                        <span className={`inline-block text-xs font-bold px-2 py-0.5 rounded-full mr-2 ${DIFF_COLOR[exam.difficulty ?? ''] ?? 'bg-gray-100 text-gray-600'}`}>
                          {exam.difficulty}
                        </span>
                        <span className="text-gray-700 text-sm font-medium group-hover:text-indigo-700 transition">
                          {exam.title}
                        </span>
                      </div>
                      <span className="text-xs text-gray-400 shrink-0 ml-3">{exam.questionCount}문제 →</span>
                    </Link>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      ) : (
        /* ── 단원별 내신기출 ── */
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

          {Object.entries(schoolBySubject).map(([subject, list]) => {
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
          })}
        </div>
      )}
    </div>
  );
}
