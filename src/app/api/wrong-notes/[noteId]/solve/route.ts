import { NextRequest, NextResponse } from 'next/server';
import { verifyFirebaseToken } from '@/lib/firebase-jwt';
import { fsGet, fsBatch, WriteOp } from '@/lib/firestore-rest';

export async function POST(req: NextRequest, { params }: { params: Promise<{ noteId: string }> }) {
  const { noteId } = await params;

  const token = req.headers.get('Authorization')?.split('Bearer ')[1];
  if (!token) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });

  let uid: string;
  try {
    uid = await verifyFirebaseToken(token);
  } catch {
    return NextResponse.json({ error: '유효하지 않은 토큰입니다.' }, { status: 401 });
  }

  const note = await fsGet(`wrong_notes/${noteId}`, token);
  if (!note || note.uid !== uid) {
    return NextResponse.json({ error: '노트를 찾을 수 없습니다.' }, { status: 404 });
  }

  const body = await req.json();
  const { answer } = body;
  const correct = answer === note.correctAnswer;

  if (!correct) {
    return NextResponse.json({ correct: false });
  }

  // 정답이면 아카이브로 이동
  const now = new Date();
  const writes: WriteOp[] = [
    {
      type: 'add',
      collection: 'wrong_notes',
      id: noteId,
      data: { ...note, archived: true, archivedAt: now },
    },
  ];

  await fsBatch(writes, token);

  return NextResponse.json({ correct: true, archived: true });
}
