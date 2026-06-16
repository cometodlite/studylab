import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'src', 'data');

function loadExams() {
  return fs
    .readdirSync(DATA_DIR)
    .filter(f => f.endsWith('.json'))
    .map(f => JSON.parse(fs.readFileSync(path.join(DATA_DIR, f), 'utf8')));
}

export async function GET() {
  const exams = loadExams().map(({ id, title, description, questions }) => ({
    id,
    title,
    description,
    questionCount: questions.length,
  }));
  return NextResponse.json(exams);
}
