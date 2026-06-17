import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'src', 'data');

const SKIP_DIRS = new Set(['archive', 'school-exams', 'roadway']);

function scanJsonFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const result: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) result.push(...scanJsonFiles(full));
    else if (entry.name.endsWith('.json')) result.push(full);
  }
  return result;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const grade = searchParams.get('grade');
  const unit = searchParams.get('unit');
  const difficulty = searchParams.get('difficulty');

  const exams = scanJsonFiles(DATA_DIR)
    .map(f => {
      const d = JSON.parse(fs.readFileSync(f, 'utf8'));
      if (!Array.isArray(d.questions)) return null;
      return {
        id: d.id,
        title: d.title,
        description: d.description ?? '',
        grade: d.grade ?? null,
        unit: d.unit ?? null,
        difficulty: d.difficulty ?? null,
        questionCount: d.questions.length,
      };
    })
    .filter((e): e is NonNullable<typeof e> => e !== null);

  const filtered = exams.filter(e => {
    if (grade && String(e.grade) !== grade) return false;
    if (unit && e.unit !== unit) return false;
    if (difficulty && e.difficulty !== difficulty) return false;
    return true;
  });

  return NextResponse.json(filtered);
}
