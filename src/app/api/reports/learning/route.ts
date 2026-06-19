import { NextRequest, NextResponse } from 'next/server';
import { verifyFirebaseToken } from '@/lib/firebase-jwt';
import { fsGet, fsQuery } from '@/lib/firestore-rest';

type TimestampLike = { seconds: number } | null;

type SessionDoc = {
  _id: string;
  userId?: unknown;
  examTitle?: unknown;
  score?: unknown;
  total?: unknown;
  totalScore?: unknown;
  maxScore?: unknown;
  pointsEarned?: unknown;
  completedAt?: unknown;
};

type AchievementDoc = {
  id?: unknown;
  emoji?: unknown;
  title?: unknown;
  description?: unknown;
  points?: unknown;
  unlockedAt?: unknown;
};

type UserDoc = {
  achievements?: unknown;
};

function startOfDayKST(date: Date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const getPart = (type: string) => parts.find(part => part.type === type)?.value ?? '01';
  return new Date(`${getPart('year')}-${getPart('month')}-${getPart('day')}T00:00:00+09:00`);
}

function startOfWeekKST(date: Date) {
  const start = startOfDayKST(date);
  const weekday = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Seoul',
    weekday: 'short',
  }).format(date);
  const dayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const day = dayMap[weekday] ?? 1;
  const daysSinceMonday = day === 0 ? 6 : day - 1;
  return new Date(start.getTime() - daysSinceMonday * 24 * 60 * 60 * 1000);
}

function startOfMonthKST(date: Date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(date);
  const getPart = (type: string) => parts.find(part => part.type === type)?.value ?? '01';
  return new Date(`${getPart('year')}-${getPart('month')}-01T00:00:00+09:00`);
}

function timestampSeconds(value: unknown): number {
  if (typeof value === 'object' && value !== null && typeof (value as { seconds?: unknown }).seconds === 'number') {
    return (value as { seconds: number }).seconds;
  }
  return 0;
}

function toNumber(value: unknown) {
  return typeof value === 'number' ? value : 0;
}

function normalizeSession(session: SessionDoc) {
  const earned = toNumber(session.totalScore ?? session.score);
  const max = toNumber(session.maxScore ?? session.total);
  const rate = max > 0 ? Math.round((earned / max) * 1000) / 10 : 0;
  return {
    id: session._id,
    title: typeof session.examTitle === 'string' ? session.examTitle : '알 수 없음',
    scoreRate: rate,
    pointsEarned: toNumber(session.pointsEarned),
    completedAtSeconds: timestampSeconds(session.completedAt),
  };
}

function summarize(sessions: ReturnType<typeof normalizeSession>[]) {
  const examCount = sessions.length;
  const avgScoreRate = examCount > 0
    ? Math.round((sessions.reduce((sum, session) => sum + session.scoreRate, 0) / examCount) * 10) / 10
    : 0;
  const bestScoreRate = sessions.reduce((best, session) => Math.max(best, session.scoreRate), 0);
  const pointsEarned = sessions.reduce((sum, session) => sum + session.pointsEarned, 0);
  return { examCount, avgScoreRate, bestScoreRate, pointsEarned };
}

function normalizeAchievements(value: unknown) {
  return Array.isArray(value)
    ? value
        .filter((item): item is AchievementDoc => typeof item === 'object' && item !== null)
        .map(item => ({
          id: typeof item.id === 'string' ? item.id : '',
          emoji: typeof item.emoji === 'string' ? item.emoji : '🏅',
          title: typeof item.title === 'string' ? item.title : '업적',
          description: typeof item.description === 'string' ? item.description : '',
          points: toNumber(item.points),
          unlockedAt: item.unlockedAt as TimestampLike,
          unlockedAtSeconds: timestampSeconds(item.unlockedAt),
        }))
    : [];
}

function growthMessage(weekly: ReturnType<typeof summarize>, weeklyBadges: number) {
  if (weekly.examCount === 0) {
    return '이번 주는 아직 기록이 없습니다. 오늘 한 번만 시작해도 다음 리포트가 달라집니다.';
  }
  if (weeklyBadges > 0) {
    return `이번 주 너는 배지 ${weeklyBadges}개를 새로 얻었어요. 노력의 흔적이 확실히 쌓이고 있습니다.`;
  }
  if (weekly.avgScoreRate >= 85) {
    return `이번 주 평균 ${weekly.avgScoreRate}%입니다. 높은 집중력을 잘 유지하고 있어요.`;
  }
  if (weekly.examCount >= 3) {
    return `이번 주 ${weekly.examCount}번 응시했습니다. 반복량이 쌓이고 있으니 오답만 조금 더 잡아봅시다.`;
  }
  return `이번 주 ${weekly.examCount}번 응시했습니다. 다음 목표는 3회 응시와 오답 재풀이입니다.`;
}

async function loadSessions(uid: string, token: string, since: Date) {
  const [schoolSessions, practiceSessions] = await Promise.all([
    fsQuery('school_exam_sessions', [
      { field: 'userId', op: 'EQUAL', value: uid },
    ], token, 10000) as Promise<SessionDoc[]>,
    fsQuery('exam_sessions', [
      { field: 'userId', op: 'EQUAL', value: uid },
    ], token, 10000) as Promise<SessionDoc[]>,
  ]);
  const sinceSeconds = Math.floor(since.getTime() / 1000);

  return [...schoolSessions, ...practiceSessions]
    .map(normalizeSession)
    .filter(session => session.completedAtSeconds >= sinceSeconds)
    .sort((a, b) => b.completedAtSeconds - a.completedAtSeconds);
}

export async function GET(req: NextRequest) {
  const token = req.headers.get('Authorization')?.split('Bearer ')[1];
  if (!token) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });

  let uid: string;
  try {
    uid = await verifyFirebaseToken(token);
  } catch {
    return NextResponse.json({ error: '유효하지 않은 토큰입니다.' }, { status: 401 });
  }

  try {
    const now = new Date();
    const weekStart = startOfWeekKST(now);
    const monthStart = startOfMonthKST(now);
    const [monthSessions, userDoc] = await Promise.all([
      loadSessions(uid, token, monthStart),
      fsGet(`users/${uid}`, token) as Promise<UserDoc | null>,
    ]);

    const weekStartSeconds = Math.floor(weekStart.getTime() / 1000);
    const monthStartSeconds = Math.floor(monthStart.getTime() / 1000);
    const weekSessions = monthSessions.filter(session => session.completedAtSeconds >= weekStartSeconds);
    const achievements = normalizeAchievements(userDoc?.achievements);
    const weeklyBadges = achievements.filter(achievement => achievement.unlockedAtSeconds >= weekStartSeconds);
    const monthlyBadges = achievements.filter(achievement => achievement.unlockedAtSeconds >= monthStartSeconds);
    const weekly = summarize(weekSessions);
    const monthly = summarize(monthSessions);

    return NextResponse.json({
      weekly: {
        ...weekly,
        badgeCount: weeklyBadges.length,
        badges: weeklyBadges,
        recentExams: weekSessions.slice(0, 3),
      },
      monthly: {
        ...monthly,
        badgeCount: monthlyBadges.length,
        badges: monthlyBadges,
      },
      message: growthMessage(weekly, weeklyBadges.length),
      generatedAt: now.toISOString(),
    });
  } catch (e) {
    console.error('[reports/learning] failed:', e);
    return NextResponse.json({ error: '학습 리포트를 불러오지 못했습니다.' }, { status: 500 });
  }
}
