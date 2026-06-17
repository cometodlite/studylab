'use client';

import { useEffect, useState } from 'react';

const QUOTES = [
  '시작하는 사람이 결국 해내는 사람이 된다.',
  '작은 걸음도 멈추지 않으면 목적지에 도착한다.',
  '오늘의 노력이 내일의 나를 만든다.',
  '포기하지 않는 한 실패는 과정일 뿐이다.',
  '할 수 있다고 믿는 순간 가능성은 열린다.',
  '완벽보다 중요한 것은 꾸준함이다.',
  '어제보다 나은 오늘을 만들자.',
  '어려움은 성장하기 위한 훈련이다.',
  '노력은 절대 배신하지 않는다.',
  '꿈은 행동하는 사람의 편이다.',
  '남과 비교하지 말고 어제의 나와 경쟁하자.',
  '천천히 가도 멈추지 않으면 된다.',
  '한 번의 용기가 인생을 바꿀 수 있다.',
  '지금 흘린 땀이 미래의 자신감을 만든다.',
  '불가능은 아직 노력하지 않은 상태일 뿐이다.',
  '작은 습관이 큰 결과를 만든다.',
  '오늘의 선택이 미래의 모습을 결정한다.',
  '실패는 끝이 아니라 방향을 알려주는 신호다.',
  '힘든 순간은 강해지는 순간이다.',
  '자신을 믿는 사람이 가장 오래 달린다.',
  '목표가 있는 사람은 흔들려도 다시 나아간다.',
  '실력은 재능보다 반복에서 만들어진다.',
  '포기하고 싶은 순간이 성장의 문 앞이다.',
  '노력한 시간은 절대 사라지지 않는다.',
  '한 걸음씩 쌓으면 어느새 정상에 도착한다.',
  '할 수 있는 이유를 찾는 사람이 성공한다.',
  '오늘을 이기는 사람이 내일을 만든다.',
  '두려움보다 도전이 더 큰 사람으로 만든다.',
  '나의 가능성은 내가 정한다.',
  '꾸준함은 평범함을 특별함으로 바꾼다.',
  '지금의 나는 미래의 나를 위한 투자다.',
  '좋은 결과는 좋은 과정에서 나온다.',
  '포기하지 않는 마음이 가장 강한 힘이다.',
  '작은 성공이 큰 자신감을 만든다.',
  '늦었다고 생각할 때가 새로운 시작일 수 있다.',
  '노력하는 사람에게 기회는 찾아온다.',
  '오늘 한 일이 내일의 차이를 만든다.',
  '자신을 믿고 한 번 더 도전하자.',
  '넘어지는 것보다 다시 일어나는 것이 중요하다.',
  '꿈은 기다리는 것이 아니라 만드는 것이다.',
  '힘든 만큼 성장할 기회도 커진다.',
  '나의 한계는 아직 정해지지 않았다.',
  '작은 변화가 큰 미래를 만든다.',
  '성공은 특별한 사람보다 끝까지 하는 사람에게 온다.',
  '오늘의 집중이 내일의 자유를 만든다.',
  '노력은 보이지 않아도 쌓이고 있다.',
  '자신과의 약속을 지키는 사람이 강해진다.',
  '계속하는 사람이 결국 앞선다.',
  '어제의 실패보다 오늘의 도전이 중요하다.',
  '나는 내가 생각하는 것보다 더 성장할 수 있다.',
];

const STORAGE_KEY = 'motivational_last_shown';

function todayKST(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date());
}

export default function MotivationalModal() {
  const [quote, setQuote] = useState<string | null>(null);

  useEffect(() => {
    const today = todayKST();
    if (localStorage.getItem(STORAGE_KEY) !== today) {
      setQuote(QUOTES[Math.floor(Math.random() * QUOTES.length)]);
    }
  }, []);

  function dismiss() {
    localStorage.setItem(STORAGE_KEY, todayKST());
    setQuote(null);
  }

  if (!quote) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm px-4"
      onClick={dismiss}
    >
      <div
        className="animate-motiv-in bg-white rounded-3xl shadow-2xl max-w-sm w-full p-8 text-center"
        onClick={e => e.stopPropagation()}
      >
        <div className="w-12 h-12 mx-auto mb-5 rounded-2xl bg-indigo-100 flex items-center justify-center text-2xl">
          💪
        </div>
        <p className="text-xs font-bold text-indigo-400 uppercase tracking-widest mb-4">
          오늘의 동기부여
        </p>
        <blockquote className="text-lg font-semibold text-gray-800 leading-relaxed mb-8">
          &ldquo;{quote}&rdquo;
        </blockquote>
        <button
          onClick={dismiss}
          className="w-full py-3 rounded-2xl bg-indigo-600 text-white font-bold text-base hover:bg-indigo-700 active:scale-95 transition-all"
        >
          오늘도 화이팅! 🔥
        </button>
        <p className="text-xs text-gray-400 mt-3">화면을 탭해도 닫힙니다</p>
      </div>
    </div>
  );
}
