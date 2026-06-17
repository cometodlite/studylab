import { NextRequest, NextResponse } from 'next/server';
import { verifyFirebaseToken } from '@/lib/firebase-jwt';
import { fsBatch } from '@/lib/firestore-rest';

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
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
  const { category, subject, message, nickname, email } = body;

  if (!subject?.trim() || !message?.trim()) {
    return NextResponse.json({ error: '제목과 내용을 입력해주세요.' }, { status: 400 });
  }

  const id = genId();
  const now = new Date();

  try {
    await fsBatch([{
      type: 'add',
      collection: 'inquiries',
      id,
      data: {
        uid,
        nickname: nickname ?? '알 수 없음',
        email: email ?? '',
        category: category ?? '일반 문의',
        subject: subject.trim(),
        message: message.trim(),
        status: 'new',
        createdAt: now,
      },
    }], token);
  } catch (e) {
    console.error('[inquiries] fsBatch failed:', e);
    return NextResponse.json({ error: '저장에 실패했습니다.' }, { status: 500 });
  }

  return NextResponse.json({ success: true, id });
}
