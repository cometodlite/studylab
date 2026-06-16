'use client';

import { useEffect, useRef, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { getAuth } from 'firebase/auth';
import MathText from '@/components/MathText';

// ── Types ────────────────────────────────────────────────────────────────────

interface FillBlankPuzzle {
  id: number;
  type: 'fill_blank';
  question: string;
  answer: string | string[];
  hint?: string;
  explanation: string;
}

interface ErrorFindPuzzle {
  id: number;
  type: 'error_find';
  question: string;
  steps: { id: number; content: string; correct: boolean }[];
  explanation: string;
}

type Puzzle = FillBlankPuzzle | ErrorFindPuzzle;

interface Stage {
  id: string;
  title: string;
  points: number;
  icon: string;
  boss: boolean;
  puzzles: Puzzle[];
}

type Phase = 'loading' | 'playing' | 'feedback' | 'complete' | 'failed';

// ── Helpers ──────────────────────────────────────────────────────────────────

function checkFillBlank(puzzle: FillBlankPuzzle, value: string): boolean {
  const norm = (s: string) => s.trim().replace(/\s+/g, '').toLowerCase();
  const answers = Array.isArray(puzzle.answer) ? puzzle.answer : [puzzle.answer];
  return answers.some(a => norm(a) === norm(value));
}

function checkErrorFind(puzzle: ErrorFindPuzzle, stepId: number): boolean {
  const wrong = puzzle.steps.find(s => !s.correct);
  return wrong?.id === stepId;
}

// ── Fill blank renderer ───────────────────────────────────────────────────────

function FillBlankView({
  puzzle,
  value,
  onChange,
  onSubmit,
  phase,
  isCorrect,
}: {
  puzzle: FillBlankPuzzle;
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  phase: Phase;
  isCorrect: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (phase === 'playing') inputRef.current?.focus(); }, [phase]);

  const parts = puzzle.question.split('__');

  return (
    <div className="flex flex-col gap-6">
      <div className="bg-gray-50 rounded-2xl p-5 min-h-[100px] flex items-center justify-center">
        <div className="flex flex-wrap items-baseline gap-1 justify-center text-lg">
          {parts.map((part, i) => (
            <span key={i} className="inline-flex items-baseline gap-1">
              <MathText text={part} />
              {i < parts.length - 1 && (
                <input
                  ref={i === 0 ? inputRef : undefined}
                  type="text"
                  value={value}
                  onChange={e => onChange(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && phase === 'playing' && onSubmit()}
                  disabled={phase !== 'playing'}
                  className={`
                    w-20 text-center text-lg font-bold border-b-2 bg-transparent outline-none px-1
                    ${phase === 'feedback'
                      ? isCorrect ? 'border-green-500 text-green-600' : 'border-red-500 text-red-600'
                      : 'border-indigo-400 text-indigo-700 focus:border-indigo-600'}
                  `}
                  placeholder="?"
                />
              )}
            </span>
          ))}
        </div>
      </div>

      {puzzle.hint && phase === 'playing' && (
        <details className="text-sm text-gray-500">
          <summary className="cursor-pointer text-indigo-500 hover:underline">힌트 보기</summary>
          <div className="mt-2 pl-2"><MathText text={puzzle.hint} /></div>
        </details>
      )}
    </div>
  );
}

// ── Error find renderer ───────────────────────────────────────────────────────

function ErrorFindView({
  puzzle,
  onSelect,
  phase,
  selected,
  isCorrect,
}: {
  puzzle: ErrorFindPuzzle;
  onSelect: (stepId: number) => void;
  phase: Phase;
  selected: number | null;
  isCorrect: boolean;
}) {
  const wrongId = puzzle.steps.find(s => !s.correct)?.id;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-gray-500 font-medium text-center">
        <MathText text={puzzle.question} />
      </p>
      <p className="text-xs text-gray-400 text-center">틀린 단계를 찾아 탭하세요</p>
      <div className="flex flex-col gap-2">
        {puzzle.steps.map(step => {
          const isSelected = selected === step.id;
          const showCorrect = phase === 'feedback' && step.id === wrongId;
          const showWrong = phase === 'feedback' && isSelected && !step.correct === false;

          let cls = 'border-gray-200 bg-white hover:border-indigo-300 hover:bg-indigo-50 cursor-pointer';
          if (phase === 'feedback' && isSelected) {
            cls = isCorrect
              ? 'border-green-400 bg-green-50'
              : 'border-red-400 bg-red-50';
          } else if (phase === 'feedback' && showCorrect && !isCorrect) {
            cls = 'border-green-400 bg-green-50';
          } else if (phase !== 'playing') {
            cls = 'border-gray-200 bg-white';
          }
          void showWrong;

          return (
            <button
              key={step.id}
              onClick={() => phase === 'playing' && onSelect(step.id)}
              disabled={phase !== 'playing'}
              className={`border-2 rounded-xl px-4 py-3 text-left transition-all text-sm ${cls}`}
            >
              <span className="font-semibold text-gray-400 mr-2">{step.id}단계</span>
              <MathText text={step.content} />
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function StagePage({ params }: { params: Promise<{ stageId: string }> }) {
  const { stageId } = use(params);
  const router = useRouter();

  const [stage, setStage] = useState<Stage | null>(null);
  const [phase, setPhase] = useState<Phase>('loading');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [hearts, setHearts] = useState(3);
  const [wrongPerPuzzle, setWrongPerPuzzle] = useState(0);
  const [isCorrect, setIsCorrect] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [selectedStep, setSelectedStep] = useState<number | null>(null);
  const [totalWrong, setTotalWrong] = useState(0);
  const [pointsEarned, setPointsEarned] = useState(0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`/api/roadway/${stageId}`)
      .then(r => r.json())
      .then(d => { setStage(d); setPhase('playing'); })
      .catch(() => router.push('/roadway'));
  }, [stageId, router]);

  if (phase === 'loading' || !stage) {
    return <div className="flex items-center justify-center py-20 text-gray-400">불러오는 중...</div>;
  }

  const puzzle = stage.puzzles[currentIndex];
  const totalPuzzles = stage.puzzles.length;
  const stars = Math.max(0, 3 - Math.floor(totalWrong / 2));

  async function saveCompletion(finalStars: number) {
    setSaving(true);
    try {
      const auth = getAuth();
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch(`/api/roadway/${stageId}/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ stars: finalStars }),
      });
      if (res.ok) {
        const data = await res.json();
        setPointsEarned(data.pointsEarned);
      }
    } catch { /* ignore */ } finally {
      setSaving(false);
    }
  }

  function handleAnswer(correct: boolean) {
    setIsCorrect(correct);
    setPhase('feedback');

    if (!correct) {
      const newWrong = wrongPerPuzzle + 1;
      setWrongPerPuzzle(newWrong);
      setTotalWrong(prev => prev + 1);
      const newHearts = hearts - 1;
      setHearts(newHearts);
      if (newHearts <= 0) {
        setTimeout(() => setPhase('failed'), 1500);
        return;
      }
    }

    setTimeout(() => {
      if (correct || wrongPerPuzzle >= 2) {
        const nextIndex = currentIndex + 1;
        if (nextIndex >= totalPuzzles) {
          const finalStars = Math.max(0, 3 - Math.floor(totalWrong / 2));
          setPhase('complete');
          saveCompletion(finalStars);
        } else {
          setCurrentIndex(nextIndex);
          setWrongPerPuzzle(0);
          setInputValue('');
          setSelectedStep(null);
          setPhase('playing');
        }
      } else {
        setInputValue('');
        setSelectedStep(null);
        setPhase('playing');
      }
    }, 1600);
  }

  function submitFillBlank() {
    if (!inputValue.trim() || phase !== 'playing') return;
    handleAnswer(checkFillBlank(puzzle as FillBlankPuzzle, inputValue));
  }

  function submitErrorFind(stepId: number) {
    if (phase !== 'playing') return;
    setSelectedStep(stepId);
    handleAnswer(checkErrorFind(puzzle as ErrorFindPuzzle, stepId));
  }

  // ── Complete screen ─────────────────────────────────────────────────────

  if (phase === 'complete') {
    const finalStars = Math.max(0, 3 - Math.floor(totalWrong / 2));
    return (
      <div className="max-w-md mx-auto px-4 py-12 flex flex-col items-center gap-6">
        <div className="text-6xl">{stage.boss ? '🏆' : '🎉'}</div>
        <h2 className="text-2xl font-bold text-gray-800">스테이지 클리어!</h2>
        <div className="flex gap-2 text-4xl">
          {[1,2,3].map(i => (
            <span key={i} className={i <= finalStars ? 'text-yellow-400' : 'text-gray-300'}>★</span>
          ))}
        </div>
        <div className="bg-indigo-50 rounded-2xl px-8 py-5 text-center">
          {saving ? (
            <p className="text-gray-400 text-sm">저장 중...</p>
          ) : (
            <>
              <p className="text-3xl font-bold text-indigo-600">+{pointsEarned}p</p>
              <p className="text-gray-500 text-sm mt-1">포인트 획득</p>
            </>
          )}
        </div>
        <div className="flex gap-3 w-full">
          <button onClick={() => router.push('/roadway')}
            className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-600 font-semibold hover:bg-gray-50">
            로드웨이로
          </button>
          <button onClick={() => { setCurrentIndex(0); setHearts(3); setWrongPerPuzzle(0); setTotalWrong(0); setInputValue(''); setSelectedStep(null); setPhase('playing'); }}
            className="flex-1 py-3 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-700">
            다시 도전
          </button>
        </div>
      </div>
    );
  }

  // ── Failed screen ───────────────────────────────────────────────────────

  if (phase === 'failed') {
    return (
      <div className="max-w-md mx-auto px-4 py-12 flex flex-col items-center gap-6">
        <div className="text-6xl">💔</div>
        <h2 className="text-2xl font-bold text-gray-800">다시 도전하세요!</h2>
        <p className="text-gray-500 text-sm">하트가 모두 소진됐어요. 다시 시작하면 됩니다.</p>
        <div className="flex gap-3 w-full">
          <button onClick={() => router.push('/roadway')}
            className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-600 font-semibold hover:bg-gray-50">
            로드웨이로
          </button>
          <button onClick={() => { setCurrentIndex(0); setHearts(3); setWrongPerPuzzle(0); setTotalWrong(0); setInputValue(''); setSelectedStep(null); setPhase('playing'); }}
            className="flex-1 py-3 rounded-xl bg-red-500 text-white font-semibold hover:bg-red-600">
            다시 시작
          </button>
        </div>
      </div>
    );
  }

  // ── Playing / Feedback screen ───────────────────────────────────────────

  return (
    <div className="max-w-md mx-auto px-4 py-4 flex flex-col min-h-[80vh]">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => router.push('/roadway')} className="text-gray-400 hover:text-gray-600 text-lg">←</button>
        <div className="flex-1 bg-gray-200 rounded-full h-2.5 overflow-hidden">
          <div
            className="bg-indigo-500 h-full rounded-full transition-all duration-500"
            style={{ width: `${((currentIndex) / totalPuzzles) * 100}%` }}
          />
        </div>
        <div className="flex gap-1">
          {[1,2,3].map(i => (
            <span key={i} className={`text-lg ${i <= hearts ? 'text-red-500' : 'text-gray-300'}`}>♥</span>
          ))}
        </div>
      </div>

      {/* Stage title */}
      <div className="text-center mb-4">
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-widest">{stage.title}</span>
        <div className="text-xs text-gray-400 mt-0.5">{currentIndex + 1} / {totalPuzzles}</div>
      </div>

      {/* Puzzle */}
      <div className="flex-1 flex flex-col justify-center gap-6">
        <div className="flex-1 flex flex-col justify-center">
          {puzzle.type === 'fill_blank' ? (
            <FillBlankView
              puzzle={puzzle as FillBlankPuzzle}
              value={inputValue}
              onChange={setInputValue}
              onSubmit={submitFillBlank}
              phase={phase}
              isCorrect={isCorrect}
            />
          ) : (
            <ErrorFindView
              puzzle={puzzle as ErrorFindPuzzle}
              onSelect={submitErrorFind}
              phase={phase}
              selected={selectedStep}
              isCorrect={isCorrect}
            />
          )}
        </div>

        {/* Feedback banner */}
        {phase === 'feedback' && (
          <div className={`rounded-2xl px-5 py-4 ${isCorrect ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
            <p className={`font-bold mb-1 ${isCorrect ? 'text-green-700' : 'text-red-600'}`}>
              {isCorrect ? '✓ 정답!' : '✗ 오답'}
            </p>
            <div className="text-sm text-gray-600"><MathText text={puzzle.explanation} /></div>
          </div>
        )}
      </div>

      {/* Submit button (fill_blank only) */}
      {puzzle.type === 'fill_blank' && phase === 'playing' && (
        <button
          onClick={submitFillBlank}
          disabled={!inputValue.trim()}
          className="mt-4 w-full py-4 rounded-2xl bg-indigo-600 text-white font-bold text-lg
            disabled:bg-gray-200 disabled:text-gray-400 hover:bg-indigo-700 transition-colors"
        >
          확인
        </button>
      )}
    </div>
  );
}
