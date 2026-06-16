export type Difficulty = '기본' | '유형별' | '심화' | '킬러';

export const POINTS_PER_KRW = 10; // 10p = 1원

export const DIFFICULTY_RULES: Record<Difficulty, {
  perQuestion: number;
  complete: number;
  bonus80: number;
  bonusPerfect: number;
}> = {
  '기본':   { perQuestion: 25,  complete: 100, bonus80: 150,  bonusPerfect: 250  },
  '유형별': { perQuestion: 50,  complete: 200, bonus80: 300,  bonusPerfect: 500  },
  '심화':   { perQuestion: 100, complete: 400, bonus80: 600,  bonusPerfect: 1000 },
  '킬러':   { perQuestion: 200, complete: 750, bonus80: 1000, bonusPerfect: 2000 },
};

export const POINT_RULES = {
  DAILY_LOGIN: 20,
  STREAK_7_DAYS: 200,
} as const;

export function calcExamPoints(
  correct: number,
  total: number,
  difficulty: Difficulty = '기본'
): { base: number; bonus: number; total: number; reasons: string[] } {
  const rule = DIFFICULTY_RULES[difficulty];
  const reasons: string[] = [];
  let base = 0;
  let bonus = 0;

  base += correct * rule.perQuestion;
  reasons.push(`정답 ${correct}개 × ${rule.perQuestion}p`);

  base += rule.complete;
  reasons.push(`시험 완료 +${rule.complete}p`);

  const ratio = correct / total;
  if (ratio === 1) {
    bonus += rule.bonusPerfect;
    reasons.push(`만점 보너스 +${rule.bonusPerfect}p`);
  } else if (ratio >= 0.8) {
    bonus += rule.bonus80;
    reasons.push(`80% 이상 보너스 +${rule.bonus80}p`);
  }

  return { base, bonus, total: base + bonus, reasons };
}

export function pointsToKrw(points: number): number {
  return Math.floor(points / POINTS_PER_KRW);
}
