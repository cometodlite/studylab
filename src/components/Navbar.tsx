'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';

const LIBRARY_LINKS = [
  { href: '/practice', label: '📝 문제풀이' },
  { href: '/concepts', label: '📚 개념' },
  { href: '/wrong-notes', label: '❌ 오답노트' },
  { href: '/flashcards', label: '🃏 플랫카드', badge: 'NEW' },
];

export default function Navbar() {
  const { profile, logout } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);

  async function handleLogout() {
    await logout();
    router.push('/login');
    setOpen(false);
  }

  return (
    <>
      <nav className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between sticky top-0 z-40">
        <Link href="/dashboard" className="text-xl font-bold text-indigo-600 shrink-0">
          📚 StudyLab
        </Link>

        {/* 데스크탑 링크 */}
        <div className="hidden md:flex items-center gap-4 text-sm">
          <Link href="/roadway" className="text-gray-600 hover:text-emerald-600 transition font-medium">🛣️ 로드웨이</Link>

          {/* 라이브러리 드롭다운 */}
          <div className="relative group">
            <button className="text-gray-600 hover:text-indigo-600 transition flex items-center gap-1">
              📖 라이브러리
              <svg className="w-3 h-3 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            <div className="absolute top-full left-0 mt-2 bg-white rounded-xl shadow-lg border border-gray-100 py-1.5 w-40 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 z-50">
              {LIBRARY_LINKS.map(l => (
                <Link key={l.href} href={l.href}
                  className="flex items-center justify-between px-3 py-2 text-sm text-gray-700 hover:bg-indigo-50 hover:text-indigo-600 transition">
                  <span>{l.label}</span>
                  {l.badge && (
                    <span className="text-[10px] bg-indigo-100 text-indigo-600 font-bold px-1.5 py-0.5 rounded-full ml-1">
                      {l.badge}
                    </span>
                  )}
                </Link>
              ))}
            </div>
          </div>

          <Link href="/workbooks" className="text-gray-600 hover:text-indigo-600 transition">📒 문제집</Link>
          <Link href="/exam" className="text-gray-600 hover:text-indigo-600 transition">시험</Link>
          <Link href="/store" className="text-gray-600 hover:text-indigo-600 transition">상점</Link>
          <Link href="/my-coupons" className="text-gray-600 hover:text-indigo-600 transition">내 쿠폰</Link>
          <Link href="/points" className="text-gray-600 hover:text-indigo-600 transition">포인트</Link>
          <Link href="/settings" className="text-gray-600 hover:text-indigo-600 transition">⚙️ 설정</Link>
          {profile?.role === 'admin' && (
            <Link href="/admin" className="text-orange-600 hover:text-orange-700 font-semibold transition">관리자</Link>
          )}
        </div>

        <div className="flex items-center gap-2">
          {profile && (
            <span className="bg-indigo-100 text-indigo-700 px-2.5 py-1 rounded-full text-xs font-semibold">
              🎯 {profile.points.toLocaleString()}p
            </span>
          )}
          <button
            onClick={handleLogout}
            className="hidden md:block text-gray-400 hover:text-gray-600 text-sm transition"
          >
            로그아웃
          </button>
          <button
            onClick={() => setOpen(v => !v)}
            className="md:hidden p-1.5 rounded-lg hover:bg-gray-100 text-gray-600 transition"
            aria-label="메뉴"
          >
            {open ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>
      </nav>

      {/* 모바일 오버레이 */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/30 md:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* 모바일 사이드 드로어 */}
      <aside
        className={`fixed top-0 right-0 h-full w-64 bg-white shadow-2xl z-50 transform transition-transform duration-300 ease-in-out md:hidden ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex flex-col h-full">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <span className="font-bold text-indigo-600">📚 StudyLab</span>
            <button onClick={() => setOpen(false)} className="p-1 rounded-lg hover:bg-gray-100 text-gray-500">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {profile && (
            <div className="px-5 py-3 border-b border-gray-100 bg-indigo-50">
              <p className="text-sm font-semibold text-gray-800">{profile.nickname}</p>
              <p className="text-xs text-indigo-600 mt-0.5">🎯 {profile.points.toLocaleString()} 포인트</p>
            </div>
          )}

          <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-0.5">
            <Link href="/roadway" onClick={() => setOpen(false)}
              className="flex items-center px-3 py-2.5 rounded-xl text-sm font-medium text-gray-700 hover:bg-indigo-50 hover:text-indigo-600 transition">
              🛣️ 로드웨이
            </Link>

            {/* 라이브러리 확장 메뉴 */}
            <div>
              <button
                onClick={() => setLibraryOpen(v => !v)}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium text-gray-700 hover:bg-indigo-50 hover:text-indigo-600 transition"
              >
                <span>📖 라이브러리</span>
                <svg className={`w-3.5 h-3.5 transition-transform duration-200 ${libraryOpen ? 'rotate-180' : ''}`}
                  fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {libraryOpen && (
                <div className="ml-3 mt-0.5 space-y-0.5 pb-1">
                  {LIBRARY_LINKS.map(l => (
                    <Link key={l.href} href={l.href} onClick={() => setOpen(false)}
                      className="flex items-center justify-between px-3 py-2 rounded-lg text-sm text-gray-600 hover:bg-indigo-50 hover:text-indigo-600 transition">
                      <span>{l.label}</span>
                      {l.badge && (
                        <span className="text-[10px] bg-indigo-100 text-indigo-600 font-bold px-1.5 py-0.5 rounded-full">
                          {l.badge}
                        </span>
                      )}
                    </Link>
                  ))}
                </div>
              )}
            </div>

            <Link href="/workbooks" onClick={() => setOpen(false)}
              className="flex items-center px-3 py-2.5 rounded-xl text-sm font-medium text-gray-700 hover:bg-indigo-50 hover:text-indigo-600 transition">
              📒 문제집
            </Link>
            <Link href="/exam" onClick={() => setOpen(false)}
              className="flex items-center px-3 py-2.5 rounded-xl text-sm font-medium text-gray-700 hover:bg-indigo-50 hover:text-indigo-600 transition">
              📄 시험
            </Link>
            <Link href="/store" onClick={() => setOpen(false)}
              className="flex items-center px-3 py-2.5 rounded-xl text-sm font-medium text-gray-700 hover:bg-indigo-50 hover:text-indigo-600 transition">
              🛍️ 상점
            </Link>
            <Link href="/my-coupons" onClick={() => setOpen(false)}
              className="flex items-center px-3 py-2.5 rounded-xl text-sm font-medium text-gray-700 hover:bg-indigo-50 hover:text-indigo-600 transition">
              🎟️ 내 쿠폰
            </Link>
            <Link href="/points" onClick={() => setOpen(false)}
              className="flex items-center px-3 py-2.5 rounded-xl text-sm font-medium text-gray-700 hover:bg-indigo-50 hover:text-indigo-600 transition">
              💰 포인트
            </Link>
            <Link href="/settings" onClick={() => setOpen(false)}
              className="flex items-center px-3 py-2.5 rounded-xl text-sm font-medium text-gray-700 hover:bg-indigo-50 hover:text-indigo-600 transition">
              ⚙️ 설정
            </Link>
            {profile?.role === 'admin' && (
              <Link href="/admin" onClick={() => setOpen(false)}
                className="flex items-center px-3 py-2.5 rounded-xl text-sm font-semibold text-orange-600 hover:bg-orange-50 transition">
                🎯 관리자
              </Link>
            )}
          </nav>

          <div className="px-5 py-4 border-t border-gray-100">
            <button onClick={handleLogout} className="text-sm text-gray-400 hover:text-gray-600 transition">
              로그아웃
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
