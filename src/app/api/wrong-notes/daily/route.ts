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

    // MC 타입만 일일 풀기 가능 (essay는 자동 채점 어려움)
    const mcNotes = all.filter(n =>
      !(n as { archived?: boolean }).archived &&
      (n as { questionType?: string }).questionType === 'mc'
    );

    // 최대 20개 랜덤 선택
    const shuffled = [...mcNotes].sort(() => Math.random() - 0.5);
    const daily = shuffled.slice(0, 20);

    return NextResponse.json({ daily, total: mcNotes.length });
  } catch {
    return NextResponse.json({ daily: [], total: 0 });
  }
}
