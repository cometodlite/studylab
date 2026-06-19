'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const UNITS_BY_GRADE: Record<number, string[]> = {
  1: ['소인수분해'],
  2: ['유리수와 순환소수', '식의 계산', '일차부등식', '일차함수'],
  3: ['제곱근과 실수', '다항식의 전개와 인수분해', '이차방정식', '이차함수', '삼각비', '원의 성질', '통계'],
};

const DIFFICULTIES = ['기본', '유형별', '심화', '킬러'] as const;
const COUNTS = [10, 20, 30] as const;

export default function ExamBuilderPage() {
  const router = useRouter();
  const [grade, setGrade] = useState<number | null>(null);
  const [units, setUnits] = useState<string[]>([]);
  const [difficulties, setDifficulties] = useState<string[]>(['기본', '유형별']);
  const [count, setCount] = useState(20);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function selectGrade(g: number) {
    setGrade(g);
    setUnits([]);
  }

  function toggleUnit(unit: string) {
    setUnits(prev => prev.includes(unit) ? prev.filter(u => u !== unit) : [...prev, unit]);
  }

  function toggleDifficulty(diff: string) {
    setDifficulties(prev => prev.includes(diff) ? prev.filter(d => d !== diff) : [...prev, diff]);
  }

  function toggleAllUnits() {
    if (!grade) return;
    const all = UNITS_BY_GRADE[grade];
    setUnits(units.length === all.length ? [] : [...all]);
  }

  async function handleStart() {
    if (!grade || units.length === 0 || difficulties.length === 0) return;
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({
        grade: String(grade),
        units: units.join(','),
        difficulties: difficulties.join(','),
        count: String(count),
      });
      const res = await fetch(`/api/exams/generate?${params}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? '문제를 불러올 수 없습니다.');
        return;
      }
      sessionStorage.setItem('generated-exam', JSON.stringify(data));
      router.push('/exam/session');
    } catch {
      setError('오류가 발생했습니다. 다시 시도해주세요.');
    } finally {
      setLoading(false);
    }
  }

  const canStart = grade !== null && units.length > 0 && difficulties.length > 0;

  return (
    <div className="max-w-lg mx-auto space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-800">시험 만들기</h1>
        <p className="text-sm text-gray-500 mt-1">범위를 선택하면 해당 문제들로 모의시험을 구성해드립니다.</p>
      </div>

      {/* 학년 */}
      <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
        <p className="text-sm font-semibold text-gray-700 mb-3">학년</p>
        <div className="flex gap-2">
          {[1, 2, 3].map(g => (
            <button
              key={g}
              onClick={() => selectGrade(g)}
              className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition border ${
                grade === g
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'border-gray-200 text-gray-600 hover:border-indigo-300'
              }`}
            >
              {g}학년
            </button>
          ))}
        </div>
      </div>

      {/* 단원 */}
      {grade && (
        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-gray-700">단원</p>
            <button onClick={toggleAllUnits} className="text-xs text-indigo-600 font-medium">
              {units.length === UNITS_BY_GRADE[grade].length ? '전체 해제' : '전체 선택'}
            </button>
          </div>
          <div className="space-y-2.5">
            {UNITS_BY_GRADE[grade].map(unit => (
              <label key={unit} className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={units.includes(unit)}
                  onChange={() => toggleUnit(unit)}
                  className="w-4 h-4 rounded accent-indigo-600"
                />
                <span className="text-sm text-gray-700">{unit}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* 난이도 */}
      <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
        <p className="text-sm font-semibold text-gray-700 mb-3">난이도</p>
        <div className="grid grid-cols-2 gap-2.5">
          {DIFFICULTIES.map(diff => (
            <label key={diff} className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={difficulties.includes(diff)}
                onChange={() => toggleDifficulty(diff)}
                className="w-4 h-4 rounded accent-indigo-600"
              />
              <span className="text-sm text-gray-700">{diff}</span>
            </label>
          ))}
        </div>
      </div>

      {/* 문제 수 */}
      <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
        <p className="text-sm font-semibold text-gray-700 mb-3">문제 수</p>
        <div className="flex gap-2">
          {COUNTS.map(c => (
            <button
              key={c}
              onClick={() => setCount(c)}
              className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition border ${
                count === c
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'border-gray-200 text-gray-600 hover:border-indigo-300'
              }`}
            >
              {c}문제
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      <button
        onClick={handleStart}
        disabled={!canStart || loading}
        className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white font-semibold py-3.5 rounded-xl transition"
      >
        {loading ? '문제 구성 중...' : '시험 시작'}
      </button>
    </div>
  );
}
