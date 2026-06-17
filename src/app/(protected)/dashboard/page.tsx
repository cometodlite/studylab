'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import MotivationModal from '@/components/MotivationModal';
import Link from 'next/link';
import { collection, query, where, orderBy, limit, getDocs, doc, updateDoc, increment, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { POINT_RULES } from '@/lib/points';

const UPDATES: { date: string; text: string; link?: { href: string; label: string } }[] = [
  {
    date: '2026-06-18',
    text: '중3 수학 전범위 (2022개정 교육과정)와 중2 수학 일차부등식 (2022개정 교육과정)을 추가했습니다.',
    link: { href: '/practice', label: '바로가기' },
  },
];

export default function DashboardPage() {
  const { user, profile, refreshProfile } = useAuth();
  const [showMotivation, setShowMotivation] = useState(false);
  const [todayPoints, setTodayPoints] = useState(0);
  const [recentLogs, setRecentLogs] = useState<{ reason: string; amount: number; id: string }[]>([]);

  useEffect(() => {
    if (!user || !profile) return;
    checkDailyLogin();
    fetchTodayPoints();
    fetchRecentLogs();
  }, [user, profile?.uid]);

  async function checkDailyLogin() {
    if (!user || !profile) return;
    const today = new Date().toDateString();
    if (profile.lastLogin === today) {
      setShowMotivation(true);
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
  }

  async function fetchTodayPoints() {
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
  }

  async function fetchRecentLogs() {
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
  }

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

      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">
            안녕하세요, {profile?.nickname}님! 👋
          </h1>
          <p className="text-gray-500 text-sm mt-1">오늘도 함께 성장해요.</p>
        </div>

        {/* 통계 카드 */}
        <div className="grid grid-cols-3 gap-4">
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
        </div>

        {/* 업데이트 내역 */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h2 className="font-semibold text-gray-700 mb-3">업데이트 내역</h2>
          <div className="space-y-2">
            {UPDATES.map((u, i) => (
              <div key={i} className="flex items-start gap-3 text-sm">
                <span className="text-gray-400 shrink-0 mt-0.5">{u.date}</span>
                <span className="text-gray-600">
                  {u.text}
                  {u.link && (
                    <Link href={u.link.href} className="ml-1.5 text-indigo-600 font-medium hover:underline">
                      {u.link.label} →
                    </Link>
                  )}
                </span>
              </div>
            ))}
          </div>
        </div>

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
