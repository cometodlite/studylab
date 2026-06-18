import { NextRequest, NextResponse } from 'next/server';
import { verifyFirebaseToken } from '@/lib/firebase-jwt';
import fs from 'fs';
import path from 'path';

const SCHOOL_EXAM_DIR = path.join(process.cwd(), 'src', 'data', 'school-exams');

export async function GET(req: NextRequest) {
  const token = req.headers.get('Authorization')?.split('Bearer ')[1];
  if (!token) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });

  let uid: string;
  try {
    uid = await verifyFirebaseToken(token);
  } catch {
    return NextResponse.json({ error: '유효하지 않은 토큰입니다.' }, { status: 401 });
  }

  if (!fs.existsSync(SCHOOL_EXAM_DIR)) {
    return NextResponse.json([]);
  }

  const files = fs
    .readdirSync(SCHOOL_EXAM_DIR)
    .filter(f => f.endsWith('.json'))
    .map(f => {
      const filePath = path.join(SCHOOL_EXAM_DIR, f);
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      return {
        filename: f,
        id: data.id,
        title: data.title,
        school: data.school,
        questionCount: data.questions?.length ?? 0,
        category: data.category ?? '미분류',
      };
    })
    .sort((a, b) => a.filename.localeCompare(b.filename));

  return NextResponse.json(files);
}

export async function POST(req: NextRequest) {
  const token = req.headers.get('Authorization')?.split('Bearer ')[1];
  if (!token) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });

  let uid: string;
  try {
    uid = await verifyFirebaseToken(token);
  } catch {
    return NextResponse.json({ error: '유효하지 않은 토큰입니다.' }, { status: 401 });
  }

  const { filename } = await req.json();
  if (!filename || !filename.endsWith('.json')) {
    return NextResponse.json({ error: '유효한 파일명이 아닙니다.' }, { status: 400 });
  }

  const filePath = path.join(SCHOOL_EXAM_DIR, filename);
  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ error: '파일을 찾을 수 없습니다.' }, { status: 404 });
  }

  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  return NextResponse.json(data);
}
