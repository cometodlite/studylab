import { NextRequest, NextResponse } from 'next/server';
import { verifyFirebaseToken } from '@/lib/firebase-jwt';
import { fsBatch, WriteOp } from '@/lib/firestore-rest';

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

  if (!category || !subject?.trim() || !message?.trim()) {
    return NextResponse.json({ error: '필수 정보가 부족합니다.' }, { status: 400 });
  }

  const now = new Date();
  const inquiryId = genId();

  const writeOps: WriteOp[] = [
    {
      type: 'add',
      collection: 'inquiries',
      id: inquiryId,
      data: {
        userId: uid,
        category,
        subject: subject.trim(),
        message: message.trim(),
        nickname: nickname || '',
        email: email || '',
        status: 'pending',
        createdAt: now,
        updatedAt: now,
      },
    },
  ];

  try {
    console.log('[inquiries] Sending inquiry:', { inquiryId, category, subject, uid });
    await fsBatch(writeOps, token);
    console.log('[inquiries] Inquiry saved successfully:', inquiryId);
    return NextResponse.json({ success: true, inquiryId });
  } catch (e) {
    const errorMsg = e instanceof Error ? e.message : String(e);
    console.error('[inquiries] fsBatch failed:', errorMsg, { writeOps, error: e });
    return NextResponse.json({
      error: '문의 전송에 실패했습니다.',
      details: errorMsg
    }, { status: 500 });
  }
}
