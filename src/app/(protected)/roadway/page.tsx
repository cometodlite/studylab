'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { getAuth } from 'firebase/auth';

interface StageMeta {
  id: string;
  title: string;
  chapter: string;
  grade: number;
  stageOrder: number;
  chapterOrder: number;
  points: number;
  icon: string;
  boss: boolean;
  puzzleCount: number;
  stars: number;
  completed: boolean;
  unlocked: boolean;
}

const POSITIONS = ['center', 'left', 'center', 'right', 'center'] as const;
type Pos = typeof POSITIONS[number];

const posClass: Record<Pos, string> = {
  center: 'self-center',
  left:   'self-start ml-8',
  right:  'self-end mr-8',
};

function StarRow({ stars, total = 3 }: { stars: number; total?: number }) {
  return (
    <div className="flex gap-0.5 justify-center mt-1">
      {Array.from({ length: total }).map((_, i) => (
        <span key={i} className={`text-xs ${i < stars ? 'text-yellow-400' : 'text-gray-600'}`}>
          {i < stars ? '★' : '☆'}
        </span>
      ))}
    </div>
  );
}

function StageNode({ stage, pos, onClick }: { stage: StageMeta; pos: Pos; onClick: () => void }) {
  const base = 'flex flex-col items-center gap-1 cursor-pointer select-none';
  const locked = !stage.unlocked;

  return (
    <div className={`${base} ${posClass[pos]}`} onClick={locked ? undefined : onClick}>
      <div
        className={`
          relative w-16 h-16 rounded-full border-[3px] flex flex-col items-center justify-center
          transition-transform duration-150
          ${locked
            ? 'bg-gray-800 border-gray-700 opacity-50 cursor-not-allowed'
            : stage.boss
              ? stage.completed
                ? 'bg-yellow-500 border-yellow-300 shadow-lg shadow-yellow-500/40'
                : 'bg-gray-800 border-yellow-500 shadow-lg shadow-yellow-500/20 hover:scale-105 animate-pulse'
              : stage.completed
                ? 'bg-indigo-600 border-indigo-400 shadow-md shadow-indigo-500/30 hover:scale-105'
                : 'bg-amber-400 border-amber-200 shadow-lg shadow-amber-400/50 hover:scale-110 animate-pulse'
          }
        `}
      >
        <span className="text-xl leading-none">{locked ? '🔒' : stage.icon}</span>
        {stage.completed && <StarRow stars={stage.stars} />}
      </div>
      <span className={`text-xs text-center max-w-[80px] leading-tight font-medium
        ${locked ? 'text-gray-600' : stage.completed ? 'text-indigo-300' : 'text-amber-300'}`}>
        {stage.title}
      </span>
      {!locked && !stage.completed && (
        <span className="text-[10px] text-amber-400/70">+{stage.points}p</span>
      )}
    </div>
  );
}

export default function RoadwayPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [stages, setStages] = useState<StageMeta[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const auth = getAuth();
        const token = await auth.currentUser?.getIdToken();
        const res = await fetch('/api/roadway', {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (res.ok) setStages(await res.json());
      } catch { /* ignore */ } finally {
        setLoading(false);
      }
    }
    if (user) load();
  }, [user]);

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="text-center text-gray-400 text-sm">로딩 중...</div>
    </div>
  );

  // Group by chapter
  const chapters: { name: string; stages: StageMeta[] }[] = [];
  for (const s of stages) {
    const ch = chapters.find(c => c.name === s.chapter);
    if (ch) ch.stages.push(s);
    else chapters.push({ name: s.chapter, stages: [s] });
  }

  return (
    <div className="max-w-md mx-auto px-4 pb-16">
      <div className="text-center py-6">
        <h1 className="text-2xl font-bold text-gray-800">🛣️ 로드웨이</h1>
        <p className="text-gray-500 text-sm mt-1">퍼즐을 풀며 단계를 클리어하세요</p>
      </div>

      {chapters.map(ch => (
        <div key={ch.name} className="mb-10">
          {/* Chapter label */}
          <div className="flex items-center gap-3 mb-6">
            <div className="flex-1 h-px bg-gray-200" />
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-widest whitespace-nowrap">
              {ch.name}
            </span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>

          {/* Stage path */}
          <div className="flex flex-col gap-2">
            {ch.stages.map((stage, idx) => {
              const pos = POSITIONS[idx % POSITIONS.length];
              const isLast = idx === ch.stages.length - 1;
              return (
                <div key={stage.id}>
                  <StageNode
                    stage={stage}
                    pos={pos}
                    onClick={() => router.push(`/roadway/${stage.id}`)}
                  />
                  {!isLast && (
                    <div className={`flex ${pos === 'left' ? 'justify-start ml-16' : pos === 'right' ? 'justify-end mr-16' : 'justify-center'}`}>
                      <div className={`w-0.5 h-8 ${stage.completed ? 'bg-indigo-400' : 'bg-gray-200'}`} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {stages.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <div className="text-4xl mb-3">🗺️</div>
          <p>아직 스테이지가 없습니다.</p>
        </div>
      )}
    </div>
  );
}
