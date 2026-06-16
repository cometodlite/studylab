import { NextRequest, NextResponse } from 'next/server';
import { verifyFirebaseToken } from '@/lib/firebase-jwt';
import { fsBeginTransaction, fsGetInTx, fsQueryInTx, fsCommit, WriteOp } from '@/lib/firestore-rest';

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

export async function POST(req: NextRequest, ctx: RouteContext<'/api/coupons/[id]/redeem'>) {
  const { id: couponId } = await ctx.params;

  const token = req.headers.get('Authorization')?.split('Bearer ')[1];
  if (!token) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });

  let uid: string;
  try {
    uid = await verifyFirebaseToken(token);
  } catch {
    return NextResponse.json({ error: '유효하지 않은 토큰입니다.' }, { status: 401 });
  }

  // Firestore 트랜잭션 시작
  const txId = await fsBeginTransaction(token);

  try {
    const [coupon, user] = await Promise.all([
      fsGetInTx(`coupons/${couponId}`, txId, token),
      fsGetInTx(`users/${uid}`, txId, token),
    ]);

    if (!coupon) throw new Error('쿠폰을 찾을 수 없습니다.');
    if (!user) throw new Error('사용자를 찾을 수 없습니다.');
    if ((user.points as number) < (coupon.pointsCost as number)) throw new Error('포인트가 부족합니다.');

    const items = await fsQueryInTx(
      'coupon_items',
      [
        { field: 'couponId', op: 'EQUAL', value: couponId },
        { field: 'isUsed', op: 'EQUAL', value: false },
      ],
      txId,
      token,
      1
    );

    if (items.length === 0) throw new Error('재고가 없습니다.');
    const item = items[0];
    const now = new Date();

    const writes: WriteOp[] = [
      { type: 'update', path: `coupon_items/${item._id}`, data: { isUsed: true, usedBy: uid, usedAt: now } },
      { type: 'increment', path: `users/${uid}`, field: 'points', delta: -(coupon.pointsCost as number) },
      {
        type: 'add',
        collection: 'purchases',
        id: genId(),
        data: { userId: uid, couponId, couponName: coupon.name, couponItemId: item._id, pointsSpent: coupon.pointsCost, createdAt: now },
      },
      {
        type: 'add',
        collection: 'point_logs',
        id: genId(),
        data: { userId: uid, amount: -(coupon.pointsCost as number), reason: `[상점] ${coupon.name} 교환`, createdAt: now },
      },
    ];

    await fsCommit(writes, txId, token);

    return NextResponse.json({ imageUrl: item.imageUrl, couponName: coupon.name, pointsSpent: coupon.pointsCost });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
