'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';

interface WorkbookMeta {
  id: string;
  title: string;
  grade: number;
  unit: string;
  difficulty: string;
  book: string;
  chapter: string;
  section: string;
  sectionName: string;
  questionRange: string;
  questionCount: number;
}

const SECTION_COLOR: Record<string, string> = {
  A: 'bg-green-100 text-green-700',
  B: 'bg-blue-100 text-blue-700',
  C: 'bg-orange-100 text-orange-700',
  D: 'bg-red-100 text-red-700',
};

const GRADE_LABEL: Record<number, string> = { 1: '중1', 2: '중2', 3: '중3' };
const DEVELOPER_CODE = '1846264284!?!whdyddhks';
const DEVELOPER_KEY = 'studylab_developer_mode';

export default function WorkbooksPage() {
  const { profile } = useAuth();
  const [books, setBooks] = useState<WorkbookMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [developerCode, setDeveloperCode] = useState('');
  const [codeError, setCodeError] = useState('');
  const [isDeveloper, setIsDeveloper] = useState(false);

  const isAdmin = profile?.role === 'admin';

  useEffect(() => {
    // 개발자 모드 확인
    const savedCode = localStorage.getItem(DEVELOPER_KEY);
    if (savedCode === DEVELOPER_CODE) {
      setIsDeveloper(true);
    }
  }, []);

  useEffect(() => {
    if (isAdmin || isDeveloper) {
      fetch('/api/workbooks')
        .then(r => r.json())
        .then(data => { setBooks(data); setLoading(false); })
        .catch(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [isAdmin, isDeveloper]);

  function handleDeveloperCodeSubmit(e: React.FormEvent) {
    e.preventDefault();
    setCodeError('');
    if (developerCode === DEVELOPER_CODE) {
      localStorage.setItem(DEVELOPER_KEY, DEVELOPER_CODE);
      setIsDeveloper(true);
      setDeveloperCode('');
    } else {
      setCodeError('잘못된 코드입니다.');
      setDeveloperCode('');
    }
  }

  // Group by book → chapter
  const grouped = books.reduce<Record<string, Record<string, WorkbookMeta[]>>>((acc, wb) => {
    if (!acc[wb.book]) acc[wb.book] = {};
    if (!acc[wb.book][wb.chapter]) acc[wb.book][wb.chapter] = [];
    acc[wb.book][wb.chapter].push(wb);
    return acc;
  }, {});

  if (loading) return <div className="text-center py-20 text-gray-400">불러오는 중...</div>;

  // 권한 없으면 개발자 코드 입력 폼 표시
  if (!isAdmin && !isDeveloper) {
    return (
      <div className="space-y-6 max-w-lg mx-auto">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">📒 문제집</h1>
          <p className="text-gray-500 text-sm mt-1">스터디랩스 n제 문제집</p>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-center space-y-4">
          <div className="text-5xl">🔒</div>
          <div>
            <p className="font-semibold text-amber-900 mb-1">개발 중인 기능입니다</p>
            <p className="text-sm text-amber-700 mb-4">현재 관리자만 접근할 수 있습니다.</p>
            <p className="text-xs text-amber-600 mb-3">개발자라면 코드를 입력하세요.</p>
          </div>

          <form onSubmit={handleDeveloperCodeSubmit} className="space-y-2">
            <input
              type="password"
              value={developerCode}
              onChange={e => setDeveloperCode(e.target.value)}
              placeholder="개발자 코드 입력"
              className="w-full border border-amber-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
            {codeError && <p className="text-xs text-red-600">{codeError}</p>}
            <button
              type="submit"
              className="w-full bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold py-2 rounded-lg transition"
            >
              접근 권한 요청
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">📒 문제집</h1>
        <p className="text-gray-500 text-sm mt-1">스터디랩스 n제 문제집</p>
      </div>

      {Object.keys(grouped).length === 0 ? (
        <div className="text-center py-24 text-gray-400">
          <div className="text-5xl mb-4">📦</div>
          <p className="font-semibold text-gray-500">곧 출시됩니다</p>
          <p className="text-sm mt-1">스터디랩스 n제 문제집을 준비 중입니다.</p>
        </div>
      ) : (
        Object.entries(grouped).map(([bookName, chapters]) => (
          <div key={bookName} className="space-y-5">
            <h2 className="text-lg font-bold text-gray-800 border-b border-gray-200 pb-2">
              {bookName}
            </h2>

            {Object.entries(chapters).map(([chapterName, sections]) => (
              <div key={chapterName} className="space-y-3">
                <h3 className="text-sm font-semibold text-indigo-600 ml-1">{chapterName}</h3>

                <div className="grid gap-3">
                  {sections.map(wb => (
                    <div
                      key={wb.id}
                      className="bg-white rounded-xl border border-gray-200 p-4 flex items-center justify-between shadow-sm"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="text-xs bg-gray-100 text-gray-600 rounded-full px-2 py-0.5 font-medium">
                            {GRADE_LABEL[wb.grade] ?? `${wb.grade}학년`}
                          </span>
                          <span
                            className={`text-xs rounded-full px-2 py-0.5 font-semibold ${
                              SECTION_COLOR[wb.section] ?? 'bg-gray-100 text-gray-600'
                            }`}
                          >
                            {wb.section}. {wb.sectionName}
                          </span>
                          <span className="text-xs text-gray-400">{wb.questionRange}번</span>
                        </div>
                        <p className="font-semibold text-gray-800">{wb.title}</p>
                        <span className="text-indigo-500 text-sm font-medium mt-0.5 block">
                          {wb.questionCount}문제
                        </span>
                      </div>
                      <div className="ml-4 shrink-0">
                        <Link
                          href={`/practice/${wb.id}`}
                          className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-4 py-2 rounded-xl transition"
                        >
                          풀기
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ))
      )}
    </div>
  );
}
