import fs from 'node:fs';
import path from 'node:path';

const mathDir = path.join(process.cwd(), 'src', 'data', 'math');

const DIFFICULTY_PROFILE = {
  '기본': {
    role: '개념 확인 연산',
    steps: 1,
    middleStage: '개념 확인 연산 유형',
    description: '핵심 개념을 바로 적용하는 짧은 계산 문제입니다.',
  },
  '유형별': {
    role: '대표 교과서 유형',
    steps: 2,
    middleStage: '대표 교과서 유형',
    description: '교과서 대표 풀이 흐름을 숫자와 조건을 바꾸어 연습합니다.',
  },
  '심화': {
    role: '기출 변형 핵심',
    steps: 4,
    middleStage: '기출 변형 핵심 유형',
    description: '조건을 연결하고 중간 결과를 해석해야 하는 내신 변형 문제입니다.',
  },
  '킬러': {
    role: '최고 수준 발전',
    steps: 6,
    middleStage: '최고 수준/발전 유형',
    description: '조건 분류와 역추론이 필요한 고난도 변별력 문제입니다.',
  },
};

const TYPE_VARIANTS = [
  ['concept', '개념 확인', '개념 정의 직접 확인', '개념·원리 직접 활용', '정의 적용'],
  ['standard', '대표 풀이', '대표 표준 문항', '문항의 축소·확대·변형', '표준 풀이'],
  ['condition', '조건 해석', '실생활 문장제 독해', '조건 및 구하는 값 변경', '조건 선별'],
  ['inverse', '역추론', '오류 찾기 및 과정 교정', '조건의 강화·완화', '역산'],
  ['casework', '경우 분류', '말장난 방지 보기 고르기', '조건의 강화·완화', '경우 나누기'],
  ['graph', '자료 해석', '대표 표준 문항', '자료 및 상황 활용', '자료 해석'],
  ['range', '범위 판단', '대표 표준 문항', '조건 및 구하는 값 변경', '범위 해석'],
  ['parameter', '매개변수', '오류 찾기 및 과정 교정', '조건의 강화·완화', '매개변수 추론'],
  ['compare', '비교 판단', '말장난 방지 보기 고르기', '문항의 축소·확대·변형', '비교'],
  ['composite', '복합 계산', '대표 표준 문항', '개념·원리 직접 활용', '계산 연결'],
  ['proof', '서술형 흐름', '오류 찾기 및 과정 교정', '풀이 과정 단계화', '과정 점검'],
  ['hidden', '숨은 조건', '오류 찾기 및 과정 교정', '조건의 강화·완화', '숨은 조건'],
  ['model', '상황 모델링', '실생활 문장제 독해', '자료 및 상황 활용', '모델링'],
  ['transform', '변형 적용', '대표 표준 문항', '문항의 축소·확대·변형', '변형'],
  ['final', '종합 추론', '말장난 방지 보기 고르기', '조건의 강화·완화', '종합 추론'],
].map(([id, label, schoolExamType, transformPattern, skill], index) => ({
  id,
  label,
  variantNo: index + 1,
  schoolExamType,
  transformPattern,
  skill,
}));

const MIDDLE_EBS_TAXONOMY = {
  buildUpStages: [
    '개념 확인 연산 유형',
    '대표 교과서 유형',
    '기출 변형 핵심 유형',
    '서술형 대비 유형',
    '최고 수준/발전 유형',
  ],
  schoolExamTypes: [
    '개념 정의 직접 확인',
    '대표 표준 문항',
    '말장난 방지 보기 고르기',
    '실생활 문장제 독해',
    '도형의 성질 및 보조선 추론',
    '오류 찾기 및 과정 교정',
  ],
  gradeFocus: {
    1: '문자와 식, 정비례·반비례, 말을 식으로 바꾸는 기초 활용',
    2: '연립방정식 활용, 일차함수 그래프 해석, 내신용 심화 변형',
    3: '제곱근, 인수분해, 이차방정식, 이차함수로 이어지는 고등 수학 기초',
  },
};

const HIGH_SCHOOL_EBS_REFERENCE = {
  levels: [
    '개념 체크 및 예제/유제',
    'Level 1 기초 연습',
    'Level 2 기본 연습',
    'Level 3 실력 완성',
  ],
  transformPatterns: [
    '개념·원리 간접 활용',
    '문항의 축소·확대·변형',
    '자료 및 상황 활용',
    '조건의 강화·완화',
  ],
};

const FILE_FAMILIES = [
  [/factorization/, 'factorization'],
  [/rational/, 'rational'],
  [/ineq/, 'inequality'],
  [/linear/, 'linear'],
  [/(mono|poly|combined|polynomial|factoring)/, 'algebra'],
  [/(sqrt|radical)/, 'radical'],
  [/quadratic-equation/, 'quadraticEquation'],
  [/quadratic-function/, 'quadraticFunction'],
  [/trigonometry/, 'trigonometry'],
  [/circle/, 'circle'],
  [/(statistics|boxplot)/, 'statistics'],
];

