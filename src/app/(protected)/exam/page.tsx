'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';

interface SchoolExamMeta {
  id: string;
  title: string;
  category: string;
  school: string;
  grade: number;
  subject: string;
  sheet: number;
  difficulty: string;
  timeLimit: number;
  totalScore: number;
  mcCount: number;
  essayCount: number;
}

const DIFF_COLOR: Record<string, string> = {
  '보통': 'bg-blue-100 text-blue-700',
  '어려움': 'bg-orange-100 text-orange-700',
};

const SHEET_ICON = ['🌱', '📗', '📘', '📙', '🔥'];

const SUBJECT_META: Record<string, { icon: string; range: string }> = {
  '수학': { icon: '📐', range: '일차부등식의 활용 ~ 함수 (p60–p131)' },
  '과학': { icon: '🔬', range: 'Ⅲ. 빛과 파동 (p94–p133) · Ⅳ. 물질의 구성 (p134–p165)' },
  '역사': { icon: '📜', range: 'p8–15, p22–71, p75–76, p78–81, p86–92, p102–113' },
};

const CATEGORY_ICONS: Record<string, string> = {
  '학교': '🏫',
  '자격증': '📜',
};

const SCHOOL_KEY = 'studylab_selected_school';
const CATEGORY_KEY = 'studylab_selected_category';

function normalizeSchoolName(name: string): string {
  if (!name) return '';
  // "부천일신중" → "부천일신중학교", "서울고" → "서울고등학교" 등으로 매칭
  const normalized = name.trim();
  return normalized;
}

function findMatchingSchool(userInput: string, availableSchools: string[]): string | null {
  const input = normalizeSchoolName(userInput);
  if (!input) return null;

  // 정확한 일치
  if (availableSchools.includes(input)) return input;

  // 접미사 무시 검색 (예: "부천일신중" → "부천일신중학교")
  const suffixes = ['학교', '고등학교', '중학교', '초등학교'];
  for (const suffix of suffixes) {
    if (availableSchools.includes(input + suffix)) return input + suffix;
  }

  // 역방향: "부천일신중학교" 입력 시 "부천일신중"으로 제거된 버전 찾기
  for (const suffix of suffixes) {
    if (input.endsWith(suffix)) {
      const base = input.slice(0, -suffix.length);
      if (availableSchools.includes(base)) return base;
    }
  }

  return null;
}

