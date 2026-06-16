import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

export async function POST(req: NextRequest, ctx: RouteContext<'/api/coupons/[id]/redeem'>) {
  const { id: couponId } = await ctx.params;

  const token = req.headers.get('Authorization')?.split('Bearer ')[1];
  if (!token) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });

  let uid: string;
  try {
    const decoded = await adminAuth().verifyIdToken(token);
    uid = decoded.uid;
  } catch {
    return NextResponse.json({ error: '유효하지 않은 토큰입니다.' }, { status: 401 });
  }

  const firestoreDb = adminDb();

  // Firestore Transaction으로 동시 교환 방지
  const result = await firestoreDb.runTransaction(async tx => {
    const couponRef = firestoreDb.doc(`coupons/${couponId}`);
    const couponSnap = await tx.get(couponRef);
    if (!couponSnap.exists) throw new Error('쿠폰을 찾을 수 없습니다.');

    const coupon = couponSnap.data()!;
    const userRef = firestoreDb.doc(`users/${uid}`);
    const userSnap = await tx.get(userRef);
    if (!userSnap.exists) throw new Error('사용자를 찾을 수 없습니다.');

    const user = userSnap.data()!;
    if (user.points < coupon.pointsCost) throw new Error('포인트가 부족합니다.');

    // 미사용 기프티콘 1개 가져오기
    const itemsSnap = await firestoreDb
      .collection('coupon_items')
      .where('couponId', '==', couponId)
      .where('isUsed', '==', false)
      .limit(1)
      .get();
    if (itemsSnap.empty) throw new Error('재고가 없습니다.');

    const itemRef = itemsSnap.docs[0].ref;
    const itemData = itemsSnap.docs[0].data();

    // 기프티콘 사용 처리
    tx.update(itemRef, { isUsed: true, usedBy: uid, usedAt: FieldValue.serverTimestamp() });

    // 포인트 차감
    tx.update(userRef, { points: FieldValue.increment(-coupon.pointsCost) });

    // 구매 기록
    const purchaseRef = firestoreDb.collection('purchases').doc();
    tx.set(purchaseRef, {
      userId: uid,
      couponId,
      couponName: coupon.name,
      couponItemId: itemsSnap.docs[0].id,
      pointsSpent: coupon.pointsCost,
      createdAt: FieldValue.serverTimestamp(),
    });

    // 포인트 로그
    const logRef = firestoreDb.collection('point_logs').doc();
    tx.set(logRef, {
      userId: uid,
      amount: -coupon.pointsCost,
      reason: `[상점] ${coupon.name} 교환`,
      createdAt: FieldValue.serverTimestamp(),
    });

    return { imageUrl: itemData.imageUrl, couponName: coupon.name, pointsSpent: coupon.pointsCost };
  });

  return NextResponse.json(result);
}
