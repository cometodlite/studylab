'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import MotivationModal from '@/components/MotivationModal';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getIdToken } from 'firebase/auth';
import { collection, query, where, orderBy, limit, getDocs, doc, updateDoc, increment, Timestamp } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { POINT_RULES } from '@/lib/points';
import { UPDATES } from '@/lib/updates';
import { ACHIEVEMENT_ORDER, ACHIEVEMENTS } from '@/lib/achievements';

interface LearningReport {
  weekly: {
    examCount: number;
    avgScoreRate: number;
    bestScoreRate: number;
    pointsEarned: number;
    badgeCount: number;
    badges: Array<{ id: string; emoji: string; title: string; description: string; points: number }>;
    recentExams: Array<{ id: string; title: string; scoreRate: number; pointsEarned: number }>;
  };
  monthly: {
    examCount: number;
    avgScoreRate: number;
    bestScoreRate: number;
    pointsEarned: number;
    badgeCount: number;
    badges: Array<{ id: string; emoji: string; title: string; description: string; points: number }>;
  };
  learningStreak: {
    currentDays: number;
    bestDays: number;
    lastDate: string | null;
  };
  message: string;
}

export default function DashboardPage() {
  const { user, profile, refreshProfile } = useAuth();
  const router = useRouter();
  const [showMotivation, setShowMotivation] = useState(false);
  const [showDailyWrongExam, setShowDailyWrongExam] = useState(false);
  const [dailyWrongExamTotal, setDailyWrongExamTotal] = useState(0);
  const [dailyWrongExamCount, setDailyWrongExamCount] = useState(0);
  const [todayPoints, setTodayPoints] = useState(0);
  const [recentLogs, setRecentLogs] = useState<{ reason: string; amount: number; id: string }[]>([]);
  const [learningReport, setLearningReport] = useState<LearningReport | null>(null);
  const achievements = profile?.achievements ?? [];
  const achievementIds = new Set(achievements.map(achievement => achievement.id));
  const learningStreakDays = learningReport?.learningStreak.currentDays ?? profile?.learningStreakDays ?? 0;
  const learningStreakBest = learningReport?.learningStreak.bestDays ?? profile?.learningStreakBest ?? 0;

  const checkDailyLogin = useCallback(async () => {
    if (!user || !profile) return;
    const today = new Date().toDateString();
    if (profile.lastLogin === today) {
      return;
    }
    // 일일 출석 포인트 지급
    const userRef = doc(db, 'users', user.uid);
    const newStreak = (profile.streakDays || 0) + 1;
    await updateDoc(userRef, {
      lastLogin: today,
      streakDays: newStreak,
      points: increment(POINT_RULES.DAILY_LOGIN),
    });

    // 포인트 로그 기록
    const { addDoc, serverTimestamp } = await import('firebase/firestore');
    await addDoc(collection(db, 'point_logs'), {
      userId: user.uid,
      amount: POINT_RULES.DAILY_LOGIN,
      reason: '일일 출석 체크',
      createdAt: serverTimestamp(),
    });

    // 7일 연속 출석 보너스
    if (newStreak % 7 === 0) {
      await updateDoc(userRef, { points: increment(POINT_RULES.STREAK_7_DAYS) });
      await addDoc(collection(db, 'point_logs'), {
        userId: user.uid,
        amount: POINT_RULES.STREAK_7_DAYS,
        reason: `${newStreak}일 연속 출석 보너스`,
        createdAt: serverTimestamp(),
      });
    }

    await refreshProfile();
    setShowMotivation(true);
  }, [profile, refreshProfile, user]);

  const fetchTodayPoints = useCallback(async () => {
    if (!user) return;
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const q = query(
        collection(db, 'point_logs'),
        where('userId', '==', user.uid),
        where('createdAt', '>=', Timestamp.fromDate(today))
      );
      const snap = await getDocs(q);
      const sum = snap.docs.reduce((acc, d) => acc + (d.data().amount as number), 0);
      setTodayPoints(sum);
    } catch (e) {
      console.error('오늘 포인트 로딩 실패:', e);
    }
  }, [user]);

  const fetchRecentLogs = useCallback(async () => {
    if (!user) return;
    try {
      const q = query(
        collection(db, 'point_logs'),
        where('userId', '==', user.uid),
        orderBy('createdAt', 'desc'),
        limit(5)
      );
      const snap = await getDocs(q);
      setRecentLogs(snap.docs.map(d => ({ id: d.id, ...d.data() } as { id: string; reason: string; amount: number })));
    } catch (e) {
      console.error('최근 내역 로딩 실패:', e);
    }
  }, [user]);

  const checkDailyWrongExam = useCallback(async () => {
    if (!user || !auth.currentUser) return;
    try {
      const token = await getIdToken(auth.currentUser);
      const res = await fetch('/api/wrong-notes/daily-exam', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.eligible && !data.promptDismissed && Array.isArray(data.retry) && data.retry.length >= 20) {
        setDailyWrongExamTotal(data.total ?? data.retry.length);
        setDailyWrongExamCount(data.retry.length);
        setShowDailyWrongExam(true);
      }
    } catch (e) {
      console.error('오늘의 오답시험 확인 실패:', e);
    }
  }, [user]);

  const fetchLearningReport = useCallback(async () => {
    if (!user || !auth.currentUser) return;
    try {
      const token = await getIdToken(auth.currentUser);
      const res = await fetch('/api/reports/learning', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setLearningReport(data);
    } catch (e) {
      console.error('학습 리포트 로딩 실패:', e);
    }
  }, [user]);

  async function dismissDailyWrongExam() {
    setShowDailyWrongExam(false);
    if (!auth.currentUser) return;
    try {
      const token = await getIdToken(auth.currentUser);
      await fetch('/api/wrong-notes/daily-exam', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'dismiss' }),
      });
    } catch (e) {
      console.error('오늘의 오답시험 닫기 실패:', e);
    }
  }

  useEffect(() => {
    if (!user || !profile) return;
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      checkDailyLogin();
      checkDailyWrongExam();
      fetchTodayPoints();
      fetchRecentLogs();
      fetchLearningReport();
    });
    return () => {
      cancelled = true;
    };
  }, [checkDailyLogin, checkDailyWrongExam, fetchLearningReport, fetchRecentLogs, fetchTodayPoints, profile, user]);

  return (
    <>
      {showMotivation && profile && (
        <MotivationModal
          onClose={() => setShowMotivation(false)}
          todayPoints={todayPoints}
          totalPoints={profile.points}
          streakDays={profile.streakDays}
        />
      )}

      {showDailyWrongExam && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-7 text-center">
            <div className="text-5xl mb-4">📝</div>
            <p className="text-xs font-bold text-indigo-500 uppercase">Daily Wrong Exam</p>
            <h2 className="text-xl font-bold text-gray-800 mt-1">오늘의 오답시험이 준비됐어요</h2>
            <p className="text-sm text-gray-500 mt-3 leading-relaxed">
              자정 이후 첫 접속이라, 쌓인 객관식 오답 {dailyWrongExamTotal}개 중 {dailyWrongExamCount}개를 랜덤으로 골랐습니다.
            </p>
            <div className="grid grid-cols-2 gap-3 my-6">
              <div className="bg-indigo-50 rounded-xl px-4 py-3">
                <div className="text-2xl font-bold text-indigo-600">{dailyWrongExamCount}</div>
                <div className="text-xs text-gray-500 mt-0.5">오늘 문항</div>
              </div>
              <div className="bg-green-50 rounded-xl px-4 py-3">
                <div className="text-2xl font-bold text-green-600">자동</div>
                <div className="text-xs text-gray-500 mt-0.5">맞히면 아카이브</div>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={dismissDailyWrongExam}
                className="flex-1 border border-gray-200 hover:bg-gray-50 text-gray-600 font-semibold py-3 rounded-xl transition"
              >
                오늘은 나중에
              </button>
              <button
                onClick={() => router.push('/wrong-notes?mode=daily-exam')}
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 rounded-xl transition"
              >
                시작하기
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">
            안녕하세요, {profile?.nickname}님! 👋
          </h1>
          <p className="text-gray-500 text-sm mt-1">오늘도 함께 성장해요.</p>
        </div>

        {/* 통계 카드 */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <div className="text-3xl font-bold text-indigo-600">{profile?.points.toLocaleString()}</div>
            <div className="text-sm text-gray-500 mt-1">총 포인트</div>
          </div>
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <div className="text-3xl font-bold text-green-500">+{todayPoints}</div>
            <div className="text-sm text-gray-500 mt-1">오늘 획득</div>
          </div>
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <div className="text-3xl font-bold text-orange-500">{profile?.streakDays}일</div>
            <div className="text-sm text-gray-500 mt-1">연속 출석</div>
          </div>
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <div className="text-3xl font-bold text-red-500">{learningStreakDays}일</div>
            <div className="text-sm text-gray-500 mt-1">연속 학습</div>
          </div>
        </div>

        {/* 학습 리포트 */}
        {learningReport && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 mb-5">
              <div>
                <h2 className="font-semibold text-gray-700">📊 주간/월간 학습 리포트</h2>
                <p className="text-sm text-gray-500 mt-1">{learningReport.message}</p>
              </div>
              <Link href="/exam" className="text-indigo-600 text-sm font-medium hover:underline">이번 주 기록 늘리기 →</Link>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-5">
              <div className="rounded-xl bg-indigo-50 px-4 py-3">
                <p className="text-xs text-indigo-500 font-semibold">이번 주 응시</p>
                <p className="text-2xl font-bold text-indigo-700 mt-1">{learningReport.weekly.examCount}회</p>
              </div>
              <div className="rounded-xl bg-green-50 px-4 py-3">
                <p className="text-xs text-green-500 font-semibold">주간 평균</p>
                <p className="text-2xl font-bold text-green-700 mt-1">{learningReport.weekly.avgScoreRate}%</p>
              </div>
              <div className="rounded-xl bg-yellow-50 px-4 py-3">
                <p className="text-xs text-yellow-600 font-semibold">주간 배지</p>
                <p className="text-2xl font-bold text-yellow-700 mt-1">{learningReport.weekly.badgeCount}개</p>
              </div>
              <div className="rounded-xl bg-purple-50 px-4 py-3">
                <p className="text-xs text-purple-500 font-semibold">이번 달 응시</p>
                <p className="text-2xl font-bold text-purple-700 mt-1">{learningReport.monthly.examCount}회</p>
              </div>
              <div className="rounded-xl bg-red-50 px-4 py-3">
                <p className="text-xs text-red-500 font-semibold">학습 스트릭</p>
                <p className="text-2xl font-bold text-red-700 mt-1">{learningReport.learningStreak.currentDays}일</p>
                <p className="text-xs text-red-400 mt-0.5">최고 {learningStreakBest}일</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="rounded-xl border border-gray-100 px-4 py-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-bold text-gray-700">최근 시험 응시</p>
                  <p className="text-xs text-gray-400">최고 {learningReport.weekly.bestScoreRate}%</p>
                </div>
                {learningReport.weekly.recentExams.length === 0 ? (
                  <p className="text-sm text-gray-400">이번 주 응시 기록이 없습니다.</p>
                ) : (
                  <div className="space-y-2">
                    {learningReport.weekly.recentExams.map(exam => (
                      <div key={exam.id} className="flex items-center justify-between gap-3 text-sm">
                        <span className="text-gray-600 truncate">{exam.title}</span>
                        <span className="font-semibold text-indigo-600 shrink-0">{exam.scoreRate}%</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-xl border border-gray-100 px-4 py-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-bold text-gray-700">배지 획득 현황</p>
                  <p className="text-xs text-gray-400">월간 {learningReport.monthly.badgeCount}개</p>
                </div>
                {learningReport.monthly.badges.length === 0 ? (
                  <p className="text-sm text-gray-400">이번 달 새 배지는 아직 없습니다.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {learningReport.monthly.badges.map(badge => (
                      <span key={badge.id} className="inline-flex items-center gap-1 rounded-full bg-yellow-50 text-yellow-700 px-3 py-1 text-xs font-semibold">
                        <span>{badge.emoji}</span>
                        {badge.title}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 배지/업적 */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="font-semibold text-gray-700">내 배지</h2>
              <p className="text-xs text-gray-400 mt-0.5">{achievements.length}/{ACHIEVEMENT_ORDER.length}개 달성</p>
            </div>
            <Link href="/exam" className="text-indigo-600 text-sm font-medium hover:underline">도전하기 →</Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {ACHIEVEMENT_ORDER.map(id => {
              const meta = ACHIEVEMENTS[id];
              const unlocked = achievements.find(achievement => achievement.id === id);
              const isUnlocked = achievementIds.has(id);
              return (
                <div
                  key={id}
                  className={`rounded-xl border px-4 py-4 ${
                    isUnlocked
                      ? 'border-yellow-200 bg-yellow-50'
                      : 'border-gray-100 bg-gray-50 opacity-70'
                  }`}
                >
                  <div className={`text-3xl mb-2 ${isUnlocked ? '' : 'grayscale'}`}>{meta.emoji}</div>
                  <p className={`font-bold ${isUnlocked ? 'text-gray-800' : 'text-gray-500'}`}>{meta.title}</p>
                  <p className="text-xs text-gray-500 mt-1">{unlocked?.detail ?? meta.description}</p>
                  <p className={`text-xs font-semibold mt-3 ${isUnlocked ? 'text-green-600' : 'text-gray-400'}`}>
                    {isUnlocked ? `획득 완료 · +${meta.points.toLocaleString()}p` : `달성 시 +${meta.points.toLocaleString()}p`}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {/* 업데이트 내역 */}
        <Link href="/updates" className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 hover:shadow-md hover:border-indigo-200 transition block">
          <div className="flex items-start justify-between">
            <h2 className="font-semibold text-gray-700 mb-3">업데이트 내역</h2>
            <span className="text-indigo-600 text-sm font-medium">전체 보기 →</span>
          </div>
          <div className="space-y-2">
            {UPDATES.slice(0, 2).map((u, i) => (
              <div key={i} className="text-sm">
                <p className="text-gray-400 text-xs mb-0.5">{u.date}</p>
                <p className="font-medium text-gray-700">{u.title}</p>
                <p className="text-gray-500 text-xs mt-0.5">{u.description}</p>
              </div>
            ))}
          </div>
        </Link>

        {/* 빠른 메뉴 */}
        <div className="grid grid-cols-2 gap-4">
          <Link
            href="/exam"
            className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl p-6 transition flex items-center gap-4"
          >
            <span className="text-4xl">📝</span>
            <div>
              <div className="font-bold text-lg">시험 풀기</div>
              <div className="text-indigo-200 text-sm">정답 1개당 10p 획득</div>
            </div>
          </Link>
          <Link
            href="/store"
            className="bg-white hover:bg-gray-50 border border-gray-200 rounded-xl p-6 transition flex items-center gap-4"
          >
            <span className="text-4xl">🎁</span>
            <div>
              <div className="font-bold text-lg text-gray-800">상점</div>
              <div className="text-gray-400 text-sm">포인트로 기프티콘 교환</div>
            </div>
          </Link>
        </div>

        {/* 최근 포인트 내역 */}
        {recentLogs.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-700">최근 포인트 내역</h2>
              <Link href="/points" className="text-indigo-600 text-sm hover:underline">전체 보기</Link>
            </div>
            <div className="space-y-3">
              {recentLogs.map(log => (
                <div key={log.id} className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">{log.reason}</span>
                  <span className={`font-semibold ${log.amount > 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {log.amount > 0 ? '+' : ''}{log.amount}p
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </>
  );
}
