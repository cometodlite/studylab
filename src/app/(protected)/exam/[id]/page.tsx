'use client';

import { useEffect, useState, use, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { getIdToken } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import MathText from '@/components/MathText';

type MCQuestion = { id: number; type: 'mc'; score: number; question: string; choices: string[] };
type EssayQuestion = { id: number; type: 'essay' | 'short'; score: number; question: string; rubric?: string };
type Question = MCQuestion | EssayQuestion;

function qLabel(type: string) {
  if (type === 'mc') return '객관식';
  if (type === 'short') return '주관식';
  return '서술형';
}

interface ExamData {
  id: string;
  title: string;
  sheet: number;
  timeLimit: number;
  totalScore: number;
  scorePerMC: number;
  scorePerEssay: number;
  questions: Question[];
  passage?: string;
}

interface GradeResult {
  id: number;
  type: string;
  question: string;
  choices?: string[];
  yourAnswer?: number | string;
  correctAnswer?: number | string;
  correct: boolean;
  score: number;
  earnedScore: number;
  explanation?: string;
  modelAnswer?: string;
  rubric?: string;
}

interface GradeResponse {
  mcScore: number;
  essayScore: number;
  totalScore: number;
  maxScore: number;
  pointsEarned: number;
  alreadyRewarded: boolean;
  results: GradeResult[];
}

export default function SchoolExamPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { user, refreshProfile } = useAuth();

  const [exam, setExam] = useState<ExamData | null>(null);
  const [current, setCurrent] = useState(0);
  const [mcAnswers, setMcAnswers] = useState<Record<number, number>>({});
  const [essayAnswers, setEssayAnswers] = useState<Record<number, string>>({});
  const [gradeResult, setGradeResult] = useState<GradeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [timesUp, setTimesUp] = useState(false);
  const autoSubmitRef = useRef(false);

  const startTimeRef = useRef<number>(0);
  const questionStartTimeRef = useRef<number>(0);
  const questionTimingsRef = useRef<Record<number, number>>({});

  useEffect(() => {
    fetch(`/api/school-exams/${id}`)
      .then(r => r.json())
      .then(data => {
        setExam(data);
        setTimeLeft(data.timeLimit * 60);
        startTimeRef.current = Date.now();
        questionStartTimeRef.current = Date.now();
        questionTimingsRef.current = {};
        setLoading(false);
      });
  }, [id]);

  useEffect(() => {
    if (!exam || gradeResult) return;
    const t = setInterval(() => {
      setTimeLeft(s => {
        if (s <= 1) {
          clearInterval(t);
          if (!autoSubmitRef.current) {
            autoSubmitRef.current = true;
            setTimesUp(true);
          }
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [exam, gradeResult]);

  useEffect(() => {
    if (timesUp && !gradeResult) handleSubmit();
  }, [timesUp]);

  useEffect(() => {
    if (!exam || gradeResult) return;
    return () => {
      // 페이지 이동 시 현재 문제의 시간 기록
      const currentQuestion = exam.questions[current];
      if (currentQuestion) {
        const elapsed = Math.round((Date.now() - questionStartTimeRef.current) / 1000);
        questionTimingsRef.current[currentQuestion.id] =
          (questionTimingsRef.current[currentQuestion.id] || 0) + elapsed;
      }
    };
  }, [current, exam, gradeResult]);

  function formatTime(s: number) {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  }

  async function handleSubmit() {
    if (!user || !exam || submitting) return;
    setSubmitting(true);
    try {
      // 마지막 문제의 시간도 기록
      const currentQuestion = exam.questions[current];
      if (currentQuestion) {
        const elapsed = Math.round((Date.now() - questionStartTimeRef.current) / 1000);
        questionTimingsRef.current[currentQuestion.id] =
          (questionTimingsRef.current[currentQuestion.id] || 0) + elapsed;
      }

      const totalTime = Math.round((Date.now() - startTimeRef.current) / 1000);

      const token = await getIdToken(auth.currentUser!);
      const res = await fetch(`/api/school-exams/${id}/grade`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          mcAnswers,
          essayAnswers,
          timings: questionTimingsRef.current,
          totalTime,
        }),
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
    const pct = Math.round((gradeResult.totalScore / gradeResult.maxScore) * 100);
    const emoji = pct >= 90 ? '🏆' : pct >= 80 ? '🎉' : pct >= 70 ? '👍' : pct >= 60 ? '🙂' : '💪';
    return (
      <div className="space-y-6">
        <div className="bg-white rounded-2xl p-8 text-center shadow-sm border border-gray-100">
          <div className="text-5xl mb-3">{emoji}</div>
          <h1 className="text-2xl font-bold text-gray-800">{exam.title}</h1>
          <div className="text-5xl font-bold text-indigo-600 mt-4">
            {gradeResult.totalScore}<span className="text-2xl text-gray-400">/{gradeResult.maxScore}</span>
          </div>
          <div className="flex justify-center gap-6 mt-3 text-sm text-gray-600">
            <span>객관식 {gradeResult.mcScore}점</span>
            <span>{exam.questions.some(q => q.type === 'short') ? '주관식' : '서술형'} {gradeResult.essayScore}점</span>
          </div>
          <div className="text-gray-500 mt-1">{pct}%</div>

          {gradeResult.alreadyRewarded ? (
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mt-6 inline-block">
              <div className="text-sm font-semibold text-yellow-700">⚠️ 오늘 이미 포인트를 받은 시험입니다.</div>
              <div className="text-sm text-yellow-600 mt-0.5">내일 다시 응시하면 포인트를 받을 수 있어요!</div>
            </div>
          ) : (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 mt-6 inline-block">
              <div className="text-2xl font-bold text-green-600">+{gradeResult.pointsEarned.toLocaleString()}p 획득!</div>
            </div>
          )}
        </div>

        <div className="space-y-4">
          {gradeResult.results.map((r, i) => (
            <div key={r.id} className={`bg-white rounded-xl p-5 border shadow-sm ${r.correct ? 'border-green-200' : 'border-red-200'}`}>
              <div className="flex items-start gap-2 mb-3">
                <span className="text-lg shrink-0">{r.correct ? '✅' : '❌'}</span>
                <div className="flex-1">
                  <span className="text-xs text-gray-400 font-medium uppercase">{qLabel(r.type)} {i + 1}번 · {r.earnedScore}/{r.score}점</span>
                  <p className="font-medium text-gray-800 mt-0.5">
                    <MathText text={r.question} />
                  </p>
                </div>
              </div>

              {r.type === 'mc' && r.choices && (
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
                      {ci + 1}. <MathText text={c} />
                    </div>
                  ))}
                </div>
              )}

              {(r.type === 'essay' || r.type === 'short') && (
                <div className="ml-7 space-y-2">
                  {r.yourAnswer && (
                    <div className="text-sm bg-gray-50 rounded-lg px-3 py-2">
                      <span className="font-medium text-gray-600">내 답안: </span>
                      <span className={r.correct ? 'text-green-700' : 'text-red-600'}>{String(r.yourAnswer)}</span>
                    </div>
                  )}
                  {r.modelAnswer && (
                    <div className="text-sm bg-green-50 rounded-lg px-3 py-2">
                      <span className="font-medium text-green-700">모범 답안: </span>
                      <MathText text={r.modelAnswer} />
                    </div>
                  )}
                  {r.rubric && (
                    <div className="text-sm bg-blue-50 rounded-lg px-3 py-2 text-blue-700">
                      <span className="font-medium">채점 기준: </span>
                      <MathText text={r.rubric} />
                    </div>
                  )}
                </div>
              )}

              {r.explanation && r.type === 'mc' && (
                <div className="mt-3 ml-7 text-sm text-gray-500 bg-gray-50 rounded-lg px-3 py-2">
                  💡 <MathText text={r.explanation} />
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="flex gap-3">
          <button onClick={() => router.push('/exam')} className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 rounded-xl transition">
            다른 회차 보기
          </button>
          <button onClick={() => router.push('/wrong-notes')} className="flex-1 border border-gray-200 hover:bg-gray-50 text-gray-700 font-semibold py-3 rounded-xl transition">
            오답노트 📝
          </button>
        </div>
      </div>
    );
  }

  const mcQuestions = exam.questions.filter(q => q.type === 'mc') as MCQuestion[];
  const essayQuestions = exam.questions.filter(q => q.type === 'essay' || q.type === 'short') as EssayQuestion[];
  const allQuestions = exam.questions;
  const q = allQuestions[current];
  const mcAnswered = Object.keys(mcAnswers).length;
  const essayAnswered = Object.keys(essayAnswers).filter(k => essayAnswers[Number(k)]?.trim()).length;
  const totalAnswered = mcAnswered + essayAnswered;
  const isUrgent = timeLeft <= 300; // 5분 이하

  return (
    <div className="space-y-4">
      {/* 헤더 */}
      <div className="flex items-center justify-between bg-white rounded-xl px-4 py-3 border border-gray-100 shadow-sm sticky top-16 z-30">
        <div>
          <h1 className="font-bold text-gray-800 text-sm">{exam.title}</h1>
          <p className="text-xs text-gray-500">{current + 1}/{allQuestions.length} · {qLabel(q.type)}</p>
        </div>
        <div className={`text-lg font-mono font-bold tabular-nums ${isUrgent ? 'text-red-600 animate-pulse' : 'text-gray-700'}`}>
          ⏱ {formatTime(timeLeft)}
        </div>
      </div>

      {/* 진행바 */}
      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-indigo-500 rounded-full transition-all"
          style={{ width: `${((current + 1) / allQuestions.length) * 100}%` }}
        />
      </div>

      {/* 본문 (영어) */}
      {exam.passage && (
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-6 shadow-sm">
          <div className="text-xs font-semibold text-blue-700 mb-3 uppercase">📖 본문</div>
          <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap font-mono">
            {exam.passage}
          </p>
        </div>
      )}

      {/* 문제 */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <div className="flex items-center gap-2 mb-4">
          <span className={`text-xs font-semibold rounded-full px-2.5 py-0.5 ${q.type === 'mc' ? 'bg-indigo-100 text-indigo-700' : 'bg-purple-100 text-purple-700'}`}>
            {q.type === 'mc' ? `객관식 ${mcQuestions.findIndex(m => m.id === q.id) + 1}` : `${qLabel(q.type)} ${essayQuestions.findIndex(e => e.id === q.id) + 1}`}
          </span>
          <span className="text-xs text-gray-400">{q.score}점</span>
        </div>

        <p className="font-semibold text-gray-800 text-base mb-5">
          {current + 1}. <MathText text={q.question} />
        </p>

        {q.type === 'mc' && (
          <div className="space-y-2">
            {(q as MCQuestion).choices.map((c, ci) => (
              <button
                key={ci}
                onClick={() => setMcAnswers(prev => ({ ...prev, [q.id]: ci }))}
                className={`w-full text-left px-4 py-3 rounded-xl text-sm transition border ${
                  mcAnswers[q.id] === ci
                    ? 'border-indigo-500 bg-indigo-50 text-indigo-700 font-semibold'
                    : 'border-gray-200 hover:border-indigo-300 hover:bg-indigo-50 text-gray-700'
                }`}
              >
                {ci + 1}. <MathText text={c} />
              </button>
            ))}
          </div>
        )}

        {q.type === 'essay' && (
          <div>
            {(q as EssayQuestion).rubric && (
              <div className="text-xs text-blue-600 bg-blue-50 rounded-lg px-3 py-2 mb-3">
                📌 <MathText text={(q as EssayQuestion).rubric!} />
              </div>
            )}
            <textarea
              value={essayAnswers[q.id] ?? ''}
              onChange={e => setEssayAnswers(prev => ({ ...prev, [q.id]: e.target.value }))}
              placeholder="풀이 과정과 답을 서술하세요..."
              rows={5}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none"
            />
          </div>
        )}

        {q.type === 'short' && (
          <div>
            {(q as EssayQuestion).rubric && (
              <div className="text-xs text-blue-600 bg-blue-50 rounded-lg px-3 py-2 mb-3">
                📌 <MathText text={(q as EssayQuestion).rubric!} />
              </div>
            )}
            <input
              type="text"
              value={essayAnswers[q.id] ?? ''}
              onChange={e => setEssayAnswers(prev => ({ ...prev, [q.id]: e.target.value }))}
              placeholder="답을 입력하세요..."
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-300"
            />
          </div>
        )}
      </div>

      {/* 문항 네비게이션 */}
      <div className="bg-white rounded-xl p-3 border border-gray-100 shadow-sm">
        <p className="text-xs text-gray-400 mb-2">객관식</p>
        <div className="flex flex-wrap gap-1.5 mb-3">
          {mcQuestions.map((qq, i) => (
            <button
              key={qq.id}
              onClick={() => setCurrent(allQuestions.indexOf(qq))}
              className={`w-8 h-8 rounded-lg text-xs font-semibold transition ${
                allQuestions.indexOf(qq) === current ? 'bg-indigo-600 text-white'
                  : mcAnswers[qq.id] !== undefined ? 'bg-indigo-100 text-indigo-700'
                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
            >
              {i + 1}
            </button>
          ))}
        </div>
        <p className="text-xs text-gray-400 mb-2">{exam.questions.some(q => q.type === 'short') ? '주관식' : '서술형'}</p>
        <div className="flex flex-wrap gap-1.5">
          {essayQuestions.map((qq, i) => (
            <button
              key={qq.id}
              onClick={() => setCurrent(allQuestions.indexOf(qq))}
              className={`w-8 h-8 rounded-lg text-xs font-semibold transition ${
                allQuestions.indexOf(qq) === current ? 'bg-purple-600 text-white'
                  : essayAnswers[qq.id]?.trim() ? 'bg-purple-100 text-purple-700'
                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
            >
              {i + 1}
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
          onClick={() => setCurrent(c => Math.min(allQuestions.length - 1, c + 1))}
          disabled={current === allQuestions.length - 1}
          className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition"
        >
          다음
        </button>
        <button
          onClick={() => {
            if (confirm(`${totalAnswered}/${allQuestions.length}문항 답안으로 제출하시겠습니까?`)) handleSubmit();
          }}
          disabled={submitting || totalAnswered === 0}
          className="ml-auto text-sm font-semibold px-5 py-2.5 rounded-xl transition disabled:opacity-50 bg-indigo-600 hover:bg-indigo-700 text-white"
        >
          {submitting ? '채점 중...' : `제출 (${totalAnswered}/${allQuestions.length})`}
        </button>
      </div>
    </div>
  );
}
