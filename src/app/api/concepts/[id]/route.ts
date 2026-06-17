import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const CONCEPT_DIR = path.join(process.cwd(), 'src', 'data', 'concepts');

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const file = path.join(CONCEPT_DIR, `${id}.json`);
  if (!fs.existsSync(file)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  return NextResponse.json(data);
}
