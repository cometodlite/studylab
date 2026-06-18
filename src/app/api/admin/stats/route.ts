import { NextRequest, NextResponse } from 'next/server';
import { verifyFirebaseToken } from '@/lib/firebase-jwt';
import { fsGet, fsQuery } from '@/lib/firestore-rest';

function startOfTodayKST(): Date {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const getPart = (type: string) => parts.find(part => part.type === type)?.value ?? '01';

  return new Date(`${getPart('year')}-${getPart('month')}-${getPart('day')}T00:00:00+09:00`);
}

function get24HoursAgoKST(): Date {
  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  return yesterday;
}

export async function GET(req: NextRequest) {
  const token = req.headers.get('Authorization')?.split('Bearer ')[1];
  if (!token) {
    return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
  }

  let uid: string;
  try {
    uid = await verifyFirebaseToken(token);
  } catch {
    return NextResponse.json({ error: '유효하지 않은 토큰입니다.' }, { status: 401 });
  }

  try {
    // admin 권한 검증
    const userDoc = await fsGet(`users/${uid}`, token);
    if (!userDoc || userDoc.role !== 'admin') {
      return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });
    }

    // 통계 계산
    const todayStart = startOfTodayKST();
    const yesterday = get24HoursAgoKST();

    // 1. 총 가입자 수
    const allUsers = await fsQuery('users', [], token, 10000);
    const totalUsers = allUsers.length;

    // 2. 24시간 내 로그인한 활성 사용자
    const pointLogs24h = await fsQuery(
      'point_logs',
      [
        {
          field: 'createdAt',
          op: 'GREATER_THAN_OR_EQUAL',
          value: yesterday,
        },
      ],
      token,
      10000
    );
    const activeUserIds = new Set(pointLogs24h.map(log => log.userId));
    const activeUsers24h = activeUserIds.size;

    // 3. 오늘 시험 응시 수
    const examSessionsToday = await fsQuery(
      'school_exam_sessions',
      [
        {
          field: 'completedAt',
          op: 'GREATER_THAN_OR_EQUAL',
          value: todayStart,
        },
      ],
      token,
      10000
    );
    const todayExamAttempts = examSessionsToday.length;

    // 4. 미해결 문의 수
    const allInquiries = await fsQuery('inquiries', [], token, 10000);
    const pendingInquiries = allInquiries.filter(
      i => i.status !== 'resolved'
    ).length;

    // 5. 시험별 통계 (평균 점수, 응시자 수)
    const allExamSessions = await fsQuery('school_exam_sessions', [], token, 10000);
    const examStats: Record<string, { attempts: number; totalScore: number }> = {};

    allExamSessions.forEach(session => {
      const examTitle = typeof session.examTitle === 'string' && session.examTitle.trim()
        ? session.examTitle
        : '알 수 없음';
      const totalScore = typeof session.totalScore === 'number' ? session.totalScore : 0;
      if (!examStats[examTitle]) {
        examStats[examTitle] = { attempts: 0, totalScore: 0 };
      }
      examStats[examTitle].attempts += 1;
      examStats[examTitle].totalScore += totalScore;
    });

    const statsTopExams = Object.entries(examStats)
      .map(([examTitle, stats]) => ({
        examTitle,
        attempts: stats.attempts,
        avgScore: Math.round((stats.totalScore / stats.attempts) * 100) / 100,
      }))
      .sort((a, b) => b.attempts - a.attempts)
      .slice(0, 10);

    return NextResponse.json({
      totalUsers,
      activeUsers24h,
      todayExamAttempts,
      pendingInquiries,
      statsTopExams,
      timestamp: new Date().toISOString(),
    });
  } catch (e) {
    console.error('[admin/stats] Error:', e);
    return NextResponse.json(
      { error: '통계 조회에 실패했습니다.' },
      { status: 500 }
    );
  }
}