const FAMILY_LABELS = {
  factorization: '소인수분해',
  rational: '유리수와 순환소수',
  algebra: '문자식과 다항식',
  inequality: '일차부등식',
  linear: '일차함수',
  radical: '제곱근',
  quadraticEquation: '이차방정식',
  quadraticFunction: '이차함수',
  trigonometry: '삼각비',
  circle: '원',
  statistics: '통계',
};

function gcd(a, b) {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) [a, b] = [b, a % b];
  return a;
}

function lcm(a, b) {
  return Math.abs(a * b) / gcd(a, b);
}

function frac(n, d) {
  if (d < 0) {
    n *= -1;
    d *= -1;
  }
  const g = gcd(n, d);
  n /= g;
  d /= g;
  return d === 1 ? `${n}` : `\\frac{${n}}{${d}}`;
}

function squareFreePart(value) {
  let result = value;
  for (let factor = 2; factor * factor <= result; factor += 1) {
    while (result % (factor * factor) === 0) result /= factor * factor;
  }
  return result;
}

function strip25(value) {
  let result = value;
  while (result % 2 === 0) result /= 2;
  while (result % 5 === 0) result /= 5;
  return result;
}

function math(value) {
  return `$${value}$`;
}

function signed(value) {
  return value >= 0 ? `+${value}` : `${value}`;
}

function textChoice(value) {
  const text = String(value);
  if (/[가-힣]/.test(text)) return text;
  return text.includes('$') ? text : math(text);
}

function unique(values) {
  const seen = new Set();
  const result = [];
  for (const value of values) {
    const key = String(value);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(key);
  }
  return result;
}

function makeChoices(correct, distractors, id) {
  const clean = unique([correct, ...distractors].map(String)).slice(0, 5);
  const numericCorrect = Number(correct);
  let pad = 1;
  while (clean.length < 5) {
    const candidate = Number.isFinite(numericCorrect)
      ? String(numericCorrect + (pad % 2 === 0 ? -pad : pad))
      : `${correct}-${pad}`;
    if (!clean.includes(candidate)) clean.push(candidate);
    pad += 1;
  }

  const answer = [0, 2, 4, 1, 3][(id - 1) % 5];
  const choices = clean.filter(value => value !== String(correct)).slice(0, 4);
  choices.splice(answer, 0, String(correct));
  return { choices: choices.map(textChoice), answer };
}

function naturalPrompt(ctx, question) {
  const openings = [
    '기본 정의를 바로 적용하여',
    '대표 풀이 흐름에 맞추어',
    '필요한 조건만 골라',
    '거꾸로 조건을 추적하여',
    '가능한 경우를 나누어',
    '주어진 자료를 해석하여',
    '값의 범위를 먼저 판단하여',
    '매개변수의 영향을 생각하여',
    '두 값을 비교하는 관점에서',
    '계산 결과를 한 번 더 연결하여',
    '풀이 과정의 빠진 단계를 채운다고 생각하고',
    '숨은 조건을 찾아',
    '상황을 식으로 모델링하여',
    '조건을 변형해 적용하여',
    '여러 조건을 종합하여',
  ];
  const secondRoundOpenings = [
    '같은 개념을 다른 수에 적용하여',
    '표준 풀이를 변형하여',
    '조건의 순서를 바꾸어 생각하며',
    '결과에서 원인을 되짚어',
    '겹치는 경우를 제외하며',
    '자료 사이의 차이를 비교하여',
    '끝값과 경계값을 확인하여',
    '변하지 않는 값을 찾아',
    '보기의 차이를 따져',
    '중간 계산을 이용하여',
    '계산 실수를 점검하며',
    '문장에 숨은 제한을 반영하여',
    '실생활 조건을 식으로 바꾸어',
    '질문한 대상을 바꾸어 생각하며',
    '마지막 조건까지 함께 고려하여',
  ];
  const phrases = ctx.round === 0 ? openings : secondRoundOpenings;
  return `${ctx.examCore}에서 ${phrases[(ctx.variant.variantNo - 1) % phrases.length]}, ${question}`;
}

function q(ctx, typeTag, skills, question, correct, distractors, explanation) {
  const { choices, answer } = makeChoices(String(correct), distractors, ctx.displayId ?? ctx.id);
  const profile = DIFFICULTY_PROFILE[ctx.difficulty];
  const familyLabel = FAMILY_LABELS[ctx.family] ?? '수학';
  return {
    id: ctx.displayId ?? ctx.id,
    question: naturalPrompt(ctx, question),
    choices,
    answer,
    explanation,
    ebs: {
      role: profile.role,
      steps: profile.steps,
      typeTag: `${familyLabel} · ${typeTag} · ${ctx.variant.label}`,
      skills: unique([...skills, ctx.variant.skill]),
      typeVariant: ctx.variant.label,
      typeVariantId: ctx.variant.variantNo,
      buildUpStage: profile.middleStage,
      schoolExamType: schoolExamTypeFor(ctx.variant, ctx.family),
      transformPattern: ctx.variant.transformPattern,
      sourceFormat: 'EBS 단계형 5지선다',
      difficulty: ctx.difficulty,
      family: ctx.family,
    },
  };
}

function schoolExamTypeFor(variant, family) {
  if (['circle', 'trigonometry'].includes(family) && variant.variantNo >= 6) {
    return '도형의 성질 및 보조선 추론';
  }
  return variant.schoolExamType;
}

