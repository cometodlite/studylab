import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { verifyFirebaseToken } from '@/lib/firebase-jwt';
import { fsBatch, WriteOp } from '@/lib/firestore-rest';
import { calcExamPoints } from '@/lib/points';

const DATA_DIR = path.join(process.cwd(), 'src', 'data');

function findExam(id: string) {
  const files = fs.readdirSync(DATA_DIR).filter(f => f.endsWith('.json'));
  for (const f of files) {
    const exam = JSON.parse(fs.readFileSync(path.join(DATA_DIR, f), 'utf8'));
    if (exam.id === id) return exam;
  }
  return null;
}

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

export async function POST(req: NextRequest, ctx: RouteContext<'/api/exams/[id]/grade'>) {
  const { id } = await ctx.params;

  const token = req.headers.get('Authorization')?.split('Bearer ')[1];
  if (!token) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });

  let uid: string;
  try {
    uid = await verifyFirebaseToken(token);
  } catch {
    return NextResponse.json({ error: '유효하지 않은 토큰입니다.' }, { status: 401 });
  }

  const exam = findExam(id);
  if (!exam) return NextResponse.json({ error: '시험을 찾을 수 없습니다.' }, { status: 404 });

  const body = await req.json();
  const answers: Record<string, number> = body.answers ?? {};
  const submittedIds = Object.keys(answers);

  const results = exam.questions
    .filter((q: { id: number }) => submittedIds.includes(String(q.id)))
    .map((q: { id: number; question: string; choices: string[]; answer: number; explanation?: string }) => ({
      id: q.id,
      question: q.question,
      choices: q.choices,
      yourAnswer: answers[String(q.id)],
      correctAnswer: q.answer,
      correct: answers[String(q.id)] === q.answer,
      explanation: q.explanation ?? '',
    }));

  const correct = results.filter((r: { correct: boolean }) => r.correct).length;
  const total = results.length;
  const pts = calcExamPoints(correct, total);
  const now = new Date();
  const sessionId = genId();
  const logId = genId();

  const writes: WriteOp[] = [
    { type: 'increment', path: `users/${uid}`, field: 'points', delta: pts.total },
    {
      type: 'add',
      collection: 'exam_sessions',
      id: sessionId,
      data: { userId: uid, examId: id, examTitle: exam.title, score: correct, total, pointsEarned: pts.total, completedAt: now },
    },
    {
      type: 'add',
      collection: 'point_logs',
      id: logId,
      data: {
        userId: uid,
        amount: pts.total,
        reason: `[${exam.title}] ${correct}/${total}점 — ${pts.reasons.join(', ')}`,
        examSessionId: sessionId,
        createdAt: now,
      },
    },
  ];

  await fsBatch(writes, token);

  return NextResponse.json({ score: correct, total, pointsEarned: pts.total, reasons: pts.reasons, results });
}
