import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const ROADWAY_DIR = path.join(process.cwd(), 'src', 'data', 'roadway');

type RouteContext = { params: Promise<{ stageId: string }> };

export async function GET(_req: NextRequest, ctx: RouteContext) {
  const { stageId } = await ctx.params;
  const filePath = path.join(ROADWAY_DIR, `${stageId}.json`);
  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ error: '스테이지를 찾을 수 없습니다.' }, { status: 404 });
  }
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  return NextResponse.json(data);
}