function familyFor(id) {
  return FILE_FAMILIES.find(([pattern]) => pattern.test(id))?.[1] ?? 'algebra';
}

function hashText(text) {
  let hash = 0;
  for (const char of text) {
    hash = (hash * 33 + char.charCodeAt(0)) % 1000003;
  }
  return hash;
}

function titleCore(title) {
  return title.split('—')[0].trim();
}

function nums(ctx) {
  const h = ctx.seed + ctx.id * 17 + ctx.round * 29 + ctx.variant.variantNo * 31;
  const level = { '기본': 0, '유형별': 1, '심화': 2, '킬러': 3 }[ctx.difficulty] ?? 0;
  return {
    level,
    a: 2 + (h % 5) + level,
    b: 2 + (Math.floor(h / 7) % 5) + level,
    c: 1 + (Math.floor(h / 31) % 4) + level,
    d: 2 + (Math.floor(h / 97) % 4) + level,
    e: 4 + (Math.floor(h / 193) % 5) + level,
    sign: h % 2 === 0 ? 1 : -1,
  };
}

function factorizationQuestion(ctx) {
  const { a, b, c, d, e, level } = nums(ctx);
  const p = 1 + ((ctx.id + level) % 3);
  const r = 1 + ((ctx.id + ctx.round) % 3);
  if (ctx.difficulty === '기본') {
    const n = 2 ** p * 3 ** r;
    const answer = p + r;
    return q(ctx, '소인수 지수 합', ['소인수분해', '지수'],
      `${math(n)}을 소인수분해했을 때 모든 소인수의 지수의 합은?`,
      answer, [answer - 2, answer - 1, answer + 1, answer + 2],
      `${math(n)}=${math(`2^{${p}}\\times3^{${r}}`)}이므로 지수의 합은 ${math(answer)}이다.`);
  }
  if (ctx.difficulty === '유형별') {
    const x = 12 + a * 2;
    const y = 18 + b * 2;
    const g = gcd(x, y);
    const l = lcm(x, y);
    const answer = l / g;
    return q(ctx, '최대공약수와 최소공배수', ['최대공약수', '최소공배수'],
      `${math(x)}와 ${math(y)}의 최대공약수를 ${math('G')}, 최소공배수를 ${math('L')}이라 할 때 ${math('\\frac{L}{G}')}의 값은?`,
      answer, [answer - 3, answer - 1, answer + 2, g + l],
      `${math(`G=${g}`)}, ${math(`L=${l}`)}이므로 ${math(`\\frac{L}{G}=${answer}`)}이다.`);
  }
  if (ctx.difficulty === '심화') {
    const n = 2 ** p * 3 ** Math.min(r, 2) * 5;
    const rr = Math.min(r, 2);
    const answer = (p % 2 ? 2 : 1) * (rr % 2 ? 3 : 1) * 5;
    return q(ctx, '완전제곱수 조건', ['소인수분해', '제곱수 조건'],
      `${math(n)}에 가장 작은 자연수 ${math('m')}을 곱해 완전제곱수가 되게 하려고 한다. ${math('m')}은?`,
      answer, [answer * 2, answer * 3, answer + 5, Math.max(1, answer - 2)],
      `완전제곱수는 모든 소인수의 지수가 짝수이다. 부족한 지수를 보충하면 ${math(answer)}가 최소이다.`);
  }
  const rr = Math.min(r, 2);
  const n = 2 ** p * 3 ** rr * 5;
  const minThree = Math.min(rr, 1 + (ctx.round % 2));
  const answer = (p + 1) * (rr - minThree + 1);
  return q(ctx, '배수인 약수의 개수 추론', ['약수', '배수 조건', '경우의 수'],
    `${math(n)}의 양의 약수 중 ${math(`3^{${minThree}}`)}의 배수이면서 ${math(5)}의 배수가 아닌 약수의 개수는?`,
    answer, [answer - 2, answer + 2, (p + 1) * (r + 1), answer + d],
    `${math(5)}의 배수가 아니어야 하므로 ${math(5)}의 지수는 ${math(0)}이다. ${math(3)}의 지수는 ${math(minThree)} 이상이므로 경우의 수는 ${math(`(${p}+1)(${rr}-${minThree}+1)=${answer}`)}이다.`);
}

