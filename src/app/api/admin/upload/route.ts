import { NextRequest, NextResponse } from 'next/server';
import { verifyFirebaseToken } from '@/lib/firebase-jwt';
import { fsGet, fsSet } from '@/lib/firestore-rest';
import { uploadToStorage } from '@/lib/storage-rest';

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

async function verifyAdmin(req: NextRequest): Promise<{ uid: string; token: string }> {
  const token = req.headers.get('Authorization')?.split('Bearer ')[1];
  if (!token) throw new Error('인증이 필요합니다.');
  const uid = await verifyFirebaseToken(token);
  const user = await fsGet(`users/${uid}`, token);
  if (!user || user.role !== 'admin') throw new Error('관리자 권한이 없습니다.');
  return { uid, token };
}

export async function POST(req: NextRequest) {
  let token: string;
  try {
    ({ token } = await verifyAdmin(req));
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 403 });
  }

  const formData = await req.formData();
  const couponId = formData.get('couponId') as string;
  const files = formData.getAll('images') as File[];

  if (!couponId || files.length === 0) {
    return NextResponse.json({ error: 'couponId와 images는 필수입니다.' }, { status: 400 });
  }

  const uploaded: string[] = [];

  for (const file of files) {
    const buffer = await file.arrayBuffer();
    const filePath = `gifticons/${couponId}/${Date.now()}_${file.name}`;
    const imageUrl = await uploadToStorage(filePath, buffer, file.type, token);

    const itemId = genId();
    await fsSet(`coupon_items/${itemId}`, {
      couponId,
      imageUrl,
      isUsed: false,
      createdAt: new Date(),
    }, token);

    uploaded.push(imageUrl);
  }

  return NextResponse.json({ uploaded: uploaded.length, urls: uploaded });
}
