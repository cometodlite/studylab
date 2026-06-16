import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { verifyFirebaseToken } from '@/lib/firebase-jwt';
import { fsQuery } from '@/lib/firestore-rest';

const ROADWAY_DIR = path.join(process.cwd(), 'src', 'data', 'roadway');

function scanRoadwayFiles(): string[] {
  if (!fs.existsSync(ROADWAY_DIR)) return [];
  return fs.readdirSync(ROADWAY_DIR)
    .filter(f => f.endsWith('.json'))
    .map(f => path.join(ROADWAY_DIR, f));
}

export async function GET(req: NextRequest) {
  const token = req.headers.get('Authorization')?.split('Bearer ')[1] ?? null;

  let uid: string | null = null;
  if (token) {
    try { uid = await verifyFirebaseToken(token); } catch { /* anonymous */ }
  }

  const stages = scanRoadwayFiles().map(f => {
    const d = JSON.parse(fs.readFileSync(f, 'utf8'));
    return {
      id: d.id as string,
      title: d.title as string,
      chapter: d.chapter as string,
      grade: d.grade as number,
      unit: d.unit as string,
      stageOrder: d.stageOrder as number,
      chapterOrder: d.chapterOrder as number,
      points: d.points as number,
      icon: d.icon as string,
      boss: d.boss as boolean,
      puzzleCount: (d.puzzles as unknown[]).length,
    };
  }).sort((a, b) => a.chapterOrder - b.chapterOrder || a.stageOrder - b.stageOrder);

  let progressMap: Record<string, { stars: number }> = {};
  if (uid && token) {
    try {
      const docs = await fsQuery('roadway_progress', [{ field: 'userId', op: 'EQUAL', value: uid }], token);
      progressMap = Object.fromEntries(docs.map(d => [d.stageId as string, { stars: d.stars as number }]));
    } catch { /* ignore */ }
  }

  const stagesWithProgress = stages.map((s, i) => {
    const progress = progressMap[s.id] ?? null;
    const prevStage = i > 0 ? stages[i - 1] : null;
    const prevDone = !prevStage || !!progressMap[prevStage.id];
    const unlocked = i === 0 || prevDone;
    return { ...s, stars: progress?.stars ?? 0, completed: !!progress, unlocked };
  });

  return NextResponse.json(stagesWithProgress);
}