function rationalQuestion(ctx) {
  const { a, b, c, d, level } = nums(ctx);
  if (ctx.difficulty === '기본') {
    const den = [8, 12, 20, 24, 25, 28, 40][ctx.id % 7];
    const num = 1 + ((ctx.seed + ctx.id) % (den - 1));
    const reducedDen = den / gcd(num, den);
    const answer = strip25(reducedDen) === 1 ? '유한소수' : '순환소수';
    return q(ctx, '유한소수 판별', ['기약분수', '분모 소인수'],
      `${math(`\\frac{${num}}{${den}}`)}을 기약분수로 나타냈을 때 어떤 소수인가?`,
      answer, ['유한소수도 순환소수도 아님', '자연수', '정수', '무리수'],
      `기약분수의 분모에 ${math(2)}, ${math(5)}가 아닌 소인수가 남는지 확인하면 된다.`);
  }
  if (ctx.difficulty === '유형별') {
    const pre = 1 + (a % 7);
    const rep = 2 + (b % 7);
    const numerator = pre * 9 + rep;
    const answer = frac(numerator, 90);
    return q(ctx, '순환소수 분수화', ['순환소수', '분수 변환'],
      `${math(`0.${pre}\\dot{${rep}}`)}를 기약분수로 나타내면?`,
      answer, [frac(numerator + 1, 90), frac(numerator, 99), frac(numerator - 1, 90), frac(numerator, 900)],
      `${math(`0.${pre}\\dot{${rep}}=\\frac{${pre}${rep}-${pre}}{90}=\\frac{${numerator}}{90}`)}이다.`);
  }
  if (ctx.difficulty === '심화') {
    const den = [18, 28, 42, 44, 63, 72][ctx.id % 6] + level;
    const need = strip25(den);
    return q(ctx, '유한소수 조건 역산', ['약분 조건', '분모 소인수'],
      `분수 ${math(`\\frac{x}{${den}}`)}가 유한소수가 되도록 하는 가장 작은 자연수 ${math('x')}는?`,
      need, [need + 1, need + 2, Math.max(1, need - 1), den],
      `분모에서 ${math(2)}, ${math(5)}가 아닌 소인수가 약분되어야 하므로 그 부분을 ${math('x')}가 포함해야 한다.`);
  }
  const n = a + c;
  const den = [6, 7, 11, 13, 14][ctx.id % 5];
  const count = Math.floor((n + 20) / den) - Math.floor(n / den);
  return q(ctx, '정수 조건 범위 추론', ['유리수', '정수 조건', '범위'],
    `${math(`${n}<\\frac{k}{${den}}\\le ${n + 20}`)}을 만족하는 자연수 ${math('k')} 중 ${math(den)}의 배수인 것은 몇 개인가?`,
    count, [count - 1, count + 1, count + 2, count + den],
    `${math('k')}가 ${math(den)}의 배수이면 분수값은 정수이다. ${math(n)}보다 크고 ${math(n + 20)} 이하인 정수의 개수를 센다.`);
}

function algebraQuestion(ctx) {
  const { a, b, c, d, sign } = nums(ctx);
  if (ctx.difficulty === '기본') {
    const answer = a * b;
    return q(ctx, '단항식 곱셈', ['계수', '지수법칙'],
      `${math(`${a}x^2y`)}와 ${math(`${b}xy^3`)}를 곱했을 때 ${math('x^3y^4')}의 계수는?`,
      answer, [answer - a, answer + a, a + b, answer + 2],
      `계수는 ${math(`${a}\\times${b}=${answer}`)}이고 문자는 지수법칙으로 정리된다.`);
  }
  if (ctx.difficulty === '유형별') {
    const answer = a * d + b * c;
    return q(ctx, '전개식 계수', ['분배법칙', '동류항'],
      `${math(`(${a}x+${b})(${c}x+${d})`)}을 전개했을 때 ${math('x')}의 계수는?`,
      answer, [answer - a, answer + c, a * c, b * d],
      `${math('x')}항은 ${math(`${a * d}x`)}와 ${math(`${b * c}x`)}에서 나오므로 계수는 ${math(answer)}이다.`);
  }
  if (ctx.difficulty === '심화') {
    const answer = 2 * (a + b);
    return q(ctx, '곱셈공식 변형', ['곱셈공식', '계수 비교'],
      `${math(`(x+${a})^2-(x-${b})^2`)}을 정리했을 때 ${math('x')}의 계수는?`,
      answer, [answer - 2, answer + 2, a + b, a * b],
      `전개하면 ${math(`2(${a}+${b})x+${a * a - b * b}`)}이므로 계수는 ${math(answer)}이다.`);
  }
  const x = a;
  const y = b * sign;
  const s = x + y;
  const diff = x - y;
  const answer = x * x + 2 * x * y;
  return q(ctx, '두 식으로 값 구하기', ['식 변형', '역추론'],
    `${math(`x+y=${s}`)}, ${math(`x-y=${diff}`)}일 때 ${math('x^2+2xy')}의 값은?`,
    answer, [answer - a, answer + b, s * s, x * y],
    `두 식을 더해 ${math(`x=${x}`)}를 구하고, 빼서 ${math(`y=${y}`)}를 구한 뒤 대입한다.`);
}

