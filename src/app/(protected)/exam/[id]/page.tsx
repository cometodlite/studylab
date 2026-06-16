'use client';

import { useEffect, useState, use } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { getIdToken } from 'firebase/auth';
import { auth } from '@/lib/firebase';

interface Question {
  id: number;
  question: string;
  choices: string[];
}

interface GradeResult {
  id: number;
  question: string;
  choices: string[];
  yourAnswer: number;
  correctAnswer: number;
  correct: boolean;
  explanation: string;
}

interface GradeResponse {
  score: number;
  total: number;
  pointsEarned: number;
  reasons: string[];
  results: GradeResult[];
}

export default function ExamPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, refreshProfile } = useAuth();

  const [exam, setExam] = useState<{ title: string; questions: Question[] } | null>(null);
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [gradeResult, setGradeResult] = useState<GradeResponse | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const qs = new URLSearchParams();
    const count = searchParams.get('count');
    const shuffle = searchParams.get('shuffle');
    if (count) qs.set('count', count);
    if (shuffle) qs.set('shuffle', shuffle);

    fetch(`/api/exams/${id}?${qs}`)
      .then(r => r.json())
      .then(data => { setExam(data); setLoading(false); });
  }, [id]);

  useEffect(() => {
    if (!exam || gradeResult) return;
    const t = setInterval(() => setElapsed(s => s + 1), 1000);
    return () => clearInterval(t);
  }, [exam, gradeResult]);

  function formatTime(s: number) {
    return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  }

  function selectAnswer(qId: number, idx: number) {
    setAnswers(prev => ({ ...prev, [qId]: idx }));
    if (current < (exam?.questions.length ?? 0) - 1) {
      setTimeout(() => setCurrent(c => c + 1), 300);
    }
  }

  async function handleSubmit() {
    if (!user || !exam) return;
    setSubmitting(true);
    try {
      const token = await getIdToken(auth.currentUser!);
      const res = await fetch(`/api/exams/${id}/grade`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ answers }),
      });
      const data = await res.json();
      setGradeResult(data);
      await refreshProfile();
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <div className="text-center py-20 text-gray-400">시험 불러오는 중...</div>;
  if (!exam) return <div className="text-center py-20 text-gray-400">시험을 찾을 수 없습니다.</div>;

  // 결과 화면
  if (gradeResult) {
    const pct = Math.round((gradeResult.score / gradeResult.total) * 100);
    return (
      <div className="space-y-6">
        <div className="bg-white rounded-2xl p-8 text-center shadow-sm border border-gray-100">
          <div className="text-5xl mb-3">{pct === 100 ? '🏆' : pct >= 80 ? '🎉' : pct >= 60 ? '👍' : '💪'}</div>
          <h1 className="text-2xl font-bold text-gray-800">{exam.title} 결과</h1>
          <div className="text-5xl font-bold text-indigo-600 mt-4">{gradeResult.score}/{gradeResult.total}</div>
          <div className="text-gray-500 mt-1">{pct}% 정답</div>

          <div className="bg-green-50 border border-green-200 rounded-xl p-4 mt-6 inline-block">
            <div className="text-2xl font-bold text-green-600">+{gradeResult.pointsEarned}p 획득!</div>
            <div className="text-sm text-green-700 mt-1">{gradeResult.reasons.join(' · ')}</div>
          </div>
        </div>

        <div className="space-y-4">
          {gradeResult.results.map((r, i) => (
            <div key={r.id} className={`bg-white rounded-xl p-5 border shadow-sm ${r.correct ? 'border-green-200' : 'border-red-200'}`}>
              <div className="flex items-start gap-2 mb-3">
                <span className={`text-lg ${r.correct ? '✅' : '❌'}`}>{r.correct ? '✅' : '❌'}</span>
                <span className="font-medium text-gray-800">{i + 1}. {r.question}</span>
              </div>
              <div className="space-y-1 ml-7">
                {r.choices.map((c, ci) => (
                  <div
                    key={ci}
                    className={`text-sm px-3 py-1.5 rounded-lg ${
                      ci === r.correctAnswer ? 'bg-green-100 text-green-800 font-semibold'
                        : ci === r.yourAnswer && !r.correct ? 'bg-red-100 text-red-700 line-through'
                        : 'text-gray-600'
                    }`}
                  >
                    {ci + 1}. {c}
                  </div>
                ))}
              </div>
              {r.explanation && (
                <div className="mt-3 ml-7 text-sm text-gray-500 bg-gray-50 rounded-lg px-3 py-2">
                  💡 {r.explanation}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="flex gap-3">
          <button onClick={() => router.push('/exam')} className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 rounded-xl transition">
            다른 시험 풀기
          </button>
          <button onClick={() => router.push('/store')} className="flex-1 border border-gray-200 hover:bg-gray-50 text-gray-700 font-semibold py-3 rounded-xl transition">
            상점 가기 🎁
          </button>
        </div>
      </div>
    );
  }

  const q = exam.questions[current];
  const answered = Object.keys(answers).length;

  return (
    <div className="space-y-5">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-bold text-gray-800">{exam.title}</h1>
          <p className="text-sm text-gray-500">{current + 1} / {exam.questions.length}문제</p>
        </div>
        <div className="text-sm text-gray-400 font-mono">{formatTime(elapsed)}</div>
      </div>

      {/* 진행바 */}
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-indigo-500 rounded-full transition-all"
          style={{ width: `${((current + 1) / exam.questions.length) * 100}%` }}
        />
      </div>

      {/* 문제 */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <p className="font-semibold text-gray-800 text-base mb-5">{current + 1}. {q.question}</p>
        <div className="space-y-2">
          {q.choices.map((c, ci) => (
            <button
              key={ci}
              onClick={() => selectAnswer(q.id, ci)}
              className={`w-full text-left px-4 py-3 rounded-xl text-sm transition border ${
                answers[q.id] === ci
                  ? 'border-indigo-500 bg-indigo-50 text-indigo-700 font-semibold'
                  : 'border-gray-200 hover:border-indigo-300 hover:bg-indigo-50 text-gray-700'
              }`}
            >
              {ci + 1}. {c}
            </button>
          ))}
        </div>
      </div>

      {/* 이전/다음 + 제출 */}
      <div className="flex gap-3">
        <button
          onClick={() => setCurrent(c => Math.max(0, c - 1))}
          disabled={current === 0}
          className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition"
        >
          이전
        </button>
        <button
          onClick={() => setCurrent(c => Math.min(exam.questions.length - 1, c + 1))}
          disabled={current === exam.questions.length - 1}
          className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition"
        >
          다음
        </button>
        <button
          onClick={handleSubmit}
          disabled={submitting || answered === 0}
          className="ml-auto bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition disabled:opacity-50"
        >
          {submitting ? '채점 중...' : `제출 (${answered}/${exam.questions.length})`}
        </button>
      </div>
    </div>
  );
}
