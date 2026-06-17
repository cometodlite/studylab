'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getIdToken } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import Image from 'next/image';
import MagicRuneGame from '@/components/MagicRuneGame';

interface Coupon {
  id: string;
  name: string;
  description: string;
  pointsCost: number;
  thumbnailUrl: string | null;
  stock: number;
}

interface RedeemResult {
  imageUrl: string;
  couponName: string;
  pointsSpent: number;
}

export default function StorePage() {
  const { profile, refreshProfile } = useAuth();
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [redeeming, setRedeeming] = useState<string | null>(null);
  const [result, setResult] = useState<RedeemResult | null>(null);
  const [error, setError] = useState('');
  const [showMiniGame, setShowMiniGame] = useState(false);

  useEffect(() => {
    fetch('/api/coupons')
      .then(r => r.json())
      .then(data => { setCoupons(Array.isArray(data) ? data : []); setLoading(false); })
      .catch(() => { setCoupons([]); setLoading(false); });
  }, []);

  async function handleRedeem(coupon: Coupon) {
    if (!profile) return;
    if (profile.points < coupon.pointsCost) {
      setError(`포인트가 부족합니다. (보유: ${profile.points}p / 필요: ${coupon.pointsCost}p)`);
      return;
    }
    setError('');
    setRedeeming(coupon.id);
    try {
      const token = await getIdToken(auth.currentUser!);
      const res = await fetch(`/api/coupons/${coupon.id}/redeem`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setResult(data);
      await refreshProfile();
      // 재고 갱신
      const updated = await fetch('/api/coupons').then(r => r.json());
      setCoupons(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : '교환에 실패했습니다.');
    } finally {
      setRedeeming(null);
    }
  }

  const allOutOfStock = coupons.length > 0 && coupons.every(c => c.stock === 0);
  const isEmpty = coupons.length === 0;

  if (loading) return <div className="text-center py-20 text-gray-400">불러오는 중...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">🎁 스터디랩 상점</h1>
          <p className="text-gray-500 text-sm mt-1">포인트를 기프티콘으로 교환하세요.</p>
        </div>
        <div className="bg-indigo-100 text-indigo-700 px-4 py-2 rounded-xl font-bold">
          🎯 {profile?.points.toLocaleString()}p
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {/* 교환 결과 모달 */}
      {result && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-2xl p-8 max-w-sm w-full mx-4 text-center shadow-2xl">
            <div className="text-4xl mb-3">🎉</div>
            <h2 className="font-bold text-xl text-gray-800 mb-1">{result.couponName}</h2>
            <p className="text-gray-500 text-sm mb-4">교환 완료! -{result.pointsSpent}p</p>
            <div className="relative w-full aspect-square rounded-xl overflow-hidden border border-gray-200 mb-5">
              <Image src={result.imageUrl} alt="기프티콘" fill className="object-contain" />
            </div>
            <p className="text-xs text-gray-400 mb-4">스크린샷을 찍어 보관하세요.</p>
            <button
              onClick={() => setResult(null)}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 rounded-xl transition"
            >
              확인
            </button>
          </div>
        </div>
      )}

      {showMiniGame && <MagicRuneGame onClose={() => setShowMiniGame(false)} />}

      {isEmpty ? (
        <div className="flex flex-col items-center py-16 px-4 text-center space-y-5">
          <div className="text-6xl">📖</div>
          <p className="text-gray-700 font-semibold text-lg leading-snug">
            아직 마법의 책이 당신의 뇌를<br />정화시켜줄 간식을 찾지 못한 것 같네요!
          </p>
          <p className="text-gray-400 text-sm">상점 준비 중입니다. 그 동안 잠깐 쉬어가세요.</p>
          <button
            onClick={() => setShowMiniGame(true)}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-6 py-3 rounded-2xl transition shadow-md"
          >
            🔮 미니게임으로 잠시 정화하기
          </button>
        </div>
      ) : allOutOfStock ? (
        <div className="flex flex-col items-center py-16 px-4 text-center space-y-4">
          <div className="text-6xl">🏃</div>
          <p className="text-gray-700 font-semibold text-lg leading-snug">
            이런, 다른 사람들이 상점에 있는 것들을<br />모조리 가지고 달아나버렸어요!
          </p>
          <p className="text-gray-400 text-sm">재고가 곧 채워질 거예요. 조금만 기다려 주세요.</p>
          <button
            onClick={() => setShowMiniGame(true)}
            className="mt-2 border border-indigo-300 text-indigo-600 hover:bg-indigo-50 font-semibold px-5 py-2.5 rounded-2xl transition text-sm"
          >
            🔮 그 동안 미니게임이나 할까요?
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {coupons.map(coupon => (
            <div key={coupon.id} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              {coupon.thumbnailUrl && (
                <div className="relative h-32 bg-gray-50">
                  <Image src={coupon.thumbnailUrl} alt={coupon.name} fill className="object-cover" />
                </div>
              )}
              <div className="p-4">
                <h3 className="font-bold text-gray-800">{coupon.name}</h3>
                <p className="text-gray-500 text-xs mt-0.5">{coupon.description}</p>
                <div className="flex items-center justify-between mt-3">
                  <div>
                    <span className="text-indigo-600 font-bold">{coupon.pointsCost.toLocaleString()}p</span>
                    <span className="text-xs text-gray-400 ml-2">재고 {coupon.stock}개</span>
                  </div>
                </div>
                <button
                  onClick={() => handleRedeem(coupon)}
                  disabled={
                    redeeming === coupon.id ||
                    coupon.stock === 0 ||
                    (profile?.points ?? 0) < coupon.pointsCost
                  }
                  className="w-full mt-3 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold py-2 rounded-xl transition disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {redeeming === coupon.id
                    ? '처리 중...'
                    : coupon.stock === 0
                    ? '품절'
                    : (profile?.points ?? 0) < coupon.pointsCost
                    ? '포인트 부족'
                    : '교환하기'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

