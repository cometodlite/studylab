'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface ConceptMeta {
  id: string;
  subject: string;
  grade: number;
  unit: string;
  order: number;
  title: string;
  sectionCount: number;
}

const SUBJECT_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  수학: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
  과학: { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200' },
  역사: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
};

const SUBJECT_ICONS: Record<string, string> = {
  수학: '📐',
  과학: '🔬',
  역사: '📜',
};

export default function ConceptsPage() {
  const [concepts, setConcepts] = useState<ConceptMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSubject, setSelectedSubject] = useState<string>('전체');

  useEffect(() => {
    fetch('/api/concepts')
      .then(r => r.json())
      .then((data: ConceptMeta[]) => { setConcepts(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const subjects = ['전체', ...Array.from(new Set(concepts.map(c => c.subject)))];

  const filtered = selectedSubject === '전체'
    ? concepts
    : concepts.filter(c => c.subject === selectedSubject);

  // Group by subject → grade → unit
  const grouped: Record<string, Record<number, Record<string, ConceptMeta[]>>> = {};
  for (const c of filtered) {
    if (!grouped[c.subject]) grouped[c.subject] = {};
    if (!grouped[c.subject][c.grade]) grouped[c.subject][c.grade] = {};
    if (!grouped[c.subject][c.grade][c.unit]) grouped[c.subject][c.grade][c.unit] = [];
    grouped[c.subject][c.grade][c.unit].push(c);
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-400 text-sm">개념집 불러오는 중...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-800 mb-1">개념집</h1>
      <p className="text-gray-500 text-sm mb-6">시험 범위 핵심 개념을 확인하세요.</p>

      {/* Subject filter tabs */}
      <div className="flex gap-2 mb-8 flex-wrap">
        {subjects.map(s => (
          <button
            key={s}
            onClick={() => setSelectedSubject(s)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium border transition ${
              selectedSubject === s
                ? 'bg-indigo-600 text-white border-indigo-600'
                : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-300'
            }`}
          >
            {s !== '전체' && SUBJECT_ICONS[s] ? `${SUBJECT_ICONS[s]} ` : ''}{s}
          </button>
        ))}
      </div>

      {/* Grouped cards */}
      <div className="space-y-10">
        {Object.entries(grouped).map(([subject, grades]) => {
          const color = SUBJECT_COLORS[subject] ?? { bg: 'bg-gray-50', text: 'text-gray-700', border: 'border-gray-200' };
          const gradeEntries = Object.entries(grades).sort(([a], [b]) => Number(a) - Number(b));
          const multiGrade = gradeEntries.length > 1;
          return (
            <section key={subject}>
              <h2 className="text-lg font-bold text-gray-700 mb-4">
                {SUBJECT_ICONS[subject]} {subject}
              </h2>
              <div className="space-y-8">
                {gradeEntries.map(([grade, units]) => (
                  <div key={grade}>
                    {multiGrade && (
                      <div className="flex items-center gap-2 mb-4">
                        <span className="text-sm font-semibold text-gray-500">{grade}학년</span>
                        <div className="flex-1 border-t border-gray-100" />
                      </div>
                    )}
                    <div className="space-y-6">
                      {Object.entries(units).map(([unit, items]) => (
                        <div key={unit}>
                          <h3 className={`text-sm font-semibold px-3 py-1 rounded-md inline-block mb-3 ${color.bg} ${color.text}`}>
                            {unit}
                          </h3>
                          <div className="grid gap-3 sm:grid-cols-2">
                            {items.map(c => (
                              <Link
                                key={c.id}
                                href={`/concepts/${c.id}`}
                                className={`block border rounded-xl p-4 bg-white hover:shadow-md transition hover:border-indigo-300 ${color.border}`}
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <p className="font-medium text-gray-800 text-sm leading-snug">{c.title}</p>
                                  <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${color.bg} ${color.text}`}>
                                    {c.sectionCount}섹션
                                  </span>
                                </div>
                                <p className="text-xs text-gray-400 mt-1">{c.subject} · {c.unit}</p>
                              </Link>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <p className="text-center text-gray-400 py-20">해당 과목의 개념이 없습니다.</p>
      )}
    </div>
  );
}
