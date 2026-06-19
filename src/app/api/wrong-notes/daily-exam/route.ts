import { NextRequest, NextResponse } from 'next/server';
import { verifyFirebaseToken } from '@/lib/firebase-jwt';
import { fsGet, fsQuery, fsUpdate } from '@/lib/firestore-rest';

type WrongNoteDoc = {
  _id: string;
  uid?: unknown;
  archived?: unknown;
  questionType?: unknown;
  choices?: unknown;
};

type UserDailyWrongExam = {
  dailyWrongExamDate?: unknown;
  dailyWrongExamNoteIds?: unknown;
  dailyWrongExamCompleted?: unknown;
  dailyWrongExamPromptDismissedDate?: unknown;
};

function todayKST() {
  return new Date().toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' }).replace(/\. /g, '-').replace('.', '');
}

function isRetryableNote(note: WrongNoteDoc) {
  return (
    note.archived !== true &&
    note.questionType === 'mc' &&
    Array.isArray(note.choices) &&
    note.choices.length > 0
  );
}

function shuffle<T>(items: T[]) {
  return [...items].sort(() => Math.random() - 0.5);
}

async function getAuth(req: NextRequest) {
  const token = req.headers.get('Authorization')?.split('Bearer ')[1];
  if (!token) return { error: NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 }) };

  try {
    return { uid: await verifyFirebaseToken(token), token };
  } catch {
    return { error: NextResponse.json({ error: '유효하지 않은 토큰입니다.' }, { status: 401 }) };
  }
}

export async function GET(req: NextRequest) {
  const auth = await getAuth(req);
  if (auth.error) return auth.error;

  const today = todayKST();

  try {
    const [userDoc, all] = await Promise.all([
      fsGet(`users/${auth.uid}`, auth.token) as Promise<UserDailyWrongExam | null>,
      fsQuery('wrong_notes', [{ field: 'uid', op: 'EQUAL', value: auth.uid }], auth.token) as Promise<WrongNoteDoc[]>,
    ]);

    const retryable = all.filter(isRetryableNote);
    const savedIds = Array.isArray(userDoc?.dailyWrongExamNoteIds)
      ? userDoc.dailyWrongExamNoteIds.filter((id): id is string => typeof id === 'string')
      : [];

    if (userDoc?.dailyWrongExamDate === today) {
      if (userDoc.dailyWrongExamCompleted === true) {
        return NextResponse.json({ eligible: false, completed: true, total: retryable.length, retry: [] });
      }
      const retry = retryable.filter(note => savedIds.includes(note._id));
      return NextResponse.json({
        eligible: retry.length > 0,
        promptDismissed: userDoc.dailyWrongExamPromptDismissedDate === today,
        total: retryable.length,
        retry,
      });
    }

    if (retryable.length < 20) {
      return NextResponse.json({ eligible: false, total: retryable.length, retry: [] });
    }

    const retry = shuffle(retryable).slice(0, 20);
    await fsUpdate(`users/${auth.uid}`, {
      dailyWrongExamDate: today,
      dailyWrongExamNoteIds: retry.map(note => note._id),
      dailyWrongExamCompleted: false,
      dailyWrongExamPromptDismissedDate: null,
      dailyWrongExamCreatedAt: new Date(),
    }, auth.token);

    return NextResponse.json({ eligible: true, total: retryable.length, retry });
  } catch (e) {
    console.error('[wrong-notes/daily-exam] GET failed:', e);
    return NextResponse.json({ eligible: false, total: 0, retry: [] });
  }
}

export async function POST(req: NextRequest) {
  const auth = await getAuth(req);
  if (auth.error) return auth.error;

  const body = await req.json().catch(() => ({}));
  const action = body.action;
  const today = todayKST();

  if (action !== 'dismiss' && action !== 'complete') {
    return NextResponse.json({ error: '지원하지 않는 작업입니다.' }, { status: 400 });
  }

  try {
    await fsUpdate(`users/${auth.uid}`, action === 'dismiss'
      ? { dailyWrongExamPromptDismissedDate: today }
      : { dailyWrongExamCompleted: true, dailyWrongExamCompletedAt: new Date() },
    auth.token);

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('[wrong-notes/daily-exam] POST failed:', e);
    return NextResponse.json({ error: '오늘의 오답시험 상태 저장에 실패했습니다.' }, { status: 500 });
  }
}
