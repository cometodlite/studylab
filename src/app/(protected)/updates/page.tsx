'use client';

import { UPDATES } from '@/lib/updates';
import Link from 'next/link';

export default function UpdatesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">📰 업데이트 내역</h1>
        <p className="text-gray-500 text-sm mt-1">StudyLab이 어떻게 성장했는지 확인하세요.</p>
      </div>

      <div className="space-y-4">
        {UPDATES.map((update, idx) => (
          <div key={idx} className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-3">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <p className="text-xs text-gray-400 font-medium">{update.date}</p>
                <h2 className="text-lg font-bold text-gray-800 mt-1">{update.title}</h2>
                <p className="text-gray-600 text-sm mt-1">{update.description}</p>
              </div>
            </div>

            {update.details && update.details.length > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-100 space-y-2">
                {update.details.map((detail, i) => (
                  <div key={i} className="flex gap-3 text-sm">
                    <span className="text-indigo-500 shrink-0 mt-0.5">✓</span>
                    <p className="text-gray-700">{detail}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="text-center py-8 text-gray-400">
        <p className="text-sm">더 많은 업데이트가 진행 중입니다. 기대해주세요! 🚀</p>
      </div>

      <Link
        href="/dashboard"
        className="inline-block text-indigo-600 hover:underline text-sm font-medium"
      >
        ← 대시보드로 돌아가기
      </Link>
    </div>
  );
}
