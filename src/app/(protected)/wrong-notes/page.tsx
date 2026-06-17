'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getIdToken } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import MathText from '@/components/MathText';

type WrongNote = {
  id?: string;
  examId: string;
  examTitle: string;
  questionId: number;
  questionType: 'mc' | 'essay';
  question: string;
  choices?: string[];
  correctAnswer: number | string;
  yourAnswer: number | string;
  explanation?: string;
  source: 'practice' | 'school_exam';
  archived?: boolean;
  archivedAt?: string;
};

type DailyNote = WrongNote & { _id: string };

export default function WrongNotesPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<'daily' | 'all' | 'archive'>('daily');
  const [notes, setNotes] = useState<WrongNote[]>([]);
  const [archived, setArchived] = useState<WrongNote[]>([]);
  const [daily, setDaily] = useState<DailyNote[]>([]);
  const [dailyTotal, setDailyTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [dailyAnswers, setDailyAnswers] = useState<Record<string, number>>({});
  const [dailyResults, setDailyResults] = useState<Record<string, boolean>>({});
  const [submittingId, setSubmittingId] = useState<string | null>(null);

  async function getToken() {
    return getIdToken(auth.currentUser!);
  }

  async function loadAll() {
    if (!user) return;
    setLoading(true);
    const token = await getToken();

    const [notesRes, dailyRes] = await Promise.all([
      fetch('/api/wrong-notes', { headers: { Authorization: `Bearer ${token}` } }),
      fetch('/api/wrong-notes/daily', { headers: { Authorization: `Bearer ${token}` } }),
    ]);

    const notesData = await notesRes.json();
    const dailyData = await dailyRes.json();

    setNotes(notesData.notes ?? []);
    setArchived(notesData.archived ?? []);
    setDaily(dailyData.daily ?? []);
    setDailyTotal(dailyData.total ?? 0);
    setLoading(false);
  }

  useEffect(() => { if (user) loadAll(); }, [user]);

  async function submitDailyAnswer(noteId: string, answer: number) {
    setDailyAnswers(prev => ({ ...prev, [noteId]: answer }));
    setSubmittingId(noteId);

    const token = await getToken();
    const res = await fetch(`/api/wrong-notes/${noteId}/solve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ answer }),
    });
    const data = await res.json();
    setDailyResults(prev => ({ ...prev, [noteId]: data.correct }));

    if (data.correct) {
      // 아카이브된 항목 제거
      setDaily(prev => prev.filter(n => n._id !== noteId));
      setNotes(prev => prev.filter(n => (n as DailyNote)._id !== noteId));
    }

    setSubmittingId(null);
  }

  if (loading) return <div className="text-center py-20 text-gray-400">불러오는 중...</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">📝 오답노트</h1>
        <p className="text-gray-500 text-sm mt-1">틀린 문제를 모아 매일 복습합니다.</p>
      </div>

      {/* 탭 */}
      <div className="flex gap-2">
        {([
          ['daily', `매일 20문항 (${daily.length}/${Math.min(dailyTotal, 20)})`],
          ['all', `전체 오답 (${notes.length})`],
          ['archive', `아카이브 (${archived.length})`],
        ] as const).map(([t, label]) => (
          <button
            key={t}
            onClick={() => setTab(t as typeof tab)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition ${tab === t ? 'bg-indigo-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* 매일 20문항 */}
      {tab === 'daily' && (
        <div className="space-y-4">
          {daily.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <div className="text-4xl mb-3">🎉</div>
              <p className="font-semibold text-gray-600">오늘의 오답 풀기 완료!</p>
              <p className="text-sm mt-1">
                {dailyTotal === 0 ? '아직 오답이 없습니다. 문제를 풀어보세요!' : '오답 MC 문제가 없습니다.'}
              </p>
            </div>
          ) : (
            daily.map((note, i) => {
              const noteId = note._id ?? `${note.examId}_${note.questionId}`;
              const result = dailyResults[noteId];
              const selected = dailyAnswers[noteId];
              const answered = result !== undefined;

              return (
                <div key={noteId} className={`bg-white rounded-xl p-5 border shadow-sm ${answered ? (result ? 'border-green-200' : 'border-red-200') : 'border-gray-200'}`}>
                  <div className="flex items-start gap-2 mb-3">
                    <span className="text-xs font-medium bg-gray-100 text-gray-600 rounded-full px-2 py-0.5 shrink-0">
                      {i + 1}/{daily.length}
                    </span>
                    <div className="flex-1">
                      <p className="text-xs text-gray-400 mb-1">{note.examTitle}</p>
                      <p className="font-medium text-gray-800">
                        <MathText text={note.question} />
                      </p>
                    </div>
                    {answered && <span className="text-xl shrink-0">{result ? '✅' : '❌'}</span>}
                  </div>

                  {note.choices && (
                    <div className="space-y-1.5 ml-2">
                      {note.choices.map((c, ci) => {
                        let cls = 'border-gray-200 text-gray-700 hover:border-indigo-300 hover:bg-indigo-50';
                        if (answered) {
                          if (ci === note.correctAnswer) cls = 'border-green-400 bg-green-50 text-green-800 font-semibold';
                          else if (ci === selected && !result) cls = 'border-red-300 bg-red-50 text-red-700 line-through';
                          else cls = 'border-gray-100 text-gray-400';
                        } else if (ci === selected) {
                          cls = 'border-indigo-500 bg-indigo-50 text-indigo-700 font-semibold';
                        }

                        return (
                          <button
                            key={ci}
                            disabled={answered || submittingId === noteId}
                            onClick={() => submitDailyAnswer(noteId, ci)}
                            className={`w-full text-left px-3 py-2 rounded-lg text-sm border transition ${cls} disabled:cursor-default`}
                          >
                            {ci + 1}. <MathText text={c} />
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {answered && note.explanation && (
                    <div className="mt-3 ml-2 text-sm text-gray-500 bg-gray-50 rounded-lg px-3 py-2">
                      💡 <MathText text={note.explanation} />
                    </div>
                  )}

                  {answered && result && (
                    <p className="text-sm text-green-600 font-semibold mt-2 ml-2">
                      정답! 아카이브로 이동되었습니다.
                    </p>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* 전체 오답 */}
      {tab === 'all' && (
        <div className="space-y-3">
          {notes.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <div className="text-4xl mb-3">👏</div>
              <p>오답이 없습니다!</p>
            </div>
          ) : (
            notes.map((note, i) => (
              <div key={i} className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
                <p className="text-xs text-gray-400 mb-1">
                  {note.examTitle} · {note.questionType === 'mc' ? '객관식' : '서술형'}
                  <span className="ml-1 text-xs font-medium text-gray-500">출처: {note.source === 'practice' ? '문제풀이' : '시험'}</span>
                </p>
                <p className="font-medium text-gray-800 text-sm mb-2">
                  <MathText text={note.question} />
                </p>
                {note.questionType === 'mc' && note.choices && (
                  <div className="space-y-1">
                    {note.choices.map((c, ci) => (
                      <div
                        key={ci}
                        className={`text-xs px-2 py-1 rounded ${
                          ci === note.correctAnswer ? 'bg-green-100 text-green-700 font-semibold'
                          : ci === note.yourAnswer ? 'bg-red-100 text-red-600 line-through'
                          : 'text-gray-500'
                        }`}
                      >
                        {ci + 1}. <MathText text={c} />
                      </div>
                    ))}
                  </div>
                )}
                {note.explanation && (
                  <p className="text-xs text-gray-400 mt-2 bg-gray-50 rounded px-2 py-1">
                    💡 <MathText text={note.explanation} />
                  </p>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* 아카이브 */}
      {tab === 'archive' && (
        <div className="space-y-3">
          {archived.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <div className="text-4xl mb-3">📦</div>
              <p>아직 아카이브된 문제가 없습니다.</p>
              <p className="text-sm mt-1">오답 문제를 맞추면 자동으로 여기에 저장돼요!</p>
            </div>
          ) : (
            archived.map((note, i) => (
              <div key={i} className="bg-green-50 rounded-xl p-4 border border-green-200 shadow-sm">
                <p className="text-xs text-green-600 mb-1">
                  ✅ 아카이브 · {note.examTitle}
                </p>
                <p className="font-medium text-gray-800 text-sm mb-2">
                  <MathText text={note.question} />
                </p>
                {note.questionType === 'mc' && note.choices && (
                  <div className="space-y-1">
                    {note.choices.map((c, ci) => (
                      <div
                        key={ci}
                        className={`text-xs px-2 py-1 rounded ${
                          ci === note.correctAnswer ? 'bg-green-200 text-green-800 font-semibold'
                          : ci === note.yourAnswer ? 'text-gray-400 line-through'
                          : 'text-gray-500'
                        }`}
                      >
                        {ci + 1}. <MathText text={c} />
                      </div>
                    ))}
                  </div>
                )}
                {note.explanation && (
                  <p className="text-xs text-green-600 mt-2 bg-green-100 rounded px-2 py-1">
                    💡 <MathText text={note.explanation} />
                  </p>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