function inequalityQuestion(ctx) {
  const { a, b, c, d } = nums(ctx);
  if (ctx.difficulty === '기본') {
    const bound = a + b;
    return q(ctx, '일차부등식 풀이', ['이항', '정수해'],
      `${math(`x-${a}>${b}`)}를 만족하는 가장 작은 정수 ${math('x')}는?`,
      bound + 1, [bound - 1, bound, bound + 2, bound + 3],
      `${math(`x>${bound}`)}이므로 가장 작은 정수는 ${math(bound + 1)}이다.`);
  }
  if (ctx.difficulty === '유형별') {
    const limit = b + d;
    return q(ctx, '자연수해 개수', ['일차부등식', '해의 개수'],
      `${math(`${a}x+${c}\\le ${a * limit + c}`)}을 만족하는 자연수 ${math('x')}의 개수는?`,
      limit, [limit - 2, limit - 1, limit + 1, limit + 2],
      `${math(`x\\le ${limit}`)}이므로 자연수 해는 ${math(limit)}개이다.`);
  }
  if (ctx.difficulty === '심화') {
    const low = c;
    const high = c + b;
    const answer = high - low + 1;
    return q(ctx, '연립부등식 정수해', ['연립부등식', '정수 범위'],
      `연립부등식 ${math(`${low - 1}<x\\le ${high}`)}를 만족하는 정수 ${math('x')}의 개수는?`,
      answer, [answer - 2, answer - 1, answer + 1, answer + 2],
      `가능한 정수는 ${math(low)}부터 ${math(high)}까지이므로 ${math(answer)}개이다.`);
  }
  const answer = a * b - c - 1;
  return q(ctx, '매개변수 최대 정수해', ['매개변수', '정수해', '역추론'],
    `부등식 ${math(`\\frac{x+${c}}{${a}}<${b}`)}를 만족하는 가장 큰 정수 ${math('x')}는?`,
    answer, [answer - 2, answer - 1, answer + 1, answer + 2],
    `${math(`x+${c}<${a * b}`)}이므로 ${math(`x<${a * b - c}`)}이다. 가장 큰 정수는 ${math(answer)}이다.`);
}

function linearQuestion(ctx) {
  const { a, b, c, d } = nums(ctx);
  if (ctx.difficulty === '기본') {
    const x = c;
    const answer = a * x + b;
    return q(ctx, '일차함수 값', ['대입', '기울기'],
      `${math(`y=${a}x+${b}`)}에서 ${math(`x=${x}`)}일 때 ${math('y')}의 값은?`,
      answer, [answer - a, answer + a, answer - 1, answer + 1],
      `대입하면 ${math(`y=${a}\\times${x}+${b}=${answer}`)}이다.`);
  }
  if (ctx.difficulty === '유형별') {
    const x1 = c;
    const x2 = c + d;
    const m = a;
    const y1 = b;
    const y2 = y1 + m * (x2 - x1);
    return q(ctx, '두 점의 기울기', ['두 점', '기울기'],
      `두 점 ${math(`(${x1},${y1})`)}, ${math(`(${x2},${y2})`)}를 지나는 직선의 기울기는?`,
      m, [m - 2, m - 1, m + 1, m + 2],
      `기울기는 ${math(`\\frac{${y2}-${y1}}{${x2}-${x1}}=${m}`)}이다.`);
  }
  if (ctx.difficulty === '심화') {
    const xIntercept = a + d;
    const yIntercept = b + c;
    const answer = frac(xIntercept * yIntercept, 2);
    return q(ctx, '절편과 넓이', ['절편', '삼각형 넓이'],
      `${math(`\\frac{x}{${xIntercept}}+\\frac{y}{${yIntercept}}=1`)}의 그래프와 두 좌표축으로 둘러싸인 삼각형의 넓이는?`,
      answer, [xIntercept + yIntercept, xIntercept * yIntercept, frac(xIntercept + yIntercept, 2), Math.abs(xIntercept - yIntercept)],
      `두 절편이 ${math(xIntercept)}, ${math(yIntercept)}이므로 넓이는 ${math(`\\frac12\\times${xIntercept}\\times${yIntercept}`)}이다.`);
  }
  const fixedX = -b;
  const fixedY = a * fixedX + c;
  const answer = fixedX + fixedY;
  return q(ctx, '항상 지나는 점', ['매개변수', '불변 조건'],
    `직선 ${math(`y=k(x+${b})+${a}x+${c}`)}는 ${math('k')}의 값과 관계없이 항상 한 점을 지난다. 그 점의 ${math('x+y')}는?`,
    answer, [answer - 2, answer - 1, answer + 1, answer + 2],
    `${math('k')}의 영향을 없애려면 ${math(`x+${b}=0`)}이다. 이때 ${math(`x=${fixedX}`)}, ${math(`y=${fixedY}`)}이다.`);
}

function radicalQuestion(ctx) {
  const { a, b, c, d } = nums(ctx);
  const sf = [2, 3, 5, 6, 7, 10][ctx.id % 6];
  if (ctx.difficulty === '기본') {
    return q(ctx, '제곱근 간단히', ['제곱근', '근호 밖으로 빼기'],
      `${math(`\\sqrt{${a * a * sf}}`)}을 간단히 하면?`,
      `${a}\\sqrt{${sf}}`, [`${a + 1}\\sqrt{${sf}}`, `${a}\\sqrt{${sf + 1}}`, `${a * sf}`, `\\sqrt{${a * sf}}`],
      `${math(`${a * a * sf}=${a}^2\\times${sf}`)}이므로 ${math(`${a}\\sqrt{${sf}}`)}이다.`);
  }
  if (ctx.difficulty === '유형별') {
    const answer = a + b;
    return q(ctx, '동류근호 계산', ['동류근호', '계수'],
      `${math(`${a}\\sqrt{${sf}}+${b}\\sqrt{${sf}}`)}를 ${math(`A\\sqrt{${sf}}`)}로 나타낼 때 ${math('A')}는?`,
      answer, [answer - 2, answer - 1, answer + 1, answer + 2],
      `같은 근호끼리 계수를 더하면 ${math(`${answer}\\sqrt{${sf}}`)}이다.`);
  }
  if (ctx.difficulty === '심화') {
    const answer = a * a - b;
    return q(ctx, '근호식 합차공식', ['제곱근', '곱셈공식'],
      `${math(`(\\sqrt{${a * a}}+\\sqrt{${b}})(\\sqrt{${a * a}}-\\sqrt{${b}})`)}의 값은?`,
      answer, [answer - 2, answer - 1, answer + 1, a * a + b],
      `합차공식으로 ${math(`${a * a}-${b}=${answer}`)}이다.`);
  }
  const small = 2 + (ctx.id % 4);
  const radicand = sf * small * small;
  const answer = squareFreePart(radicand);
  return q(ctx, '자연수 조건 역추론', ['제곱근', '완전제곱수 조건'],
    `${math(`\\sqrt{${radicand}n}`)}이 자연수가 되도록 하는 가장 작은 자연수 ${math('n')}은?`,
    answer, [answer * 2, answer * 3, answer + 1, Math.max(1, answer - 1)],
    `근호 안의 제곱인수를 제거하고 남은 부분을 곱해야 완전제곱수가 된다.`);
}

