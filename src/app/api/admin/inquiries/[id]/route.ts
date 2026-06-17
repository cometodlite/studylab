import { NextRequest, NextResponse } from 'next/server';
import { verifyFirebaseToken } from '@/lib/firebase-jwt';
import { fsGet, fsUpdate } from '@/lib/firestore-rest';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = req.headers.get('Authorization')?.split('Bearer ')[1];
  if (!token) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });

  let uid: string;
  try {
    uid = await verifyFirebaseToken(token);
  } catch {
    return NextResponse.json({ error: '유효하지 않은 토큰입니다.' }, { status: 401 });
  }

  const userDoc = await fsGet(`users/${uid}`, token);
  if (!userDoc || userDoc.role !== 'admin') {
    return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });
  }

  const body = await req.json();
  const { status } = body;
  if (!['new', 'read', 'resolved'].includes(status)) {
    return NextResponse.json({ error: '잘못된 상태값입니다.' }, { status: 400 });
  }

  await fsUpdate(`inquiries/${id}`, { status }, token);
  return NextResponse.json({ success: true });
}
