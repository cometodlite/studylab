import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const MATH_DIR = path.join(process.cwd(), 'src', 'data', 'math');

interface RawQuestion {
  id: number;
  question: string;
  choices: string[];
  answer: number;
  explanation?: string;
}

interface ExamFile {
  id: string;
  title: string;
  grade: number;
  unit: string;
  difficulty: string;
  questions: RawQuestion[];
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const grade = Number(searchParams.get('grade'));
  const units = searchParams.get('units')?.split(',').filter(Boolean) ?? [];
  const difficulties = searchParams.get('difficulties')?.split(',').filter(Boolean) ?? [];
  const count = Math.min(Math.max(Number(searchParams.get('count') ?? 20), 1), 50);

  if (!grade || units.length === 0 || difficulties.length === 0) {
    return NextResponse.json({ error: '학년, 단원, 난이도를 선택해주세요.' }, { status: 400 });
  }

  if (!fs.existsSync(MATH_DIR)) {
    return NextResponse.json({ error: '문제 데이터를 찾을 수 없습니다.' }, { status: 500 });
  }

  const pool: Array<RawQuestion & { _source: string }> = [];

  for (const file of fs.readdirSync(MATH_DIR)) {
    if (!file.endsWith('.json')) continue;
    try {
      const exam = JSON.parse(fs.readFileSync(path.join(MATH_DIR, file), 'utf8')) as ExamFile;
      if (exam.grade !== grade) continue;
      if (!units.includes(exam.unit)) continue;
      if (!difficulties.includes(exam.difficulty)) continue;
      for (const q of exam.questions) {
        pool.push({ ...q, _source: exam.unit });
      }
    } catch {
      // skip malformed files
    }
  }

  if (pool.length === 0) {
    return NextResponse.json({ error: '선택한 범위에 해당하는 문제가 없습니다.' }, { status: 404 });
  }

  // Fisher-Yates shuffle
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }

  const selected = pool.slice(0, count).map((q, i) => ({
    id: i + 1,
    question: q.question,
    choices: q.choices,
    answer: q.answer,
    explanation: q.explanation,
    unit: q._source,
  }));

  const unitLabel = units.length === 1 ? units[0] : `${units[0]} 외 ${units.length - 1}개`;
  const diffLabel = difficulties.join('+');

  return NextResponse.json({
    title: `${grade}학년 ${unitLabel} — ${diffLabel}`,
    grade,
    units,
    difficulties,
    questions: selected,
    totalPoolSize: pool.length,
  });
}
