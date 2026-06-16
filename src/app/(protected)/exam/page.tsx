'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface ExamMeta {
  id: string;
  title: string;
  description: string;
  questionCount: number;
}

export default function ExamListPage() {
  const [exams, setExams] = useState<ExamMeta[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/exams')
      .then(r => r.json())
      .then(data => { setExams(data); setLoading(false); });
  }, []);

  if (loading) return <div className="text-center py-20 text-gray-400">불러오는 중...</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">📝 시험 선택</h1>
        <p className="text-gray-500 text-sm mt-1">문제를 풀고 포인트를 획득하세요.</p>
      </div>

      <div className="grid gap-4">
        {exams.map(exam => (
          <div key={exam.id} className="bg-white rounded-xl border border-gray-200 p-6 flex items-center justify-between shadow-sm">
            <div>
              <h2 className="font-bold text-gray-800 text-lg">{exam.title}</h2>
              <p className="text-gray-500 text-sm mt-0.5">{exam.description}</p>
              <p className="text-indigo-500 text-sm mt-1.5 font-medium">총 {exam.questionCount}문제</p>
            </div>
            <div className="flex flex-col gap-2 ml-4">
              <Link
                href={`/exam/${exam.id}?count=5&shuffle=1`}
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-4 py-2 rounded-xl transition whitespace-nowrap"
              >
                5문제
              </Link>
              <Link
                href={`/exam/${exam.id}?count=10&shuffle=1`}
                className="bg-white hover:bg-gray-50 border border-indigo-300 text-indigo-600 text-sm font-semibold px-4 py-2 rounded-xl transition whitespace-nowrap"
              >
                10문제
              </Link>
              <Link
                href={`/exam/${exam.id}?shuffle=1`}
                className="bg-white hover:bg-gray-50 border border-gray-200 text-gray-600 text-sm font-semibold px-4 py-2 rounded-xl transition whitespace-nowrap"
              >
                전체
              </Link>
            </div>
          </div>
        ))}

        {exams.length === 0 && (
          <div className="text-center py-16 text-gray-400">
            <div className="text-4xl mb-3">📭</div>
            <p>등록된 시험이 없습니다.</p>
          </div>
        )}
      </div>
    </div>
  );
}
