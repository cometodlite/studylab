import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const CONCEPT_DIR = path.join(process.cwd(), 'src', 'data', 'concepts');

export async function GET() {
  if (!fs.existsSync(CONCEPT_DIR)) return NextResponse.json([]);

  const subjectOrder: Record<string, number> = { '수학': 0, '과학': 1, '역사': 2 };

  const concepts = fs
    .readdirSync(CONCEPT_DIR)
    .filter(f => f.endsWith('.json'))
    .map(f => {
      const d = JSON.parse(fs.readFileSync(path.join(CONCEPT_DIR, f), 'utf8'));
      return {
        id: d.id as string,
        subject: d.subject as string,
        grade: d.grade as number,
        unit: d.unit as string,
        order: d.order as number,
        title: d.title as string,
        sectionCount: Array.isArray(d.sections) ? d.sections.length : 0,
      };
    })
    .sort((a, b) => {
      const sa = subjectOrder[a.subject] ?? 99;
      const sb = subjectOrder[b.subject] ?? 99;
      if (sa !== sb) return sa - sb;
      return a.order - b.order;
    });

  return NextResponse.json(concepts);
}
