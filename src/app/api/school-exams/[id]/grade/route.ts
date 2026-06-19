import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { verifyFirebaseToken } from '@/lib/firebase-jwt';
import { fsGet, fsSet, fsBatch, fsQuery, WriteOp } from '@/lib/firestore-rest';
import { AchievementId, UserAchievement, createAchievement } from '@/lib/achievements';
import { updateLearningStreak, type LearningStreakResult } from '@/lib/learning-streak';
import type { GoalAlert } from '@/lib/notifications';

const SCHOOL_EXAM_DIR = path.join(process.cwd(), 'src', 'data', 'school-exams');
const DATA_DIR = path.join(process.cwd(), 'src', 'data');
const PRACTICE_SKIP_DIRS = new Set(['archive', 'concepts', 'roadway', 'school-exams', 'workbooks']);

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
  difficulty?: string;
};

type UserDoc = {
  achievements?: unknown;
};

type PracticeExamMeta = {
  id: string;
  title: string;
  description: string;
  grade: number | null;
  unit: string | null;
  difficulty: string | null;
  questionCount: number;
};

type SchoolExamRecommendationMeta = {
  id: string;
  title: string;
  school?: string;
  grade?: number;
  subject?: string;
  sheet?: number;
  difficulty?: string;
  questionCount: number;
};

type RecommendedSet = {
  id: string;
  title: string;
  description: string;
  href: string;
  source: 'practice' | 'school_exam';
  difficulty: string | null;
  unit: string | null;
  questionCount: number;
  reason: string;
};

type LearningPathStep = {
  title: string;
  description: string;
  href?: string;
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

function scanJsonFiles(dir: string, skipDirs = new Set<string>()): string[] {
  if (!fs.existsSync(dir)) return [];
  const result: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (skipDirs.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) result.push(...scanJsonFiles(full, skipDirs));
    else if (entry.name.endsWith('.json')) result.push(full);
  }
  return result;
}

function normalizeDifficulty(value: unknown) {
  if (typeof value !== 'string') return null;
  if (value.includes('기초') || value.includes('기본')) return '기본';
  if (value.includes('유형')) return '유형별';
  if (value.includes('심화')) return '심화';
  if (value.includes('킬러')) return '킬러';
  return value;
}

function loadPracticeExams(): PracticeExamMeta[] {
  return scanJsonFiles(DATA_DIR, PRACTICE_SKIP_DIRS)
    .map(filePath => {
      try {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        if (!data?.id || !Array.isArray(data.questions)) return null;
        return {
          id: String(data.id),
          title: String(data.title ?? data.id),
          description: String(data.description ?? ''),
          grade: typeof data.grade === 'number' ? data.grade : null,
          unit: typeof data.unit === 'string' ? data.unit : null,
          difficulty: normalizeDifficulty(data.difficulty),
          questionCount: data.questions.length,
        };
      } catch {
        return null;
      }
    })
    .filter((exam): exam is PracticeExamMeta => exam !== null);
}

function loadSchoolExamMetas(currentId: string): SchoolExamRecommendationMeta[] {
  return scanJsonFiles(SCHOOL_EXAM_DIR)
    .map((filePath): SchoolExamRecommendationMeta | null => {
      try {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        if (!data?.id || data.id === currentId || !Array.isArray(data.questions)) return null;
        return {
          id: String(data.id),
          title: String(data.title ?? data.id),
          school: typeof data.school === 'string' ? data.school : undefined,
          grade: typeof data.grade === 'number' ? data.grade : undefined,
          subject: typeof data.subject === 'string' ? data.subject : undefined,
          sheet: typeof data.sheet === 'number' ? data.sheet : undefined,
          difficulty: typeof data.difficulty === 'string' ? data.difficulty : undefined,
          questionCount: data.questions.length,
        };
      } catch {
        return null;
      }
    })
    .filter((exam): exam is SchoolExamRecommendationMeta => exam !== null);
}

