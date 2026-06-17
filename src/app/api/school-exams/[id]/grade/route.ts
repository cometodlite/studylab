import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { verifyFirebaseToken } from '@/lib/firebase-jwt';
import { fsGet, fsSet, fsBatch, WriteOp } from '@/lib/firestore-rest';

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
  answer?: number;
  expectedAnswer?: string;
  answer_text?: string;
  explanation?: string;
  rubric?: string;
};

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
        question: q.question,
        choices: q.choices,
        yourAnswer: userAns,
        correctAnswer: q.answer,
        correct,
        score: q.score,
        earnedScore: correct ? q.score : 0,
        explanation: q.explanation,
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
        question: q.question,
        yourAnswer: userAns,
        correctAnswer: q.expectedAnswer,
        correct,
        score: q.score,
        earnedScore: correct ? q.score : 0,
        modelAnswer: q.answer_text ?? q.answer as unknown as string,
        rubric: q.rubric,
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

  const writes: WriteOp[] = [
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
  ];

  if (!alreadyRewarded) {
    writes.push(
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
      }
    );
    try {
      await fsSet(attemptKey, { userId: uid, examId: id, date: today, createdAt: now }, token);
    } catch (e) {
      console.error('[school-exams/grade] fsSet attempt failed:', e);
    }
  }

  try {
    await fsBatch(writes, token);
  } catch (e) {
    console.error('[school-exams/grade] fsBatch failed:', e);
    return NextResponse.json({
      mcScore, essayScore, totalScore,
      maxScore: exam.totalScore,
      pointsEarned: 0, alreadyRewarded,
      results,
    });
  }

  return NextResponse.json({
    mcScore,
    essayScore,
    totalScore,
    maxScore: exam.totalScore,
    pointsEarned: alreadyRewarded ? 0 : pts,
    alreadyRewarded,
    results,
  });
}
