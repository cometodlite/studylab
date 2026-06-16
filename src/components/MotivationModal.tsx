'use client';

import { useEffect, useState } from 'react';
import { getDailyMotivation } from '@/lib/motivations';

interface Props {
  onClose: () => void;
  todayPoints: number;
  totalPoints: number;
  streakDays: number;
}

export default function MotivationModal({ onClose, todayPoints, totalPoints, streakDays }: Props) {
  const [visible, setVisible] = useState(false);
  const motivation = getDailyMotivation();

  useEffect(() => {
    setTimeout(() => setVisible(true), 50);
  }, []);

  function handleClose() {
    setVisible(false);
    setTimeout(onClose, 300);
  }

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-black/40 transition-opacity duration-300 ${visible ? 'opacity-100' : 'opacity-0'}`}
    >
      <div
        className={`bg-white rounded-2xl shadow-2xl w-[90%] max-w-md p-8 text-center transition-all duration-300 ${visible ? 'scale-100 opacity-100' : 'scale-95 opacity-0'}`}
      >
        <div className="text-5xl mb-4">🌟</div>

        <h2 className="text-xl font-bold text-gray-800 mb-2 leading-snug">
          {motivation.message}
        </h2>
        <p className="text-gray-500 text-sm mb-6">{motivation.sub}</p>

        <div className="flex justify-center gap-4 mb-8">
          <div className="bg-indigo-50 rounded-xl px-5 py-3">
            <div className="text-2xl font-bold text-indigo-600">{totalPoints.toLocaleString()}</div>
            <div className="text-xs text-gray-500 mt-0.5">총 포인트</div>
          </div>
          <div className="bg-green-50 rounded-xl px-5 py-3">
            <div className="text-2xl font-bold text-green-600">+{todayPoints}</div>
            <div className="text-xs text-gray-500 mt-0.5">오늘 획득</div>
          </div>
          <div className="bg-orange-50 rounded-xl px-5 py-3">
            <div className="text-2xl font-bold text-orange-500">{streakDays}일</div>
            <div className="text-xs text-gray-500 mt-0.5">연속 출석</div>
          </div>
        </div>

        <button
          onClick={handleClose}
          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 rounded-xl transition"
        >
          공부 시작하기 →
        </button>
      </div>
    </div>
  );
}
