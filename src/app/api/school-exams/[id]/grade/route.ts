import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { verifyFirebaseToken } from '@/lib/firebase-jwt';
import { fsGet, fsSet, fsBatch, fsQuery, WriteOp } from '@/lib/firestore-rest';
import { AchievementId, UserAchievement, createAchievement } from '@/lib/achievements';

const SCHOOL_EXAM_DIR = path.join(process.cwd(), 'src', 'data', 'school-exams');

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function todayKST(): string {
  return new Date().toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' }).replace(/\. /g, '-').replace('.', '');
}

function calcPoints(score: number, totalScore: number): number {
  const pct = (score / totalScore) * 100;
  if (pct >= 90) return 500;
  if (pct >= 80) return 350;
  if (pct >= 70) return 250;
  if (pct >= 60) return 150;
  if (pct >= 50) return 100;
  return 50;
}

type RawQuestion = {
  id: number;
  type: 'mc' | 'essay' | 'short';
  score: number;
  question: string;
  choices?: string[];
  answer?: number | string;
  expectedAnswer?: string;
  answer_text?: string;
  explanation?: string;
  rubric?: string;
  category?: string;
};

type SessionDoc = {
  _id: string;
  userId?: unknown;
  examId?: unknown;
  examTitle?: unknown;
  sheet?: unknown;
  totalScore?: unknown;
  maxScore?: unknown;
  completedAt?: unknown;
};

type SchoolExamFileMeta = {
  id?: string;
  title?: string;
  school?: string;
  grade?: number;
  subject?: string;
  sheet?: number;
};

type UserDoc = {
  achievements?: unknown;
};

function qLabel(type: RawQuestion['type']) {
  if (type === 'mc') return '객관식';
  if (type === 'short') return '주관식';
  return '서술형';
}

function questionCategory(q: RawQuestion) {
  return q.category?.trim() || qLabel(q.type);
}

function timestampSeconds(value: unknown): number {
  if (typeof value === 'object' && value !== null && typeof (value as { seconds?: unknown }).seconds === 'number') {
    return (value as { seconds: number }).seconds;
  }
  return 0;
}

function examSeriesKey(examId: string) {
  return examId.replace(/-sheet\d+$/, '');
}

function scoreRate(totalScore: number, maxScore: number) {
  return maxScore > 0 ? Math.round((totalScore / maxScore) * 1000) / 10 : 0;
}

function normalizeAchievements(value: unknown): UserAchievement[] {
  return Array.isArray(value)
    ? value.filter((item): item is UserAchievement => (
      typeof item === 'object' &&
      item !== null &&
      typeof (item as { id?: unknown }).id === 'string'
    ))
    : [];
}

function getAvailableSeriesSheets(seriesKey: string) {
  const sheets = new Set<number>();
  if (!fs.existsSync(SCHOOL_EXAM_DIR)) return [];

  for (const entry of fs.readdirSync(SCHOOL_EXAM_DIR)) {
    if (!entry.endsWith('.json')) continue;
    try {
      const fileExam = JSON.parse(fs.readFileSync(path.join(SCHOOL_EXAM_DIR, entry), 'utf8')) as SchoolExamFileMeta;
      if (fileExam.id && examSeriesKey(fileExam.id) === seriesKey && typeof fileExam.sheet === 'number') {
        sheets.add(fileExam.sheet);
      }
    } catch {
      // Ignore malformed files here; normal exam loading handles the selected file.
    }
  }

  return [...sheets].sort((a, b) => a - b);
}

function seriesLabel(exam: SchoolExamFileMeta) {
  const grade = typeof exam.grade === 'number' ? `${exam.grade}학년 ` : '';
  return [exam.school, `${grade}${exam.subject ?? ''}`.trim()].filter(Boolean).join(' ');
}

