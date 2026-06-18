export type AchievementId = 'honor-student' | 'perfectionist' | 'master';

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
};

export const ACHIEVEMENT_ORDER: AchievementId[] = ['honor-student', 'perfectionist', 'master'];

export function createAchievement(id: AchievementId, unlockedAt: Date, detail?: string): UserAchievement {
  return {
    ...ACHIEVEMENTS[id],
    unlockedAt,
    detail,
  };
}
