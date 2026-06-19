import { NextRequest, NextResponse } from 'next/server';
import { verifyFirebaseToken } from '@/lib/firebase-jwt';
import { fsGet, fsSet, fsBatch, WriteOp } from '@/lib/firestore-rest';
import { calcExamPoints, type Difficulty } from '@/lib/points';
import { updateLearningStreak } from '@/lib/learning-streak';

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function todayKST(): string {
  return new Date().toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' }).replace(/\. /g, '-').replace('.', '');
}

function topDifficulty(difficulties: string[]): Difficulty {
  const order: Difficulty[] = ['킬러', '심화', '유형별', '기본'];
  return order.find(d => difficulties.includes(d)) ?? '기본';
}

interface SubmittedResult {
  id: number;
  correct: boolean;
  yourAnswer: number;
  correctAnswer: number;
  question: string;
  choices: string[];
  explanation?: string;
  unit?: string;
}

export async function POST(req: NextRequest) {
  const token = req.headers.get('Authorization')?.split('Bearer ')[1];
  if (!token) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });

  let uid: string;
  try {
    uid = await verifyFirebaseToken(token);
  } catch {
    return NextResponse.json({ error: '유효하지 않은 토큰입니다.' }, { status: 401 });
  }

  const body = await req.json();
  const title: string = body.title ?? '생성 시험';
  const grade: number = body.grade ?? 0;
  const units: string[] = body.units ?? [];
  const difficulties: string[] = body.difficulties ?? [];
  const score: number = body.score ?? 0;
  const total: number = body.total ?? 0;
  const totalTime: number = body.totalTime ?? 0;
  const results: SubmittedResult[] = body.results ?? [];

  const difficulty = topDifficulty(difficulties);
  const pts = calcExamPoints(score, total, difficulty);
  const now = new Date();
  const today = todayKST();

  // 하루 1회 포인트 제한 (학년 + 단원 조합 기준)
  const unitKey = [...units].sort().join('_');
  const attemptKey = `exam_attempts/${uid}_gen_${grade}_${unitKey}_${today}`;
  const existing = await fsGet(attemptKey, token);
  const alreadyRewarded = !!existing;

  const sessionId = genId();

  // 오답 노트 저장
  const wrongNoteWrites: WriteOp[] = results
    .filter(r => !r.correct)
    .map(r => ({
      type: 'add' as const,
      collection: 'wrong_notes',
      id: `${uid}__gen_${grade}_${r.unit ?? ''}_${r.id}_${today}`,
      data: {
        uid,
        source: 'generated_exam',
        examId: `gen_${grade}_${unitKey}`,
        examTitle: title,
        questionId: r.id,
        questionType: 'mc',
        question: r.question,
        choices: r.choices ?? [],
        correctAnswer: r.correctAnswer,
        yourAnswer: r.yourAnswer,
        explanation: r.explanation ?? '',
        addedAt: now,
        archived: false,
      },
    }));

  try {
    await fsBatch([
      {
        type: 'add',
        collection: 'exam_sessions',
        id: sessionId,
        data: {
          userId: uid,
          examId: `gen_${grade}_${unitKey}`,
          examTitle: title,
          grade,
          units,
          difficulties,
          score,
          total,
          totalTime,
          difficulty,
          pointsEarned: alreadyRewarded ? 0 : pts.total,
          completedAt: now,
        },
      },
      ...wrongNoteWrites,
    ], token);
  } catch (e) {
    console.error('[exams/session/grade] fsBatch (core) failed:', e);
    return NextResponse.json({ pointsEarned: 0, alreadyRewarded, reasons: [] });
  }

  if (!alreadyRewarded) {
    try {
      await fsBatch([
        { type: 'increment', path: `users/${uid}`, field: 'points', delta: pts.total },
        {
          type: 'add',
          collection: 'point_logs',
          id: genId(),
          data: {
            userId: uid,
            amount: pts.total,
            reason: `[${title}] ${score}/${total}문제 — ${pts.reasons.join(', ')}`,
            examSessionId: sessionId,
            createdAt: now,
          },
        },
      ], token);
      await fsSet(attemptKey, { userId: uid, grade, units, date: today, createdAt: now }, token);
    } catch (e) {
      console.error('[exams/session/grade] fsBatch (points) failed:', e);
    }
  }

  let learningStreak = null;
  try {
    learningStreak = await updateLearningStreak(uid, token, now);
  } catch (e) {
    console.error('[exams/session/grade] learning streak failed:', e);
  }

  return NextResponse.json({
    pointsEarned: alreadyRewarded ? 0 : pts.total,
    alreadyRewarded,
    reasons: alreadyRewarded ? ['오늘 이미 이 범위의 포인트를 받았습니다.'] : pts.reasons,
    learningStreak,
  });
}
