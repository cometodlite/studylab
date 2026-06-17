import { NextRequest, NextResponse } from 'next/server';
import { verifyFirebaseToken } from '@/lib/firebase-jwt';
import { fsGet, fsQuery } from '@/lib/firestore-rest';

export async function GET(req: NextRequest) {
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

  try {
    const inquiries = await fsQuery(
      'inquiries',
      [],
      token,
      undefined,
      { field: 'createdAt', dir: 'DESCENDING' }
    );
    return NextResponse.json(inquiries);
  } catch (e) {
    console.error('[admin/inquiries] fsQuery failed:', e);
    return NextResponse.json([]);
  }
}
