import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const SCHOOL_EXAM_DIR = path.join(process.cwd(), 'src', 'data', 'school-exams');

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const file = path.join(SCHOOL_EXAM_DIR, `${id}.json`);
  if (!fs.existsSync(file)) {
    return NextResponse.json({ error: '시험을 찾을 수 없습니다.' }, { status: 404 });
  }

  const data = JSON.parse(fs.readFileSync(file, 'utf8'));

  // 클라이언트에 answer 노출 안 함
  const questions = data.questions.map((q: { id: number; type: string; score: number; question: string; choices?: string[]; rubric?: string; answer?: number; expectedAnswer?: string; explanation?: string }) => {
    if (q.type === 'mc') {
      return { id: q.id, type: q.type, score: q.score, question: q.question, choices: q.choices };
    }
    return { id: q.id, type: q.type, score: q.score, question: q.question, rubric: q.rubric };
  });

  return NextResponse.json({
    id: data.id,
    title: data.title,
    sheet: data.sheet,
    timeLimit: data.timeLimit,
    totalScore: data.totalScore,
    scorePerMC: data.scorePerMC,
    scorePerEssay: data.scorePerEssay,
    questions,
  });
}
