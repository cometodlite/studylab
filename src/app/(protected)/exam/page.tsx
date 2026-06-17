'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface SchoolExamMeta {
  id: string;
  title: string;
  school: string;
  grade: number;
  subject: string;
  sheet: number;
  difficulty: string;
  timeLimit: number;
  totalScore: number;
  mcCount: number;
  essayCount: number;
}

const DIFF_COLOR: Record<string, string> = {
  '보통': 'bg-blue-100 text-blue-700',
  '어려움': 'bg-orange-100 text-orange-700',
};

const SHEET_ICON = ['🌱', '📗', '📘', '📙', '🔥'];

const SUBJECT_META: Record<string, { icon: string; label: string; range: string }> = {
  '수학': { icon: '📐', label: '수학', range: '일차부등식의 활용 ~ 함수 (p60–p131)' },
  '과학': { icon: '🔬', label: '과학', range: 'Ⅲ. 빛과 파동 (p94–p133) · Ⅳ. 물질의 구성 (p134–p165)' },
  '역사': { icon: '📜', label: '역사', range: 'p8–15, p22–71, p75–76, p78–81, p86–92, p102–113' },
};

export default function ExamListPage() {
  const [exams, setExams] = useState<SchoolExamMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSubject, setActiveSubject] = useState<string>('수학');

  useEffect(() => {
    fetch('/api/school-exams')
      .then(r => r.json())
      .then(data => { setExams(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const subjects = [...new Set(exams.map(e => e.subject))];
  const filtered = exams.filter(e => e.subject === activeSubject);
  const meta = SUBJECT_META[activeSubject];

  if (loading) return <div className="text-center py-20 text-gray-400">불러오는 중...</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">📋 학교 시험</h1>
        <p className="text-gray-500 text-sm mt-1">
          부천일신중 2학년 1학기 2차 정기시험 모의고사
        </p>
      </div>

      {/* Subject tabs */}
      <div className="flex gap-2 flex-wrap">
        {subjects.map(sub => {
          const sm = SUBJECT_META[sub];
          return (
            <button
              key={sub}
              onClick={() => setActiveSubject(sub)}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition ${
                activeSubject === sub
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {sm?.icon ?? '📄'} {sub}
            </button>
          );
        })}
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
        <p className="font-semibold mb-1">⚠️ 시험 안내 — {meta?.icon} {meta?.label}</p>
        <ul className="space-y-0.5 text-amber-700">
          <li>· 시험 시간 <strong>40분</strong> — 시간 조정 불가</li>
          <li>· 5지선다 <strong>20문항</strong> (각 4점) + 서술형 <strong>5문항</strong> (각 4점) = 100점</li>
          {meta && <li>· 범위: {meta.range}</li>}
          <li>· 점수에 따라 포인트 지급 (90점↑ 500p · 80점↑ 350p · 70점↑ 250p · 60점↑ 150p · 50점↑ 100p · 50점 미만 50p)</li>
          <li>· 하루 1회 포인트 지급</li>
        </ul>
      </div>

      <div className="grid gap-4">
        {filtered.map((exam, idx) => (
          <div key={exam.id} className="bg-white rounded-xl border border-gray-200 p-5 flex items-center justify-between shadow-sm">
            <div className="flex items-start gap-4">
              <div className="text-3xl mt-0.5">{SHEET_ICON[idx] ?? '📄'}</div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-bold text-gray-700">{exam.sheet}회</span>
                  <span className={`text-xs rounded-full px-2 py-0.5 font-semibold ${DIFF_COLOR[exam.difficulty] ?? 'bg-gray-100 text-gray-600'}`}>
                    {exam.difficulty}
                  </span>
                </div>
                <h2 className="font-bold text-gray-800">{exam.title}</h2>
                <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
                  <span>⏱ {exam.timeLimit}분</span>
                  <span>📝 객관식 {exam.mcCount}문항 + 서술형 {exam.essayCount}문항</span>
                  <span>🏆 {exam.totalScore}점 만점</span>
                </div>
              </div>
            </div>
            <Link
              href={`/exam/${exam.id}`}
              className="shrink-0 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition"
            >
              응시하기
            </Link>
          </div>
        ))}

        {filtered.length === 0 && (
          <div className="text-center py-16 text-gray-400">
            <div className="text-4xl mb-3">📭</div>
            <p>시험 문항을 불러올 수 없습니다.</p>
          </div>
        )}
      </div>
    </div>
  );
}