function buildStudyRecommendations(params: {
  exam: SchoolExamFileMeta;
  examId: string;
  totalRate: number;
  weakestCategories: Array<{ category: string; scoreRate: number }>;
  results: Array<{ id: number; type: string; category: string; correct: boolean; question: string }>;
}): { summary: string; recommendedSets: RecommendedSet[]; learningPath: LearningPathStep[] } {
  const weakLabels = params.weakestCategories
    .filter(category => category.scoreRate < 85)
    .map(category => category.category);
  const weakText = weakLabels.length > 0 ? weakLabels.join(', ') : '전체 유형';
  const targetDifficulty = normalizeDifficulty(params.exam.difficulty) ?? (params.totalRate >= 80 ? '유형별' : '기본');
  const wrongType = params.results.find(result => !result.correct)?.type ?? 'mc';
  const wrongTypeLabel = wrongType === 'mc' ? '객관식' : wrongType === 'short' ? '주관식' : '서술형';

  const practiceCandidates = (params.exam.subject === '수학' ? loadPracticeExams() : [])
    .map(candidate => {
      let score = 0;
      if (typeof params.exam.grade === 'number' && candidate.grade === params.exam.grade) score += 35;
      if (candidate.difficulty === targetDifficulty) score += 25;
      if (candidate.unit && weakLabels.some(label => candidate.unit?.includes(label) || candidate.title.includes(label))) score += 30;
      if (candidate.title.includes(String(params.exam.subject ?? ''))) score += 5;
      return { candidate, score };
    })
    .filter(item => item.score >= 25)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(({ candidate }) => ({
      id: candidate.id,
      title: candidate.title,
      description: candidate.description || `${targetDifficulty} 난이도의 유사 유형 연습입니다.`,
      href: `/practice/${candidate.id}?shuffle=1&count=10`,
      source: 'practice' as const,
      difficulty: candidate.difficulty,
      unit: candidate.unit,
      questionCount: Math.min(candidate.questionCount, 10),
      reason: `${weakText} 보강에 맞춘 ${candidate.difficulty ?? targetDifficulty} 문제입니다.`,
    }));

  const schoolCandidates = loadSchoolExamMetas(params.examId)
    .map(candidate => {
      let score = 0;
      if (candidate.subject === params.exam.subject) score += 35;
      if (candidate.grade === params.exam.grade) score += 20;
      if (candidate.school === params.exam.school) score += 15;
      if (normalizeDifficulty(candidate.difficulty) === targetDifficulty) score += 10;
      if (typeof candidate.sheet === 'number' && typeof params.exam.sheet === 'number' && candidate.sheet > params.exam.sheet) score += 5;
      return { candidate, score };
    })
    .filter(item => item.score >= 35)
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.max(1, 4 - practiceCandidates.length))
    .map(({ candidate }) => ({
      id: candidate.id,
      title: candidate.title ?? candidate.id,
      description: '같은 내신 범위의 다른 회차로 실전 감각을 이어갑니다.',
      href: `/exam/${candidate.id}`,
      source: 'school_exam' as const,
      difficulty: normalizeDifficulty(candidate.difficulty),
      unit: candidate.subject ?? null,
      questionCount: candidate.questionCount,
      reason: `같은 ${candidate.subject ?? '과목'} 회차로 ${wrongTypeLabel} 감각을 다시 확인하세요.`,
    }));

  const recommendedSets = [...practiceCandidates, ...schoolCandidates].slice(0, 4);
  const firstHref = recommendedSets[0]?.href;
  const learningPath: LearningPathStep[] = [
    {
      title: '오답 재점검',
      description: `${weakText}에서 놓친 개념과 해설을 먼저 다시 확인하세요.`,
      href: '/wrong-notes',
    },
    {
      title: '같은 난이도 반복',
      description: `${targetDifficulty} 난이도의 ${wrongTypeLabel} 중심 문제를 짧게 풀어 감각을 회복하세요.`,
      href: firstHref,
    },
    {
      title: '실전 회차 확인',
      description: '유사 회차를 한 번 더 풀어 점수 변화를 확인하세요.',
      href: schoolCandidates[0]?.href ?? firstHref,
    },
  ];

  return {
    summary: `${weakText} 약점을 기준으로 ${targetDifficulty} 난이도와 ${wrongTypeLabel} 유형에 가까운 문제를 추천했습니다.`,
    recommendedSets,
    learningPath,
  };
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

