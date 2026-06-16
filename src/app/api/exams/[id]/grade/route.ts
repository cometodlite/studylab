import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { calcExamPoints } from '@/lib/points';
import { FieldValue } from 'firebase-admin/firestore';

const DATA_DIR = path.join(process.cwd(), 'src', 'data');

function findExam(id: string) {
  const files = fs.readdirSync(DATA_DIR).filter(f => f.endsWith('.json'));
  for (const f of files) {
    const exam = JSON.parse(fs.readFileSync(path.join(DATA_DIR, f), 'utf8'));
    if (exam.id === id) return exam;
  }
  return null;
}

export async function POST(req: NextRequest, ctx: RouteContext<'/api/exams/[id]/grade'>) {
  const { id } = await ctx.params;

  // Firebase 토큰 검증
  const token = req.headers.get('Authorization')?.split('Bearer ')[1];
  if (!token) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });

  let uid: string;
  try {
    const decoded = await adminAuth().verifyIdToken(token);
    uid = decoded.uid;
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
    .map((q: { id: number; question: string; choices: string[]; answer: number; explanation?: string }) => {
      const yourAnswer = answers[String(q.id)];
      return {
        id: q.id,
        question: q.question,
        choices: q.choices,
        yourAnswer,
        correctAnswer: q.answer,
        correct: yourAnswer === q.answer,
        explanation: q.explanation ?? '',
      };
    });

  const correct = results.filter((r: { correct: boolean }) => r.correct).length;
  const total = results.length;
  const pts = calcExamPoints(correct, total);

  // Firestore에 포인트 지급 및 기록
  const firestoreDb = adminDb();
  const batch = firestoreDb.batch();

  const userRef = firestoreDb.doc(`users/${uid}`);
  batch.update(userRef, { points: FieldValue.increment(pts.total) });

  const sessionRef = firestoreDb.collection('exam_sessions').doc();
  batch.set(sessionRef, {
    userId: uid,
    examId: id,
    examTitle: exam.title,
    score: correct,
    total,
    pointsEarned: pts.total,
    completedAt: FieldValue.serverTimestamp(),
  });

  const logRef = firestoreDb.collection('point_logs').doc();
  batch.set(logRef, {
    userId: uid,
    amount: pts.total,
    reason: `[${exam.title}] ${correct}/${total}점 — ${pts.reasons.join(', ')}`,
    examSessionId: sessionRef.id,
    createdAt: FieldValue.serverTimestamp(),
  });

  await batch.commit();

  return NextResponse.json({ score: correct, total, pointsEarned: pts.total, reasons: pts.reasons, results });
}
