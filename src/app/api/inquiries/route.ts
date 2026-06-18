import { NextRequest, NextResponse } from 'next/server';
import { verifyFirebaseToken } from '@/lib/firebase-jwt';
import { fsBatch, WriteOp } from '@/lib/firestore-rest';

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

type InquiryBody = {
  category?: unknown;
  subject?: unknown;
  message?: unknown;
  nickname?: unknown;
  email?: unknown;
};

export async function POST(req: NextRequest) {
  console.log('[inquiries] POST request received');
  const token = req.headers.get('Authorization')?.split('Bearer ')[1];
  if (!token) {
    console.log('[inquiries] No token provided');
    return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
  }

  let uid: string;
  try {
    console.log('[inquiries] Verifying Firebase token...');
    uid = await verifyFirebaseToken(token);
    console.log('[inquiries] Token verified for uid:', uid);
  } catch (e) {
    const err = e instanceof Error ? e.message : String(e);
    console.log('[inquiries] Token verification failed:', err);
    return NextResponse.json({ error: '유효하지 않은 토큰입니다.', details: err }, { status: 401 });
  }

  let body: InquiryBody;
  try {
    body = await req.json() as InquiryBody;
  } catch (e) {
    const err = e instanceof Error ? e.message : String(e);
    console.log('[inquiries] Failed to parse JSON body:', err);
    return NextResponse.json({ error: 'Invalid JSON', details: err }, { status: 400 });
  }
  const category = typeof body.category === 'string' ? body.category : '';
  const subject = typeof body.subject === 'string' ? body.subject : '';
  const message = typeof body.message === 'string' ? body.message : '';
  const nickname = typeof body.nickname === 'string' ? body.nickname : '';
  const email = typeof body.email === 'string' ? body.email : '';

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
        status: 'new',
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
