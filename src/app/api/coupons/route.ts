import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

export async function GET() {
  const snap = await adminDb().collection('coupons').orderBy('pointsCost', 'asc').get();
  const coupons = await Promise.all(
    snap.docs.map(async d => {
      const data = d.data();
      // 재고 개수 계산
      const itemsSnap = await adminDb()
        .collection('coupon_items')
        .where('couponId', '==', d.id)
        .where('isUsed', '==', false)
        .count()
        .get();
      return {
        id: d.id,
        name: data.name,
        description: data.description,
        pointsCost: data.pointsCost,
        thumbnailUrl: data.thumbnailUrl ?? null,
        stock: itemsSnap.data().count,
      };
    })
  );
  return NextResponse.json(coupons);
}
