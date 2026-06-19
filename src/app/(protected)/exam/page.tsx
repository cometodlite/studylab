'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const UNITS_BY_GRADE: Record<number, string[]> = {
  1: ['소인수분해'],
  2: ['유리수와 순환소수', '식의 계산', '일차부등식', '일차함수'],
  3: ['제곱근과 실수', '다항식의 전개와 인수분해', '이차방정식', '이차함수', '삼각비', '원의 성질', '통계'],
};

const EBS_STAGES = [
  { id: '개념 확인 연산 유형', label: '개념 확인 연산', desc: '핵심 공식·개념 직접 적용 (★☆☆☆☆)' },
  { id: '대표 교과서 유형', label: '대표 교과서 유형', desc: '교과서 대표 유형 풀이 (★★☆☆☆)' },
  { id: '기출 변형 핵심 유형', label: '기출 변형 핵심', desc: '내신 빈출 변형 문제 (★★★☆☆)' },
  { id: '서술형 대비 유형', label: '서술형 대비', desc: '풀이 과정·논리력 요구 (★★★★☆)' },
  { id: '최고 수준/발전 유형', label: '최고 수준 발전', desc: '준킬러·킬러 수준 (★★★★★)' },
] as const;

const COUNTS = [10, 20, 30] as const;

export default function ExamBuilderPage() {
  const router = useRouter();
  const [grade, setGrade] = useState<number | null>(null);
  const [units, setUnits] = useState<string[]>([]);
  const [stages, setStages] = useState<string[]>(['개념 확인 연산 유형', '대표 교과서 유형', '기출 변형 핵심 유형']);
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

  function toggleStage(stage: string) {
    setStages(prev => prev.includes(stage) ? prev.filter(s => s !== stage) : [...prev, stage]);
  }

  function toggleAllUnits() {
    if (!grade) return;
    const all = UNITS_BY_GRADE[grade];
    setUnits(units.length === all.length ? [] : [...all]);
  }

  async function handleStart() {
    if (!grade || units.length === 0 || stages.length === 0) return;
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({
        grade: String(grade),
        units: units.join(','),
        stages: stages.join(','),
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

  const canStart = grade !== null && units.length > 0 && stages.length > 0;

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

      {/* EBS 유형 단계 */}
      <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
        <p className="text-sm font-semibold text-gray-700 mb-1">문제 유형 단계 (EBS 5단계)</p>
        <p className="text-xs text-gray-400 mb-3">여러 단계를 함께 선택할 수 있습니다.</p>
        <div className="space-y-2.5">
          {EBS_STAGES.map(stage => (
            <label key={stage.id} className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={stages.includes(stage.id)}
                onChange={() => toggleStage(stage.id)}
                className="w-4 h-4 rounded accent-indigo-600 mt-0.5 shrink-0"
              />
              <div>
                <span className="text-sm font-medium text-gray-800">{stage.label}</span>
                <p className="text-xs text-gray-400 mt-0.5">{stage.desc}</p>
              </div>
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