function buildAchievementGoalAlerts(params: {
  achievements: UserAchievement[];
  sessions: Array<{ examId: string; totalScore: number; maxScore: number; sheet: number | null; completedAtSeconds: number }>;
  currentSeriesKey: string;
  currentExam: SchoolExamFileMeta;
}): GoalAlert[] {
  const existingIds = new Set(params.achievements.map(achievement => achievement.id));
  const orderedSessions = [...params.sessions].sort((a, b) => a.completedAtSeconds - b.completedAtSeconds);
  const alerts: GoalAlert[] = [];

  if (!existingIds.has('honor-student')) {
    const recentTwo = orderedSessions.slice(-2);
    if (recentTwo.length === 2 && recentTwo.every(session => scoreRate(session.totalScore, session.maxScore) >= 90)) {
      alerts.push({
        id: 'near-honor-student',
        emoji: '🏆',
        title: '우등생 배지까지 한 번 남았어요',
        message: '다음 시험도 90점 이상이면 3회 연속 90점 이상으로 우등생 배지를 받을 수 있습니다.',
        href: '/exam',
      });
    }
  }

  const seriesSessions = orderedSessions.filter(session => examSeriesKey(session.examId) === params.currentSeriesKey);
  const completedSheets = new Set(seriesSessions.map(session => session.sheet).filter((sheet): sheet is number => typeof sheet === 'number'));
  const missingCoreSheets = [1, 2, 3, 4, 5].filter(sheet => !completedSheets.has(sheet));
  const label = seriesLabel(params.currentExam) || '시험 시리즈';
  if (!existingIds.has('perfectionist') && missingCoreSheets.length === 1) {
    alerts.push({
      id: 'near-perfectionist',
      emoji: '🎯',
      title: '완벽주의자 배지까지 한 회차 남았어요',
      message: `${label} ${missingCoreSheets[0]}회차만 완료하면 5회차 완주 배지를 받을 수 있습니다.`,
      href: '/exam',
    });
  }

  const availableSheets = getAvailableSeriesSheets(params.currentSeriesKey);
  const bestRateBySheet = new Map<number, number>();
  for (const session of seriesSessions) {
    if (typeof session.sheet !== 'number') continue;
    bestRateBySheet.set(session.sheet, Math.max(bestRateBySheet.get(session.sheet) ?? 0, scoreRate(session.totalScore, session.maxScore)));
  }
  const nearMasterSheets = availableSheets.filter(sheet => (bestRateBySheet.get(sheet) ?? 0) < 90);
  if (!existingIds.has('master') && availableSheets.length >= 5 && nearMasterSheets.length === 1) {
    alerts.push({
      id: 'near-master',
      emoji: '💎',
      title: '마스터 배지까지 한 회차 남았어요',
      message: `${label} ${nearMasterSheets[0]}회차에서 90점 이상을 만들면 마스터 배지를 받을 수 있습니다.`,
      href: '/exam',
    });
  }

  return alerts.slice(0, 2);
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
  let existingAchievementsForGoals: UserAchievement[] = [];
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
    existingAchievementsForGoals = existingAchievements;
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

  let learningStreak: LearningStreakResult | null = null;
  try {
    learningStreak = await updateLearningStreak(uid, token, now);
    if (learningStreak.achievementsUnlocked.length > 0) {
      achievementsUnlocked = [...achievementsUnlocked, ...learningStreak.achievementsUnlocked];
      achievementPointsEarned += learningStreak.achievementPointsEarned;
    }
  } catch (e) {
    console.error('[school-exams/grade] learning streak update failed:', e);
  }
  const combinedAchievements = [...existingAchievementsForGoals, ...achievementsUnlocked];
  const goalAlerts = [
    ...buildAchievementGoalAlerts({
      achievements: combinedAchievements,
      sessions: sessionsForAchievements,
      currentSeriesKey: examSeriesKey(id),
      currentExam: exam,
    }),
    ...(learningStreak?.goalAlerts ?? []),
  ];

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
  const recommendations = buildStudyRecommendations({
    exam,
    examId: id,
    totalRate,
    weakestCategories,
    results: results.map(result => ({
      id: result.id,
      type: result.type,
      category: result.category,
      correct: result.correct,
      question: result.question,
    })),
  });

  return NextResponse.json({
    mcScore,
    essayScore,
    totalScore,
    maxScore: exam.totalScore,
    pointsEarned: alreadyRewarded ? 0 : pts,
    achievementPointsEarned,
    achievementsUnlocked,
    alreadyRewarded,
    learningStreak,
    goalAlerts,
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
      recommendations,
    },
  });
}
