'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getIdToken } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import type { GoalAlert } from '@/lib/notifications';

type PlannerSettings = {
  weeklyExamGoal: number;
  weeklyWrongRetryGoal: number;
  monthlyExamGoal: number;
  focusMode: 'auto' | 'wrong-notes' | 'exam-score' | 'streak';
  reminderEnabled: boolean;
};

type ProgressItem = {
  current: number;
  goal: number;
  percent: number;
};

type PlannerRecommendation = {
  id: string;
  title: string;
  description: string;
  href: string;
  priority: 'high' | 'normal';
};

type PlannerData = {
  settings: PlannerSettings;
  progress: {
    weeklyExams: ProgressItem;
    weeklyWrongRetries: ProgressItem;
    monthlyExams: ProgressItem;
  };
  insights: {
    weekAverage: number;
    openWrongNotes: number;
    weakTitle: string;
    learningStreakDays: number;
  };
  recommendations: PlannerRecommendation[];
  reminders: GoalAlert[];
};

const FOCUS_LABELS: Record<PlannerSettings['focusMode'], string> = {
  auto: '자동',
  'wrong-notes': '오답 우선',
  'exam-score': '점수 회복',
  streak: '스트릭 유지',
};

function todayKST() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const getPart = (type: string) => parts.find(part => part.type === type)?.value ?? '01';
  return `${getPart('year')}-${getPart('month')}-${getPart('day')}`;
}

function ProgressBar({ label, item, color }: { label: string; item: ProgressItem; color: string }) {
  return (
    <div className="rounded-xl border border-gray-100 bg-white px-4 py-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-bold text-gray-700">{label}</p>
        <p className="text-sm font-semibold text-gray-500">{item.current}/{item.goal}</p>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-gray-100">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${item.percent}%` }} />
      </div>
      <p className="mt-2 text-xs text-gray-400">{item.percent}% 진행</p>
    </div>
  );
}

