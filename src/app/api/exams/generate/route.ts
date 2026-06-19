import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const MATH_DIR = path.join(process.cwd(), 'src', 'data', 'math');

// Maps EBS stage names to internal difficulty tiers for points calculation
const STAGE_TO_DIFFICULTY: Record<string, string> = {
  '개념 확인 연산 유형': '기본',
  '대표 교과서 유형': '유형별',
  '기출 변형 핵심 유형': '심화',
  '서술형 대비 유형': '심화',
  '최고 수준/발전 유형': '킬러',
};

interface EbsMeta {
  buildUpStage?: string;
  typeTag?: string;
  role?: string;
}

interface RawQuestion {
  id: number;
  question: string;
  choices: string[];
  answer: number;
  explanation?: string;
  ebs?: EbsMeta;
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
  const stages = searchParams.get('stages')?.split(',').filter(Boolean) ?? [];
  const count = Math.min(Math.max(Number(searchParams.get('count') ?? 20), 1), 50);

  if (!grade || units.length === 0 || stages.length === 0) {
    return NextResponse.json({ error: '학년, 단원, 유형 단계를 선택해주세요.' }, { status: 400 });
  }

  if (!fs.existsSync(MATH_DIR)) {
    return NextResponse.json({ error: '문제 데이터를 찾을 수 없습니다.' }, { status: 500 });
  }

  const stageSet = new Set(stages);

  const pool: Array<RawQuestion & { _source: string; _stage: string; _typeTag: string }> = [];

  for (const file of fs.readdirSync(MATH_DIR)) {
    if (!file.endsWith('.json')) continue;
    try {
      const exam = JSON.parse(fs.readFileSync(path.join(MATH_DIR, file), 'utf8')) as ExamFile;
      if (exam.grade !== grade) continue;
      if (!units.includes(exam.unit)) continue;
      for (const q of exam.questions) {
        const stage = q.ebs?.buildUpStage ?? '';
        if (!stageSet.has(stage)) continue;
        pool.push({
          ...q,
          _source: exam.unit,
          _stage: stage,
          _typeTag: q.ebs?.typeTag ?? '',
        });
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
    stage: q._stage,
    typeTag: q._typeTag,
    difficulty: STAGE_TO_DIFFICULTY[q._stage] ?? '기본',
  }));

  const unitLabel = units.length === 1 ? units[0] : `${units[0]} 외 ${units.length - 1}개`;
  const stageLabel = stages.length === 1
    ? stages[0].replace(' 유형', '')
    : `${stages.length}개 유형`;

  return NextResponse.json({
    title: `${grade}학년 ${unitLabel} — ${stageLabel}`,
    grade,
    units,
    stages,
    questions: selected,
    totalPoolSize: pool.length,
  });
}
