'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { getIdToken } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import MathText from '@/components/MathText';

interface GeneratedQuestion {
  id: number;
  question: string;
  choices: string[];
  answer: number;
  explanation?: string;
  unit?: string;
}

interface GeneratedExam {
  title: string;
  grade: number;
  units: string[];
  difficulties: string[];
  questions: GeneratedQuestion[];
  totalPoolSize: number;
}

interface QuestionResult {
  id: number;
  question: string;
  choices: string[];
  yourAnswer: number;
  correctAnswer: number;
  correct: boolean;
  explanation?: string;
  unit?: string;
}

interface GradeResponse {
  pointsEarned: number;
  alreadyRewarded: boolean;
  reasons: string[];
}

export default function ExamSessionPage() {
  const router = useRouter();
  const { user, refreshProfile } = useAuth();

  const [exam, setExam] = useState<GeneratedExam | null>(null);
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [gradeResponse, setGradeResponse] = useState<GradeResponse | null>(null);
  const [gradeResults, setGradeResults] = useState<QuestionResult[]>([]);
  const [elapsed, setElapsed] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const startTimeRef = useRef(Date.now());

  useEffect(() => {
    const raw = sessionStorage.getItem('generated-exam');
    if (!raw) { router.replace('/exam'); return; }
    try {
      const data = JSON.parse(raw) as GeneratedExam;
      setExam(data);
      startTimeRef.current = Date.now();
    } catch {
      router.replace('/exam');
    }
  }, [router]);

  useEffect(() => {
    if (!exam || gradeResponse) return;
    const t = setInterval(() => setElapsed(s => s + 1), 1000);
    return () => clearInterval(t);
  }, [exam, gradeResponse]);

  function formatTime(s: number) {
    return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  }

  function selectAnswer(qId: number, idx: number) {
    setAnswers(prev => ({ ...prev, [qId]: idx }));
    if (exam && current < exam.questions.length - 1) {
      setTimeout(() => setCurrent(c => c + 1), 300);
    }
  }

  const handleSubmit = useCallback(async () => {
    if (!user || !exam || submitting) return;
    setSubmitting(true);
    try {
      const results: QuestionResult[] = exam.questions.map(q => ({
        id: q.id,
        question: q.question,
        choices: q.choices,
        yourAnswer: answers[q.id] ?? -1,
        correctAnswer: q.answer,
        correct: answers[q.id] === q.answer,
        explanation: q.explanation,
        unit: q.unit,
      }));

      const score = results.filter(r => r.correct).length;
      const totalTime = Math.round((Date.now() - startTimeRef.current) / 1000);

      const token = await getIdToken(auth.currentUser!);
      const res = await fetch('/api/exams/session/grade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          title: exam.title,
          grade: exam.grade,
          units: exam.units,
          difficulties: exam.difficulties,
          score,
          total: exam.questions.length,
          totalTime,
          results,
        }),
      });
      const data = await res.json() as GradeResponse;
      setGradeResults(results);
      setGradeResponse(data);
      await refreshProfile();
    } finally {
      setSubmitting(false);
    }
  }, [answers, exam, refreshProfile, submitting, user]);

  if (!exam) return <div className="text-center py-20 text-gray-400">불러오는 중...</div>;

  // 결과 화면
  if (gradeResponse) {
    const score = gradeResults.filter(r => r.correct).length;
    const total = gradeResults.length;
    const pct = Math.round((score / total) * 100);
    const emoji = pct === 100 ? '🏆' : pct >= 80 ? '🎉' : pct >= 60 ? '👍' : '💪';

    return (
      <div className="space-y-6">
        <div className="bg-white rounded-2xl p-8 text-center shadow-sm border border-gray-100">
          <div className="text-5xl mb-3">{emoji}</div>
          <h1 className="text-xl font-bold text-gray-800">{exam.title}</h1>
          <div className="text-5xl font-bold text-indigo-600 mt-4">
            {score}<span className="text-2xl text-gray-400">/{total}</span>
          </div>
          <div className="text-gray-500 mt-1">{pct}% 정답</div>

          {gradeResponse.alreadyRewarded ? (
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mt-6 inline-block">
              <div className="text-sm font-semibold text-yellow-700">⚠️ 오늘 이미 이 범위의 포인트를 받았습니다.</div>
              <div className="text-sm text-yellow-600 mt-0.5">내일 다시 도전하면 포인트를 받을 수 있어요!</div>
            </div>
          ) : (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 mt-6 inline-block">
              <div className="text-2xl font-bold text-green-600">+{gradeResponse.pointsEarned.toLocaleString()}p 획득!</div>
              <div className="text-sm text-green-700 mt-1">{gradeResponse.reasons.join(' · ')}</div>
            </div>
          )}
        </div>

        <div className="space-y-4">
          {gradeResults.map((r, i) => (
            <div key={r.id} className={`bg-white rounded-xl p-5 border shadow-sm ${r.correct ? 'border-green-200' : 'border-red-200'}`}>
              <div className="flex items-start gap-2 mb-3">
                <span className="text-lg shrink-0">{r.correct ? '✅' : '❌'}</span>
                <div>
                  {r.unit && <span className="text-xs text-gray-400 font-medium">{r.unit} · </span>}
                  <span className="font-medium text-gray-800">{i + 1}. <MathText text={r.question} /></span>
                </div>
              </div>
              <div className="space-y-1 ml-7">
                {r.choices.map((c, ci) => (
                  <div key={ci} className={`text-sm px-3 py-1.5 rounded-lg ${
                    ci === r.correctAnswer ? 'bg-green-100 text-green-800 font-semibold'
                      : ci === r.yourAnswer && !r.correct ? 'bg-red-100 text-red-700 line-through'
                      : 'text-gray-600'
                  }`}>
                    {ci + 1}. <MathText text={c} />
                  </div>
                ))}
                {r.yourAnswer === -1 && (
                  <div className="text-sm px-3 py-1.5 rounded-lg bg-gray-100 text-gray-500">
                    ⊘ 잘 모르겠음으로 건너뜀
                  </div>
                )}
              </div>
              {r.explanation && (
                <div className="mt-3 ml-7 text-sm text-gray-500 bg-gray-50 rounded-lg px-3 py-2">
                  💡 <MathText text={r.explanation} />
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => router.push('/exam')}
            className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 rounded-xl transition"
          >
            새 시험 만들기
          </button>
          <button
            onClick={() => router.push('/wrong-notes')}
            className="flex-1 border border-gray-200 hover:bg-gray-50 text-gray-700 font-semibold py-3 rounded-xl transition"
          >
            오답노트 📝
          </button>
        </div>
      </div>
    );
  }

  const q = exam.questions[current];
  const answered = Object.keys(answers).length;
  const allAnswered = answered === exam.questions.length;

  return (
    <div className="space-y-5">
      {/* 헤더 */}
      <div className="flex items-center justify-between bg-white rounded-xl px-4 py-3 border border-gray-100 shadow-sm sticky top-16 z-30">
        <div>
          <h1 className="font-bold text-gray-800 text-sm">{exam.title}</h1>
          <p className="text-xs text-gray-500">{current + 1}/{exam.questions.length} {q.unit && `· ${q.unit}`}</p>
        </div>
        <div className="text-sm text-gray-500 font-mono">{formatTime(elapsed)}</div>
      </div>

      {/* 진행바 */}
      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-indigo-500 rounded-full transition-all"
          style={{ width: `${((current + 1) / exam.questions.length) * 100}%` }}
        />
      </div>

      {/* 문제 */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <p className="font-semibold text-gray-800 text-base mb-5">
          {current + 1}. <MathText text={q.question} />
        </p>
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
              {ci + 1}. <MathText text={c} />
            </button>
          ))}
          <button
            onClick={() => selectAnswer(q.id, -1)}
            className={`w-full text-left px-4 py-3 rounded-xl text-sm transition border ${
              answers[q.id] === -1
                ? 'border-gray-400 bg-gray-100 text-gray-600 font-semibold'
                : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50 text-gray-500'
            }`}
          >
            6. 잘 모르겠음
          </button>
        </div>
      </div>

      {/* 문항 네비게이션 */}
      <div className="flex flex-wrap gap-1.5">
        {exam.questions.map((qq, i) => (
          <button
            key={qq.id}
            onClick={() => setCurrent(i)}
            className={`w-8 h-8 rounded-lg text-xs font-semibold transition ${
              i === current ? 'bg-indigo-600 text-white'
                : answers[qq.id] === -1 ? 'bg-gray-200 text-gray-500'
                : answers[qq.id] !== undefined ? 'bg-indigo-100 text-indigo-700'
                : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            }`}
          >
            {i + 1}
          </button>
        ))}
      </div>

      {/* 이전/다음/제출 */}
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
          onClick={() => { if (confirm('모든 문항의 답안을 제출하고 채점하시겠습니까?')) handleSubmit(); }}
          disabled={submitting || answered < exam.questions.length}
          title={answered < exam.questions.length ? `모든 문항에 답하거나 '잘 모르겠음'을 선택해야 합니다. (${answered}/${exam.questions.length})` : undefined}
          className={`ml-auto text-sm font-semibold px-5 py-2.5 rounded-xl transition disabled:opacity-50 ${
            allAnswered ? 'bg-indigo-600 hover:bg-indigo-700 text-white' : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
          }`}
        >
          {submitting ? '채점 중...' : `제출 (${answered}/${exam.questions.length})${allAnswered ? ' ✓' : ''}`}
        </button>
      </div>
    </div>
  );
}
