import { NextRequest, NextResponse } from 'next/server';
import { verifyFirebaseToken } from '@/lib/firebase-jwt';
import { fsGet, fsQuery, fsUpdate } from '@/lib/firestore-rest';

type StudyPlannerSettings = {
  weeklyExamGoal: number;
  weeklyWrongRetryGoal: number;
  monthlyExamGoal: number;
  focusMode: 'auto' | 'wrong-notes' | 'exam-score' | 'streak';
  reminderEnabled: boolean;
  updatedAt?: unknown;
};

type UserDoc = {
  studyPlanner?: unknown;
  learningStreakDays?: unknown;
};

type SessionDoc = {
  _id: string;
  examTitle?: unknown;
  score?: unknown;
  total?: unknown;
  totalScore?: unknown;
  maxScore?: unknown;
  completedAt?: unknown;
};

type WrongNoteDoc = {
  _id: string;
  archived?: unknown;
  examTitle?: unknown;
  questionType?: unknown;
  retrySolvedAt?: unknown;
  archivedAt?: unknown;
  addedAt?: unknown;
};

const DEFAULT_PLANNER: StudyPlannerSettings = {
  weeklyExamGoal: 3,
  weeklyWrongRetryGoal: 1,
  monthlyExamGoal: 12,
  focusMode: 'auto',
  reminderEnabled: true,
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
  const weekday = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Seoul', weekday: 'short' }).format(date);
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
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function clampGoal(value: unknown, fallback: number, min: number, max: number) {
  const numberValue = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numberValue)) return fallback;
  return Math.min(max, Math.max(min, Math.round(numberValue)));
}

function normalizePlanner(value: unknown): StudyPlannerSettings {
  const data = typeof value === 'object' && value !== null ? value as Partial<StudyPlannerSettings> : {};
  const focusModes = new Set<StudyPlannerSettings['focusMode']>(['auto', 'wrong-notes', 'exam-score', 'streak']);
  return {
    weeklyExamGoal: clampGoal(data.weeklyExamGoal, DEFAULT_PLANNER.weeklyExamGoal, 1, 21),
    weeklyWrongRetryGoal: clampGoal(data.weeklyWrongRetryGoal, DEFAULT_PLANNER.weeklyWrongRetryGoal, 0, 14),
    monthlyExamGoal: clampGoal(data.monthlyExamGoal, DEFAULT_PLANNER.monthlyExamGoal, 1, 80),
    focusMode: focusModes.has(data.focusMode as StudyPlannerSettings['focusMode']) ? data.focusMode as StudyPlannerSettings['focusMode'] : DEFAULT_PLANNER.focusMode,
    reminderEnabled: typeof data.reminderEnabled === 'boolean' ? data.reminderEnabled : DEFAULT_PLANNER.reminderEnabled,
    updatedAt: data.updatedAt,
  };
}

function normalizeSession(session: SessionDoc) {
  const earned = toNumber(session.totalScore ?? session.score);
  const max = toNumber(session.maxScore ?? session.total);
  return {
    id: session._id,
    title: typeof session.examTitle === 'string' ? session.examTitle : '시험',
    scoreRate: max > 0 ? Math.round((earned / max) * 1000) / 10 : 0,
    completedAtSeconds: timestampSeconds(session.completedAt),
  };
}

function progress(current: number, goal: number) {
  if (goal <= 0) return 100;
  return Math.min(100, Math.round((current / goal) * 100));
}

function mostFrequentTitle(notes: WrongNoteDoc[]) {
  const counts = new Map<string, number>();
  notes.forEach(note => {
    const title = typeof note.examTitle === 'string' && note.examTitle.trim() ? note.examTitle : '오답';
    counts.set(title, (counts.get(title) ?? 0) + 1);
  });
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? '오답';
}

function sortRecommendations<T extends { id: string }>(items: T[], focusMode: StudyPlannerSettings['focusMode']) {
  const priorityByMode: Record<StudyPlannerSettings['focusMode'], string[]> = {
    auto: ['wrong-retry', 'weekly-exam', 'score-focus'],
    'wrong-notes': ['wrong-retry', 'score-focus', 'weekly-exam'],
    'exam-score': ['score-focus', 'wrong-retry', 'weekly-exam'],
    streak: ['weekly-exam', 'score-focus', 'wrong-retry'],
  };
  const order = priorityByMode[focusMode];
  return [...items].sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
}

async function getUid(req: NextRequest) {
  const token = req.headers.get('Authorization')?.split('Bearer ')[1];
  if (!token) return { error: NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 }) };
  try {
    return { uid: await verifyFirebaseToken(token), token };
  } catch {
    return { error: NextResponse.json({ error: '유효하지 않은 토큰입니다.' }, { status: 401 }) };
  }
}

