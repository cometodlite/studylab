import { NextRequest, NextResponse } from 'next/server';
import { verifyFirebaseToken } from '@/lib/firebase-jwt';
import { fsQuery } from '@/lib/firestore-rest';

export async function GET(req: NextRequest) {
  const token = req.headers.get('Authorization')?.split('Bearer ')[1];
  if (!token) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });

  let uid: string;
  try {
    uid = await verifyFirebaseToken(token);
  } catch {
    return NextResponse.json({ error: '유효하지 않은 토큰입니다.' }, { status: 401 });
  }

  try {
    const all = await fsQuery('wrong_notes', [
      { field: 'uid', op: 'EQUAL', value: uid },
    ], token);

    const notes = all.filter(n => !(n as { archived?: boolean }).archived);
    const archived = all.filter(n => (n as { archived?: boolean }).archived === true);

    return NextResponse.json({ notes, archived });
  } catch {
    return NextResponse.json({ notes: [], archived: [] });
  }
}