export default function PlannerPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [planner, setPlanner] = useState<PlannerData | null>(null);
  const [settings, setSettings] = useState<PlannerSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const loadPlanner = useCallback(async () => {
    if (!user || !auth.currentUser) return;
    setLoading(true);
    setError('');
    try {
      const token = await getIdToken(auth.currentUser);
      const res = await fetch('/api/planner', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json() as PlannerData;
      setPlanner(data);
      setSettings(data.settings);
    } catch (e) {
      console.error('공부 플래너 로딩 실패:', e);
      setError('공부 플래너를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) loadPlanner();
    });
    return () => {
      cancelled = true;
    };
  }, [loadPlanner]);

  useEffect(() => {
    if (!planner?.reminders.length) return;
    planner.reminders.forEach(reminder => {
      const key = `studylab-planner-reminder-${reminder.id}-${todayKST()}`;
      if (window.sessionStorage.getItem(key)) return;
      window.sessionStorage.setItem(key, '1');
      window.dispatchEvent(new CustomEvent('studylab:notify', {
        detail: { ...reminder, variant: 'goal' },
      }));
    });
  }, [planner]);

  async function savePlanner() {
    if (!settings || !auth.currentUser) return;
    setSaving(true);
    setError('');
    try {
      const token = await getIdToken(auth.currentUser);
      const res = await fetch('/api/planner', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(settings),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json() as PlannerData;
      setPlanner(data);
      setSettings(data.settings);
      window.dispatchEvent(new CustomEvent('studylab:notify', {
        detail: {
          id: 'planner-saved',
          variant: 'info',
          emoji: '📅',
          title: '공부 플래너가 저장됐어요',
          message: '새 목표 기준으로 진도와 추천을 다시 계산했습니다.',
          href: '/planner',
        },
      }));
    } catch (e) {
      console.error('공부 플래너 저장 실패:', e);
      setError('공부 플래너 저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="py-20 text-center text-sm text-gray-400">공부 플래너 불러오는 중...</div>;
  }

  if (!planner || !settings) {
    return (
      <div className="rounded-xl border border-red-100 bg-white p-6 text-center shadow-sm">
        <p className="text-sm text-red-500">{error || '공부 플래너를 표시할 수 없습니다.'}</p>
        <button onClick={loadPlanner} className="mt-4 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700">
          다시 불러오기
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase text-indigo-500">Study Planner</p>
          <h1 className="mt-1 text-2xl font-bold text-gray-800">공부 플래너</h1>
          <p className="mt-1 text-sm text-gray-500">주간·월간 목표를 정하고, 현재 약점에 맞는 다음 행동을 확인하세요.</p>
        </div>
        <button
          onClick={savePlanner}
          disabled={saving}
          className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50"
        >
          {saving ? '저장 중...' : '목표 저장'}
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <ProgressBar label="주간 시험/문제 목표" item={planner.progress.weeklyExams} color="bg-indigo-500" />
        <ProgressBar label="주간 오답 재풀이" item={planner.progress.weeklyWrongRetries} color="bg-green-500" />
        <ProgressBar label="월간 시험/문제 목표" item={planner.progress.monthlyExams} color="bg-purple-500" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="font-bold text-gray-800">약점 기반 추천</h2>
              <p className="mt-1 text-sm text-gray-500">
                열린 오답 {planner.insights.openWrongNotes}개 · 주간 평균 {planner.insights.weekAverage}% · 학습 스트릭 {planner.insights.learningStreakDays}일
              </p>
            </div>
            <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-600">
              {FOCUS_LABELS[settings.focusMode]}
            </span>
          </div>
          <div className="space-y-3">
            {planner.recommendations.map(item => (
              <button
                key={item.id}
                onClick={() => router.push(item.href)}
                className={`w-full rounded-xl border px-4 py-4 text-left transition ${
                  item.priority === 'high'
                    ? 'border-indigo-200 bg-indigo-50/60 hover:bg-indigo-50'
                    : 'border-gray-100 bg-gray-50 hover:bg-gray-100'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-bold text-gray-800">{item.title}</p>
                    <p className="mt-1 text-sm text-gray-500">{item.description}</p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2 py-1 text-xs font-semibold ${
                    item.priority === 'high' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-500'
                  }`}>
                    {item.priority === 'high' ? '우선' : '추천'}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          <h2 className="font-bold text-gray-800">목표 설정</h2>
          <div className="mt-4 space-y-4">
            <label className="block">
              <span className="text-xs font-semibold text-gray-500">주간 시험/문제 목표</span>
              <input
                type="number"
                min={1}
                max={21}
                value={settings.weeklyExamGoal}
                onChange={e => setSettings(current => current && { ...current, weeklyExamGoal: Number(e.target.value) })}
                className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-indigo-400"
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-gray-500">주간 오답 재풀이 목표</span>
              <input
                type="number"
                min={0}
                max={14}
                value={settings.weeklyWrongRetryGoal}
                onChange={e => setSettings(current => current && { ...current, weeklyWrongRetryGoal: Number(e.target.value) })}
                className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-indigo-400"
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-gray-500">월간 시험/문제 목표</span>
              <input
                type="number"
                min={1}
                max={80}
                value={settings.monthlyExamGoal}
                onChange={e => setSettings(current => current && { ...current, monthlyExamGoal: Number(e.target.value) })}
                className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-indigo-400"
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-gray-500">추천 기준</span>
              <select
                value={settings.focusMode}
                onChange={e => setSettings(current => current && { ...current, focusMode: e.target.value as PlannerSettings['focusMode'] })}
                className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-indigo-400"
              >
                {Object.entries(FOCUS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </label>
            <label className="flex items-center justify-between gap-3 rounded-xl bg-gray-50 px-3 py-3">
              <span>
                <span className="block text-sm font-semibold text-gray-700">알림 사용</span>
                <span className="block text-xs text-gray-400">목표가 밀리면 추천 알림을 표시합니다.</span>
              </span>
              <input
                type="checkbox"
                checked={settings.reminderEnabled}
                onChange={e => setSettings(current => current && { ...current, reminderEnabled: e.target.checked })}
                className="h-5 w-5 accent-indigo-600"
              />
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}