async function loadPlanner(uid: string, token: string) {
  const now = new Date();
  const weekStart = startOfWeekKST(now);
  const monthStart = startOfMonthKST(now);
  const weekStartSeconds = Math.floor(weekStart.getTime() / 1000);
  const monthStartSeconds = Math.floor(monthStart.getTime() / 1000);

  const [userDoc, schoolSessions, practiceSessions, wrongNotes] = await Promise.all([
    fsGet(`users/${uid}`, token) as Promise<UserDoc | null>,
    fsQuery('school_exam_sessions', [{ field: 'userId', op: 'EQUAL', value: uid }], token, 10000) as Promise<SessionDoc[]>,
    fsQuery('exam_sessions', [{ field: 'userId', op: 'EQUAL', value: uid }], token, 10000) as Promise<SessionDoc[]>,
    fsQuery('wrong_notes', [{ field: 'uid', op: 'EQUAL', value: uid }], token, 10000) as Promise<WrongNoteDoc[]>,
  ]);

  const settings = normalizePlanner(userDoc?.studyPlanner);
  const sessions = [...schoolSessions, ...practiceSessions].map(normalizeSession);
  const weekSessions = sessions.filter(session => session.completedAtSeconds >= weekStartSeconds);
  const monthSessions = sessions.filter(session => session.completedAtSeconds >= monthStartSeconds);
  const weekAverage = weekSessions.length > 0
    ? Math.round((weekSessions.reduce((sum, session) => sum + session.scoreRate, 0) / weekSessions.length) * 10) / 10
    : 0;
  const openWrongNotes = wrongNotes.filter(note => note.archived !== true);
  const weeklySolvedWrongNotes = wrongNotes.filter(note => {
    const solvedSeconds = timestampSeconds(note.retrySolvedAt ?? note.archivedAt);
    return note.archived === true && solvedSeconds >= weekStartSeconds;
  });
  const weakTitle = mostFrequentTitle(openWrongNotes);
  const learningStreakDays = toNumber(userDoc?.learningStreakDays);
  const recommendations = sortRecommendations([
    {
      id: 'wrong-retry',
      title: openWrongNotes.length >= 5 ? `${weakTitle} 오답부터 줄이기` : '오답노트 가볍게 점검',
      description: openWrongNotes.length > 0
        ? `열려 있는 오답 ${openWrongNotes.length}개 중 자주 나온 ${weakTitle}부터 다시 풀어보세요.`
        : '현재 열려 있는 오답이 적습니다. 새 시험을 풀어 약점을 더 정확히 잡아봅시다.',
      href: openWrongNotes.length > 0 ? '/wrong-notes?mode=retry' : '/exam',
      priority: openWrongNotes.length >= 10 ? 'high' : 'normal',
    },
    {
      id: 'weekly-exam',
      title: weekSessions.length < settings.weeklyExamGoal ? '이번 주 목표 응시 채우기' : '이번 주 응시 목표 완료',
      description: weekSessions.length < settings.weeklyExamGoal
        ? `주간 목표까지 ${settings.weeklyExamGoal - weekSessions.length}회 남았습니다. 짧은 문제풀이로 흐름을 이어가세요.`
        : '이번 주 목표 응시는 채웠습니다. 다음은 오답 정리로 점수를 끌어올릴 차례입니다.',
      href: weekSessions.length < settings.weeklyExamGoal ? '/practice' : '/wrong-notes',
      priority: weekSessions.length < settings.weeklyExamGoal ? 'high' : 'normal',
    },
    {
      id: 'score-focus',
      title: weekAverage > 0 && weekAverage < 75 ? '평균 점수 회복 루틴' : '실전 감각 유지',
      description: weekAverage > 0 && weekAverage < 75
        ? `이번 주 평균이 ${weekAverage}%입니다. 같은 난이도 문제를 한 세트 더 풀고 오답을 바로 정리하세요.`
        : `학습 스트릭 ${learningStreakDays}일째입니다. 오늘도 한 세트만 풀면 흐름이 유지됩니다.`,
      href: weekAverage > 0 && weekAverage < 75 ? '/practice' : '/exam',
      priority: weekAverage > 0 && weekAverage < 75 ? 'high' : 'normal',
    },
  ], settings.focusMode);

  return {
    settings,
    progress: {
      weeklyExams: {
        current: weekSessions.length,
        goal: settings.weeklyExamGoal,
        percent: progress(weekSessions.length, settings.weeklyExamGoal),
      },
      weeklyWrongRetries: {
        current: weeklySolvedWrongNotes.length,
        goal: settings.weeklyWrongRetryGoal,
        percent: progress(weeklySolvedWrongNotes.length, settings.weeklyWrongRetryGoal),
      },
      monthlyExams: {
        current: monthSessions.length,
        goal: settings.monthlyExamGoal,
        percent: progress(monthSessions.length, settings.monthlyExamGoal),
      },
    },
    insights: {
      weekAverage,
      openWrongNotes: openWrongNotes.length,
      weakTitle,
      learningStreakDays,
    },
    recommendations,
    reminders: settings.reminderEnabled
      ? recommendations
          .filter(item => item.priority === 'high')
          .slice(0, 2)
          .map(item => ({
            id: `planner-${item.id}`,
            title: item.title,
            message: item.description,
            emoji: item.id === 'wrong-retry' ? '📝' : '🎯',
            href: item.href,
          }))
      : [],
    generatedAt: now.toISOString(),
  };
}

export async function GET(req: NextRequest) {
  const auth = await getUid(req);
  if (auth.error) return auth.error;

  try {
    return NextResponse.json(await loadPlanner(auth.uid, auth.token));
  } catch (e) {
    console.error('[planner] GET failed:', e);
    return NextResponse.json({ error: '공부 플래너를 불러오지 못했습니다.' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const auth = await getUid(req);
  if (auth.error) return auth.error;

  const body = await req.json().catch(() => ({}));
  const settings = normalizePlanner(body);

  try {
    await fsUpdate(`users/${auth.uid}`, {
      studyPlanner: {
        ...settings,
        updatedAt: new Date(),
      },
    }, auth.token);
    return NextResponse.json(await loadPlanner(auth.uid, auth.token));
  } catch (e) {
    console.error('[planner] PATCH failed:', e);
    return NextResponse.json({ error: '공부 플래너 저장에 실패했습니다.' }, { status: 500 });
  }
}
