import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const WORKBOOKS_DIR = path.join(process.cwd(), 'src', 'data', 'workbooks');

export async function GET() {
  if (!fs.existsSync(WORKBOOKS_DIR)) return NextResponse.json([]);

  const books = fs
    .readdirSync(WORKBOOKS_DIR)
    .filter(f => f.endsWith('.json'))
    .map(f => {
      const d = JSON.parse(fs.readFileSync(path.join(WORKBOOKS_DIR, f), 'utf8'));
      if (!Array.isArray(d.questions)) return null;
      return {
        id: d.id as string,
        title: d.title as string,
        grade: d.grade as number,
        unit: d.unit as string,
        difficulty: d.difficulty as string,
        book: d.book as string,
        chapter: d.chapter as string,
        section: d.section as string,
        sectionName: d.sectionName as string,
        questionRange: d.questionRange as string,
        questionCount: d.questions.length as number,
      };
    })
    .filter((b): b is NonNullable<typeof b> => b !== null)
    .sort((a, b) => a.id.localeCompare(b.id));

  return NextResponse.json(books);
}
