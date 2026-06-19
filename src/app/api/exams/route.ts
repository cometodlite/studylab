import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { verifyFirebaseToken } from '@/lib/firebase-jwt';
import { fsGet } from '@/lib/firestore-rest';
import { getPracticeExamQuality, isPracticeExamBlocked } from '@/lib/practice-exam-quality';

const DATA_DIR = path.join(process.cwd(), 'src', 'data');

const SKIP_DIRS = new Set(['archive', 'school-exams', 'roadway', 'workbooks']);

async function isAdminRequest(req: NextRequest): Promise<boolean> {
  const token = req.headers.get('Authorization')?.split('Bearer ')[1];
  if (!token) return false;

  try {
    const uid = await verifyFirebaseToken(token);
    const userDoc = await fsGet(`users/${uid}`, token);
    return userDoc?.role === 'admin';
  } catch {
    return false;
  }
}

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
  const canIncludeBlocked = searchParams.get('includeBlocked') === '1' && await isAdminRequest(req);

  const exams = scanJsonFiles(DATA_DIR)
    .map(f => {
      const d = JSON.parse(fs.readFileSync(f, 'utf8'));
      if (!Array.isArray(d.questions)) return null;
      const quality = getPracticeExamQuality(d.id);
      if (!canIncludeBlocked && isPracticeExamBlocked(d.id)) return null;

      return {
        id: d.id,
        title: d.title,
        description: d.description ?? '',
        grade: d.grade ?? null,
        unit: d.unit ?? null,
        difficulty: d.difficulty ?? null,
        questionCount: d.questions.length,
        qualityStatus: canIncludeBlocked ? quality.status : undefined,
        qualityReason: canIncludeBlocked ? quality.reason : undefined,
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
