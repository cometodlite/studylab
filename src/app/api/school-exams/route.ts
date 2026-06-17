import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const SCHOOL_EXAM_DIR = path.join(process.cwd(), 'src', 'data', 'school-exams');

export async function GET() {
  if (!fs.existsSync(SCHOOL_EXAM_DIR)) {
    return NextResponse.json([]);
  }

  const exams = fs.readdirSync(SCHOOL_EXAM_DIR)
    .filter(f => f.endsWith('.json'))
    .map(f => {
      const data = JSON.parse(fs.readFileSync(path.join(SCHOOL_EXAM_DIR, f), 'utf8'));
      return {
        id: data.id,
        title: data.title,
        school: data.school,
        grade: data.grade,
        sheet: data.sheet,
        difficulty: data.difficulty,
        timeLimit: data.timeLimit,
        totalScore: data.totalScore,
        mcCount: data.questions?.filter((q: { type: string }) => q.type === 'mc').length ?? 0,
        essayCount: data.questions?.filter((q: { type: string }) => q.type === 'essay').length ?? 0,
      };
    })
    .sort((a, b) => a.sheet - b.sheet);

  return NextResponse.json(exams);
}
