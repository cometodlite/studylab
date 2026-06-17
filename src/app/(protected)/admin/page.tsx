'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { getIdToken } from 'firebase/auth';
import { auth } from '@/lib/firebase';

interface AdminCoupon {
  id: string;
  name: string;
  description: string;
  pointsCost: number;
  thumbnailUrl: string | null;
  totalStock: number;
  availableStock: number;
}

export default function AdminPage() {
  const { profile } = useAuth();
  const router = useRouter();
  const [coupons, setCoupons] = useState<AdminCoupon[]>([]);
  const [debugHistory, setDebugHistory] = useState<{id:string;date:string;category:string;description:string;files:string[]}[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'coupons' | 'upload' | 'debug'>('coupons');

  // 새 쿠폰 폼
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newPoints, setNewPoints] = useState('');
  const [newThumb, setNewThumb] = useState('');
  const [creating, setCreating] = useState(false);

  // 기프티콘 업로드 폼
  const [uploadCouponId, setUploadCouponId] = useState('');
  const [uploadFiles, setUploadFiles] = useState<FileList | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState('');

  useEffect(() => {
    if (profile && profile.role !== 'admin') router.replace('/dashboard');
    if (profile?.role === 'admin') {
      loadCoupons();
      getIdToken(auth.currentUser!).then(token =>
        fetch('/api/admin/debug-history', { headers: { Authorization: `Bearer ${token}` } })
          .then(r => r.json()).then(data => setDebugHistory(data)).catch(() => {})
      );
    }
  }, [profile]);

  async function getToken() {
    return getIdToken(auth.currentUser!);
  }

  async function loadCoupons() {
    const token = await getToken();
    const res = await fetch('/api/admin/coupons', { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    setCoupons(data);
    setLoading(false);
  }

  async function handleCreateCoupon(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    const token = await getToken();
    await fetch('/api/admin/coupons', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name: newName, description: newDesc, pointsCost: Number(newPoints), thumbnailUrl: newThumb || null }),
    });
    setNewName(''); setNewDesc(''); setNewPoints(''); setNewThumb('');
    setCreating(false);
    await loadCoupons();
  }

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!uploadFiles || !uploadCouponId) return;
    setUploading(true);
    setUploadMsg('');
    const token = await getToken();
    const fd = new FormData();
    fd.append('couponId', uploadCouponId);
    Array.from(uploadFiles).forEach(f => fd.append('images', f));
    const res = await fetch('/api/admin/upload', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd });
    const data = await res.json();
    setUploadMsg(`✅ ${data.uploaded}개 업로드 완료`);
    setUploading(false);
    await loadCoupons();
  }

  if (!profile || profile.role !== 'admin') return null;
  if (loading) return <div className="text-center py-20 text-gray-400">불러오는 중...</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">🛠️ 관리자 패널</h1>
      </div>

      <div className="flex gap-2 flex-wrap">
        {([['coupons', '🎁 쿠폰 관리'], ['upload', '⬆️ 기프티콘 업로드'], ['debug', '🐛 디버그 수정 내역']] as const).map(([t, label]) => (
          <button
            key={t}
            onClick={() => setTab(t as typeof tab)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition ${tab === t ? 'bg-indigo-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'coupons' && (
        <div className="space-y-5">
          {/* 새 쿠폰 생성 */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
            <h2 className="font-semibold text-gray-700 mb-4">새 쿠폰 종류 추가</h2>
            <form onSubmit={handleCreateCoupon} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <input
                  value={newName} onChange={e => setNewName(e.target.value)} required
                  placeholder="쿠폰 이름 (예: 스타벅스 5천원)"
                  className="border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
                <input
                  value={newPoints} onChange={e => setNewPoints(e.target.value)} required type="number" min="1"
                  placeholder="포인트 비용"
                  className="border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
              </div>
              <input
                value={newDesc} onChange={e => setNewDesc(e.target.value)}
                placeholder="설명 (선택)"
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
              <input
                value={newThumb} onChange={e => setNewThumb(e.target.value)}
                placeholder="썸네일 URL (선택)"
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
              <button
                type="submit" disabled={creating}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-5 py-2 rounded-xl text-sm transition disabled:opacity-50"
              >
                {creating ? '추가 중...' : '쿠폰 추가'}
              </button>
            </form>
          </div>

          {/* 쿠폰 목록 */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 text-gray-600 font-semibold">쿠폰명</th>
                  <th className="text-right px-4 py-3 text-gray-600 font-semibold">포인트</th>
                  <th className="text-right px-4 py-3 text-gray-600 font-semibold">재고</th>
                  <th className="text-right px-4 py-3 text-gray-600 font-semibold">ID</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {coupons.map(c => (
                  <tr key={c.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-800">
                      {c.name}
                      {c.description && <span className="text-gray-400 text-xs ml-2">{c.description}</span>}
                    </td>
                    <td className="px-4 py-3 text-right text-indigo-600 font-semibold">{c.pointsCost.toLocaleString()}p</td>
                    <td className="px-4 py-3 text-right">
                      <span className={`font-semibold ${c.availableStock === 0 ? 'text-red-500' : 'text-green-600'}`}>
                        {c.availableStock}
                      </span>
                      <span className="text-gray-400"> / {c.totalStock}</span>
                    </td>
                    <td className="px-4 py-3 text-right text-gray-400 text-xs font-mono">{c.id.slice(0, 8)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'upload' && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm space-y-4">
          <h2 className="font-semibold text-gray-700">기프티콘 이미지 업로드</h2>
          <p className="text-sm text-gray-500">카카오 기프티콘 사진을 업로드하면 상점 재고로 등록됩니다.</p>

          <form onSubmit={handleUpload} className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">쿠폰 선택</label>
              <select
                value={uploadCouponId}
                onChange={e => setUploadCouponId(e.target.value)}
                required
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              >
                <option value="">-- 쿠폰을 선택하세요 --</option>
                {coupons.map(c => (
                  <option key={c.id} value={c.id}>{c.name} ({c.pointsCost}p)</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">기프티콘 이미지 (여러 장 가능)</label>
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={e => setUploadFiles(e.target.files)}
                required
                className="w-full text-sm text-gray-600 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
              />
            </div>
            {uploadMsg && <p className="text-green-600 text-sm">{uploadMsg}</p>}
            <button
              type="submit" disabled={uploading || !uploadFiles || !uploadCouponId}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-5 py-2 rounded-xl text-sm transition disabled:opacity-50"
            >
              {uploading ? '업로드 중...' : '업로드'}
            </button>
          </form>
        </div>
      )}

      {tab === 'debug' && (
        <div className="space-y-3">
          <p className="text-sm text-gray-500">총 {debugHistory.length}건의 수정 내역</p>
          {debugHistory.length === 0 ? (
            <div className="text-center py-10 text-gray-400">수정 내역이 없습니다.</div>
          ) : (
            [...debugHistory].reverse().map(entry => (
              <div key={entry.id} className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                  <span className={`text-xs font-semibold rounded-full px-2 py-0.5 ${
                    entry.category === 'answer_fix' ? 'bg-red-100 text-red-600' :
                    entry.category === 'question_fix' ? 'bg-orange-100 text-orange-600' :
                    entry.category === 'json_fix' ? 'bg-yellow-100 text-yellow-600' :
                    'bg-blue-100 text-blue-600'
                  }`}>
                    {entry.category === 'answer_fix' ? '정답 수정' :
                     entry.category === 'question_fix' ? '문제 수정' :
                     entry.category === 'json_fix' ? 'JSON 수정' : '기능 추가'}
                  </span>
                  <span className="text-xs text-gray-400">{entry.date}</span>
                </div>
                <p className="text-sm text-gray-700 mb-2">{entry.description}</p>
                <div className="flex flex-wrap gap-1">
                  {entry.files.map(f => (
                    <span key={f} className="text-xs font-mono bg-gray-50 text-gray-500 rounded px-2 py-0.5">{f.split('/').pop()}</span>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
