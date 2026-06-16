'use client';

import { useEffect, useRef, useState } from 'react';

const RUNES = ['✦', '✧', '⬡', '◈', '✵', '⟡', '⬟', '◉'];
const GRID = 16;
const GAME_DURATION = 20;

function getRune() {
  return RUNES[Math.floor(Math.random() * RUNES.length)];
}

function getResultMessage(score: number) {
  if (score >= 25) return { emoji: '🌟', msg: '대마법사의 재능이 보입니다! 룬이 당신을 두려워하고 있어요.' };
  if (score >= 15) return { emoji: '🔮', msg: '꽤 능숙한 룬 사냥꾼이네요. 뇌가 깨끗해진 것 같습니다!' };
  if (score >= 8) return { emoji: '✨', msg: '룬들이 살짝 겁먹었어요. 조금 더 연습하면 될 것 같아요.' };
  return { emoji: '💤', msg: '룬들이 오히려 당신을 위로하고 있어요. 공부가 더 쉬울지도 몰라요...' };
}

interface ActiveRune {
  cell: number;
  rune: string;
  timerId: ReturnType<typeof setTimeout>;
}

interface Props {
  onClose: () => void;
}

export default function MagicRuneGame({ onClose }: Props) {
  const [phase, setPhase] = useState<'intro' | 'playing' | 'result'>('intro');
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(GAME_DURATION);
  const [actives, setActives] = useState<ActiveRune[]>([]);
  const [flash, setFlash] = useState<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const spawnRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const activesRef = useRef<ActiveRune[]>([]);

  activesRef.current = actives;

  function clearAll() {
    if (timerRef.current) clearInterval(timerRef.current);
    if (spawnRef.current) clearInterval(spawnRef.current);
    activesRef.current.forEach(a => clearTimeout(a.timerId));
  }

  function startGame() {
    setScore(0);
    setTimeLeft(GAME_DURATION);
    setActives([]);
    setPhase('playing');
  }

  useEffect(() => {
    if (phase !== 'playing') return;

    // 카운트다운
    timerRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) {
          clearAll();
          setActives([]);
          setPhase('result');
          return 0;
        }
        return t - 1;
      });
    }, 1000);

    // 룬 스폰 (0.6초마다 최대 3개 동시)
    spawnRef.current = setInterval(() => {
      const current = activesRef.current;
      if (current.length >= 3) return;
      const occupied = new Set(current.map(a => a.cell));
      let cell: number;
      let tries = 0;
      do { cell = Math.floor(Math.random() * GRID); tries++; }
      while (occupied.has(cell) && tries < 20);
      if (occupied.has(cell)) return;

      const rune = getRune();
      const lifeMs = 900 + Math.random() * 600;

      const timerId = setTimeout(() => {
        setActives(prev => prev.filter(a => a.cell !== cell));
      }, lifeMs);

      const entry: ActiveRune = { cell, rune, timerId };
      setActives(prev => [...prev, entry]);
    }, 600);

    return () => clearAll();
  }, [phase]);

  function handleClick(cell: number) {
    const hit = activesRef.current.find(a => a.cell === cell);
    if (!hit) return;
    clearTimeout(hit.timerId);
    setActives(prev => prev.filter(a => a.cell !== cell));
    setScore(s => s + 1);
    setFlash(cell);
    setTimeout(() => setFlash(null), 150);
  }

  const result = getResultMessage(score);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-gradient-to-b from-indigo-950 to-purple-950 rounded-2xl w-full max-w-sm shadow-2xl border border-indigo-700 overflow-hidden">

        {phase === 'intro' && (
          <div className="p-8 text-center space-y-5">
            <div className="text-5xl">🔮</div>
            <h2 className="text-white font-bold text-xl">마법의 룬 정화 의식</h2>
            <p className="text-indigo-300 text-sm leading-relaxed">
              격자에 나타나는 룬을 사라지기 전에 클릭하세요.<br />
              <span className="text-yellow-300 font-semibold">20초</span> 안에 최대한 많이!
            </p>
            <div className="grid grid-cols-4 gap-1 opacity-40 px-4">
              {Array.from({ length: GRID }).map((_, i) => (
                <div key={i} className="aspect-square rounded-lg bg-indigo-800 flex items-center justify-center text-lg text-indigo-400">
                  {i % 5 === 0 ? RUNES[i % RUNES.length] : ''}
                </div>
              ))}
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-indigo-600 text-indigo-300 text-sm font-medium hover:bg-indigo-900 transition">
                그냥 나가기
              </button>
              <button onClick={startGame} className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold transition">
                시작!
              </button>
            </div>
          </div>
        )}

        {phase === 'playing' && (
          <div className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="text-indigo-300 text-sm font-medium">룬 {score}개 포획</div>
              <div className={`font-mono font-bold text-lg ${timeLeft <= 5 ? 'text-red-400 animate-pulse' : 'text-yellow-300'}`}>
                {timeLeft}s
              </div>
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              {Array.from({ length: GRID }).map((_, i) => {
                const active = actives.find(a => a.cell === i);
                const isFlash = flash === i;
                return (
                  <button
                    key={i}
                    onClick={() => handleClick(i)}
                    className={`aspect-square rounded-xl text-xl transition-all duration-100 select-none ${
                      isFlash
                        ? 'bg-yellow-400 scale-110'
                        : active
                        ? 'bg-indigo-500 hover:bg-indigo-400 shadow-lg shadow-indigo-500/50 scale-105 cursor-pointer'
                        : 'bg-indigo-900/50 cursor-default'
                    }`}
                  >
                    {active ? active.rune : ''}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {phase === 'result' && (
          <div className="p-8 text-center space-y-5">
            <div className="text-5xl">{result.emoji}</div>
            <div>
              <div className="text-white font-bold text-4xl">{score}개</div>
              <div className="text-indigo-300 text-sm mt-1">룬 포획 완료</div>
            </div>
            <p className="text-indigo-200 text-sm leading-relaxed bg-indigo-900/50 rounded-xl p-3">
              {result.msg}
            </p>
            <div className="flex gap-3 pt-1">
              <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-indigo-600 text-indigo-300 text-sm font-medium hover:bg-indigo-900 transition">
                상점 돌아가기
              </button>
              <button onClick={startGame} className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold transition">
                다시 하기
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