function quadraticEquationQuestion(ctx) {
  const { a, b, c } = nums(ctx);
  const r1 = a;
  const r2 = a + c;
  if (ctx.difficulty === '기본') {
    return q(ctx, '인수분해 근의 합', ['이차방정식', '인수분해'],
      `${math(`(x-${r1})(x-${r2})=0`)}의 두 근의 합은?`,
      r1 + r2, [r1, r2, r1 * r2, Math.abs(r2 - r1)],
      `두 근은 ${math(r1)}, ${math(r2)}이므로 합은 ${math(r1 + r2)}이다.`);
  }
  if (ctx.difficulty === '유형별') {
    return q(ctx, '근과 계수의 관계', ['근의 합', '근의 곱'],
      `이차방정식 ${math(`x^2-${r1 + r2}x+${r1 * r2}=0`)}의 두 근의 곱은?`,
      r1 * r2, [r1 + r2, r1 * r2 - 1, r1 * r2 + 1, Math.abs(r2 - r1)],
      `근과 계수의 관계에서 두 근의 곱은 상수항 ${math(r1 * r2)}이다.`);
  }
  if (ctx.difficulty === '심화') {
    const answer = r1 * r1;
    return q(ctx, '중근 조건', ['판별식', '매개변수'],
      `${math(`x^2-${2 * r1}x+k=0`)}이 중근을 갖도록 하는 ${math('k')}의 값은?`,
      answer, [answer - 1, answer + 1, 2 * r1, r1],
      `중근이면 ${math(`D=0`)}이고 ${math(`k=(${2 * r1}/2)^2=${answer}`)}이다.`);
  }
  const answer = r1 + r2;
  return q(ctx, '공통근 계수 추론', ['공통근', '매개변수'],
    `두 방정식 ${math(`x^2-${answer}x+${r1 * r2}=0`)}, ${math(`x^2-px+${r1 * r2}=0`)}이 두 근을 모두 공유할 때 ${math('p')}는?`,
    answer, [answer - 2, answer - 1, answer + 1, answer + 2],
    `두 근을 모두 공유하면 두 근의 합도 같아야 하므로 ${math(`p=${answer}`)}이다.`);
}

function quadraticFunctionQuestion(ctx) {
  const { a, b, c, d } = nums(ctx);
  if (ctx.difficulty === '기본') {
    return q(ctx, '꼭짓점 읽기', ['이차함수', '꼭짓점'],
      `${math(`y=${a}(x-${b})^2+${c}`)}의 꼭짓점의 ${math('x')}좌표는?`,
      b, [b - 2, b - 1, b + 1, c],
      `꼭짓점형에서 꼭짓점은 ${math(`(${b},${c})`)}이다.`);
  }
  if (ctx.difficulty === '유형별') {
    const x = b + d;
    const answer = a * (x - b) ** 2 + c;
    return q(ctx, '대칭축과 함수값', ['대입', '대칭축'],
      `${math(`y=${a}(x-${b})^2+${c}`)}에서 ${math(`x=${x}`)}일 때 ${math('y')}의 값은?`,
      answer, [answer - a, answer + a, c, a + c],
      `꼭짓점형에 ${math(`x=${x}`)}를 대입한다.`);
  }
  if (ctx.difficulty === '심화') {
    const h = b;
    const k = c;
    const span = 2 + (ctx.id % 4);
    const x = h + span;
    const y = a * span * span + k;
    return q(ctx, '계수 역추론', ['꼭짓점형', '계수 결정'],
      `꼭짓점이 ${math(`(${h},${k})`)}이고 점 ${math(`(${x},${y})`)}을 지나는 이차함수 ${math(`y=A(x-${h})^2+${k}`)}에서 ${math('A')}는?`,
      a, [a - 2, a - 1, a + 1, a + 2],
      `점을 대입하면 ${math(`${y}=A\\times${span * span}+${k}`)}이므로 ${math(`A=${a}`)}이다.`);
  }
  const h = b;
  const k = c;
  const span = 2 + (ctx.id % 4);
  const left = h - span;
  const right = h + span + 1;
  const far = Math.max((left - h) ** 2, (right - h) ** 2);
  const answer = a * far + k;
  return q(ctx, '구간 최댓값 추론', ['이차함수', '구간', '대칭축'],
    `${math(`y=${a}(x-${h})^2+${k}`)}에서 ${math(`${left}\\le x\\le ${right}`)}일 때 최댓값은?`,
    answer, [answer - a, answer + a, k, a * d * d + k],
    `위로 열린 포물선은 꼭짓점에서 멀수록 값이 커진다. 구간 양 끝 중 더 먼 점을 비교한다.`);
}

