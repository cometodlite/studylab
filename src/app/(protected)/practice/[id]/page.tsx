'use client';

import { useEffect, useState, use } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { getIdToken } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import MathText from '@/components/MathText';
import { Difficulty } from '@/lib/points';
import type { UserAchievement } from '@/lib/achievements';
import type { GoalAlert } from '@/lib/notifications';

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
  difficulty: Difficulty;
  pointsEarned: number;
  alreadyRewarded: boolean;
  reasons: string[];
  results: GradeResult[];
  learningStreak?: {
    streakDays: number;
    bestStreak: number;
    alreadyUpdatedToday: boolean;
    achievementsUnlocked: UserAchievement[];
    achievementPointsEarned: number;
    goalAlerts: GoalAlert[];
  } | null;
}

const DIFFICULTY_COLOR: Record<Difficulty, string> = {
  '기본':   'bg-green-100 text-green-700',
  '유형별': 'bg-blue-100 text-blue-700',
  '심화':   'bg-orange-100 text-orange-700',
  '킬러':   'bg-red-100 text-red-700',
};

export default function PracticePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, refreshProfile } = useAuth();

  const [exam, setExam] = useState<{ title: string; difficulty: Difficulty | null; questions: Question[] } | null>(null);
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [gradeResult, setGradeResult] = useState<GradeResponse | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const qs = new URLSearchParams();
    const shuffle = searchParams.get('shuffle');
    const count = searchParams.get('count');
    if (shuffle) qs.set('shuffle', shuffle);
    if (count) qs.set('count', count);

    fetch(`/api/exams/${id}?${qs}`)
      .then(r => r.json())
      .then(data => { setExam(data); setLoading(false); });
  }, [id, searchParams]);

  useEffect(() => {
    if (!exam || gradeResult) return;
    const t = setInterval(() => setElapsed(s => s + 1), 1000);
    return () => clearInterval(t);
  }, [exam, gradeResult]);

  useEffect(() => {
    if (!gradeResult?.learningStreak?.goalAlerts.length) return;
    gradeResult.learningStreak.goalAlerts.forEach(alert => {
      window.dispatchEvent(new CustomEvent('studylab:notify', {
        detail: { ...alert, variant: 'goal' },
      }));
    });
  }, [gradeResult]);

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
        body: JSON.stringify({ answers, source: 'practice' }),
      });
      const data = await res.json();
      setGradeResult(data);
      await refreshProfile();
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <div className="text-center py-20 text-gray-400">문제 불러오는 중...</div>;
  if (!exam) return <div className="text-center py-20 text-gray-400">문제를 찾을 수 없습니다.</div>;

  // 결과 화면
  if (gradeResult) {
    const pct = Math.round((gradeResult.score / gradeResult.total) * 100);
    return (
      <div className="space-y-6">
        <div className="bg-white rounded-2xl p-8 text-center shadow-sm border border-gray-100">
          <div className="text-5xl mb-3">{pct === 100 ? '🏆' : pct >= 80 ? '🎉' : pct >= 60 ? '👍' : '💪'}</div>
          <h1 className="text-2xl font-bold text-gray-800">{exam.title} 결과</h1>
          {exam.difficulty && (
            <span className={`inline-block text-xs rounded-full px-2.5 py-0.5 font-semibold mt-2 ${DIFFICULTY_COLOR[exam.difficulty]}`}>
              {exam.difficulty}
            </span>
          )}
          <div className="text-5xl font-bold text-indigo-600 mt-4">{gradeResult.score}/{gradeResult.total}</div>
          <div className="text-gray-500 mt-1">{pct}% 정답</div>

          {gradeResult.alreadyRewarded ? (
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mt-6 inline-block">
              <div className="text-sm font-semibold text-yellow-700">⚠️ 오늘 이미 포인트를 받은 문제집입니다.</div>
              <div className="text-sm text-yellow-600 mt-0.5">내일 다시 도전하면 포인트를 받을 수 있어요!</div>
            </div>
          ) : (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 mt-6 inline-block">
              <div className="text-2xl font-bold text-green-600">+{gradeResult.pointsEarned.toLocaleString()}p 획득!</div>
              <div className="text-sm text-green-700 mt-1">{gradeResult.reasons.join(' · ')}</div>
            </div>
          )}
        </div>

        {gradeResult.learningStreak && (
          <div className="bg-white rounded-2xl p-6 border border-red-100 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <p className="text-xs font-bold text-red-500 uppercase">Learning Streak</p>
                <h2 className="text-xl font-bold text-gray-800 mt-1">
                  🔥 {gradeResult.learningStreak.streakDays}일 연속 학습 중
                </h2>
                <p className="text-sm text-gray-500 mt-1">최고 기록 {gradeResult.learningStreak.bestStreak}일</p>
              </div>
              {gradeResult.learningStreak.achievementPointsEarned > 0 && (
                <div className="text-sm font-semibold text-green-600">
                  +{gradeResult.learningStreak.achievementPointsEarned.toLocaleString()}p 보너스
                </div>
              )}
            </div>
            {gradeResult.learningStreak.achievementsUnlocked.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
                {gradeResult.learningStreak.achievementsUnlocked.map(achievement => (
                  <div key={achievement.id} className="rounded-xl bg-red-50 border border-red-100 px-4 py-4">
                    <div className="text-4xl mb-2">{achievement.emoji}</div>
                    <p className="font-bold text-gray-800">{achievement.title}</p>
                    <p className="text-xs text-gray-500 mt-1">{achievement.detail ?? achievement.description}</p>
                    <p className="text-xs font-semibold text-green-600 mt-3">+{achievement.points.toLocaleString()}p</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="space-y-4">
          {gradeResult.results.map((r, i) => (
            <div key={r.id} className={`bg-white rounded-xl p-5 border shadow-sm ${r.correct ? 'border-green-200' : 'border-red-200'}`}>
              <div className="flex items-start gap-2 mb-3">
                <span className="text-lg">{r.correct ? '✅' : '❌'}</span>
                <span className="font-medium text-gray-800">
                  {i + 1}. <MathText text={r.question} />
                </span>
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
                    {ci + 1}. <MathText text={c} />
                  </div>
                ))}
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
          <button onClick={() => router.push('/practice')} className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 rounded-xl transition">
            다른 문제 풀기
          </button>
          <button onClick={() => router.push('/wrong-notes')} className="flex-1 border border-gray-200 hover:bg-gray-50 text-gray-700 font-semibold py-3 rounded-xl transition">
            오답노트 보기 📝
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
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-bold text-gray-800">{exam.title}</h1>
            {exam.difficulty && (
              <span className={`text-xs rounded-full px-2 py-0.5 font-semibold ${DIFFICULTY_COLOR[exam.difficulty]}`}>
                {exam.difficulty}
              </span>
            )}
          </div>
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
                : answers[qq.id] !== undefined ? 'bg-indigo-100 text-indigo-700'
                : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            }`}
          >
            {i + 1}
          </button>
        ))}
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
          className={`ml-auto text-sm font-semibold px-5 py-2.5 rounded-xl transition disabled:opacity-50 ${
            allAnswered
              ? 'bg-indigo-600 hover:bg-indigo-700 text-white'
              : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
          }`}
        >
          {submitting ? '채점 중...' : allAnswered ? `제출 (${answered}/${exam.questions.length}) ✓` : `제출 (${answered}/${exam.questions.length})`}
        </button>
      </div>
    </div>
  );
}