function evaluateNewAchievements(params: {
  existingAchievements: UserAchievement[];
  sessions: Array<{ examId: string; totalScore: number; maxScore: number; sheet: number | null; completedAtSeconds: number }>;
  currentSeriesKey: string;
  currentExam: SchoolExamFileMeta;
  now: Date;
}) {
  const existingIds = new Set(params.existingAchievements.map(achievement => achievement.id));
  const unlocked: UserAchievement[] = [];
  const unlock = (id: AchievementId, detail?: string) => {
    if (existingIds.has(id)) return;
    existingIds.add(id);
    unlocked.push(createAchievement(id, params.now, detail));
  };

  const orderedSessions = [...params.sessions].sort((a, b) => a.completedAtSeconds - b.completedAtSeconds);
  const recentThree = orderedSessions.slice(-3);
  if (recentThree.length === 3 && recentThree.every(session => scoreRate(session.totalScore, session.maxScore) >= 90)) {
    unlock('honor-student', '최근 3회 연속 90점 이상');
  }

  const seriesSessions = orderedSessions.filter(session => examSeriesKey(session.examId) === params.currentSeriesKey);
  const completedSheets = new Set(seriesSessions.map(session => session.sheet).filter((sheet): sheet is number => typeof sheet === 'number'));
  const label = seriesLabel(params.currentExam) || '시험 시리즈';
  if ([1, 2, 3, 4, 5].every(sheet => completedSheets.has(sheet))) {
    unlock('perfectionist', `${label} 1~5회차 완주`);
  }

  const availableSheets = getAvailableSeriesSheets(params.currentSeriesKey);
  const bestRateBySheet = new Map<number, number>();
  for (const session of seriesSessions) {
    if (typeof session.sheet !== 'number') continue;
    bestRateBySheet.set(session.sheet, Math.max(bestRateBySheet.get(session.sheet) ?? 0, scoreRate(session.totalScore, session.maxScore)));
  }
  if (
    availableSheets.length >= 5 &&
    availableSheets.every(sheet => (bestRateBySheet.get(sheet) ?? 0) >= 90)
  ) {
    unlock('master', `${label} 전 회차 90점 이상`);
  }

  return unlocked;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const token = req.headers.get('Authorization')?.split('Bearer ')[1];
  if (!token) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });

  let uid: string;
  try {
    uid = await verifyFirebaseToken(token);
  } catch {
    return NextResponse.json({ error: '유효하지 않은 토큰입니다.' }, { status: 401 });
  }

  const file = path.join(SCHOOL_EXAM_DIR, `${id}.json`);
  if (!fs.existsSync(file)) {
    return NextResponse.json({ error: '시험을 찾을 수 없습니다.' }, { status: 404 });
  }

  const exam = JSON.parse(fs.readFileSync(file, 'utf8'));
  const body = await req.json();
  const mcAnswers: Record<string, number> = body.mcAnswers ?? {};
  const essayAnswers: Record<string, string> = body.essayAnswers ?? {};
  const timings: Record<string, number> = body.timings ?? {};
  const totalTime: number = typeof body.totalTime === 'number' ? body.totalTime : 0;

  const now = new Date();
  const today = todayKST();
  const attemptKey = `school_exam_attempts/${uid}_${id}_${today}`;
  const existing = await fsGet(attemptKey, token);
  const alreadyRewarded = !!existing;

  let mcScore = 0;
  let essayScore = 0;
  const results: Array<{
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
  }> = [];

  const wrongNoteWrites: WriteOp[] = [];

  for (const q of exam.questions as RawQuestion[]) {
    if (q.type === 'mc') {
      const userAns = mcAnswers[String(q.id)];
      const correct = userAns === q.answer;
      if (correct) mcScore += q.score;
      results.push({
        id: q.id,
        type: 'mc',
        category: questionCategory(q),
        question: q.question,
        choices: q.choices,
        yourAnswer: userAns,
        correctAnswer: q.answer,
        correct,
        score: q.score,
        earnedScore: correct ? q.score : 0,
        explanation: q.explanation,
        timeSpent: timings[String(q.id)] ?? 0,
      });

      if (!correct && userAns !== undefined) {
        const noteId = `${uid}__${id}__${q.id}`;
        wrongNoteWrites.push({
          type: 'add',
          collection: 'wrong_notes',
          id: noteId,
          data: {
            uid,
            source: 'school_exam',
            examId: id,
            examTitle: exam.title,
            questionId: q.id,
            questionType: 'mc',
            question: q.question,
            choices: q.choices ?? [],
            correctAnswer: q.answer,
            yourAnswer: userAns,
            explanation: q.explanation ?? '',
            addedAt: now,
            archived: false,
          },
        });
      }
    } else {
      const userAns = (essayAnswers[String(q.id)] ?? '').trim();
      const expected = (q.expectedAnswer ?? '').trim().toLowerCase().replace(/\s/g, '');
      const normalized = userAns.toLowerCase().replace(/\s/g, '');
      const correct = normalized === expected;
      if (correct) essayScore += q.score;
      results.push({
        id: q.id,
        type: q.type,
        category: questionCategory(q),
        question: q.question,
        yourAnswer: userAns,
        correctAnswer: q.expectedAnswer,
        correct,
        score: q.score,
        earnedScore: correct ? q.score : 0,
        modelAnswer: q.answer_text ?? q.answer as unknown as string,
        rubric: q.rubric,
        timeSpent: timings[String(q.id)] ?? 0,
      });

      if (!correct && userAns) {
        const noteId = `${uid}__${id}__${q.id}`;
        wrongNoteWrites.push({
          type: 'add',
          collection: 'wrong_notes',
          id: noteId,
          data: {
            uid,
            source: 'school_exam',
            examId: id,
            examTitle: exam.title,
            questionId: q.id,
            questionType: 'essay',
            question: q.question,
            choices: [],
            correctAnswer: q.expectedAnswer ?? '',
            yourAnswer: userAns,
            explanation: q.rubric ?? '',
            addedAt: now,
            archived: false,
          },
        });
      }
    }
  }

  const totalScore = mcScore + essayScore;
  const pts = calcPoints(totalScore, exam.totalScore);
  const sessionId = genId();

  // Batch 1: session + wrong notes
  try {
    await fsBatch([
      {
        type: 'add',
        collection: 'school_exam_sessions',
        id: sessionId,
        data: {
          userId: uid,
          examId: id,
          examTitle: exam.title,
          sheet: exam.sheet,
          mcScore,
          essayScore,
          totalScore,
          maxScore: exam.totalScore,
          pointsEarned: alreadyRewarded ? 0 : pts,
          completedAt: now,
        },
      },
      ...wrongNoteWrites,
    ], token);
  } catch (e) {
    console.error('[school-exams/grade] fsBatch (core) failed:', e);
    return NextResponse.json({
      mcScore, essayScore, totalScore,
      maxScore: exam.totalScore,
      pointsEarned: 0, alreadyRewarded,
      results,
    });
  }

  // Batch 2: points (best-effort)
  if (!alreadyRewarded) {
    try {
      await fsBatch([
        { type: 'increment', path: `users/${uid}`, field: 'points', delta: pts },
        {
          type: 'add',
          collection: 'point_logs',
          id: genId(),
          data: {
            userId: uid,
            amount: pts,
            reason: `[${exam.title}] ${totalScore}/${exam.totalScore}점`,
            sessionId,
            createdAt: now,
          },
        },
      ], token);
      await fsSet(attemptKey, { userId: uid, examId: id, date: today, createdAt: now }, token);
    } catch (e) {
      console.error('[school-exams/grade] fsBatch (points) failed:', e);
    }
  }

  let userSessions: SessionDoc[] = [];
  try {
    userSessions = await fsQuery(
      'school_exam_sessions',
      [{ field: 'userId', op: 'EQUAL', value: uid }],
      token,
      10000
    ) as SessionDoc[];
  } catch (e) {
    console.error('[school-exams/grade] sessions query failed:', e);
  }

  let achievementsUnlocked: UserAchievement[] = [];
  let achievementPointsEarned = 0;
  const currentSession = {
    examId: id,
    totalScore,
    maxScore: exam.totalScore,
    sheet: typeof exam.sheet === 'number' ? exam.sheet : null,
    completedAtSeconds: Math.floor(now.getTime() / 1000),
  };
  const sessionsForAchievements = [
    ...userSessions
      .filter(session => session._id !== sessionId)
      .map(session => ({
        examId: typeof session.examId === 'string' ? session.examId : '',
        totalScore: typeof session.totalScore === 'number' ? session.totalScore : 0,
        maxScore: typeof session.maxScore === 'number' ? session.maxScore : 0,
        sheet: typeof session.sheet === 'number' ? session.sheet : null,
        completedAtSeconds: timestampSeconds(session.completedAt),
      }))
      .filter(session => session.examId),
    currentSession,
  ];

  try {
    const userDoc = await fsGet(`users/${uid}`, token) as UserDoc | null;
    const existingAchievements = normalizeAchievements(userDoc?.achievements);
    achievementsUnlocked = evaluateNewAchievements({
      existingAchievements,
      sessions: sessionsForAchievements,
      currentSeriesKey: examSeriesKey(id),
      currentExam: exam,
      now,
    });
    achievementPointsEarned = achievementsUnlocked.reduce((sum, achievement) => sum + achievement.points, 0);

    if (achievementsUnlocked.length > 0) {
      await fsBatch([
        {
          type: 'update',
          path: `users/${uid}`,
          data: { achievements: [...existingAchievements, ...achievementsUnlocked] },
        },
        { type: 'increment', path: `users/${uid}`, field: 'points', delta: achievementPointsEarned },
        ...achievementsUnlocked.map(achievement => ({
          type: 'add' as const,
          collection: 'point_logs',
          id: genId(),
          data: {
            userId: uid,
            amount: achievement.points,
            reason: `${achievement.emoji} 업적 달성: ${achievement.title}`,
            achievementId: achievement.id,
            sessionId,
            createdAt: now,
          },
        })),
      ], token);
    }
  } catch (e) {
    console.error('[school-exams/grade] achievement update failed:', e);
    achievementsUnlocked = [];
    achievementPointsEarned = 0;
  }

  // 분석 데이터 계산
  const mcCount = exam.questions.filter((q: RawQuestion) => q.type === 'mc').length;
  const essayCount = exam.questions.length - mcCount;
  const mcCorrect = results.filter(r => r.type === 'mc' && r.correct).length;
  const essayCorrect = results.filter(r => r.type !== 'mc' && r.correct).length;
  const avgTime = exam.questions.length > 0 ? Math.round(totalTime / exam.questions.length) : 0;
  const categoryStatsMap = new Map<string, { category: string; correct: number; total: number; earnedScore: number; totalScore: number; totalTime: number }>();
  results.forEach(result => {
    const current = categoryStatsMap.get(result.category) ?? {
      category: result.category,
      correct: 0,
      total: 0,
      earnedScore: 0,
      totalScore: 0,
      totalTime: 0,
    };
    current.total += 1;
    current.correct += result.correct ? 1 : 0;
    current.earnedScore += result.earnedScore;
    current.totalScore += result.score;
    current.totalTime += result.timeSpent ?? 0;
    categoryStatsMap.set(result.category, current);
  });
  const categoryStats = Array.from(categoryStatsMap.values()).map(stats => ({
    ...stats,
    accuracy: stats.total > 0 ? Math.round((stats.correct / stats.total) * 1000) / 10 : 0,
    scoreRate: stats.totalScore > 0 ? Math.round((stats.earnedScore / stats.totalScore) * 1000) / 10 : 0,
    avgTime: stats.total > 0 ? Math.round(stats.totalTime / stats.total) : 0,
  }));
  const questionBreakdown = results.map(result => ({
    id: result.id,
    type: result.type,
    category: result.category,
    correct: result.correct,
    earnedScore: result.earnedScore,
    score: result.score,
    timeSpent: result.timeSpent ?? 0,
  }));
  const weakestCategories = [...categoryStats]
    .sort((a, b) => a.scoreRate - b.scoreRate || b.total - a.total)
    .slice(0, 2);
  const slowestWrong = results
    .filter(result => !result.correct)
    .sort((a, b) => (b.timeSpent ?? 0) - (a.timeSpent ?? 0))
    .slice(0, 3)
    .map(result => result.id);
  const feedback: string[] = [];
  const totalRate = exam.totalScore > 0 ? Math.round((totalScore / exam.totalScore) * 1000) / 10 : 0;
  if (totalRate >= 90) feedback.push('전체 이해도가 높습니다. 틀린 문항만 오답노트로 점검하면 충분합니다.');
  else if (totalRate >= 70) feedback.push('기본기는 잡혀 있습니다. 낮은 카테고리와 오래 걸린 오답을 우선 복습하세요.');
  else feedback.push('핵심 개념을 다시 정리한 뒤 비슷한 유형을 짧게 반복하는 것이 좋습니다.');
  weakestCategories
    .filter(category => category.scoreRate < 80)
    .forEach(category => feedback.push(`${category.category} 영역의 점수율이 ${category.scoreRate}%입니다. 이 부분을 더 공부하세요.`));
  if (slowestWrong.length > 0) {
    feedback.push(`오답 중 시간이 오래 걸린 ${slowestWrong.map(questionId => `${questionId}번`).join(', ')} 문항을 먼저 다시 풀어보세요.`);
  }

  let trend: Array<{ sessionId: string; examId: string; examTitle: string; sheet: number | null; totalScore: number; maxScore: number; scoreRate: number; completedAt: { seconds: number } | null }> = [];
  try {
    trend = [
      ...userSessions
        .filter(session => session._id !== sessionId)
        .map(session => {
          const sessionTotal = typeof session.totalScore === 'number' ? session.totalScore : 0;
          const sessionMax = typeof session.maxScore === 'number' ? session.maxScore : 0;
          const completedAtSeconds = timestampSeconds(session.completedAt);
          return {
            sessionId: session._id,
            examId: typeof session.examId === 'string' ? session.examId : '',
            examTitle: typeof session.examTitle === 'string' ? session.examTitle : '알 수 없음',
            sheet: typeof session.sheet === 'number' ? session.sheet : null,
            totalScore: sessionTotal,
            maxScore: sessionMax,
            scoreRate: sessionMax > 0 ? Math.round((sessionTotal / sessionMax) * 1000) / 10 : 0,
            completedAt: completedAtSeconds > 0 ? { seconds: completedAtSeconds } : null,
          };
        }),
      {
        sessionId,
        examId: id,
        examTitle: exam.title,
        sheet: typeof exam.sheet === 'number' ? exam.sheet : null,
        totalScore,
        maxScore: exam.totalScore,
        scoreRate: totalRate,
        completedAt: { seconds: Math.floor(now.getTime() / 1000) },
      },
    ]
      .sort((a, b) => (a.completedAt?.seconds ?? 0) - (b.completedAt?.seconds ?? 0))
      .slice(-8);
  } catch (e) {
    console.error('[school-exams/grade] trend analysis failed:', e);
  }

  return NextResponse.json({
    mcScore,
    essayScore,
    totalScore,
    maxScore: exam.totalScore,
    pointsEarned: alreadyRewarded ? 0 : pts,
    achievementPointsEarned,
    achievementsUnlocked,
    alreadyRewarded,
    results,
    analysis: {
      mcCorrectCount: mcCorrect,
      mcTotalCount: mcCount,
      essayCorrectCount: essayCorrect,
      essayTotalCount: essayCount,
      avgTimePerQuestion: avgTime,
      totalTimeSpent: totalTime,
      totalAccuracy: results.length > 0 ? Math.round(((mcCorrect + essayCorrect) / results.length) * 1000) / 10 : 0,
      categoryStats,
      questionBreakdown,
      weakestCategories,
      feedback,
      trend,
    },
  });
}