function trigonometryQuestion(ctx) {
  const { a, b, c } = nums(ctx);
  const triples = [[3, 4, 5], [5, 12, 13], [8, 15, 17], [7, 24, 25]];
  const [ta, tb, tc] = triples[ctx.id % triples.length];
  const scale = 1 + (ctx.round % 2) + (ctx.difficulty === '킬러' ? 1 : 0);
  const x = ta * scale;
  const y = tb * scale;
  const z = tc * scale;
  if (ctx.difficulty === '기본') {
    return q(ctx, '삼각비 기본값', ['직각삼각형', 'sin'],
      `직각삼각형에서 한 예각의 대변이 ${math(x)}, 빗변이 ${math(z)}일 때 사인값은?`,
      frac(x, z), [frac(y, z), frac(x, y), frac(z, x), frac(y, x)],
      `사인값은 대변을 빗변으로 나눈 값이다.`);
  }
  if (ctx.difficulty === '유형별') {
    return q(ctx, '삼각비 길이 구하기', ['tan', '비례식'],
      `${math(`\\tan A=\\frac{${x}}{${y}}`)}이고 이웃한 변의 길이가 ${math(y + b)}일 때 대변의 길이는?`,
      frac(x * (y + b), y), [x, y, x + b, y + b],
      `탄젠트의 비례식을 세워 대변의 길이를 구한다.`);
  }
  if (ctx.difficulty === '심화') {
    const answer = x + y;
    return q(ctx, '삼각비 복합식', ['sin', 'cos', '복합 계산'],
      `${math(`\\sin A=\\frac{${x}}{${z}}`)}, ${math(`\\cos A=\\frac{${y}}{${z}}`)}일 때 ${math(`z(\\sin A+\\cos A)`)}의 값은?`,
      answer, [x, y, z, answer + 1],
      `분모가 모두 ${math(z)}이므로 곱하면 ${math(`${x}+${y}`)}만 남는다.`);
  }
  const distance = y;
  const shadow = b;
  const height = frac(x * distance, y);
  const total = Number(height) || x + c;
  return q(ctx, '높이와 거리 복합 추론', ['tan', '상황 모델링', '비례식'],
    `기울어진 지점에서 탑까지의 수평거리가 ${math(distance)}m이고 올려본 각의 탄젠트가 ${math(`\\frac{${x}}{${y}}`)}이다. 눈높이 ${math(shadow)}m를 더한 탑의 전체 높이는?`,
    Number(height) ? total + shadow : `${height}+${shadow}`, [x + shadow, y + shadow, distance, total],
    `탄젠트로 눈높이 위의 높이를 구한 뒤 눈높이를 더한다.`);
}

function circleQuestion(ctx) {
  const { a, b, c, d } = nums(ctx);
  if (ctx.difficulty === '기본') {
    const angle = 40 + ((ctx.id + c) % 20) * 4;
    return q(ctx, '원주각 계산', ['중심각', '원주각'],
      `같은 호에 대한 중심각이 ${math(`${angle}^\\circ`)}일 때 원주각은?`,
      `${angle / 2}^\\circ`, [`${angle}^\\circ`, `${angle / 2 + 10}^\\circ`, `${angle - 10}^\\circ`, `${90 - angle / 2}^\\circ`],
      `같은 호에 대한 원주각은 중심각의 절반이다.`);
  }
  if (ctx.difficulty === '유형별') {
    return q(ctx, '접선의 길이', ['접선', '외부점'],
      `한 외부점에서 원에 그은 두 접선 중 하나의 길이가 ${math(a + b)}일 때 다른 접선의 길이는?`,
      a + b, [a + b - 2, a + b - 1, a + b + 1, a + b + 2],
      `한 외부점에서 그은 두 접선의 길이는 같다.`);
  }
  if (ctx.difficulty === '심화') {
    const angle = 70 + ((ctx.id + d) % 10) * 5;
    const answer = 180 - angle;
    return q(ctx, '내접사각형 대각', ['내접사각형', '대각'],
      `원에 내접하는 사각형에서 한 각이 ${math(`${angle}^\\circ`)}일 때 그 대각은?`,
      `${answer}^\\circ`, [`${angle}^\\circ`, `${answer - 10}^\\circ`, `${answer + 10}^\\circ`, `${90}^\\circ`],
      `원에 내접하는 사각형의 대각의 합은 ${math('180^\\circ')}이다.`);
  }
  const x = a;
  const y = b;
  const known = c;
  const answer = frac(x * y, known);
  return q(ctx, '현의 교차 정리', ['현', '곱의 관계', '역추론'],
    `원 안에서 두 현이 만나고 한 현의 두 부분이 ${math(x)}, ${math(y)}이다. 다른 현의 한 부분이 ${math(known)}일 때 나머지 부분의 길이는?`,
    answer, [x + y, frac(x * y + known, known), frac(Math.max(1, x * y - known), known), known],
    `현의 교차 정리에 의해 ${math(`${x}\\times${y}=${known}\\times t`)}이다.`);
}

