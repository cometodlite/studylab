'use client';

import { useEffect, useState } from 'react';
import MathText from '@/components/MathText';

interface ConceptMeta {
  id: string;
  subject: string;
  grade: number;
  unit: string;
  title: string;
  sectionCount: number;
}

interface Flashcard {
  front: string;
  back: string;
}

interface ConceptSection {
  heading: string;
  keyPoints?: string[];
  examples?: { q: string; a: string }[];
}

interface ConceptDetail {
  id: string;
  title: string;
  subject: string;
  sections: ConceptSection[];
}

const SUBJECT_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  수학: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
  과학: { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200' },
  역사: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  한문: { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200' },
};

const SUBJECT_ICONS: Record<string, string> = {
  수학: '📐', 과학: '🔬', 역사: '📜', 한문: '🖋️',
};

function buildFlashcards(detail: ConceptDetail): Flashcard[] {
  const cards: Flashcard[] = [];
  for (const section of detail.sections) {
    if (section.examples) {
      for (const ex of section.examples) {
        if (ex.q && ex.a) cards.push({ front: ex.q, back: ex.a });
      }
    }
    if (section.keyPoints) {
      for (const kp of section.keyPoints) {
        const m = kp.match(/\*\*(.+?)\*\*[：:]\s*(.+)/);
        if (m) {
          cards.push({ front: m[1], back: m[2] });
        }
      }
    }
  }
  return cards;
}

export default function FlashcardsPage() {
  const [concepts, setConcepts] = useState<ConceptMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSubject, setSelectedSubject] = useState<string>('전체');
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [cardIndex, setCardIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [deckTitle, setDeckTitle] = useState('');
  const [deckLoading, setDeckLoading] = useState(false);

  useEffect(() => {
    fetch('/api/concepts')
      .then(r => r.json())
      .then((data: ConceptMeta[]) => { setConcepts(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const subjects = ['전체', ...Array.from(new Set(concepts.map(c => c.subject)))];
  const filtered = selectedSubject === '전체' ? concepts : concepts.filter(c => c.subject === selectedSubject);

  const grouped: Record<string, ConceptMeta[]> = {};
  for (const c of filtered) {
    if (!grouped[c.subject]) grouped[c.subject] = [];
    grouped[c.subject].push(c);
  }

  async function openDeck(concept: ConceptMeta) {
    setDeckLoading(true);
    try {
      const res = await fetch(`/api/concepts/${concept.id}`);
      const detail: ConceptDetail = await res.json();
      const built = buildFlashcards(detail);
      if (built.length === 0) {
        alert('이 개념집에는 플랫카드로 변환할 내용이 없습니다.');
        setDeckLoading(false);
        return;
      }
      setCards(built);
      setCardIndex(0);
      setFlipped(false);
      setDeckTitle(concept.title);
    } catch {
      alert('불러오기에 실패했습니다.');
    } finally {
      setDeckLoading(false);
    }
  }

  function closeDeck() {
    setCards([]);
    setDeckTitle('');
    setCardIndex(0);
    setFlipped(false);
  }

  function next() { setCardIndex(i => Math.min(i + 1, cards.length - 1)); setFlipped(false); }
  function prev() { setCardIndex(i => Math.max(i - 1, 0)); setFlipped(false); }

  // ── Flashcard viewer ──
  if (cards.length > 0) {
    const card = cards[cardIndex];
    const progress = ((cardIndex + 1) / cards.length) * 100;
    return (
      <div className="max-w-lg mx-auto px-4 py-6 flex flex-col gap-5">
        <div className="flex items-center gap-3">
          <button onClick={closeDeck} className="text-gray-400 hover:text-gray-600 text-lg">←</button>
          <div className="flex-1">
            <p className="text-xs text-gray-500 font-medium truncate">{deckTitle}</p>
            <div className="mt-1 bg-gray-200 rounded-full h-1.5 overflow-hidden">
              <div className="bg-indigo-500 h-full rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
            </div>
          </div>
          <span className="text-xs text-gray-400 shrink-0">{cardIndex + 1} / {cards.length}</span>
        </div>

        {/* 카드 flip */}
        <div
          onClick={() => setFlipped(v => !v)}
          className="cursor-pointer select-none"
          style={{ perspective: '1000px' }}
        >
          <div style={{
            position: 'relative',
            width: '100%',
            paddingBottom: '56%',
            transformStyle: 'preserve-3d',
            transition: 'transform 0.45s cubic-bezier(0.4,0,0.2,1)',
            transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
          }}>
            {/* 앞면 */}
            <div style={{ position: 'absolute', inset: 0, backfaceVisibility: 'hidden' }}
              className="bg-white rounded-3xl shadow-lg border border-gray-200 flex flex-col items-center justify-center px-8 py-6 text-center">
              <p className="text-[11px] font-bold text-indigo-400 uppercase tracking-widest mb-4">질문</p>
              <div className="text-gray-800 text-lg font-semibold leading-relaxed"><MathText text={card.front} /></div>
              <p className="text-xs text-gray-400 mt-6">탭하여 정답 확인</p>
            </div>
            {/* 뒷면 */}
            <div style={{ position: 'absolute', inset: 0, backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
              className="bg-indigo-600 rounded-3xl shadow-lg flex flex-col items-center justify-center px-8 py-6 text-center">
              <p className="text-[11px] font-bold text-indigo-200 uppercase tracking-widest mb-4">정답</p>
              <div className="text-white text-lg font-semibold leading-relaxed"><MathText text={card.back} /></div>
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <button onClick={prev} disabled={cardIndex === 0}
            className="flex-1 py-3 rounded-2xl border border-gray-200 text-gray-600 font-semibold hover:bg-gray-50 disabled:opacity-30 transition">
            ← 이전
          </button>
          <button onClick={next} disabled={cardIndex === cards.length - 1}
            className="flex-1 py-3 rounded-2xl bg-indigo-600 text-white font-semibold hover:bg-indigo-700 disabled:opacity-30 transition">
            다음 →
          </button>
        </div>

        {cardIndex === cards.length - 1 && (
          <div className="bg-green-50 border border-green-200 rounded-2xl px-5 py-4 text-center">
            <p className="text-green-700 font-bold text-base">덱 완료!</p>
            <p className="text-green-600 text-sm mt-1">모든 카드를 학습했습니다.</p>
            <button onClick={closeDeck} className="mt-3 px-5 py-2 bg-green-600 text-white rounded-xl text-sm font-semibold hover:bg-green-700 transition">
              개념집으로 돌아가기
            </button>
          </div>
        )}
      </div>
    );
  }

  // ── Deck picker ──
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">🃏 플랫카드</h1>
        <p className="text-gray-500 text-sm mt-1">개념집을 플래시카드로 빠르게 복습하세요.</p>
      </div>

      {/* 과목 필터 */}
      <div className="flex gap-2 flex-wrap">
        {subjects.map(s => (
          <button key={s} onClick={() => setSelectedSubject(s)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition border ${
              selectedSubject === s
                ? 'bg-indigo-600 text-white border-indigo-600'
                : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-300'
            }`}>
            {SUBJECT_ICONS[s] ?? ''} {s}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-16 text-gray-400">불러오는 중...</div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([subject, list]) => {
            const col = SUBJECT_COLORS[subject] ?? { bg: 'bg-gray-50', text: 'text-gray-700', border: 'border-gray-200' };
            return (
              <div key={subject}>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-lg">{SUBJECT_ICONS[subject] ?? '📄'}</span>
                  <h2 className="font-bold text-gray-700">{subject}</h2>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {list.map(c => (
                    <button
                      key={c.id}
                      onClick={() => openDeck(c)}
                      disabled={deckLoading}
                      className={`text-left border ${col.border} ${col.bg} rounded-2xl px-4 py-3.5 hover:shadow-md transition group disabled:opacity-50`}
                    >
                      <p className={`text-xs font-bold ${col.text} mb-1`}>{c.unit}</p>
                      <p className="text-gray-800 font-semibold text-sm leading-snug group-hover:text-indigo-700 transition">
                        {c.title}
                      </p>
                      <p className="text-gray-400 text-xs mt-2">{c.sectionCount}개 섹션</p>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
