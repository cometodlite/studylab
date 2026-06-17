'use client';

import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';

export default function Navbar() {
  const { profile, logout } = useAuth();
  const router = useRouter();

  async function handleLogout() {
    await logout();
    router.push('/login');
  }

  return (
    <nav className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between sticky top-0 z-40">
      <Link href="/dashboard" className="text-xl font-bold text-indigo-600">
        📚 StudyLab
      </Link>

      <div className="flex items-center gap-4 text-sm">
        <Link href="/roadway" className="text-gray-600 hover:text-emerald-600 transition font-medium">🛣️ 로드웨이</Link>
        <Link href="/practice" className="text-gray-600 hover:text-indigo-600 transition">문제풀이</Link>
        <Link href="/exam" className="text-gray-600 hover:text-indigo-600 transition">시험</Link>
        <Link href="/concepts" className="text-gray-600 hover:text-indigo-600 transition">개념</Link>
        <Link href="/wrong-notes" className="text-gray-600 hover:text-indigo-600 transition">오답노트</Link>
        <Link href="/store" className="text-gray-600 hover:text-indigo-600 transition">상점</Link>
        <Link href="/my-coupons" className="text-gray-600 hover:text-indigo-600 transition">내 쿠폰</Link>
        <Link href="/points" className="text-gray-600 hover:text-indigo-600 transition">포인트</Link>
        {profile?.role === 'admin' && (
          <Link href="/admin" className="text-orange-600 hover:text-orange-700 font-semibold transition">관리자</Link>
        )}
      </div>

      <div className="flex items-center gap-3">
        {profile && (
          <div className="flex items-center gap-2">
            <span className="bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full text-sm font-semibold">
              🎯 {profile.points.toLocaleString()}p
            </span>
            <span className="text-gray-500 text-sm hidden sm:block">{profile.nickname}</span>
          </div>
        )}
        <button
          onClick={handleLogout}
          className="text-gray-400 hover:text-gray-600 text-sm transition"
        >
          로그아웃
        </button>
      </div>
    </nav>
  );
}