export default function ExamListPage() {
  const { profile } = useAuth();
  const [exams, setExams] = useState<SchoolExamMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<string>('학교');
  const [activeSchool, setActiveSchool] = useState<string>('');
  const [activeSubject, setActiveSubject] = useState<string>('');

  useEffect(() => {
    fetch('/api/school-exams')
      .then(r => r.json())
      .then((data: SchoolExamMeta[]) => {
        setExams(data);

        const savedCategory = localStorage.getItem(CATEGORY_KEY) ?? '학교';
        setActiveCategory(savedCategory);

        const schoolsInCategory = [...new Set(data.filter(e => e.category === savedCategory).map(e => e.school))];
        // Prefer profile school (정규화) > localStorage > first available
        const profileSchool = profile?.school ?? '';
        const matchedProfileSchool = profileSchool ? findMatchingSchool(profileSchool, schoolsInCategory) : null;
        const savedSchool = localStorage.getItem(SCHOOL_KEY) ?? '';
        const preferred = matchedProfileSchool ?? savedSchool;
        const school = schoolsInCategory.includes(preferred) ? preferred : (schoolsInCategory[0] ?? '');
        setActiveSchool(school);

        const subjects = [...new Set(data.filter(e => e.category === savedCategory && e.school === school).map(e => e.subject))];
        setActiveSubject(subjects[0] ?? '');

        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  function selectCategory(cat: string) {
    setActiveCategory(cat);
    localStorage.setItem(CATEGORY_KEY, cat);

    const schoolsInCat = [...new Set(exams.filter(e => e.category === cat).map(e => e.school))];
    const school = schoolsInCat[0] ?? '';
    setActiveSchool(school);
    localStorage.setItem(SCHOOL_KEY, school);

    const subjects = [...new Set(exams.filter(e => e.category === cat && e.school === school).map(e => e.subject))];
    setActiveSubject(subjects[0] ?? '');
  }

  function selectSchool(school: string) {
    setActiveSchool(school);
    localStorage.setItem(SCHOOL_KEY, school);
    const subjects = [...new Set(exams.filter(e => e.category === activeCategory && e.school === school).map(e => e.subject))];
    setActiveSubject(subjects[0] ?? '');
  }

  const categories = [...new Set(exams.map(e => e.category))];
  const schoolsInCategory = [...new Set(exams.filter(e => e.category === activeCategory).map(e => e.school))];
  // 사용자 설정 학교가 실제로 DB에 있는지 확인 (정규화된 이름으로 매칭)
  const matchedSchool = profile?.school ? findMatchingSchool(profile.school, schoolsInCategory) : null;
  const isSchoolValid = activeCategory === '학교' && !!matchedSchool;
  const subjectsForSchool = [...new Set(exams.filter(e => e.category === activeCategory && e.school === activeSchool).map(e => e.subject))];
  const filtered = exams.filter(e => e.category === activeCategory && e.school === activeSchool && e.subject === activeSubject);
  const meta = SUBJECT_META[activeSubject];

  if (loading) return <div className="text-center py-20 text-gray-400">불러오는 중...</div>;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">📋 시험</h1>
        <p className="text-gray-500 text-sm mt-1">카테고리를 선택하고 모의고사를 응시하세요</p>
      </div>

      {/* 학교 카테고리 선택 시 학교 미설정 또는 미등록 경고 */}
      {activeCategory === '학교' && !isSchoolValid && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 text-center space-y-3">
          <div className="text-5xl">🏫</div>
          <div>
            <p className="font-semibold text-amber-900 mb-1">
              {profile?.school ? `"${profile.school}"은(는) 등록되지 않은 학교입니다` : '학교를 설정해주세요'}
            </p>
            <p className="text-sm text-amber-700 mb-3">설정에서 학교를 입력하면 해당 학교의 시험을 볼 수 있습니다.</p>
            <Link href="/settings" className="inline-block bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition">
              ⚙️ 설정 페이지로 이동
            </Link>
          </div>
        </div>
      )}

      {/* Category tabs & content (학교는 설정 필수) */}
      {activeCategory === '학교' && !isSchoolValid ? null : (
      <>
      <div className="flex gap-2">
        {['학교', '자격증', ...categories.filter(c => c !== '학교' && c !== '자격증')].map(cat => (
          <button
            key={cat}
            onClick={() => selectCategory(cat)}
            className={`px-5 py-2.5 rounded-xl text-sm font-bold transition border ${
              activeCategory === cat
                ? 'bg-indigo-600 text-white border-indigo-600'
                : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            {CATEGORY_ICONS[cat] ?? '📄'} {cat}
          </button>
        ))}
      </div>

      {/* 학교 카테고리 */}
      {activeCategory === '학교' && (
        <>
          {schoolsInCategory.length > 0 ? (
            <>
              {/* School selector */}
              <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">학교 선택</p>
                <div className="flex flex-wrap gap-2">
                  {schoolsInCategory.map(school => (
                    <button
                      key={school}
                      onClick={() => selectSchool(school)}
                      className={`px-4 py-2 rounded-xl text-sm font-semibold transition border ${
                        activeSchool === school
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      🏫 {school}
                    </button>
                  ))}
                </div>
              </div>

              {/* Subject tabs */}
              <div className="flex gap-2 flex-wrap">
                {subjectsForSchool.map(sub => {
                  const sm = SUBJECT_META[sub];
                  return (
                    <button
                      key={sub}
                      onClick={() => setActiveSubject(sub)}
                      className={`px-4 py-2 rounded-xl text-sm font-semibold transition ${
                        activeSubject === sub
                          ? 'bg-indigo-600 text-white'
                          : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      {sm?.icon ?? '📄'} {sub}
                    </button>
                  );
                })}
              </div>

              {/* Info banner */}
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
                <p className="font-semibold mb-1">
                  ⚠️ 시험 안내 — 🏫 {activeSchool}{meta ? ` · ${meta.icon} ${activeSubject}` : ''}
                </p>
                <ul className="space-y-0.5 text-amber-700">
                  <li>· 시험 시간 <strong>40분</strong> — 시간 조정 불가</li>
                  <li>· 5지선다 <strong>20문항</strong> (각 4점) + 서술형 <strong>5문항</strong> (각 4점) = 100점</li>
                  {meta && <li>· 범위: {meta.range}</li>}
                  <li>· 점수에 따라 포인트 지급 (90점↑ 500p · 80점↑ 350p · 70점↑ 250p · 60점↑ 150p · 50점↑ 100p · 50점 미만 50p)</li>
                  <li>· 하루 1회 포인트 지급</li>
                </ul>
              </div>

              {/* Exam cards */}
              <div className="grid gap-4">
                {filtered.map((exam, idx) => (
                  <div key={exam.id} className="bg-white rounded-xl border border-gray-200 p-5 flex items-center justify-between shadow-sm">
                    <div className="flex items-start gap-4">
                      <div className="text-3xl mt-0.5">{SHEET_ICON[idx] ?? '📄'}</div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-bold text-gray-700">{exam.sheet}회</span>
                          <span className={`text-xs rounded-full px-2 py-0.5 font-semibold ${DIFF_COLOR[exam.difficulty] ?? 'bg-gray-100 text-gray-600'}`}>
                            {exam.difficulty}
                          </span>
                        </div>
                        <h2 className="font-bold text-gray-800">{exam.title}</h2>
                        <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
                          <span>⏱ {exam.timeLimit}분</span>
                          <span>📝 객관식 {exam.mcCount}문항 + 서술형 {exam.essayCount}문항</span>
                          <span>🏆 {exam.totalScore}점 만점</span>
                        </div>
                      </div>
                    </div>
                    <Link
                      href={`/exam/${exam.id}`}
                      className="shrink-0 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition"
                    >
                      응시하기
                    </Link>
                  </div>
                ))}
                {filtered.length === 0 && (
                  <div className="text-center py-16 text-gray-400">
                    <div className="text-4xl mb-3">📭</div>
                    <p>해당 과목의 시험이 없습니다.</p>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="text-center py-20 text-gray-400">
              <div className="text-4xl mb-3">🏫</div>
              <p>등록된 학교 시험이 없습니다.</p>
            </div>
          )}
        </>
      )}

      {/* 자격증 카테고리 */}
      {activeCategory === '자격증' && (
        <>
          {exams.filter(e => e.category === '자격증').length > 0 ? (
            <div className="grid gap-4">
              {exams.filter(e => e.category === '자격증').map((exam, idx) => (
                <div key={exam.id} className="bg-white rounded-xl border border-gray-200 p-5 flex items-center justify-between shadow-sm">
                  <div className="flex items-start gap-4">
                    <div className="text-3xl mt-0.5">{SHEET_ICON[idx] ?? '📄'}</div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-bold text-gray-700">{exam.subject}</span>
                        <span className={`text-xs rounded-full px-2 py-0.5 font-semibold ${DIFF_COLOR[exam.difficulty] ?? 'bg-gray-100 text-gray-600'}`}>
                          {exam.difficulty}
                        </span>
                      </div>
                      <h2 className="font-bold text-gray-800">{exam.title}</h2>
                      <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
                        <span>⏱ {exam.timeLimit}분</span>
                        <span>📝 {exam.mcCount + exam.essayCount}문항</span>
                        <span>🏆 {exam.totalScore}점 만점</span>
                      </div>
                    </div>
                  </div>
                  <Link
                    href={`/exam/${exam.id}`}
                    className="shrink-0 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition"
                  >
                    응시하기
                  </Link>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-20 text-gray-400">
              <div className="text-5xl mb-4">📜</div>
              <p className="font-semibold text-gray-500 mb-1">준비 중입니다</p>
              <p className="text-sm">자격증 모의고사가 곧 추가될 예정입니다.</p>
            </div>
          )}
        </>
      )}
      </>
      )}
    </div>
  );
}
