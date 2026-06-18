import { NextRequest, NextResponse } from 'next/server';
import { verifyFirebaseToken } from '@/lib/firebase-jwt';
import { fsGet, fsQuery } from '@/lib/firestore-rest';

type TimestampLike = { seconds: number };

type UserSummary = {
  _id: string;
  uid?: unknown;
  email?: unknown;
  nickname?: unknown;
  school?: unknown;
  gradeLevel?: unknown;
};

type ExamSession = {
  _id: string;
  userId?: unknown;
  examId?: unknown;
  examTitle?: unknown;
  sheet?: unknown;
  mcScore?: unknown;
  essayScore?: unknown;
  totalScore?: unknown;
  maxScore?: unknown;
  pointsEarned?: unknown;
  completedAt?: unknown;
};

function isTimestampLike(value: unknown): value is TimestampLike {
  return typeof value === 'object' && value !== null && typeof (value as TimestampLike).seconds === 'number';
}

function toNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

async function requireAdmin(req: NextRequest): Promise<{ token: string } | NextResponse> {
  const token = req.headers.get('Authorization')?.split('Bearer ')[1];
  if (!token) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });

  let uid: string;
  try {
    uid = await verifyFirebaseToken(token);
  } catch {
    return NextResponse.json({ error: '유효하지 않은 토큰입니다.' }, { status: 401 });
  }

  const userDoc = await fsGet(`users/${uid}`, token);
  if (!userDoc || userDoc.role !== 'admin') {
    return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });
  }

  return { token };
}

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const [sessions, users] = await Promise.all([
      fsQuery(
        'school_exam_sessions',
        [],
        auth.token,
        500,
        { field: 'completedAt', dir: 'DESCENDING' }
      ) as Promise<ExamSession[]>,
      fsQuery('users', [], auth.token, 10000) as Promise<UserSummary[]>,
    ]);

    const usersById = new Map<string, UserSummary>();
    users.forEach(user => {
      usersById.set(String(user.uid ?? user._id), user);
    });

    const reports = sessions.map(session => {
      const userId = typeof session.userId === 'string' ? session.userId : '';
      const user = usersById.get(userId);
      const totalScore = toNumber(session.totalScore);
      const maxScore = toNumber(session.maxScore);

      return {
        id: session._id,
        userId,
        nickname: typeof user?.nickname === 'string' ? user.nickname : '알 수 없음',
        email: typeof user?.email === 'string' ? user.email : '',
        school: typeof user?.school === 'string' ? user.school : '',
        gradeLevel: typeof user?.gradeLevel === 'number' ? user.gradeLevel : null,
        examId: typeof session.examId === 'string' ? session.examId : '',
        examTitle: typeof session.examTitle === 'string' ? session.examTitle : '알 수 없음',
        sheet: toNumber(session.sheet),
        mcScore: toNumber(session.mcScore),
        essayScore: toNumber(session.essayScore),
        totalScore,
        maxScore,
        scoreRate: maxScore > 0 ? Math.round((totalScore / maxScore) * 1000) / 10 : 0,
        pointsEarned: toNumber(session.pointsEarned),
        completedAt: isTimestampLike(session.completedAt) ? session.completedAt : null,
      };
    });

    return NextResponse.json({ reports, total: reports.length });
  } catch (e) {
    console.error('[admin/user-reports] Error:', e);
    return NextResponse.json({ error: '사용자 리포트 조회에 실패했습니다.' }, { status: 500 });
  }
}
