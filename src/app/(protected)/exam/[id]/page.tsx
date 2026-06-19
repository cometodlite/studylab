'use client';

import { useCallback, useEffect, useState, use, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { getIdToken } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import MathText from '@/components/MathText';
import type { UserAchievement } from '@/lib/achievements';
import type { GoalAlert } from '@/lib/notifications';

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
  category: string;
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
  timeSpent?: number;
}

interface CategoryStat {
  category: string;
  correct: number;
  total: number;
  earnedScore: number;
  totalScore: number;
  totalTime: number;
  accuracy: number;
  scoreRate: number;
  avgTime: number;
}

interface TrendPoint {
  sessionId: string;
  examId: string;
  examTitle: string;
  sheet: number | null;
  totalScore: number;
  maxScore: number;
  scoreRate: number;
  completedAt: { seconds: number } | null;
}

interface RecommendedSet {
  id: string;
  title: string;
  description: string;
  href: string;
  source: 'practice' | 'school_exam';
  difficulty: string | null;
  unit: string | null;
  questionCount: number;
  reason: string;
}

interface LearningPathStep {
  title: string;
  description: string;
  href?: string;
}

interface GradeResponse {
  mcScore: number;
  essayScore: number;
  totalScore: number;
  maxScore: number;
  pointsEarned: number;
  achievementPointsEarned?: number;
  achievementsUnlocked?: UserAchievement[];
  goalAlerts?: GoalAlert[];
  alreadyRewarded: boolean;
  results: GradeResult[];
  analysis?: {
    mcCorrectCount: number;
    mcTotalCount: number;
    essayCorrectCount: number;
    essayTotalCount: number;
    avgTimePerQuestion: number;
    totalTimeSpent: number;
    totalAccuracy: number;
    categoryStats: CategoryStat[];
    questionBreakdown: Array<{
      id: number;
      type: string;
      category: string;
      correct: boolean;
      earnedScore: number;
      score: number;
      timeSpent: number;
    }>;
    weakestCategories: CategoryStat[];
    feedback: string[];
    trend: TrendPoint[];
    recommendations?: {
      summary: string;
      recommendedSets: RecommendedSet[];
      learningPath: LearningPathStep[];
    };
  };
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
  const autoSubmitRef = useRef(false);
  const handleSubmitRef = useRef<() => Promise<void>>(async () => {});

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
        autoSubmitRef.current = false;
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
            window.setTimeout(() => {
              void handleSubmitRef.current();
            }, 0);
          }
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [exam, gradeResult]);

  useEffect(() => {
    if (!gradeResult?.goalAlerts?.length) return;
    gradeResult.goalAlerts.forEach(alert => {
      window.dispatchEvent(new CustomEvent('studylab:notify', {
        detail: { ...alert, variant: 'goal' },
      }));
    });
  }, [gradeResult]);

  function formatTime(s: number) {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  }

  const recordCurrentQuestionTime = useCallback(() => {
    if (!exam || gradeResult) return;
    const currentQuestion = exam.questions[current];
    if (!currentQuestion) return;

    const elapsed = Math.max(0, Math.round((Date.now() - questionStartTimeRef.current) / 1000));
    questionTimingsRef.current[currentQuestion.id] =
      (questionTimingsRef.current[currentQuestion.id] || 0) + elapsed;
    questionStartTimeRef.current = Date.now();
  }, [current, exam, gradeResult]);

  function goToQuestion(nextIndex: number) {
    if (nextIndex === current) return;
    recordCurrentQuestionTime();
    setCurrent(nextIndex);
  }

  const handleSubmit = useCallback(async () => {
    if (!user || !exam || submitting) return;
    setSubmitting(true);
    try {
      recordCurrentQuestionTime();

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
  }, [essayAnswers, exam, id, mcAnswers, recordCurrentQuestionTime, refreshProfile, submitting, user]);

  useEffect(() => {
    handleSubmitRef.current = handleSubmit;
  }, [handleSubmit]);

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

        {gradeResult.achievementsUnlocked && gradeResult.achievementsUnlocked.length > 0 && (
          <div className="bg-gradient-to-r from-yellow-50 via-white to-indigo-50 rounded-2xl p-6 border border-yellow-200 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
              <div>
                <p className="text-xs font-bold text-yellow-600 uppercase">Achievement Unlocked</p>
                <h2 className="text-xl font-bold text-gray-800 mt-1">새 업적을 달성했습니다!</h2>
              </div>
              <div className="text-sm font-semibold text-green-600">
                +{(gradeResult.achievementPointsEarned ?? 0).toLocaleString()}p 보너스
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {gradeResult.achievementsUnlocked.map(achievement => (
                <div key={achievement.id} className="bg-white rounded-xl border border-yellow-100 px-4 py-4">
                  <div className="text-4xl mb-2">{achievement.emoji}</div>
                  <p className="font-bold text-gray-800">{achievement.title}</p>
                  <p className="text-xs text-gray-500 mt-1">{achievement.detail ?? achievement.description}</p>
                  <p className="text-xs font-semibold text-green-600 mt-3">+{achievement.points.toLocaleString()}p</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {gradeResult.analysis && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-bold text-gray-800">취약점 분석</h2>
                <span className="text-xs text-gray-400">정답률 {gradeResult.analysis.totalAccuracy.toFixed(1)}%</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-indigo-50 px-4 py-3">
                  <p className="text-xs text-indigo-500 font-semibold">객관식 정답률</p>
                  <p className="text-xl font-bold text-indigo-700 mt-1">
                    {gradeResult.analysis.mcCorrectCount}/{gradeResult.analysis.mcTotalCount}
                  </p>
                </div>
                <div className="rounded-xl bg-purple-50 px-4 py-3">
                  <p className="text-xs text-purple-500 font-semibold">{exam.questions.some(q => q.type === 'short') ? '주관식' : '서술형'} 정답률</p>
                  <p className="text-xl font-bold text-purple-700 mt-1">
                    {gradeResult.analysis.essayCorrectCount}/{gradeResult.analysis.essayTotalCount}
                  </p>
                </div>
              </div>
              <div className="space-y-3">
                {gradeResult.analysis.categoryStats.map(category => (
                  <div key={category.category}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-semibold text-gray-700">{category.category}</span>
                      <span className="text-gray-400">{category.correct}/{category.total} · {category.scoreRate.toFixed(1)}%</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${category.scoreRate >= 80 ? 'bg-green-500' : category.scoreRate >= 60 ? 'bg-yellow-500' : 'bg-red-500'}`}
                        style={{ width: `${Math.max(4, category.scoreRate)}%` }}
                      />
                    </div>
                    <p className="text-xs text-gray-400 mt-1">평균 풀이 시간 {formatTime(category.avgTime)}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm space-y-4">
              <h2 className="font-bold text-gray-800">맞춤 피드백</h2>
              <div className="space-y-2">
                {gradeResult.analysis.feedback.map(item => (
                  <div key={item} className="rounded-xl bg-gray-50 px-4 py-3 text-sm text-gray-700">
                    {item}
                  </div>
                ))}
              </div>
              <div className="border-t border-gray-100 pt-4">
                <p className="text-sm font-semibold text-gray-700 mb-3">문제별 정답률</p>
                <div className="grid grid-cols-5 sm:grid-cols-10 gap-1.5">
                  {gradeResult.analysis.questionBreakdown.map(question => (
                    <div
                      key={question.id}
                      className={`h-9 rounded-lg flex items-center justify-center text-xs font-bold ${
                        question.correct ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
                      }`}
                      title={`${question.id}번 ${question.earnedScore}/${question.score}점`}
                    >
                      {question.id}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {gradeResult.analysis.trend.length > 0 && (
              <div className="lg:col-span-2 bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
                <div className="flex items-center justify-between gap-3 mb-4">
                  <h2 className="font-bold text-gray-800">회차별 성적 추이</h2>
                  <span className="text-xs text-gray-400">최근 {gradeResult.analysis.trend.length}회</span>
                </div>
                <div className="flex items-end gap-2 h-40 border-b border-gray-100 pb-2">
                  {gradeResult.analysis.trend.map(point => (
                    <div key={point.sessionId} className="flex-1 min-w-0 flex flex-col items-center justify-end gap-2 h-full">
                      <div className="text-xs font-semibold text-indigo-600">{point.scoreRate.toFixed(0)}%</div>
                      <div
                        className="w-full max-w-12 rounded-t-lg bg-indigo-500"
                        style={{ height: `${Math.max(8, point.scoreRate)}%` }}
                      />
                    </div>
                  ))}
                </div>
                <div className="grid gap-2 mt-3" style={{ gridTemplateColumns: `repeat(${gradeResult.analysis.trend.length}, minmax(0, 1fr))` }}>
                  {gradeResult.analysis.trend.map(point => (
                    <div key={point.sessionId} className="text-center min-w-0">
                      <p className="text-xs text-gray-500 truncate">{point.sheet ? `${point.sheet}회` : '시험'}</p>
                      <p className="text-[10px] text-gray-400 truncate">{point.totalScore}/{point.maxScore}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {gradeResult.analysis?.recommendations && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 bg-white rounded-2xl p-5 border border-gray-100 shadow-sm space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-bold text-indigo-500 uppercase">AI Recommendation</p>
                  <h2 className="font-bold text-gray-800 mt-1">다음에 풀면 좋은 문제</h2>
                  <p className="text-sm text-gray-500 mt-1">{gradeResult.analysis.recommendations.summary}</p>
                </div>
              </div>
              {gradeResult.analysis.recommendations.recommendedSets.length === 0 ? (
                <div className="rounded-xl bg-gray-50 px-4 py-5 text-sm text-gray-500">
                  아직 추천할 유사 문제가 충분하지 않습니다. 오답노트에서 틀린 문항을 먼저 복습해보세요.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {gradeResult.analysis.recommendations.recommendedSets.map(item => (
                    <button
                      key={`${item.source}-${item.id}`}
                      onClick={() => router.push(item.href)}
                      className="text-left rounded-xl border border-gray-100 hover:border-indigo-200 hover:bg-indigo-50/40 px-4 py-4 transition"
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs font-semibold rounded-full bg-indigo-100 text-indigo-600 px-2 py-0.5">
                          {item.source === 'practice' ? '연습문제' : '실전회차'}
                        </span>
                        {item.difficulty && (
                          <span className="text-xs font-medium rounded-full bg-gray-100 text-gray-500 px-2 py-0.5">
                            {item.difficulty}
                          </span>
                        )}
                      </div>
                      <p className="font-bold text-gray-800 text-sm">{item.title}</p>
                      <p className="text-xs text-gray-500 mt-1 line-clamp-2">{item.reason}</p>
                      <p className="text-xs text-indigo-500 font-semibold mt-3">{item.questionCount}문항 풀기 →</p>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
              <h2 className="font-bold text-gray-800 mb-4">자동 학습 경로</h2>
              <div className="space-y-3">
                {gradeResult.analysis.recommendations.learningPath.map((step, index) => (
                  <button
                    key={`${step.title}-${index}`}
                    onClick={() => step.href && router.push(step.href)}
                    disabled={!step.href}
                    className="w-full text-left flex gap-3 rounded-xl bg-gray-50 hover:bg-gray-100 disabled:hover:bg-gray-50 px-3 py-3 transition"
                  >
                    <span className="w-7 h-7 shrink-0 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center">
                      {index + 1}
                    </span>
                    <span>
                      <span className="block text-sm font-bold text-gray-800">{step.title}</span>
                      <span className="block text-xs text-gray-500 mt-0.5">{step.description}</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

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
                  {r.yourAnswer === -1 && (
                    <div className="text-sm px-3 py-1.5 rounded-lg bg-gray-100 text-gray-500">
                      ⊘ 잘 모르겠음으로 건너뜀
                    </div>
                  )}
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
  const essayAnswered = essayQuestions.filter(q =>
    essayAnswers[q.id] === '__SKIP__' || !!essayAnswers[q.id]?.trim()
  ).length;
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
            <button
              onClick={() => setMcAnswers(prev => {
                if (prev[q.id] === -1) {
                  const next = { ...prev };
                  delete next[q.id];
                  return next;
                }
                return { ...prev, [q.id]: -1 };
              })}
              className={`w-full text-left px-4 py-3 rounded-xl text-sm transition border ${
                mcAnswers[q.id] === -1
                  ? 'border-gray-400 bg-gray-100 text-gray-600 font-semibold'
                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50 text-gray-500'
              }`}
            >
              6. 잘 모르겠음
            </button>
          </div>
        )}

        {q.type === 'essay' && (
          <div>
            {(q as EssayQuestion).rubric && (
              <div className="text-xs text-blue-600 bg-blue-50 rounded-lg px-3 py-2 mb-3">
                📌 <MathText text={(q as EssayQuestion).rubric!} />
              </div>
            )}
            {essayAnswers[q.id] === '__SKIP__' ? (
              <div className="w-full border border-gray-200 rounded-xl px-4 py-3 bg-gray-50 text-sm text-gray-400">
                잘 모르겠음으로 표시됨
              </div>
            ) : (
              <textarea
                value={essayAnswers[q.id] ?? ''}
                onChange={e => setEssayAnswers(prev => ({ ...prev, [q.id]: e.target.value }))}
                placeholder="풀이 과정과 답을 서술하세요..."
                rows={5}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none"
              />
            )}
            <button
              onClick={() => setEssayAnswers(prev => ({
                ...prev,
                [q.id]: prev[q.id] === '__SKIP__' ? '' : '__SKIP__',
              }))}
              className={`mt-2 px-4 py-2 rounded-xl text-sm transition border ${
                essayAnswers[q.id] === '__SKIP__'
                  ? 'border-gray-400 bg-gray-100 text-gray-600 font-semibold'
                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50 text-gray-500'
              }`}
            >
              잘 모르겠음
            </button>
          </div>
        )}

        {q.type === 'short' && (
          <div>
            {(q as EssayQuestion).rubric && (
              <div className="text-xs text-blue-600 bg-blue-50 rounded-lg px-3 py-2 mb-3">
                📌 <MathText text={(q as EssayQuestion).rubric!} />
              </div>
            )}
            {essayAnswers[q.id] === '__SKIP__' ? (
              <div className="w-full border border-gray-200 rounded-xl px-4 py-3 bg-gray-50 text-sm text-gray-400">
                잘 모르겠음으로 표시됨
              </div>
            ) : (
              <input
                type="text"
                value={essayAnswers[q.id] ?? ''}
                onChange={e => setEssayAnswers(prev => ({ ...prev, [q.id]: e.target.value }))}
                placeholder="답을 입력하세요..."
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-300"
              />
            )}
            <button
              onClick={() => setEssayAnswers(prev => ({
                ...prev,
                [q.id]: prev[q.id] === '__SKIP__' ? '' : '__SKIP__',
              }))}
              className={`mt-2 px-4 py-2 rounded-xl text-sm transition border ${
                essayAnswers[q.id] === '__SKIP__'
                  ? 'border-gray-400 bg-gray-100 text-gray-600 font-semibold'
                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50 text-gray-500'
              }`}
            >
              잘 모르겠음
            </button>
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
              onClick={() => goToQuestion(allQuestions.indexOf(qq))}
              className={`w-8 h-8 rounded-lg text-xs font-semibold transition ${
                allQuestions.indexOf(qq) === current ? 'bg-indigo-600 text-white'
                  : mcAnswers[qq.id] === -1 ? 'bg-gray-200 text-gray-500'
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
              onClick={() => goToQuestion(allQuestions.indexOf(qq))}
              className={`w-8 h-8 rounded-lg text-xs font-semibold transition ${
                allQuestions.indexOf(qq) === current ? 'bg-purple-600 text-white'
                  : essayAnswers[qq.id] === '__SKIP__' ? 'bg-gray-200 text-gray-500'
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
          onClick={() => goToQuestion(Math.max(0, current - 1))}
          disabled={current === 0}
          className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition"
        >
          이전
        </button>
        <button
          onClick={() => goToQuestion(Math.min(allQuestions.length - 1, current + 1))}
          disabled={current === allQuestions.length - 1}
          className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition"
        >
          다음
        </button>
        <button
          onClick={() => {
            if (confirm('모든 문항의 답안을 제출하고 채점하시겠습니까?')) handleSubmit();
          }}
          disabled={submitting || totalAnswered < allQuestions.length}
          title={totalAnswered < allQuestions.length ? `모든 문항에 답하거나 '잘 모르겠음'을 선택해야 제출할 수 있습니다. (${totalAnswered}/${allQuestions.length})` : undefined}
          className="ml-auto text-sm font-semibold px-5 py-2.5 rounded-xl transition disabled:opacity-50 bg-indigo-600 hover:bg-indigo-700 text-white"
        >
          {submitting ? '채점 중...' : `제출 (${totalAnswered}/${allQuestions.length})`}
        </button>
      </div>
    </div>
  );
}
