export type AchievementId = 'honor-student' | 'perfectionist' | 'master' | 'streak-7' | 'streak-15' | 'streak-30';

export interface AchievementMeta {
  id: AchievementId;
  emoji: string;
  title: string;
  description: string;
  points: number;
}

export interface UserAchievement extends AchievementMeta {
  unlockedAt?: unknown;
  detail?: string;
}

export const ACHIEVEMENTS: Record<AchievementId, AchievementMeta> = {
  'honor-student': {
    id: 'honor-student',
    emoji: '🏆',
    title: '우등생',
    description: '3회 연속 90점 이상 달성',
    points: 1500,
  },
  perfectionist: {
    id: 'perfectionist',
    emoji: '🎯',
    title: '완벽주의자',
    description: '한 시험 시리즈 5회차 완주',
    points: 1200,
  },
  master: {
    id: 'master',
    emoji: '💎',
    title: '마스터',
    description: '한 시험 시리즈 전 회차 90점 이상 달성',
    points: 3000,
  },
  'streak-7': {
    id: 'streak-7',
    emoji: '🔥',
    title: '7일 연속',
    description: '7일 연속 시험/문제 풀이 완료',
    points: 700,
  },
  'streak-15': {
    id: 'streak-15',
    emoji: '🔥',
    title: '15일 연속!',
    description: '15일 연속 시험/문제 풀이 완료',
    points: 1500,
  },
  'streak-30': {
    id: 'streak-30',
    emoji: '🔥',
    title: '30일 연속',
    description: '30일 연속 시험/문제 풀이 완료',
    points: 3000,
  },
};

export const ACHIEVEMENT_ORDER: AchievementId[] = ['honor-student', 'perfectionist', 'master', 'streak-7', 'streak-15', 'streak-30'];

export function createAchievement(id: AchievementId, unlockedAt: Date, detail?: string): UserAchievement {
  return {
    ...ACHIEVEMENTS[id],
    unlockedAt,
    detail,
  };
}
