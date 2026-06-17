'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import MathText from '@/components/MathText';

interface Section {
  heading: string;
  content: string;
  keyPoints: string[];
  examples: { q: string; a: string }[];
  notes?: string[];
}

interface Concept {
  id: string;
  subject: string;
  grade: number;
  unit: string;
  order: number;
  title: string;
  sections: Section[];
}

const SUBJECT_COLORS: Record<string, { badge: string; heading: string }> = {
  수학: { badge: 'bg-blue-100 text-blue-700', heading: 'text-blue-700' },
  과학: { badge: 'bg-green-100 text-green-700', heading: 'text-green-700' },
  역사: { badge: 'bg-amber-100 text-amber-700', heading: 'text-amber-700' },
};

export default function ConceptDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [concept, setConcept] = useState<Concept | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    fetch(`/api/concepts/${id}`)
      .then(r => {
        if (!r.ok) { setNotFound(true); setLoading(false); return null; }
        return r.json();
      })
      .then((data: Concept | null) => {
        if (data) setConcept(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-400 text-sm">개념 불러오는 중...</p>
      </div>
    );
  }

  if (notFound || !concept) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <p className="text-gray-500">해당 개념을 찾을 수 없습니다.</p>
        <button onClick={() => router.back()} className="text-indigo-600 text-sm hover:underline">← 돌아가기</button>
      </div>
    );
  }

  const color = SUBJECT_COLORS[concept.subject] ?? { badge: 'bg-gray-100 text-gray-700', heading: 'text-gray-700' };

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* Back */}
      <button onClick={() => router.back()} className="text-sm text-gray-400 hover:text-gray-600 mb-4 flex items-center gap-1">
        ← 개념집으로
      </button>

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-2">
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${color.badge}`}>{concept.subject}</span>
          <span className="text-xs text-gray-400">{concept.unit}</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-800">{concept.title}</h1>
      </div>

      {/* Sections */}
      <div className="space-y-8">
        {concept.sections.map((section, i) => (
          <section key={i} className="border border-gray-100 rounded-2xl p-5 bg-white shadow-sm">
            {section.heading && (
              <h2 className={`text-base font-bold mb-3 ${color.heading}`}>{section.heading}</h2>
            )}

            {section.content && (
              <div className="text-sm text-gray-700 leading-relaxed mb-4 prose prose-sm max-w-none">
                <MathText text={section.content} block />
              </div>
            )}

            {section.keyPoints.length > 0 && (
              <ul className="space-y-1.5 mb-4">
                {section.keyPoints.map((kp, j) => (
                  <li key={j} className="flex items-start gap-2 text-sm text-gray-700">
                    <span className="text-indigo-400 mt-0.5 shrink-0">•</span>
                    <MathText text={kp} />
                  </li>
                ))}
              </ul>
            )}

            {section.examples.length > 0 && (
              <div className="space-y-3">
                {section.examples.map((ex, j) => (
                  <div key={j} className="bg-gray-50 rounded-xl p-3 text-sm">
                    <p className="text-gray-600 font-medium mb-1">
                      <span className="text-indigo-500">Q.</span> <MathText text={ex.q} />
                    </p>
                    <p className="text-gray-800">
                      <span className="text-emerald-600 font-semibold">A.</span> <MathText text={ex.a} />
                    </p>
                  </div>
                ))}
              </div>
            )}

            {section.notes && section.notes.length > 0 && (
              <div className="mt-3 border-l-2 border-amber-300 pl-3 space-y-1">
                {section.notes.map((note, j) => (
                  <p key={j} className="text-xs text-amber-700">
                    ⚠ <MathText text={note} />
                  </p>
                ))}
              </div>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}
