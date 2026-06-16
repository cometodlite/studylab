'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { collection, query, where, orderBy, getDocs, limit, startAfter, QueryDocumentSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';

interface PointLog {
  id: string;
  amount: number;
  reason: string;
  createdAt: { seconds: number } | null;
}

const PAGE_SIZE = 20;

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
    setLoading(false);
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
  );
}
