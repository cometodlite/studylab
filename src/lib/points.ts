export const POINT_RULES = {
  CORRECT_ANSWER: 10,       // 문제 1개 정답
  EXAM_COMPLETE: 30,        // 시험지 완료
  BONUS_80_PERCENT: 50,     // 80% 이상 정답
  BONUS_PERFECT: 100,       // 만점
  DAILY_LOGIN: 20,          // 첫 접속 (일일 1회)
  STREAK_7_DAYS: 200,       // 연속 출석 7일
} as const;

export function calcExamPoints(correct: number, total: number): {
  base: number;
  bonus: number;
  total: number;
  reasons: string[];
} {
  const reasons: string[] = [];
  let base = 0;
  let bonus = 0;

  base += correct * POINT_RULES.CORRECT_ANSWER;
  reasons.push(`정답 ${correct}개 × ${POINT_RULES.CORRECT_ANSWER}p`);

  base += POINT_RULES.EXAM_COMPLETE;
  reasons.push(`시험 완료 +${POINT_RULES.EXAM_COMPLETE}p`);

  const ratio = correct / total;
  if (ratio === 1) {
    bonus += POINT_RULES.BONUS_PERFECT;
    reasons.push(`만점 보너스 +${POINT_RULES.BONUS_PERFECT}p`);
  } else if (ratio >= 0.8) {
    bonus += POINT_RULES.BONUS_80_PERCENT;
    reasons.push(`80% 이상 보너스 +${POINT_RULES.BONUS_80_PERCENT}p`);
  }

  return { base, bonus, total: base + bonus, reasons };
}
