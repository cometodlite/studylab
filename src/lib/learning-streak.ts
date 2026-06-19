import { AchievementId, UserAchievement, createAchievement } from '@/lib/achievements';
import { fsBatch, fsGet, WriteOp } from '@/lib/firestore-rest';
import type { GoalAlert } from '@/lib/notifications';

const DAY_MS = 24 * 60 * 60 * 1000;
const STREAK_ACHIEVEMENTS: Array<{ days: number; id: AchievementId }> = [
  { days: 7, id: 'streak-7' },
  { days: 15, id: 'streak-15' },
  { days: 30, id: 'streak-30' },
];

type UserStreakDoc = {
  achievements?: unknown;
  learningStreakDays?: unknown;
  learningStreakBest?: unknown;
  learningStreakLastDate?: unknown;
};

export type LearningStreakResult = {
  streakDays: number;
  bestStreak: number;
  lastDate: string;
  alreadyUpdatedToday: boolean;
  achievementsUnlocked: UserAchievement[];
  achievementPointsEarned: number;
  goalAlerts: GoalAlert[];
};

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function dateKST(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const getPart = (type: string) => parts.find(part => part.type === type)?.value ?? '01';
  return `${getPart('year')}-${getPart('month')}-${getPart('day')}`;
}

function normalizeAchievements(value: unknown): UserAchievement[] {
  return Array.isArray(value)
    ? value.filter((item): item is UserAchievement => typeof item === 'object' && item !== null && typeof (item as UserAchievement).id === 'string')
    : [];
}

function toPositiveInteger(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

function buildStreakGoalAlerts(streakDays: number, existingAchievements: UserAchievement[]): GoalAlert[] {
  const existingIds = new Set(existingAchievements.map(achievement => achievement.id));
  const next = STREAK_ACHIEVEMENTS.find(achievement => streakDays === achievement.days - 1 && !existingIds.has(achievement.id));
  if (!next) return [];
  return [
    {
      id: `streak-near-${next.id}`,
      emoji: '🔥',
      title: `${next.days}일 연속 배지까지 하루 남았어요`,
      message: '내일 한 번만 더 시험/문제를 풀면 바로 달성할 수 있습니다.',
      href: '/exam',
    },
  ];
}

export async function updateLearningStreak(uid: string, token: string, now = new Date()): Promise<LearningStreakResult> {
  const today = dateKST(now);
  const yesterday = dateKST(new Date(now.getTime() - DAY_MS));
  const userDoc = await fsGet(`users/${uid}`, token) as UserStreakDoc | null;
  const existingAchievements = normalizeAchievements(userDoc?.achievements);
  const previousDays = toPositiveInteger(userDoc?.learningStreakDays);
  const previousBest = toPositiveInteger(userDoc?.learningStreakBest);
  const previousDate = typeof userDoc?.learningStreakLastDate === 'string' ? userDoc.learningStreakLastDate : null;

  if (previousDate === today) {
    return {
      streakDays: previousDays,
      bestStreak: Math.max(previousBest, previousDays),
      lastDate: today,
      alreadyUpdatedToday: true,
      achievementsUnlocked: [],
      achievementPointsEarned: 0,
      goalAlerts: buildStreakGoalAlerts(previousDays, existingAchievements),
    };
  }

  const streakDays = previousDate === yesterday ? previousDays + 1 : 1;
  const bestStreak = Math.max(previousBest, streakDays);
  const existingIds = new Set(existingAchievements.map(achievement => achievement.id));
  const achievementsUnlocked = STREAK_ACHIEVEMENTS
    .filter(achievement => streakDays >= achievement.days && !existingIds.has(achievement.id))
    .map(achievement => createAchievement(achievement.id, now, `${streakDays}일 연속 학습`));
  const achievementPointsEarned = achievementsUnlocked.reduce((sum, achievement) => sum + achievement.points, 0);

  const writes: WriteOp[] = [
    {
      type: 'update',
      path: `users/${uid}`,
      data: {
        learningStreakDays: streakDays,
        learningStreakBest: bestStreak,
        learningStreakLastDate: today,
        achievements: [...existingAchievements, ...achievementsUnlocked],
      },
    },
  ];

  if (achievementPointsEarned > 0) {
    writes.push(
      { type: 'increment', path: `users/${uid}`, field: 'points', delta: achievementPointsEarned },
      ...achievementsUnlocked.map(achievement => ({
        type: 'add' as const,
        collection: 'point_logs',
        id: genId(),
        data: {
          userId: uid,
          amount: achievement.points,
          reason: `${achievement.emoji} 학습 스트릭 달성: ${achievement.title}`,
          achievementId: achievement.id,
          createdAt: now,
        },
      }))
    );
  }

  await fsBatch(writes, token);

  return {
    streakDays,
    bestStreak,
    lastDate: today,
    alreadyUpdatedToday: false,
    achievementsUnlocked,
    achievementPointsEarned,
    goalAlerts: buildStreakGoalAlerts(streakDays, [...existingAchievements, ...achievementsUnlocked]),
  };
}
