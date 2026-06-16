export const MOTIVATIONS = [
  { message: "오늘 10문제만 풀면 커피 한 잔이 기다리고 있어요. ☕", sub: "작은 목표가 큰 성취를 만듭니다." },
  { message: "어제보다 딱 1% 더 나아지면 됩니다. 🌱", sub: "꾸준함이 천재를 이깁니다." },
  { message: "지금 이 순간 공부하는 당신, 이미 앞서가고 있어요. 🚀", sub: "시작이 반입니다." },
  { message: "포인트가 쌓이는 만큼 실력도 쌓입니다. 🏆", sub: "오늘도 포인트 획득해봐요!" },
  { message: "힘들 때일수록 한 문제씩, 천천히 가도 됩니다. 💪", sub: "당신의 속도가 맞습니다." },
  { message: "오늘의 땀이 내일의 기회를 만듭니다. ✨", sub: "포기하지 말아요." },
  { message: "매일 접속하는 것만으로도 이미 대단합니다. 🌟", sub: "연속 출석 보너스 받아가세요!" },
  { message: "공부는 배신하지 않습니다. 반드시 보답합니다. 📚", sub: "오늘도 화이팅!" },
  { message: "작은 노력들이 모여 큰 변화를 만들어요. 🧩", sub: "오늘 하루도 함께 합시다!" },
  { message: "불편함을 견디는 사람이 성장하는 사람입니다. 🔥", sub: "어려운 문제일수록 도전해보세요." },
];

export function getDailyMotivation(): { message: string; sub: string } {
  const today = new Date();
  const idx = (today.getFullYear() * 365 + today.getMonth() * 31 + today.getDate()) % MOTIVATIONS.length;
  return MOTIVATIONS[idx];
}
