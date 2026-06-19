import { NextRequest, NextResponse } from 'next/server';
import { verifyFirebaseToken } from '@/lib/firebase-jwt';
import { fsBatch, fsQuery, fsUpdate, WriteOp } from '@/lib/firestore-rest';

type WrongNoteDoc = {
  _id: string;
  uid?: unknown;
  archived?: unknown;
  questionType?: unknown;
  choices?: unknown;
  correctAnswer?: unknown;
  question?: unknown;
  examTitle?: unknown;
  explanation?: unknown;
};

function isRetryableNote(note: WrongNoteDoc) {
  return (
    note.archived !== true &&
    note.questionType === 'mc' &&
    Array.isArray(note.choices) &&
    note.choices.length > 0
  );
}

function todayKST() {
  return new Date().toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' }).replace(/\. /g, '-').replace('.', '');
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

export async function GET(req: NextRequest) {
  const auth = await getUid(req);
  if (auth.error) return auth.error;

  const limitParam = Number(new URL(req.url).searchParams.get('limit') ?? 20);
  const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 50) : 20;

  try {
    const all = await fsQuery('wrong_notes', [
      { field: 'uid', op: 'EQUAL', value: auth.uid },
    ], auth.token) as WrongNoteDoc[];

    const retry = all.filter(isRetryableNote).slice(0, limit);

    return NextResponse.json({ retry, total: all.filter(isRetryableNote).length });
  } catch (e) {
    console.error('[wrong-notes/retry] GET failed:', e);
    return NextResponse.json({ retry: [], total: 0 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await getUid(req);
  if (auth.error) return auth.error;

  const body = await req.json().catch(() => ({}));
  const answers = (body.answers ?? {}) as Record<string, number>;
  const mode = body.mode;
  const submittedIds = Object.keys(answers);
  if (submittedIds.length === 0) {
    return NextResponse.json({ error: '제출된 답안이 없습니다.' }, { status: 400 });
  }

  try {
    const all = await fsQuery('wrong_notes', [
      { field: 'uid', op: 'EQUAL', value: auth.uid },
    ], auth.token) as WrongNoteDoc[];
    const submitted = all.filter(note => submittedIds.includes(note._id) && isRetryableNote(note));
    const now = new Date();

    const results = submitted.map(note => {
      const selected = answers[note._id];
      const correct = selected === note.correctAnswer;
      return {
        noteId: note._id,
        question: typeof note.question === 'string' ? note.question : '',
        examTitle: typeof note.examTitle === 'string' ? note.examTitle : '',
        selected,
        correctAnswer: note.correctAnswer,
        correct,
        explanation: typeof note.explanation === 'string' ? note.explanation : '',
      };
    });

    const writes: WriteOp[] = results
      .filter(result => result.correct)
      .map(result => ({
        type: 'update' as const,
        path: `wrong_notes/${result.noteId}`,
        data: {
          archived: true,
          archivedAt: now,
          retrySolvedAt: now,
        },
      }));

    if (writes.length > 0) {
      await fsBatch(writes, auth.token);
    }
    if (mode === 'daily-exam') {
      await fsUpdate(`users/${auth.uid}`, {
        dailyWrongExamDate: todayKST(),
        dailyWrongExamCompleted: true,
        dailyWrongExamCompletedAt: now,
      }, auth.token);
    }

    return NextResponse.json({
      total: submitted.length,
      answered: submittedIds.length,
      correct: results.filter(result => result.correct).length,
      archived: writes.length,
      results,
    });
  } catch (e) {
    console.error('[wrong-notes/retry] POST failed:', e);
    return NextResponse.json({ error: '오답 재풀이 제출에 실패했습니다.' }, { status: 500 });
  }
}
