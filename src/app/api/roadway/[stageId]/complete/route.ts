import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { verifyFirebaseToken } from '@/lib/firebase-jwt';
import { fsGet, fsSet, fsBatch, WriteOp } from '@/lib/firestore-rest';

const ROADWAY_DIR = path.join(process.cwd(), 'src', 'data', 'roadway');

type RouteContext = { params: Promise<{ stageId: string }> };

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

export async function POST(req: NextRequest, ctx: RouteContext) {
  const { stageId } = await ctx.params;
  const token = req.headers.get('Authorization')?.split('Bearer ')[1];
  if (!token) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });

  let uid: string;
  try { uid = await verifyFirebaseToken(token); } catch {
    return NextResponse.json({ error: '유효하지 않은 토큰입니다.' }, { status: 401 });
  }

  const filePath = path.join(ROADWAY_DIR, `${stageId}.json`);
  if (!fs.existsSync(filePath)) return NextResponse.json({ error: '스테이지 없음' }, { status: 404 });
  const stage = JSON.parse(fs.readFileSync(filePath, 'utf8'));

  const { stars } = await req.json() as { stars: number };
  const clampedStars = Math.min(3, Math.max(0, stars));

  const progressKey = `roadway_progress/${uid}_${stageId}`;
  const existing = await fsGet(progressKey, token);
  const prevStars = (existing?.stars as number) ?? 0;
  const isFirstClear = !existing;
  const bestStars = Math.max(prevStars, clampedStars);

  // 포인트: 별 × (stage.points / 3), 첫 클리어 보너스 ×1.5
  const basePoints = Math.round((stage.points as number) * (clampedStars / 3));
  const earnedPoints = isFirstClear ? Math.round(basePoints * 1.5) : basePoints;

  const now = new Date();
  const writes: WriteOp[] = [];

  if (earnedPoints > 0) {
    writes.push(
      { type: 'increment', path: `users/${uid}`, field: 'points', delta: earnedPoints },
      {
        type: 'add', collection: 'point_logs', id: genId(),
        data: {
          userId: uid, amount: earnedPoints,
          reason: `[로드웨이] ${stage.title} ${clampedStars}⭐ 클리어${isFirstClear ? ' (첫 클리어 보너스)' : ''}`,
          stageId, createdAt: now,
        },
      }
    );
  }

  try {
    await fsSet(progressKey, { userId: uid, stageId, stars: bestStars, completedAt: now }, token);
  } catch (e) {
    console.error('[roadway/complete] fsSet roadway_progress failed:', e);
    return NextResponse.json({ error: 'progress_save_failed', detail: String(e) }, { status: 500 });
  }

  if (writes.length > 0) {
    try {
      await fsBatch(writes, token);
    } catch (e) {
      console.error('[roadway/complete] fsBatch points failed:', e);
      // 진행 저장은 성공했으므로 포인트 0으로 응답
      return NextResponse.json({ pointsEarned: 0, stars: bestStars, isFirstClear, error: 'points_save_failed' });
    }
  }

  return NextResponse.json({ pointsEarned: earnedPoints, stars: bestStars, isFirstClear });
}
