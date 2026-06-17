import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { verifyFirebaseToken } from '@/lib/firebase-jwt';
import { fsGet, fsSet, fsBatch, WriteOp } from '@/lib/firestore-rest';
import { calcExamPoints, Difficulty } from '@/lib/points';

const DATA_DIR = path.join(process.cwd(), 'src', 'data');

function scanJsonFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const result: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) result.push(...scanJsonFiles(full));
    else if (entry.name.endsWith('.json')) result.push(full);
  }
  return result;
}

function findExam(id: string) {
  for (const f of scanJsonFiles(DATA_DIR)) {
    const exam = JSON.parse(fs.readFileSync(f, 'utf8'));
    if (exam.id === id) return exam;
  }
  return null;
}

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function todayKST(): string {
  return new Date().toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' }).replace(/\. /g, '-').replace('.', '');
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

  type RawQ = { id: number; question: string; choices: string[]; answer: number; explanation?: string };
  const results = (exam.questions as RawQ[])
    .filter(q => submittedIds.includes(String(q.id)))
    .map(q => ({
      id: q.id,
      question: q.question,
      choices: q.choices,
      yourAnswer: answers[String(q.id)],
      correctAnswer: q.answer,
      correct: answers[String(q.id)] === q.answer,
      explanation: q.explanation ?? '',
    }));

  const correct = results.filter(r => r.correct).length;
  const total = results.length;
  const difficulty = (exam.difficulty ?? '기본') as Difficulty;
  const pts = calcExamPoints(correct, total, difficulty);

  const now = new Date();

  // 오답 노트 저장
  const wrongNoteWrites: WriteOp[] = results
    .filter(r => !r.correct)
    .map(r => ({
      type: 'add' as const,
      collection: 'wrong_notes',
      id: `${uid}__${id}__${r.id}`,
      data: {
        uid,
        source: 'practice',
        examId: id,
        examTitle: exam.title,
        questionId: r.id,
        questionType: 'mc',
        question: r.question,
        choices: r.choices ?? [],
        correctAnswer: r.correctAnswer,
        yourAnswer: r.yourAnswer,
        explanation: r.explanation,
        addedAt: now,
        archived: false,
      },
    }));

  // 하루 1회 포인트 제한 체크
  const today = todayKST();
  const attemptKey = `exam_attempts/${uid}_${id}_${today}`;
  const existing = await fsGet(attemptKey, token);
  const alreadyRewarded = !!existing;

  const sessionId = genId();

  // Batch 1: session + wrong notes (isolated from points so a rule failure on users/{uid} can't block notes)
  try {
    await fsBatch([
      {
        type: 'add',
        collection: 'exam_sessions',
        id: sessionId,
        data: {
          userId: uid, examId: id, examTitle: exam.title,
          score: correct, total, difficulty,
          pointsEarned: alreadyRewarded ? 0 : pts.total,
          completedAt: now,
        },
      },
      ...wrongNoteWrites,
    ], token);
  } catch (e) {
    console.error('[exams/grade] fsBatch (core) failed:', e);
    return NextResponse.json({
      score: correct, total, difficulty,
      pointsEarned: 0, alreadyRewarded,
      reasons: ['채점은 완료됐지만 결과 저장에 실패했습니다.'],
      results,
    });
  }

  // Batch 2: points (best-effort — failure doesn't block the response)
  if (!alreadyRewarded) {
    try {
      await fsBatch([
        { type: 'increment', path: `users/${uid}`, field: 'points', delta: pts.total },
        {
          type: 'add',
          collection: 'point_logs',
          id: genId(),
          data: {
            userId: uid, amount: pts.total,
            reason: `[${exam.title}] ${correct}/${total}점 — ${pts.reasons.join(', ')}`,
            examSessionId: sessionId, createdAt: now,
          },
        },
      ], token);
      await fsSet(attemptKey, { userId: uid, examId: id, date: today, createdAt: now }, token);
    } catch (e) {
      console.error('[exams/grade] fsBatch (points) failed:', e);
    }
  }

  return NextResponse.json({
    score: correct,
    total,
    difficulty,
    pointsEarned: alreadyRewarded ? 0 : pts.total,
    alreadyRewarded,
    reasons: alreadyRewarded ? ['오늘 이미 포인트를 받은 시험입니다. (내일 다시 도전하세요)'] : pts.reasons,
    results,
  });
}
