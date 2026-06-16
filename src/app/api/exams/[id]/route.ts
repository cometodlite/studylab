import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'src', 'data');

function scanJsonFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const result: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
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
  type RawQ = { answer: number; explanation: string; [key: string]: unknown };
  let questions = exam.questions.map(({ answer: _a, explanation: _e, ...q }: RawQ) => q);

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
