import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'src', 'data');

function findExam(id: string) {
  const files = fs.readdirSync(DATA_DIR).filter(f => f.endsWith('.json'));
  for (const f of files) {
    const exam = JSON.parse(fs.readFileSync(path.join(DATA_DIR, f), 'utf8'));
    if (exam.id === id) return exam;
  }
  return null;
}

export async function GET(req: NextRequest, ctx: RouteContext<'/api/exams/[id]'>) {
  const { id } = await ctx.params;
  const exam = findExam(id);
  if (!exam) return NextResponse.json({ error: '시험을 찾을 수 없습니다.' }, { status: 404 });

  const { searchParams } = new URL(req.url);
  let questions = exam.questions.map(({ answer: _a, explanation: _e, ...q }: { answer: number; explanation: string; [key: string]: unknown }) => q);

  if (searchParams.get('shuffle') === '1') {
    questions = questions.sort(() => Math.random() - 0.5);
  }
  const count = parseInt(searchParams.get('count') ?? '', 10);
  if (!isNaN(count) && count > 0) questions = questions.slice(0, count);

  return NextResponse.json({ id: exam.id, title: exam.title, description: exam.description, questions });
}
