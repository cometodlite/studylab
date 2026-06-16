import { NextRequest, NextResponse } from 'next/server';
import { verifyFirebaseToken } from '@/lib/firebase-jwt';
import { fsGet, fsQuery, fsSet } from '@/lib/firestore-rest';

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

async function verifyAdmin(req: NextRequest): Promise<string> {
  const token = req.headers.get('Authorization')?.split('Bearer ')[1];
  if (!token) throw new Error('인증이 필요합니다.');
  const uid = await verifyFirebaseToken(token);
  const user = await fsGet(`users/${uid}`, token);
  if (!user || user.role !== 'admin') throw new Error('관리자 권한이 없습니다.');
  return uid;
}

export async function GET(req: NextRequest) {
  try {
    await verifyAdmin(req);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 403 });
  }

  const token = req.headers.get('Authorization')!.split('Bearer ')[1];
  const coupons = await fsQuery('coupons', [], token, undefined, { field: 'pointsCost', dir: 'ASCENDING' });

  const result = await Promise.all(
    coupons.map(async coupon => {
      const [total, available] = await Promise.all([
        fsQuery('coupon_items', [{ field: 'couponId', op: 'EQUAL', value: coupon._id }], token),
        fsQuery('coupon_items', [
          { field: 'couponId', op: 'EQUAL', value: coupon._id },
          { field: 'isUsed', op: 'EQUAL', value: false },
        ], token),
      ]);
      return {
        id: coupon._id,
        name: coupon.name,
        description: coupon.description,
        pointsCost: coupon.pointsCost,
        thumbnailUrl: coupon.thumbnailUrl ?? null,
        totalStock: total.length,
        availableStock: available.length,
      };
    })
  );

  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  try {
    await verifyAdmin(req);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 403 });
  }

  const token = req.headers.get('Authorization')!.split('Bearer ')[1];
  const body = await req.json();
  const { name, description, pointsCost, thumbnailUrl } = body;
  if (!name || !pointsCost) return NextResponse.json({ error: '이름과 포인트 비용은 필수입니다.' }, { status: 400 });

  const id = genId();
  await fsSet(`coupons/${id}`, {
    name,
    description: description ?? '',
    pointsCost: Number(pointsCost),
    thumbnailUrl: thumbnailUrl ?? null,
    createdAt: new Date(),
  }, token);

  return NextResponse.json({ id, name, description, pointsCost, thumbnailUrl });
}
