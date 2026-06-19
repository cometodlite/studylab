'use client';

import { useEffect, useRef, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { ACHIEVEMENTS, AchievementId, UserAchievement } from '@/lib/achievements';
import type { AppNotificationDetail, AppNotificationVariant } from '@/lib/notifications';

type Toast = Required<Pick<AppNotificationDetail, 'title' | 'message'>> & {
  id: string;
  emoji: string;
  variant: AppNotificationVariant;
  href?: string;
};

type UserNotificationDoc = {
  achievements?: unknown;
  learningStreakDays?: unknown;
};

const STREAK_NEAR_GOALS: Array<{ days: number; achievementId: AchievementId; title: string }> = [
  { days: 6, achievementId: 'streak-7', title: '7일 연속 배지까지 하루 남았어요' },
  { days: 14, achievementId: 'streak-15', title: '15일 연속 배지까지 하루 남았어요' },
  { days: 29, achievementId: 'streak-30', title: '30일 연속 배지까지 하루 남았어요' },
];

function normalizeAchievements(value: unknown): UserAchievement[] {
  return Array.isArray(value)
    ? value.filter((item): item is UserAchievement => typeof item === 'object' && item !== null && typeof (item as UserAchievement).id === 'string')
    : [];
}

function todayKST() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const getPart = (type: string) => parts.find(part => part.type === type)?.value ?? '01';
  return `${getPart('year')}-${getPart('month')}-${getPart('day')}`;
}

function isToastDetail(value: unknown): value is AppNotificationDetail {
  return typeof value === 'object' && value !== null &&
    typeof (value as AppNotificationDetail).id === 'string' &&
    typeof (value as AppNotificationDetail).title === 'string' &&
    typeof (value as AppNotificationDetail).message === 'string';
}

export default function RealtimeNotificationCenter() {
  const { user } = useAuth();
  const router = useRouter();
  const [toasts, setToasts] = useState<Toast[]>([]);
  const previousAchievementIdsRef = useRef<Set<string> | null>(null);

  const pushToast = (detail: AppNotificationDetail) => {
    const toast: Toast = {
      id: `${detail.id}-${Date.now()}`,
      title: detail.title,
      message: detail.message,
      emoji: detail.emoji ?? (detail.variant === 'achievement' ? '🏅' : '📣'),
      variant: detail.variant ?? 'info',
      href: detail.href,
    };
    setToasts(current => [toast, ...current].slice(0, 3));
    window.setTimeout(() => {
      setToasts(current => current.filter(item => item.id !== toast.id));
    }, 7000);
  };

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<unknown>).detail;
      if (isToastDetail(detail)) pushToast(detail);
    };
    window.addEventListener('studylab:notify', handler);
    return () => window.removeEventListener('studylab:notify', handler);
  }, []);

  useEffect(() => {
    if (!user) return;
    const unsubscribe = onSnapshot(doc(db, 'users', user.uid), snapshot => {
      const data = snapshot.data() as UserNotificationDoc | undefined;
      const achievements = normalizeAchievements(data?.achievements);
      const achievementIds = new Set(achievements.map(achievement => achievement.id));
      const previousIds = previousAchievementIdsRef.current;

      if (previousIds) {
        achievements
          .filter(achievement => !previousIds.has(achievement.id))
          .forEach(achievement => {
            pushToast({
              id: `achievement-${achievement.id}`,
              variant: 'achievement',
              emoji: achievement.emoji,
              title: `${achievement.title} 배지를 획득했어요!`,
              message: achievement.detail ?? achievement.description,
              href: '/dashboard',
            });
          });
      }

      previousAchievementIdsRef.current = achievementIds;

      const learningStreakDays = typeof data?.learningStreakDays === 'number' ? data.learningStreakDays : 0;
      const nearGoal = STREAK_NEAR_GOALS.find(goal => learningStreakDays === goal.days && !achievementIds.has(goal.achievementId));
      if (nearGoal) {
        const key = `studylab-goal-${user.uid}-${nearGoal.achievementId}-${todayKST()}`;
        if (!window.sessionStorage.getItem(key)) {
          window.sessionStorage.setItem(key, '1');
          pushToast({
            id: `goal-${nearGoal.achievementId}`,
            variant: 'goal',
            emoji: ACHIEVEMENTS[nearGoal.achievementId].emoji,
            title: nearGoal.title,
            message: '내일 한 번만 더 시험/문제를 풀면 바로 달성할 수 있습니다.',
            href: '/exam',
          });
        }
      }
    });

    return unsubscribe;
  }, [user]);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed right-4 top-4 z-[60] flex w-[calc(100vw-2rem)] max-w-sm flex-col gap-3">
      {toasts.map(toast => (
        <div
          key={toast.id}
          className={`rounded-2xl border bg-white px-4 py-4 shadow-xl ${
            toast.variant === 'achievement'
              ? 'border-yellow-200'
              : toast.variant === 'goal'
                ? 'border-indigo-200'
                : 'border-gray-200'
          }`}
        >
          <div className="flex items-start gap-3">
            <div className="text-3xl">{toast.emoji}</div>
            <div className="min-w-0 flex-1">
              <p className="font-bold text-gray-800">{toast.title}</p>
              <p className="mt-1 text-sm text-gray-500">{toast.message}</p>
              {toast.href && (
                <button
                  onClick={() => router.push(toast.href!)}
                  className="mt-3 text-sm font-semibold text-indigo-600 hover:underline"
                >
                  바로 보기 →
                </button>
              )}
            </div>
            <button
              onClick={() => setToasts(current => current.filter(item => item.id !== toast.id))}
              className="rounded-full px-2 py-1 text-sm text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              aria-label="알림 닫기"
            >
              ×
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
