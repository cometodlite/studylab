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

function findExam(id: string) {
  for (const f of scanJsonFiles(DATA_DIR)) {
    const exam = JSON.parse(fs.readFileSync(f, 'utf8'));
    if (exam.id === id) return exam;
  }
  return null;
}

export async function GET(req: NextRequest, ctx: RouteContext<'/api/exams/[id]'>) {
  const { id } = await ctx.params;
  const exam = findExam(id);
  if (!exam) return NextResponse.json({ error: '시험을 찾을 수 없습니다.' }, { status: 404 });

  const { searchParams } = new URL(req.url);
  const canIncludeBlocked = searchParams.get('includeBlocked') === '1' && await isAdminRequest(req);
  const quality = getPracticeExamQuality(id);

  if (!canIncludeBlocked && isPracticeExamBlocked(id)) {
    return NextResponse.json({
      error: '검수 중인 문제입니다.',
      status: quality.status,
      reason: quality.reason ?? '문항 품질 검수 후 다시 공개됩니다.',
      issueQuestionIds: quality.issueQuestionIds ?? [],
    }, { status: 423 });
  }

  type RawQ = { answer: number; explanation: string; [key: string]: unknown };
  let questions = exam.questions.map(({ answer, explanation, ...q }: RawQ) => {
    void answer;
    void explanation;
    return q;
  });

  if (searchParams.get('shuffle') === '1') {
    questions = questions.sort(() => Math.random() - 0.5);
  }
  const count = parseInt(searchParams.get('count') ?? '', 10);
  if (!isNaN(count) && count > 0) questions = questions.slice(0, count);

  return NextResponse.json({
    id: exam.id,
    title: exam.title,
    description: exam.description ?? '',
    grade: exam.grade ?? null,
    unit: exam.unit ?? null,
    difficulty: exam.difficulty ?? null,
    questions,
  });
}
