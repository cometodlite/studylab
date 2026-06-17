'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { collection, query, where, orderBy, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import Image from 'next/image';

interface Purchase {
  id: string;
  couponName: string;
  pointsSpent: number;
  couponItemId: string;
  createdAt: { seconds: number } | null;
  item?: CouponItem;
}

interface CouponItem {
  imageUrl: string;
  isUsed: boolean;
}

export default function MyCouponsPage() {
  const { user } = useAuth();
  const [purchases, setPurchases] = useState<(Purchase & { item?: CouponItem })[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    loadPurchases();
  }, [user]);

  async function loadPurchases() {
    if (!user) return;
    try {
      const q = query(
        collection(db, 'purchases'),
        where('userId', '==', user.uid),
        orderBy('createdAt', 'desc')
      );
      const snap = await getDocs(q);
      const items = snap.docs.map(d => ({ id: d.id, ...d.data() } as Purchase));
      setPurchases(items);
    } catch (e) {
      console.error('[my-coupons] loadPurchases failed:', e);
    } finally {
      setLoading(false);
    }
  }

  async function loadItem(purchase: Purchase) {
    if (purchase.item) {
      setExpanded(expanded === purchase.id ? null : purchase.id);
      return;
    }
    const { getDoc, doc: firestoreDoc } = await import('firebase/firestore');
    const snap = await getDoc(firestoreDoc(db, 'coupon_items', purchase.couponItemId));
    if (snap.exists()) {
      setPurchases(prev =>
        prev.map(p => p.id === purchase.id ? { ...p, item: snap.data() as CouponItem } : p)
      );
    }
    setExpanded(purchase.id);
  }

  if (loading) return <div className="text-center py-20 text-gray-400">불러오는 중...</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">🎟️ 내 쿠폰함</h1>
        <p className="text-gray-500 text-sm mt-1">교환한 기프티콘을 확인하세요.</p>
      </div>

      {purchases.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <div className="text-4xl mb-3">🎟️</div>
          <p>아직 교환한 쿠폰이 없습니다.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {purchases.map(p => (
            <div key={p.id} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <button
                onClick={() => loadItem(p)}
                className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition"
              >
                <div className="text-left">
                  <div className="font-semibold text-gray-800">{p.couponName}</div>
                  <div className="text-sm text-gray-400 mt-0.5">
                    -{p.pointsSpent}p · {p.createdAt ? new Date(p.createdAt.seconds * 1000).toLocaleDateString('ko-KR') : ''}
                  </div>
                </div>
                <span className="text-gray-400 text-sm">{expanded === p.id ? '▲' : '▼'} 기프티콘 보기</span>
              </button>
              {expanded === p.id && p.item && (
                <div className="border-t border-gray-100 p-4 bg-gray-50">
                  <div className="relative w-full max-w-xs mx-auto aspect-square rounded-xl overflow-hidden border border-gray-200">
                    <Image src={p.item.imageUrl} alt={p.couponName} fill className="object-contain" />
                  </div>
                  <p className="text-center text-xs text-gray-400 mt-3">스크린샷을 찍어 보관하세요.</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