function statisticsQuestion(ctx) {
  const { a, b, c, d } = nums(ctx);
  if (ctx.difficulty === '기본') {
    const data = [a, a + 2, a + 4];
    const answer = a + 2;
    return q(ctx, '평균 계산', ['평균', '자료'],
      `자료 ${math(data.join(', '))}의 평균은?`,
      answer, [answer - 2, answer - 1, answer + 1, answer + 2],
      `세 수의 합을 ${math(3)}으로 나누면 ${math(answer)}이다.`);
  }
  if (ctx.difficulty === '유형별') {
    const values = [a, a + c, a + c + d, a + c + d + 2, a + c + d + b];
    const answer = values[2];
    return q(ctx, '중앙값과 자료 배열', ['중앙값', '자료 해석'],
      `자료 ${math(values.join(', '))}의 중앙값은?`,
      answer, [values[0], values[1], values[3], values[4]],
      `자료가 크기순으로 놓여 있으므로 가운데 값이 중앙값이다.`);
  }
  if (ctx.difficulty === '심화') {
    const mean = a + 4;
    const n = 5;
    const added = mean + b;
    const answer = frac(mean * n + added, n + 1);
    return q(ctx, '평균 변화', ['평균', '자료 추가'],
      `평균이 ${math(mean)}인 자료 ${math(n)}개에 ${math(added)}를 하나 추가했다. 새 평균은?`,
      answer, [mean, added, frac(mean * n + added + 1, n + 1), frac(mean * n + added - 1, n + 1)],
      `기존 합 ${math(mean * n)}에 새 자료를 더한 뒤 ${math(n + 1)}로 나눈다.`);
  }
  const q1 = a + c;
  const q3 = q1 + b;
  const min = q1 - d;
  const max = q3 + c;
  const range = max - min;
  const iqr = q3 - q1;
  const answer = range - iqr;
  return q(ctx, '상자그림 조건 비교', ['상자그림', '범위', '사분위범위'],
    `상자그림에서 최솟값 ${math(min)}, 제1사분위수 ${math(q1)}, 제3사분위수 ${math(q3)}, 최댓값 ${math(max)}이다. 범위가 사분위범위보다 얼마나 큰가?`,
    answer, [answer - 2, answer - 1, answer + 1, range + iqr],
    `범위는 ${math(range)}, 사분위범위는 ${math(iqr)}이므로 차는 ${math(answer)}이다.`);
}

const GENERATORS = {
  factorization: factorizationQuestion,
  rational: rationalQuestion,
  algebra: algebraQuestion,
  inequality: inequalityQuestion,
  linear: linearQuestion,
  radical: radicalQuestion,
  quadraticEquation: quadraticEquationQuestion,
  quadraticFunction: quadraticFunctionQuestion,
  trigonometry: trigonometryQuestion,
  circle: circleQuestion,
  statistics: statisticsQuestion,
};

function buildExam(file) {
  const filePath = path.join(mathDir, file);
  const current = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const profile = DIFFICULTY_PROFILE[current.difficulty];
  const family = familyFor(current.id);
  const generator = GENERATORS[family] ?? algebraQuestion;
  const core = titleCore(current.title);
  const seed = hashText(`${current.id}:${current.grade}:${current.unit}:${current.difficulty}`);

  const questions = Array.from({ length: 30 }, (_, index) => {
    const variant = TYPE_VARIANTS[index % TYPE_VARIANTS.length];
    const ctx = {
    id: seed + index + 1 + variant.variantNo * 37 + Math.floor(index / TYPE_VARIANTS.length) * 101,
    displayId: index + 1,
      difficulty: current.difficulty,
      family,
      unit: current.unit,
      examCore: core,
      variant,
      round: Math.floor(index / TYPE_VARIANTS.length),
      seed,
    };
    return generator(ctx);
  });

  return {
    id: current.id,
    title: `${core} — ${current.difficulty}`,
    description: profile.description,
    grade: current.grade,
    unit: current.unit,
    difficulty: current.difficulty,
    ebsStyle: {
      version: 4,
      role: profile.role,
      expectedSteps: profile.steps,
      middleStage: profile.middleStage,
      typeVariantCount: TYPE_VARIANTS.length,
      maxSimilarPerExam: 2,
      middleTaxonomy: MIDDLE_EBS_TAXONOMY,
      highSchoolReference: HIGH_SCHOOL_EBS_REFERENCE,
      family,
      generatedAt: '2026-06-19',
    },
    questions,
  };
}

const files = fs.readdirSync(mathDir).filter(file => file.endsWith('.json')).sort();
for (const file of files) {
  const exam = buildExam(file);
  fs.writeFileSync(path.join(mathDir, file), `${JSON.stringify(exam, null, 2)}\n`);
}

console.log(`Generated ${files.length} EBS-style practice exam files.`);
