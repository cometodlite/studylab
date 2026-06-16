import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

async function verifyAdmin(req: NextRequest): Promise<string> {
  const token = req.headers.get('Authorization')?.split('Bearer ')[1];
  if (!token) throw new Error('인증이 필요합니다.');
  const decoded = await adminAuth().verifyIdToken(token);
  const userSnap = await adminDb().doc(`users/${decoded.uid}`).get();
  if (userSnap.data()?.role !== 'admin') throw new Error('관리자 권한이 없습니다.');
  return decoded.uid;
}

// 쿠폰 목록 (관리자용 - 재고 상세 포함)
export async function GET(req: NextRequest) {
  try {
    await verifyAdmin(req);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 403 });
  }

  const snap = await adminDb().collection('coupons').orderBy('createdAt', 'desc').get();
  const coupons = await Promise.all(
    snap.docs.map(async d => {
      const data = d.data();
      const total = await adminDb().collection('coupon_items').where('couponId', '==', d.id).count().get();
      const unused = await adminDb().collection('coupon_items').where('couponId', '==', d.id).where('isUsed', '==', false).count().get();
      return {
        id: d.id,
        name: data.name,
        description: data.description,
        pointsCost: data.pointsCost,
        thumbnailUrl: data.thumbnailUrl ?? null,
        totalStock: total.data().count,
        availableStock: unused.data().count,
      };
    })
  );
  return NextResponse.json(coupons);
}

// 새 쿠폰 종류 생성
export async function POST(req: NextRequest) {
  try {
    await verifyAdmin(req);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 403 });
  }

  const body = await req.json();
  const { name, description, pointsCost, thumbnailUrl } = body;
  if (!name || !pointsCost) return NextResponse.json({ error: '이름과 포인트 비용은 필수입니다.' }, { status: 400 });

  const ref = await adminDb().collection('coupons').add({
    name, description: description ?? '', pointsCost: Number(pointsCost),
    thumbnailUrl: thumbnailUrl ?? null,
    createdAt: FieldValue.serverTimestamp(),
  });

  return NextResponse.json({ id: ref.id, name, description, pointsCost, thumbnailUrl });
}
