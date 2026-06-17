import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { verifyFirebaseToken } from '@/lib/firebase-jwt';

const HISTORY_FILE = path.join(process.cwd(), 'src', 'data', 'debug-history.json');

export async function GET(req: NextRequest) {
  const token = req.headers.get('Authorization')?.split('Bearer ')[1];
  if (!token) return NextResponse.json([], { status: 401 });

  try {
    await verifyFirebaseToken(token);
  } catch {
    return NextResponse.json([], { status: 401 });
  }

  if (!fs.existsSync(HISTORY_FILE)) return NextResponse.json([]);
  const data = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8'));
  return NextResponse.json(data);
}
