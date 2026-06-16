import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { getStorage } from 'firebase-admin/storage';
import { getApps } from 'firebase-admin/app';
import { FieldValue } from 'firebase-admin/firestore';

async function verifyAdmin(req: NextRequest): Promise<string> {
  const token = req.headers.get('Authorization')?.split('Bearer ')[1];
  if (!token) throw new Error('인증이 필요합니다.');
  const decoded = await adminAuth().verifyIdToken(token);
  const userSnap = await adminDb().doc(`users/${decoded.uid}`).get();
  if (userSnap.data()?.role !== 'admin') throw new Error('관리자 권한이 없습니다.');
  return decoded.uid;
}

// 기프티콘 이미지 업로드 + coupon_items에 등록
export async function POST(req: NextRequest) {
  try {
    await verifyAdmin(req);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 403 });
  }

  const formData = await req.formData();
  const couponId = formData.get('couponId') as string;
  const files = formData.getAll('images') as File[];

  if (!couponId || files.length === 0) {
    return NextResponse.json({ error: 'couponId와 images는 필수입니다.' }, { status: 400 });
  }

  const bucket = getStorage(getApps()[0]).bucket(process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET);
  const uploaded: string[] = [];

  for (const file of files) {
    const buffer = Buffer.from(await file.arrayBuffer());
    const filename = `gifticons/${couponId}/${Date.now()}_${file.name}`;
    const fileRef = bucket.file(filename);
    await fileRef.save(buffer, { metadata: { contentType: file.type } });
    await fileRef.makePublic();
    const publicUrl = `https://storage.googleapis.com/${bucket.name}/${filename}`;

    await adminDb().collection('coupon_items').add({
      couponId,
      imageUrl: publicUrl,
      isUsed: false,
      createdAt: FieldValue.serverTimestamp(),
    });
    uploaded.push(publicUrl);
  }

  return NextResponse.json({ uploaded: uploaded.length, urls: uploaded });
}
