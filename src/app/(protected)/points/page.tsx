'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { collection, query, where, orderBy, getDocs, limit, startAfter, QueryDocumentSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { DIFFICULTY_RULES, POINT_RULES, POINTS_PER_KRW, type Difficulty } from '@/lib/points';

interface PointLog {
  id: string;
  amount: number;
  reason: string;
  createdAt: { seconds: number } | null;
}

const PAGE_SIZE = 20;

const DIFFICULTY_COLOR: Record<Difficulty, string> = {
  '기본':   'bg-green-50 border-green-200 text-green-700',
  '유형별': 'bg-blue-50 border-blue-200 text-blue-700',
  '심화':   'bg-orange-50 border-orange-200 text-orange-700',
  '킬러':   'bg-red-50 border-red-200 text-red-700',
};

export default function PointsPage() {
  const { user, profile } = useAuth();
  const [logs, setLogs] = useState<PointLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot | null>(null);
  const [hasMore, setHasMore] = useState(true);

  useEffect(() => {
    if (!user) return;
    loadLogs(true);
  }, [user]);

  async function loadLogs(reset = false) {
    if (!user) return;
    setLoading(true);
    try {
      const constraints: Parameters<typeof query>[1][] = [
        where('userId', '==', user.uid),
        orderBy('createdAt', 'desc'),
        limit(PAGE_SIZE),
      ];
      if (!reset && lastDoc) constraints.push(startAfter(lastDoc));

      const q = query(collection(db, 'point_logs'), ...constraints);
      const snap = await getDocs(q);
      const newLogs = snap.docs.map(d => ({ id: d.id, ...d.data() } as PointLog));
      setLogs(reset ? newLogs : prev => [...prev, ...newLogs]);
      setLastDoc(snap.docs[snap.docs.length - 1] ?? null);
      setHasMore(snap.docs.length === PAGE_SIZE);
    } catch (e) {
      console.error('포인트 내역 로딩 실패:', e);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">🎯 포인트 내역</h1>
        <p className="text-gray-500 text-sm mt-1">포인트 획득 및 사용 내역입니다.</p>
      </div>

      <div className="bg-indigo-600 rounded-2xl p-6 text-white text-center">
        <div className="text-4xl font-bold">{profile?.points.toLocaleString() ?? 0}p</div>
        <div className="text-indigo-200 text-sm mt-1">현재 보유 포인트</div>
      </div>

      {/* 포인트 획득 방법 */}
      <div className="space-y-3">
        <h2 className="font-bold text-gray-700 text-sm uppercase tracking-wide">포인트 획득 방법</h2>

        {/* 환율 안내 */}
        <div className="bg-indigo-50 border border-indigo-200 rounded-xl px-4 py-3 flex items-center justify-between">
          <span className="text-indigo-700 text-sm font-medium">💱 교환 환율</span>
          <span className="text-indigo-800 font-bold">{POINTS_PER_KRW}p = 1원</span>
        </div>

        {/* 난이도별 시험 포인트 */}
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
            <span className="text-sm font-semibold text-gray-700">📝 시험 포인트 (하루 1회)</span>
          </div>
          <div className="divide-y divide-gray-100">
            {(Object.entries(DIFFICULTY_RULES) as [Difficulty, typeof DIFFICULTY_RULES[Difficulty]][]).map(([diff, rule]) => (
              <div key={diff} className="px-4 py-3 flex items-center gap-3">
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${DIFFICULTY_COLOR[diff]}`}>
                  {diff}
                </span>
                <div className="flex-1 grid grid-cols-4 gap-1 text-center text-xs text-gray-500">
                  <div><div className="font-semibold text-gray-700">{rule.perQuestion}p</div>문항당</div>
                  <div><div className="font-semibold text-gray-700">+{rule.complete}p</div>완료</div>
                  <div><div className="font-semibold text-gray-700">+{rule.bonus80}p</div>80%+</div>
                  <div><div className="font-semibold text-yellow-600">+{rule.bonusPerfect}p</div>만점</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 출석 포인트 */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white border border-gray-200 rounded-xl px-4 py-3 text-center shadow-sm">
            <div className="text-2xl font-bold text-indigo-600">+{POINT_RULES.DAILY_LOGIN}p</div>
            <div className="text-xs text-gray-500 mt-0.5">매일 첫 접속</div>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl px-4 py-3 text-center shadow-sm">
            <div className="text-2xl font-bold text-purple-600">+{POINT_RULES.STREAK_7_DAYS}p</div>
            <div className="text-xs text-gray-500 mt-0.5">7일 연속 출석</div>
          </div>
        </div>
      </div>

      {/* 포인트 내역 */}
      <div>
        <h2 className="font-bold text-gray-700 text-sm uppercase tracking-wide mb-3">내역</h2>
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm divide-y divide-gray-100">
        {logs.length === 0 && !loading && (
          <div className="text-center py-12 text-gray-400">포인트 내역이 없습니다.</div>
        )}
        {logs.map(log => (
          <div key={log.id} className="flex items-center justify-between px-5 py-4">
            <div>
              <div className="text-sm font-medium text-gray-700">{log.reason}</div>
              <div className="text-xs text-gray-400 mt-0.5">
                {log.createdAt ? new Date(log.createdAt.seconds * 1000).toLocaleString('ko-KR') : ''}
              </div>
            </div>
            <div className={`font-bold text-sm ${log.amount > 0 ? 'text-green-500' : 'text-red-500'}`}>
              {log.amount > 0 ? '+' : ''}{log.amount}p
            </div>
          </div>
        ))}
        </div>

        {hasMore && (
          <button
            onClick={() => loadLogs(false)}
            disabled={loading}
            className="w-full border border-gray-200 rounded-xl py-3 text-sm font-medium text-gray-600 hover:bg-gray-50 transition disabled:opacity-50"
          >
            {loading ? '불러오는 중...' : '더 보기'}
          </button>
        )}
      </div>
    </div>
  );
}
