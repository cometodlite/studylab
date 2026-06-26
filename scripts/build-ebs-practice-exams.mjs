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
    description: '자주 나오는 대표 유형을 조건을 바꾸어 연습합니다.',
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

const QUESTION_ENDINGS = [
  '',
  '보기에서 알맞은 값을 고르시오.',
  '계산 결과로 옳은 것은?',
  '다음 중 정답을 고르시오.',
  '조건을 만족하는 값을 고르시오.',
  '풀이 결과와 일치하는 것은?',
  '가장 알맞은 값을 고르시오.',
  '보기 중 옳은 값을 고르시오.',
  '정리한 결과를 고르시오.',
  '답으로 알맞은 것은?',
  '마지막 값으로 옳은 것은?',
  '조건에 맞는 답을 고르시오.',
  '문제 상황에 맞는 값을 고르시오.',
  '같은 값을 나타내는 것을 고르시오.',
  '종합하면 알맞은 답은?',
];

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

function makeChoices(correct, distractors, answerSlot) {
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

  const answer = Number.isInteger(answerSlot) ? answerSlot % 5 : hashText(String(correct)) % 5;
  const choices = clean.filter(value => value !== String(correct)).slice(0, 4);
  choices.splice(answer, 0, String(correct));
  return { choices: choices.map(textChoice), answer };
}

function naturalPrompt(ctx, question) {
  return question;
}

function transformNumericQuestion(ctx, question, correct, distractors, explanation) {
  const ending = QUESTION_ENDINGS[(ctx.variant.variantNo - 1) % QUESTION_ENDINGS.length];

  return {
    question: ending ? `${question} ${ending}` : question,
    correct,
    distractors,
    explanation,
  };
}

function q(ctx, typeTag, skills, question, correct, distractors, explanation) {
  const transformed = transformNumericQuestion(ctx, question, correct, distractors, explanation);
  question = transformed.question;
  correct = transformed.correct;
  distractors = transformed.distractors;
  explanation = transformed.explanation;

  const { choices, answer } = makeChoices(String(correct), distractors, ctx.answerSlot);
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

function nextSeed(seed) {
  return (seed * 48271) % 2147483647;
}

function answerSlotsForExam(seed, count) {
  const slots = Array.from({ length: count }, (_, index) => index % 5);
  let state = seed || 1;
  for (let index = slots.length - 1; index > 0; index -= 1) {
    state = nextSeed(state);
    const swapIndex = state % (index + 1);
    [slots[index], slots[swapIndex]] = [slots[swapIndex], slots[index]];
  }
  return slots;
}

function titleCore(title) {
  return title.split('—')[0].trim();
}

function nums(ctx) {
  const h = ctx.seed + ctx.id * 17 + ctx.round * 9973 + ctx.variant.variantNo * 31;
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

function variantMode(ctx, count = 4) {
  return (ctx.variant.variantNo - 1) % count;
}

function factorizationQuestion(ctx) {
  const { a, b, d, level } = nums(ctx);
  const mode = variantMode(ctx);
  const p = 1 + ((ctx.id + level) % 4);
  const r = 1 + ((Math.floor(ctx.id / 3) + ctx.round) % (ctx.difficulty === '기본' ? 3 : 2));
  if (ctx.difficulty === '기본') {
    const n = 2 ** p * 3 ** r;
    if (mode === 1) {
      return q(ctx, '소인수 지수 확인', ['소인수분해', '지수'],
        `${math(n)}을 소인수분해했을 때 소인수 ${math(2)}의 지수는?`,
        p, [p - 1, p + 1, r, p + r],
        `${math(n)}=${math(`2^{${p}}\\times3^{${r}}`)}이므로 ${math(2)}의 지수는 ${math(p)}이다.`);
    }
    if (mode === 2) {
      const answer = (p + 1) * (r + 1);
      return q(ctx, '약수 개수', ['소인수분해', '약수의 개수'],
        `${math(n)}의 양의 약수의 개수는?`,
        answer, [answer - 2, answer - 1, answer + 1, p + r],
        `약수의 개수는 ${math(`(${p}+1)(${r}+1)=${answer}`)}이다.`);
    }
    if (mode === 3) {
      const answer = 2 ** p;
      return q(ctx, '특정 소인수 거듭제곱', ['소인수분해', '거듭제곱'],
        `${math(n)}을 소인수분해했을 때 ${math(2)}만으로 이루어진 인수의 값은?`,
        answer, [answer / 2, answer * 2, 3 ** r, p + r],
        `${math(n)}=${math(`2^{${p}}\\times3^{${r}}`)}이므로 ${math(2)}만으로 이루어진 인수는 ${math(`2^{${p}}=${answer}`)}이다.`);
    }
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
    if (mode === 1) {
      return q(ctx, '최대공약수 활용', ['최대공약수', '공약수'],
        `${math(x)}와 ${math(y)}의 최대공약수는?`,
        g, [Math.max(1, g - 2), g + 1, g + 2, l],
        `두 수의 공통 인수를 모으면 최대공약수는 ${math(g)}이다.`);
    }
    if (mode === 2) {
      return q(ctx, '최소공배수 활용', ['최소공배수', '배수 조건'],
        `${math(x)}와 ${math(y)}의 최소공배수는?`,
        l, [l - g, l + g, x + y, g],
        `최소공배수는 ${math(l)}이다.`);
    }
    if (mode === 3) {
      const answer = x * y;
      return q(ctx, '곱과 최대공약수 관계', ['최대공약수', '최소공배수'],
        `${math(x)}와 ${math(y)}의 최대공약수를 ${math('G')}, 최소공배수를 ${math('L')}이라 할 때 ${math('GL')}의 값은?`,
        answer, [answer - g, answer + g, l, g],
        `두 자연수의 곱은 최대공약수와 최소공배수의 곱과 같으므로 ${math(`GL=${x}\\times${y}=${answer}`)}이다.`);
    }
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
    if (mode === 1) {
      const cubeNeed = (3 - (p % 3)) % 3;
      const cubeNeed3 = (3 - (rr % 3)) % 3;
      const value = 2 ** cubeNeed * 3 ** cubeNeed3 * 5 ** 2;
      return q(ctx, '완전세제곱수 조건', ['소인수분해', '지수 조건'],
        `${math(n)}에 가장 작은 자연수 ${math('m')}을 곱해 완전세제곱수가 되게 하려고 한다. ${math('m')}은?`,
        value, [Math.max(1, value / 2), Math.max(1, value - 3), value + 3, answer],
        `완전세제곱수는 모든 소인수의 지수가 ${math(3)}의 배수여야 한다.`);
    }
    if (mode === 2) {
      const answer2 = (p + 1) * rr;
      return q(ctx, '조건부 약수 개수', ['약수', '배수 조건'],
        `${math(n)}의 양의 약수 중 ${math(3)}의 배수인 약수의 개수는?`,
        answer2, [answer2 - 2, answer2 - 1, answer2 + 1, (p + 1) * (rr + 1)],
        `${math(3)}의 지수가 ${math(1)} 이상이어야 하므로 경우의 수를 제한해 센다.`);
    }
    if (mode === 3) {
      const answer2 = (p + 1) * (rr + 1);
      return q(ctx, '제곱수 조건 역추론', ['약수', '제곱수 조건'],
        `${math(n)}의 양의 약수 중 ${math(5)}를 인수로 갖지 않는 약수의 개수는?`,
        answer2, [answer2 - 2, answer2 + 2, answer2 + 4, answer],
        `${math(5)}의 지수는 ${math(0)}으로 고정하고 ${math(2)}, ${math(3)}의 지수만 센다.`);
    }
    return q(ctx, '완전제곱수 조건', ['소인수분해', '제곱수 조건'],
      `${math(n)}에 가장 작은 자연수 ${math('m')}을 곱해 완전제곱수가 되게 하려고 한다. ${math('m')}은?`,
      answer, [answer * 2, answer * 3, answer + 5, Math.max(1, answer - 2)],
      `완전제곱수는 모든 소인수의 지수가 짝수이다. 부족한 지수를 보충하면 ${math(answer)}가 최소이다.`);
  }
  const rr = Math.min(r, 2);
  const n = 2 ** p * 3 ** rr * 5;
  const minThree = Math.min(rr, 1 + (ctx.round % 2));
  const answer = (p + 1) * (rr - minThree + 1);
  if (mode === 1) {
    const answer2 = Math.floor((p + 1) / 2) * (rr + 1) * 2;
    return q(ctx, '약수 조건 경우분류', ['약수', '경우의 수', '조건 분류'],
      `${math(n)}의 양의 약수 중 짝수이면서 ${math(5)}의 배수인 약수의 개수는?`,
      answer2, [answer2 - 2, answer2 + 2, answer, (p + 1) * (rr + 1) * 2],
      `짝수 조건으로 ${math(2)}의 지수는 ${math(1)} 이상, ${math(5)}의 지수는 ${math(1)}로 고정한다.`);
  }
  if (mode === 2) {
    const answer2 = (p + 1) * (rr + 1) * 2 - (p + 1) * (rr + 1);
    return q(ctx, '여집합으로 약수 세기', ['약수', '여집합'],
      `${math(n)}의 양의 약수 중 ${math(5)}의 배수인 약수는 전체 약수보다 몇 개 적은가?`,
      answer2, [answer2 - 2, answer2 + 2, answer, p + rr],
      `전체 약수에서 ${math(5)}를 포함하지 않는 약수를 제외하는 방식으로 비교한다.`);
  }
  if (mode === 3) {
    const answer2 = (p + 1) * (rr + 1);
    return q(ctx, '조건 제외 약수 세기', ['약수', '조건 제외'],
      `${math(n)}의 양의 약수 중 ${math(5)}의 배수가 아닌 약수의 개수는?`,
      answer2, [answer2 - 2, answer2 + 2, answer, answer2 + 4],
      `${math(5)}의 지수를 ${math(0)}으로 고정하고 나머지 지수의 경우를 센다.`);
  }
  return q(ctx, '배수인 약수의 개수 추론', ['약수', '배수 조건', '경우의 수'],
    `${math(n)}의 양의 약수 중 ${math(`3^{${minThree}}`)}의 배수이면서 ${math(5)}의 배수가 아닌 약수의 개수는?`,
    answer, [answer - 2, answer + 2, (p + 1) * (r + 1), answer + d],
    `${math(5)}의 배수가 아니어야 하므로 ${math(5)}의 지수는 ${math(0)}이다. ${math(3)}의 지수는 ${math(minThree)} 이상이므로 경우의 수는 ${math(`(${p}+1)(${rr}-${minThree}+1)=${answer}`)}이다.`);
}

function rationalQuestion(ctx) {
  const { a, b, c, level } = nums(ctx);
  if (ctx.difficulty === '기본') {
    const den = 8 + ((ctx.id * 37 + ctx.seed + ctx.round * 11) % 240);
    const num = 1 + ((ctx.seed + ctx.id) % (den - 1));
    const reducedDen = den / gcd(num, den);
    const answer = strip25(reducedDen) === 1 ? '유한소수' : '순환소수';
    return q(ctx, '유한소수 판별', ['기약분수', '분모 소인수'],
      `${math(`\\frac{${num}}{${den}}`)}을 기약분수로 나타냈을 때 어떤 소수인가?`,
      answer, ['유한소수도 순환소수도 아님', '자연수', '정수', '무리수'],
      `기약분수의 분모에 ${math(2)}, ${math(5)}가 아닌 소인수가 남는지 확인하면 된다.`);
  }
  if (ctx.difficulty === '유형별') {
    const pre = 1 + ((ctx.id + a + ctx.seed) % 9);
    const mid = (Math.floor(ctx.id / 7) + ctx.seed + ctx.round) % 10;
    const rep = 1 + ((Math.floor(ctx.id / 5) + b + ctx.round) % 9);
    const numerator = (pre * 100 + mid * 10 + rep) - (pre * 10 + mid);
    const answer = frac(numerator, 900);
    return q(ctx, '순환소수 분수화', ['순환소수', '분수 변환'],
      `${math(`0.${pre}${mid}\\dot{${rep}}`)}를 기약분수로 나타내면?`,
      answer, [frac(numerator + 1, 900), frac(numerator, 990), frac(numerator - 1, 900), frac(numerator, 90)],
      `${math(`0.${pre}${mid}\\dot{${rep}}=\\frac{${pre}${mid}${rep}-${pre}${mid}}{900}=\\frac{${numerator}}{900}`)}이다.`);
  }
  if (ctx.difficulty === '심화') {
    const den = 18 + ((ctx.id * 41 + ctx.seed + level + ctx.round * 13) % 300);
    const need = strip25(den);
    return q(ctx, '유한소수 조건 역산', ['약분 조건', '분모 소인수'],
      `분수 ${math(`\\frac{x}{${den}}`)}가 유한소수가 되도록 하는 가장 작은 자연수 ${math('x')}는?`,
      need, [need + 1, need + 2, Math.max(1, need - 1), den],
      `분모에서 ${math(2)}, ${math(5)}가 아닌 소인수가 약분되어야 하므로 그 부분을 ${math('x')}가 포함해야 한다.`);
  }
  const n = a + c;
  const den = 6 + ((ctx.id * 29 + ctx.seed + ctx.round * 17) % 150);
  const count = Math.floor((n + 20) / den) - Math.floor(n / den);
  return q(ctx, '정수 조건 범위 추론', ['유리수', '정수 조건', '범위'],
    `${math(`${n}<\\frac{k}{${den}}\\le ${n + 20}`)}을 만족하는 자연수 ${math('k')} 중 ${math(den)}의 배수인 것은 몇 개인가?`,
    count, [count - 1, count + 1, count + 2, count + den],
    `${math('k')}가 ${math(den)}의 배수이면 분수값은 정수이다. ${math(n)}보다 크고 ${math(n + 20)} 이하인 정수의 개수를 센다.`);
}

function algebraQuestion(ctx) {
  let { a, b, c, d } = nums(ctx);
  const offset = ctx.seed % 17;
  const level = { '기본': 0, '유형별': 1, '심화': 2, '킬러': 3 }[ctx.difficulty] ?? 0;
  const boost = Math.min(level, 2);
  a = 2 + ((ctx.id + offset) % 9) + boost;
  b = 2 + ((Math.floor(ctx.id / 3) + offset) % 9) + boost;
  c = 2 + ((Math.floor(ctx.id / 7) + offset) % 9) + boost;
  d = 2 + ((Math.floor(ctx.id / 11) + offset) % 9) + boost;
  const mode = variantMode(ctx);
  if (ctx.difficulty === '기본') {
    if (mode === 1) {
      const answer = a + b - c;
      return q(ctx, '동류항 정리', ['동류항', '문자식'],
        `${math(`${a}x+${b}x-${c}x`)}를 간단히 하면 ${math('kx')}이다. ${math('k')}는?`,
        answer, [answer - 2, answer - 1, answer + 1, answer + 2],
        `동류항의 계수만 계산하면 ${math(`${a}+${b}-${c}=${answer}`)}이다.`);
    }
    if (mode === 2) {
      return q(ctx, '단항식 나눗셈', ['지수법칙', '계수'],
        `${math(`${a * b}x^3y^2`)}를 ${math(`${a}xy`)}로 나누었을 때 계수는?`,
        b, [a, a + b, b + 1, Math.max(1, b - 1)],
        `계수는 ${math(`${a * b}\\div${a}=${b}`)}이다.`);
    }
    if (mode === 3) {
      const x = c;
      const answer = a * x + b;
      return q(ctx, '문자식 대입', ['대입', '식의 값'],
        `${math(`A=${a}x+${b}`)}일 때 ${math(`x=${x}`)}이면 ${math('A')}의 값은?`,
        answer, [answer - a, answer + a, a + b, a * b],
        `${math('x')}에 ${math(x)}를 대입한다.`);
    }
    const answer = a * b;
    return q(ctx, '단항식 곱셈', ['계수', '지수법칙'],
      `${math(`${a}x^2y`)}와 ${math(`${b}xy^3`)}를 곱했을 때 ${math('x^3y^4')}의 계수는?`,
      answer, [answer - a, answer + a, a + b, answer + 2],
      `계수는 ${math(`${a}\\times${b}=${answer}`)}이고 문자는 지수법칙으로 정리된다.`);
  }
  if (ctx.difficulty === '유형별') {
    if (mode === 1) {
      const answer = a * c;
      return q(ctx, '전개식 최고차항', ['전개', '계수'],
        `${math(`(${a}x+${b})(${c}x+${d})`)}을 전개했을 때 ${math('x^2')}의 계수는?`,
        answer, [answer - a, answer + c, a + b, b * d],
        `${math('x^2')}항은 ${math(`${a}x\\cdot${c}x`)}에서 나온다.`);
    }
    if (mode === 2) {
      const answer = b * d;
      return q(ctx, '전개식 상수항', ['전개', '상수항'],
        `${math(`(${a}x+${b})(${c}x+${d})`)}을 전개했을 때 상수항은?`,
        answer, [answer - b, answer + d, a * c, a * d + b * c],
        `상수항은 ${math(`${b}\\times${d}=${answer}`)}이다.`);
    }
    if (mode === 3) {
      const answer = a * c + a * d + b * c + b * d;
      return q(ctx, '전개 후 대입', ['전개', '대입'],
        `${math(`(${a}x+${b})(${c}x+${d})`)}에서 ${math('x=1')}일 때의 값은?`,
        answer, [answer - 2, answer + 2, a * c + b * d, a + b + c + d],
        `${math('x=1')}을 대입하면 ${math(`(${a}+${b})(${c}+${d})=${answer}`)}이다.`);
    }
    const answer = a * d + b * c;
    return q(ctx, '전개식 계수', ['분배법칙', '동류항'],
      `${math(`(${a}x+${b})(${c}x+${d})`)}을 전개했을 때 ${math('x')}의 계수는?`,
      answer, [answer - a, answer + c, a * c, b * d],
      `${math('x')}항은 ${math(`${a * d}x`)}와 ${math(`${b * c}x`)}에서 나오므로 계수는 ${math(answer)}이다.`);
  }
  if (ctx.difficulty === '심화') {
    if (mode === 1) {
      const offset = a + b;
      const answer = 2 * (a - offset);
      return q(ctx, '곱셈공식 차', ['곱셈공식', '계수 비교'],
        `${math(`(x+${a})^2-(x+${offset})^2`)}을 정리했을 때 ${math('x')}의 계수는?`,
        answer, [answer - 2, answer + 2, a - offset, a + offset],
        `제곱식을 전개해 ${math('x')}항의 계수를 비교한다.`);
    }
    if (mode === 2) {
      const answer = a + b;
      return q(ctx, '항등식 계수 조건', ['항등식', '계수 비교'],
        `${math(`(x+${a})(x+${b})=x^2+kx+${a * b}`)}가 항등식일 때 ${math('k')}는?`,
        answer, [answer - 2, answer - 1, answer + 1, a * b],
        `${math('x')}의 계수를 비교하면 ${math(`k=${a}+${b}=${answer}`)}이다.`);
    }
    if (mode === 3) {
      const answer = a * a + b * b;
      return q(ctx, '대칭식 변형', ['식 변형', '대칭식'],
        `${math(`x+y=${a + b}`)}, ${math(`xy=${a * b}`)}일 때 ${math('x^2+y^2')}의 값은?`,
        answer, [answer - 2, answer + 2, (a + b) ** 2, a * b],
        `${math('x^2+y^2=(x+y)^2-2xy')}를 이용한다.`);
    }
    const answer = 2 * (a + b);
    return q(ctx, '곱셈공식 변형', ['곱셈공식', '계수 비교'],
      `${math(`(x+${a})^2-(x-${b})^2`)}을 정리했을 때 ${math('x')}의 계수는?`,
      answer, [answer - 2, answer + 2, a + b, a * b],
      `전개하면 ${math(`2(${a}+${b})x+${a * a - b * b}`)}이므로 계수는 ${math(answer)}이다.`);
  }
  const xVal = 6 + ((ctx.id + ctx.variant.variantNo + ctx.seed) % 13);
  const yVal = 2 + ((Math.floor(ctx.id / 5) + ctx.round + ctx.variant.variantNo) % 8);
  const sum = xVal + yVal;
  const product = xVal * yVal;
  const diff = xVal - yVal;
  if (mode === 1) {
    const answer = sum ** 2 - 2 * product;
    return q(ctx, '대칭식 역추론', ['식 변형', '역추론'],
      `${math(`x+y=${sum}`)}, ${math(`xy=${product}`)}일 때 ${math('x^2+y^2')}의 값은?`,
      answer, [answer - 2, answer + 2, sum ** 2, product],
      `${math('x^2+y^2=(x+y)^2-2xy')}를 사용한다.`);
  }
  if (mode === 2) {
    const answer = sum ** 2 - 4 * product;
    return q(ctx, '조건식 최솟값형', ['완전제곱식', '식 변형'],
      `${math(`x+y=${sum}`)}, ${math(`xy=${product}`)}일 때 ${math('(x-y)^2')}의 값은?`,
      answer, [answer - 2, answer + 2, sum, product],
      `${math('(x-y)^2=(x+y)^2-4xy')}를 이용한다.`);
  }
  if (mode === 3) {
    const answer = sum * diff;
    return q(ctx, '두 식 동시 추론', ['식 변형', '역추론'],
      `${math(`x+y=${sum}`)}, ${math(`x-y=${diff}`)}일 때 ${math('x^2-y^2')}의 값은?`,
      answer, [answer - 2, answer + 2, sum ** 2, diff ** 2],
      `${math('x^2-y^2=(x+y)(x-y)')}이다.`);
  }
  const p = 2 * xVal + yVal;
  const qDiff = xVal - yVal;
  const answer = xVal * xVal + 2 * xVal * yVal;
  return q(ctx, '두 식으로 값 구하기', ['식 변형', '역추론'],
    `${math(`2x+y=${p}`)}, ${math(`x-y=${qDiff}`)}일 때 ${math('x^2+2xy')}의 값은?`,
    answer, [answer - a, answer + b, sum ** 2, product],
    `두 식을 연립해 ${math(`x=${xVal}`)}, ${math(`y=${yVal}`)}를 구한 뒤 대입한다.`);
}

function inequalityQuestion(ctx) {
  const { a, b, c, d } = nums(ctx);
  const mode = variantMode(ctx);
  if (ctx.difficulty === '기본') {
    const bound = a + b;
    if (mode === 1) {
      const answer = a + b - c + 1;
      return q(ctx, '부등식 대입 확인', ['부등식', '대입'],
        `${math(`x+${c}>${a + b}`)}를 만족하는 가장 작은 정수 ${math('x')}는?`,
        answer, [answer - 2, answer - 1, answer + 1, answer + 2],
        `${math(`x>${a + b - c}`)}이므로 가장 작은 정수는 ${math(answer)}이다.`);
    }
    if (mode === 2) {
      return q(ctx, '부등호 방향', ['부등식', '음수 곱셈'],
        `${math(`-${a}x<-${a * b}`)}를 만족하는 가장 작은 자연수 ${math('x')}는?`,
        b + 1, [b - 1, b, b + 2, a + b],
        `음수로 나누면 부등호 방향이 바뀌어 ${math(`x>${b}`)}가 된다.`);
    }
    if (mode === 3) {
      const answer = b + c;
      return q(ctx, '일차부등식 값', ['이항', '정수해'],
        `${math(`x-${b}\\le ${c}`)}를 만족하는 가장 큰 정수 ${math('x')}는?`,
        answer, [answer - 2, answer - 1, answer + 1, answer + 2],
        `${math(`x\\le ${answer}`)}이므로 가장 큰 정수는 ${math(answer)}이다.`);
    }
    return q(ctx, '일차부등식 풀이', ['이항', '정수해'],
      `${math(`x-${a}>${b}`)}를 만족하는 가장 작은 정수 ${math('x')}는?`,
      bound + 1, [bound - 1, bound, bound + 2, bound + 3],
      `${math(`x>${bound}`)}이므로 가장 작은 정수는 ${math(bound + 1)}이다.`);
  }
  if (ctx.difficulty === '유형별') {
    const limit = b + d;
    if (mode === 1) {
      const answer = Math.max(0, limit - c + 1);
      return q(ctx, '정수해 구간', ['부등식', '해의 개수'],
        `${math(`${c}\\le x\\le ${limit}`)}를 만족하는 정수 ${math('x')}의 개수는?`,
        answer, [answer - 2, answer - 1, answer + 1, limit],
        `양 끝 값을 포함해 ${math(`${limit}-${c}+1=${answer}`)}개이다.`);
    }
    if (mode === 2) {
      const answer = limit - 1;
      return q(ctx, '자연수해 조건', ['일차부등식', '자연수해'],
        `${math(`${a}x+${c}<${a * limit + c}`)}을 만족하는 자연수 ${math('x')}의 개수는?`,
        answer, [answer - 2, answer - 1, answer + 1, limit],
        `${math(`x<${limit}`)}이므로 가능한 자연수는 ${math(1)}부터 ${math(limit - 1)}까지이다.`);
    }
    if (mode === 3) {
      const answer = limit + 1;
      return q(ctx, '최소 정수해', ['일차부등식', '정수해'],
        `${math(`${a}x-${c}>${a * limit - c}`)}을 만족하는 가장 작은 정수 ${math('x')}는?`,
        answer, [limit - 1, limit, answer + 1, answer + 2],
        `${math(`x>${limit}`)}이므로 가장 작은 정수는 ${math(answer)}이다.`);
    }
    return q(ctx, '자연수해 개수', ['일차부등식', '해의 개수'],
      `${math(`${a}x+${c}\\le ${a * limit + c}`)}을 만족하는 자연수 ${math('x')}의 개수는?`,
      limit, [limit - 2, limit - 1, limit + 1, limit + 2],
      `${math(`x\\le ${limit}`)}이므로 자연수 해는 ${math(limit)}개이다.`);
  }
  if (ctx.difficulty === '심화') {
    const low = c;
    const high = c + b;
    const answer = high - low + 1;
    if (mode === 1) {
      return q(ctx, '연립부등식 끝값', ['연립부등식', '범위 해석'],
        `연립부등식 ${math(`${low}\\le x<${high + 1}`)}를 만족하는 정수 중 가장 큰 값은?`,
        high, [high - 2, high - 1, high + 1, answer],
        `오른쪽 끝은 포함되지 않으므로 가장 큰 정수는 ${math(high)}이다.`);
    }
    if (mode === 2) {
      const answer2 = a * answer;
      return q(ctx, '부등식 범위와 합', ['연립부등식', '정수해 합'],
        `${math(`${low - 1}<x\\le ${high}`)}를 만족하는 정수 ${math('x')}들의 합에 ${math(a)}를 곱한 값은?`,
        answer2 * (low + high) / 2, [answer2, answer2 + a, answer2 - a, answer],
        `정수해의 합을 구한 뒤 ${math(a)}를 곱한다.`);
    }
    if (mode === 3) {
      const answer2 = high - low;
      return q(ctx, '경계 제외 해석', ['연립부등식', '경계 조건'],
        `${math(`${low}\\le x<${high}`)}를 만족하는 정수 ${math('x')}의 개수는?`,
        answer2, [answer2 - 2, answer2 - 1, answer2 + 1, answer],
        `왼쪽 끝은 포함하고 오른쪽 끝은 제외한다.`);
    }
    return q(ctx, '연립부등식 정수해', ['연립부등식', '정수 범위'],
      `연립부등식 ${math(`${low - 1}<x\\le ${high}`)}를 만족하는 정수 ${math('x')}의 개수는?`,
      answer, [answer - 2, answer - 1, answer + 1, answer + 2],
      `가능한 정수는 ${math(low)}부터 ${math(high)}까지이므로 ${math(answer)}개이다.`);
  }
  const answer = a * b - c - 1;
  if (mode === 1) {
    const min = a * b - c + 1;
    return q(ctx, '매개변수 최소 정수해', ['매개변수', '정수해', '역추론'],
      `${math(`\\frac{x+${c}}{${a}}>${b}`)}를 만족하는 가장 작은 정수 ${math('x')}는?`,
      min, [min - 2, min - 1, min + 1, answer],
      `${math(`x+${c}>${a * b}`)}이므로 ${math(`x>${a * b - c}`)}이다.`);
  }
  if (mode === 2) {
    const t = b + d;
    const answer2 = t - c + 1;
    return q(ctx, '조건부 정수해 개수', ['매개변수', '정수해', '조건 분류'],
      `${math(`${c}\\le x\\le ${t}`)}이고 ${math(`x>${c - 1}`)}인 정수 ${math('x')}의 개수는?`,
      answer2, [answer2 - 2, answer2 - 1, answer2 + 1, t],
      `두 조건을 함께 만족하는 정수 범위만 센다.`);
  }
  if (mode === 3) {
    const answer2 = a * (b - 1) + c + 1;
    return q(ctx, '경계값 역추론', ['매개변수', '경계값'],
      `부등식 ${math(`${a}x+${c}<m`)}의 가장 큰 정수해가 ${math(b - 1)}이 되도록 하는 가장 작은 정수 ${math('m')}은?`,
      answer2, [answer2 - 2, answer2 - 1, answer2 + 1, answer2 + 2],
      `${math(`x=${b}`)}는 만족하지 않아야 하므로 경계값을 정수로 맞춘다.`);
  }
  return q(ctx, '매개변수 최대 정수해', ['매개변수', '정수해', '역추론'],
    `부등식 ${math(`\\frac{x+${c}}{${a}}<${b}`)}를 만족하는 가장 큰 정수 ${math('x')}는?`,
    answer, [answer - 2, answer - 1, answer + 1, answer + 2],
    `${math(`x+${c}<${a * b}`)}이므로 ${math(`x<${a * b - c}`)}이다. 가장 큰 정수는 ${math(answer)}이다.`);
}

function linearQuestion(ctx) {
  const { a, b, c, d } = nums(ctx);
  const mode = variantMode(ctx);
  if (ctx.difficulty === '기본') {
    const x = c;
    const answer = a * x + b;
    if (mode === 1) {
      return q(ctx, '기울기 읽기', ['일차함수', '기울기'],
        `${math(`y=${a}x+${b}`)}의 기울기는?`,
        a, [a - 2, a - 1, b, a + 1],
        `${math('x')}의 계수가 기울기이다.`);
    }
    if (mode === 2) {
      return q(ctx, '절편 읽기', ['일차함수', 'y절편'],
        `${math(`y=${a}x+${b}`)}의 ${math('y')}절편은?`,
        b, [a, b - 1, b + 1, a + b],
        `${math('x=0')}일 때의 ${math('y')}값이 ${math('y')}절편이다.`);
    }
    if (mode === 3) {
      const answer2 = a * (x + 1) + b;
      return q(ctx, '함수값 비교', ['대입', '함수값'],
        `${math(`y=${a}x+${b}`)}에서 ${math(`x=${x + 1}`)}일 때 ${math('y')}의 값은?`,
        answer2, [answer2 - a, answer2 + a, answer, b],
        `주어진 ${math('x')}값을 대입한다.`);
    }
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
    if (mode === 1) {
      return q(ctx, '두 점과 변화량', ['두 점', '변화량'],
        `두 점 ${math(`(${x1},${y1})`)}, ${math(`(${x2},${y2})`)}에서 ${math('y')}값의 증가량은?`,
        y2 - y1, [m, x2 - x1, y2 - y1 - 1, y2 - y1 + 1],
        `${math('y')}값의 증가량은 ${math(`${y2}-${y1}`)}이다.`);
    }
    if (mode === 2) {
      const y0 = y1 - m * x1;
      return q(ctx, '기울기와 절편', ['두 점', '일차함수'],
        `기울기가 ${math(m)}이고 점 ${math(`(${x1},${y1})`)}을 지나는 직선의 ${math('y')}절편은?`,
        y0, [y0 - 2, y0 - 1, y0 + 1, y1],
        `${math(`y=${m}x+n`)}에 점을 대입해 ${math('n')}을 구한다.`);
    }
    if (mode === 3) {
      return q(ctx, '변화율 적용', ['기울기', '함수값 변화'],
        `기울기가 ${math(m)}인 일차함수에서 ${math('x')}가 ${math(d)}만큼 증가하면 ${math('y')}는 얼마나 변하는가?`,
        m * d, [m + d, m * d - 1, m * d + 1, d],
        `변화량은 기울기와 ${math('x')}의 증가량의 곱이다.`);
    }
    return q(ctx, '두 점의 기울기', ['두 점', '기울기'],
      `두 점 ${math(`(${x1},${y1})`)}, ${math(`(${x2},${y2})`)}를 지나는 직선의 기울기는?`,
      m, [m - 2, m - 1, m + 1, m + 2],
      `기울기는 ${math(`\\frac{${y2}-${y1}}{${x2}-${x1}}=${m}`)}이다.`);
  }
  if (ctx.difficulty === '심화') {
    const xIntercept = a + d;
    const yIntercept = b + c;
    const answer = frac(xIntercept * yIntercept, 2);
    if (mode === 1) {
      return q(ctx, '절편 합 해석', ['절편', '그래프'],
        `${math(`\\frac{x}{${xIntercept}}+\\frac{y}{${yIntercept}}=1`)}의 ${math('x')}절편과 ${math('y')}절편의 합은?`,
        xIntercept + yIntercept, [xIntercept, yIntercept, xIntercept * yIntercept, answer],
        `절편형에서 두 절편을 바로 읽어 더한다.`);
    }
    if (mode === 2) {
      const m = frac(-yIntercept, xIntercept);
      return q(ctx, '절편형 기울기', ['절편', '기울기'],
        `${math(`\\frac{x}{${xIntercept}}+\\frac{y}{${yIntercept}}=1`)}의 그래프의 기울기는?`,
        m, [frac(yIntercept, xIntercept), -xIntercept, yIntercept, frac(xIntercept, yIntercept)],
        `두 절편을 이용해 기울기를 구한다.`);
    }
    if (mode === 3) {
      return q(ctx, '좌표축 삼각형 둘레', ['절편', '거리'],
        `${math(`\\frac{x}{${xIntercept}}+\\frac{y}{${yIntercept}}=1`)}의 그래프와 두 좌표축으로 생기는 직각삼각형에서 두 직각변의 길이의 합은?`,
        xIntercept + yIntercept, [xIntercept, yIntercept, xIntercept * yIntercept, answer],
        `두 직각변은 각각 절편의 길이이다.`);
    }
    return q(ctx, '절편과 넓이', ['절편', '삼각형 넓이'],
      `${math(`\\frac{x}{${xIntercept}}+\\frac{y}{${yIntercept}}=1`)}의 그래프와 두 좌표축으로 둘러싸인 삼각형의 넓이는?`,
      answer, [xIntercept + yIntercept, xIntercept * yIntercept, frac(xIntercept + yIntercept, 2), Math.abs(xIntercept - yIntercept)],
      `두 절편이 ${math(xIntercept)}, ${math(yIntercept)}이므로 넓이는 ${math(`\\frac12\\times${xIntercept}\\times${yIntercept}`)}이다.`);
  }
  const fixedX = -b;
  const fixedY = a * fixedX + c;
  const answer = fixedX + fixedY;
  if (mode === 1) {
    return q(ctx, '불변점 좌표', ['매개변수', '불변 조건'],
      `직선 ${math(`y=k(x+${b})+${a}x+${c}`)}가 ${math('k')}의 값과 관계없이 지나는 점의 ${math('x')}좌표는?`,
      fixedX, [fixedX - 2, fixedX - 1, fixedX + 1, fixedY],
      `${math('k')}가 붙은 항이 사라지려면 ${math(`x+${b}=0`)}이어야 한다.`);
  }
  if (mode === 2) {
    return q(ctx, '불변점 함수값', ['매개변수', '대입'],
      `직선 ${math(`y=k(x+${b})+${a}x+${c}`)}가 항상 지나는 점의 ${math('y')}좌표는?`,
      fixedY, [fixedY - 2, fixedY - 1, fixedY + 1, fixedX],
      `${math(`x=${fixedX}`)}를 대입해 ${math('y')}좌표를 구한다.`);
  }
  if (mode === 3) {
    const answer2 = fixedY - fixedX;
    return q(ctx, '불변점 조건 비교', ['매개변수', '좌표 비교'],
      `직선 ${math(`y=k(x+${b})+${a}x+${c}`)}가 항상 지나는 점을 ${math('(p,q)')}라 할 때 ${math('q-p')}는?`,
      answer2, [answer2 - 2, answer2 - 1, answer, fixedY],
      `불변점의 두 좌표를 구한 뒤 차를 계산한다.`);
  }
  return q(ctx, '항상 지나는 점', ['매개변수', '불변 조건'],
    `직선 ${math(`y=k(x+${b})+${a}x+${c}`)}는 ${math('k')}의 값과 관계없이 항상 한 점을 지난다. 그 점의 ${math('x+y')}는?`,
    answer, [answer - 2, answer - 1, answer + 1, answer + 2],
    `${math('k')}의 영향을 없애려면 ${math(`x+${b}=0`)}이다. 이때 ${math(`x=${fixedX}`)}, ${math(`y=${fixedY}`)}이다.`);
}

function radicalQuestion(ctx) {
  let { a, b } = nums(ctx);
  const offset = ctx.seed % 29;
  const plainRoot = 2 + ((ctx.id + offset) % 28);
  a = 2 + ((ctx.id + offset) % 8);
  b = 2 + ((Math.floor(ctx.id / 5) + offset) % 10);
  const mode = variantMode(ctx);
  const sf = [2, 3, 5, 6, 7, 10][ctx.id % 6];
  if (ctx.difficulty === '기본') {
    if (mode === 1) {
      return q(ctx, '제곱근 값 확인', ['제곱근', '제곱수'],
        `${math(`\\sqrt{${plainRoot * plainRoot}}`)}의 값은?`,
        plainRoot, [plainRoot - 2, plainRoot - 1, plainRoot + 1, plainRoot * plainRoot],
        `양의 제곱근을 구하면 ${math(plainRoot)}이다.`);
    }
    if (mode === 2) {
      return q(ctx, '근호 밖 인수', ['제곱근', '근호 정리'],
        `${math(`\\sqrt{${a * a * sf}}`)}에서 근호 밖으로 나오는 자연수 인수는?`,
        a, [a - 1, a + 1, sf, a * sf],
        `${math(`${a}^2`)}이 근호 밖으로 나온다.`);
    }
    if (mode === 3) {
      return q(ctx, '제곱근 비교', ['제곱근', '대소 비교'],
        `${math(`\\sqrt{${plainRoot * plainRoot}}`)}와 ${math(`\\sqrt{${(plainRoot + 1) * (plainRoot + 1)}}`)}의 차는?`,
        1, [plainRoot, plainRoot + 1, 2, Math.max(1, plainRoot - 1)],
        `각각 ${math(plainRoot)}, ${math(plainRoot + 1)}이므로 차는 ${math(1)}이다.`);
    }
    return q(ctx, '제곱근 간단히', ['제곱근', '근호 밖으로 빼기'],
      `${math(`\\sqrt{${a * a * sf}}`)}을 간단히 하면?`,
      `${a}\\sqrt{${sf}}`, [`${a + 1}\\sqrt{${sf}}`, `${a}\\sqrt{${sf + 1}}`, `${a * sf}`, `\\sqrt{${a * sf}}`],
      `${math(`${a * a * sf}=${a}^2\\times${sf}`)}이므로 ${math(`${a}\\sqrt{${sf}}`)}이다.`);
  }
  if (ctx.difficulty === '유형별') {
    const answer = a + b;
    if (mode === 1) {
      return q(ctx, '동류근호 뺄셈', ['동류근호', '계수'],
        `${math(`${a + b}\\sqrt{${sf}}-${b}\\sqrt{${sf}}`)}를 ${math(`A\\sqrt{${sf}}`)}로 나타낼 때 ${math('A')}는?`,
        a, [b, a + b, a - 1, a + 1],
        `같은 근호끼리 계수만 계산한다.`);
    }
    if (mode === 2) {
      const outside = a + b;
      return q(ctx, '근호 정리 후 덧셈', ['근호 정리', '동류근호'],
        `${math(`\\sqrt{${a * a * sf}}+${b}\\sqrt{${sf}}`)}를 ${math(`A\\sqrt{${sf}}`)}로 나타낼 때 ${math('A')}는?`,
        outside, [outside - 2, outside - 1, outside + 1, a * b],
        `첫 항을 정리하면 ${math(`${a}\\sqrt{${sf}}`)}가 된다.`);
    }
    if (mode === 3) {
      const answer2 = a * b * sf;
      return q(ctx, '근호 곱셈', ['제곱근', '곱셈'],
        `${math(`${a}\\sqrt{${sf}}\\times${b}\\sqrt{${sf}}`)}의 값은?`,
        answer2, [answer2 - sf, answer2 + sf, a * b, a + b],
        `계수끼리 곱하고 ${math(`\\sqrt{${sf}}\\times\\sqrt{${sf}}=${sf}`)}를 이용한다.`);
    }
    return q(ctx, '동류근호 계산', ['동류근호', '계수'],
      `${math(`${a}\\sqrt{${sf}}+${b}\\sqrt{${sf}}`)}를 ${math(`A\\sqrt{${sf}}`)}로 나타낼 때 ${math('A')}는?`,
      answer, [answer - 2, answer - 1, answer + 1, answer + 2],
      `같은 근호끼리 계수를 더하면 ${math(`${answer}\\sqrt{${sf}}`)}이다.`);
  }
  if (ctx.difficulty === '심화') {
    const answer = a * a - b;
    if (mode === 1) {
      const answer2 = a * a + b;
      return q(ctx, '근호식 전개', ['제곱근', '곱셈공식'],
        `${math(`(\\sqrt{${a * a}}+\\sqrt{${b}})^2`)}을 전개해 정리하면 유리수 부분은?`,
        answer2, [answer2 - 2, answer2 + 2, 2 * a * b, a + b],
        `제곱 전개에서 유리수 부분은 ${math(`${a * a}+${b}`)}이다.`);
    }
    if (mode === 2) {
      const value = a * a * sf;
      const answer2 = sf * sf;
      return q(ctx, '근호식 역산', ['제곱근', '역추론'],
        `${math(`\\sqrt{${value}n}`)}이 ${math(`${a * sf}\\sqrt{${sf}}`)}가 되도록 하는 가장 작은 자연수 ${math('n')}은?`,
        answer2, [Math.max(1, answer2 - sf), answer2 + sf, sf, a * sf],
        `근호 안의 남는 제곱이 아닌 부분을 맞춘다.`);
    }
    if (mode === 3) {
      return q(ctx, '근호식 비교', ['제곱근', '대소 비교'],
        `${math(`${a}\\sqrt{${sf}}`)}와 ${math(`${b}\\sqrt{${sf}}`)}의 차를 ${math(`A\\sqrt{${sf}}`)}라 할 때 ${math('A')}는?`,
        a - b, [b - a, a + b, a - b + 1, a],
        `같은 근호의 계수끼리 뺀다.`);
    }
    return q(ctx, '근호식 합차공식', ['제곱근', '곱셈공식'],
      `${math(`(\\sqrt{${a * a}}+\\sqrt{${b}})(\\sqrt{${a * a}}-\\sqrt{${b}})`)}의 값은?`,
      answer, [answer - 2, answer - 1, answer + 1, a * a + b],
      `합차공식으로 ${math(`${a * a}-${b}=${answer}`)}이다.`);
  }
  const small = 2 + ((ctx.id + offset) % 8);
  const radicand = sf * small * small;
  const answer = squareFreePart(radicand);
  if (mode === 1) {
    const need = squareFreePart(a * sf);
    return q(ctx, '완전제곱 조건', ['제곱근', '완전제곱수 조건'],
      `${math(`${a * sf}n`)}이 완전제곱수가 되도록 하는 가장 작은 자연수 ${math('n')}은?`,
      need, [need + 1, need + 2, Math.max(1, need - 1), a],
      `소인수의 지수가 모두 짝수가 되도록 부족한 인수를 곱한다.`);
  }
  if (mode === 2) {
    const answer2 = sf;
    return q(ctx, '근호 속 조건 제외', ['제곱근', '역추론'],
      `${math(`\\sqrt{${small * small * sf}n}`)}이 자연수이고 ${math('n')}이 가장 작을 때 ${math('n')}은?`,
      answer2, [answer2 + 1, answer2 + 2, small, small * sf],
      `이미 제곱인 부분을 제외하고 남은 ${math(sf)}를 보충한다.`);
  }
  if (mode === 3) {
    const answer2 = small;
    return q(ctx, '근호 밖 계수 역추론', ['제곱근', '계수 추론'],
      `${math(`\\sqrt{${radicand}}=${answer2}\\sqrt{m}`)}일 때 제곱인수를 최대한 밖으로 빼면 ${math('m')}은?`,
      sf, [sf + 1, sf + 2, answer2, radicand],
      `제곱인수 ${math(`${small}^2`)}를 밖으로 빼면 근호 안에는 ${math(sf)}가 남는다.`);
  }
  return q(ctx, '자연수 조건 역추론', ['제곱근', '완전제곱수 조건'],
    `${math(`\\sqrt{${radicand}n}`)}이 자연수가 되도록 하는 가장 작은 자연수 ${math('n')}은?`,
    answer, [answer * 2, answer * 3, answer + 1, Math.max(1, answer - 1)],
    `근호 안의 제곱인수를 제거하고 남은 부분을 곱해야 완전제곱수가 된다.`);
}

function quadraticEquationQuestion(ctx) {
  let { a, c } = nums(ctx);
  const offset = ctx.seed % 23;
  a = 2 + ((ctx.id + offset) % 16);
  c = 1 + ((Math.floor(ctx.id / 5) + ctx.round + offset) % 10);
  const mode = variantMode(ctx);
  const r1 = a;
  const r2 = a + c;
  if (ctx.difficulty === '기본') {
    if (mode === 1) {
      return q(ctx, '인수분해 근 확인', ['이차방정식', '근'],
        `${math(`(x-${r1})(x-${r2})=0`)}의 큰 근은?`,
        r2, [r1, r1 + r2, r1 * r2, Math.abs(r2 - r1)],
        `두 근은 ${math(r1)}, ${math(r2)}이다.`);
    }
    if (mode === 2) {
      return q(ctx, '근의 곱', ['이차방정식', '인수분해'],
        `${math(`(x-${r1})(x-${r2})=0`)}의 두 근의 곱은?`,
        r1 * r2, [r1 + r2, r1, r2, Math.abs(r2 - r1)],
        `두 근을 곱한다.`);
    }
    if (mode === 3) {
      return q(ctx, '근의 차', ['이차방정식', '근'],
        `${math(`(x-${r1})(x-${r2})=0`)}의 두 근의 차는?`,
        Math.abs(r2 - r1), [r1, r2, r1 + r2, r1 * r2],
        `두 근의 차를 구한다.`);
    }
    return q(ctx, '인수분해 근의 합', ['이차방정식', '인수분해'],
      `${math(`(x-${r1})(x-${r2})=0`)}의 두 근의 합은?`,
      r1 + r2, [r1, r2, r1 * r2, Math.abs(r2 - r1)],
      `두 근은 ${math(r1)}, ${math(r2)}이므로 합은 ${math(r1 + r2)}이다.`);
  }
  if (ctx.difficulty === '유형별') {
    if (mode === 1) {
      return q(ctx, '근과 계수의 관계 합', ['근의 합', '근의 곱'],
        `이차방정식 ${math(`x^2-${r1 + r2}x+${r1 * r2}=0`)}의 두 근의 합은?`,
        r1 + r2, [r1 * r2, r1, r2, Math.abs(r2 - r1)],
        `근과 계수의 관계에서 두 근의 합은 ${math(r1 + r2)}이다.`);
    }
    if (mode === 2) {
      const answer = (r1 + r2) ** 2 - 2 * r1 * r2;
      return q(ctx, '근의 제곱합', ['근과 계수', '식 변형'],
        `이차방정식의 두 근 ${math('\\alpha,\\beta')}에 대하여 ${math(`\\alpha+\\beta=${r1 + r2}`)}, ${math(`\\alpha\\beta=${r1 * r2}`)}일 때 ${math('\\alpha^2+\\beta^2')}은?`,
        answer, [answer - 2, answer + 2, r1 + r2, r1 * r2],
        `${math('\\alpha^2+\\beta^2=(\\alpha+\\beta)^2-2\\alpha\\beta')}를 이용한다.`);
    }
    if (mode === 3) {
      return q(ctx, '상수항 추론', ['근과 계수', '계수 추론'],
        `두 근이 ${math(r1)}, ${math(r2)}인 이차방정식 ${math(`x^2-${r1 + r2}x+k=0`)}에서 ${math('k')}는?`,
        r1 * r2, [r1 + r2, r1 * r2 - 1, r1 * r2 + 1, Math.abs(r2 - r1)],
        `상수항은 두 근의 곱이다.`);
    }
    return q(ctx, '근과 계수의 관계', ['근의 합', '근의 곱'],
      `이차방정식 ${math(`x^2-${r1 + r2}x+${r1 * r2}=0`)}의 두 근의 곱은?`,
      r1 * r2, [r1 + r2, r1 * r2 - 1, r1 * r2 + 1, Math.abs(r2 - r1)],
      `근과 계수의 관계에서 두 근의 곱은 상수항 ${math(r1 * r2)}이다.`);
  }
  if (ctx.difficulty === '심화') {
    const answer = r1 * r1;
    if (mode === 1) {
      return q(ctx, '판별식 조건', ['판별식', '중근'],
        `${math(`x^2-${2 * r1}x+k=0`)}의 판별식이 ${math(0)}이 되도록 하는 ${math('k')}는?`,
        answer, [answer - 1, answer + 1, 2 * r1, r1],
        `중근 조건은 판별식 ${math('D=0')}이다.`);
    }
    if (mode === 2) {
      const answer2 = 2 * r1;
      return q(ctx, '중근 계수 역추론', ['중근', '계수 비교'],
        `${math(`x^2-px+${r1 * r1}=0`)}이 중근을 가질 때 양수 ${math('p')}는?`,
        answer2, [answer2 - 2, answer2 - 1, answer2 + 1, r1],
        `중근이 ${math(r1)}이면 두 근의 합은 ${math(2 * r1)}이다.`);
    }
    if (mode === 3) {
      const answer2 = r1 + r2;
      return q(ctx, '한 근 조건 추론', ['근과 계수', '대입'],
        `${math(r1)}이 방정식 ${math(`x^2-px+${r1 * r2}=0`)}의 한 근일 때 ${math('p')}는?`,
        answer2, [answer2 - 2, answer2 - 1, answer2 + 1, r1 * r2],
        `나머지 근이 ${math(r2)}가 되므로 두 근의 합을 이용한다.`);
    }
    return q(ctx, '중근 조건', ['판별식', '매개변수'],
      `${math(`x^2-${2 * r1}x+k=0`)}이 중근을 갖도록 하는 ${math('k')}의 값은?`,
      answer, [answer - 1, answer + 1, 2 * r1, r1],
      `중근이면 ${math(`D=0`)}이고 ${math(`k=(${2 * r1}/2)^2=${answer}`)}이다.`);
  }
  const answer = r1 + r2;
  if (mode === 1) {
    return q(ctx, '공통근 상수 추론', ['공통근', '계수 추론'],
      `두 방정식 ${math(`x^2-${answer}x+${r1 * r2}=0`)}, ${math(`x^2-${answer}x+q=0`)}이 두 근을 모두 공유할 때 ${math('q')}는?`,
      r1 * r2, [answer, r1 * r2 - 1, r1 * r2 + 1, Math.abs(r2 - r1)],
      `두 근을 모두 공유하면 근의 곱도 같아야 한다.`);
  }
  if (mode === 2) {
    const answer2 = (r1 - r2) ** 2;
    return q(ctx, '두 근 거리 추론', ['근과 계수', '식 변형'],
      `두 근의 합이 ${math(answer)}, 곱이 ${math(r1 * r2)}일 때 두 근의 차의 제곱은?`,
      answer2, [answer2 - 2, answer2 + 2, answer, r1 * r2],
      `${math('(\\alpha-\\beta)^2=(\\alpha+\\beta)^2-4\\alpha\\beta')}를 이용한다.`);
  }
  if (mode === 3) {
    const answer2 = r1 * r2 - answer;
    return q(ctx, '근 조건 복합식', ['근과 계수', '복합 계산'],
      `두 근 ${math('\\alpha,\\beta')}가 ${math(`\\alpha+\\beta=${answer}`)}, ${math(`\\alpha\\beta=${r1 * r2}`)}를 만족할 때 ${math('\\alpha\\beta-\\alpha-\\beta')}는?`,
      answer2, [answer2 - 2, answer2 + 2, answer, r1 * r2],
      `주어진 두 값을 식에 그대로 대입한다.`);
  }
  return q(ctx, '공통근 계수 추론', ['공통근', '매개변수'],
    `두 방정식 ${math(`x^2-${answer}x+${r1 * r2}=0`)}, ${math(`x^2-px+${r1 * r2}=0`)}이 두 근을 모두 공유할 때 ${math('p')}는?`,
    answer, [answer - 2, answer - 1, answer + 1, answer + 2],
    `두 근을 모두 공유하면 두 근의 합도 같아야 하므로 ${math(`p=${answer}`)}이다.`);
}

function quadraticFunctionQuestion(ctx) {
  const { a, b, c, d } = nums(ctx);
  const mode = variantMode(ctx);
  if (ctx.difficulty === '기본') {
    if (mode === 1) {
      return q(ctx, '꼭짓점 y좌표', ['이차함수', '꼭짓점'],
        `${math(`y=${a}(x-${b})^2+${c}`)}의 꼭짓점의 ${math('y')}좌표는?`,
        c, [b, c - 1, c + 1, a],
        `꼭짓점형에서 꼭짓점은 ${math(`(${b},${c})`)}이다.`);
    }
    if (mode === 2) {
      return q(ctx, '대칭축 읽기', ['이차함수', '대칭축'],
        `${math(`y=${a}(x-${b})^2+${c}`)}의 대칭축은 ${math(`x=k`)}이다. ${math('k')}는?`,
        b, [b - 2, b - 1, b + 1, c],
        `대칭축은 ${math(`x=${b}`)}이다.`);
    }
    if (mode === 3) {
      return q(ctx, '최솟값 읽기', ['이차함수', '꼭짓점'],
        `${math(`y=${a}(x-${b})^2+${c}`)}의 최솟값은?`,
        c, [a, b, c - 1, c + 1],
        `위로 열린 포물선의 최솟값은 꼭짓점의 ${math('y')}좌표이다.`);
    }
    return q(ctx, '꼭짓점 읽기', ['이차함수', '꼭짓점'],
      `${math(`y=${a}(x-${b})^2+${c}`)}의 꼭짓점의 ${math('x')}좌표는?`,
      b, [b - 2, b - 1, b + 1, c],
      `꼭짓점형에서 꼭짓점은 ${math(`(${b},${c})`)}이다.`);
  }
  if (ctx.difficulty === '유형별') {
    const x = b + d;
    const answer = a * (x - b) ** 2 + c;
    if (mode === 1) {
      return q(ctx, '대칭점 함수값', ['대칭축', '함수값'],
        `${math(`y=${a}(x-${b})^2+${c}`)}에서 ${math(`x=${b - d}`)}일 때의 함수값은?`,
        answer, [answer - a, answer + a, c, a + c],
        `대칭축에서 같은 거리만큼 떨어진 두 점의 함수값은 같다.`);
    }
    if (mode === 2) {
      return q(ctx, '꼭짓점 거리', ['이차함수', '함수값'],
        `${math(`y=${a}(x-${b})^2+${c}`)}에서 ${math(`x=${x}`)}일 때 ${math('y-c')}의 값은?`,
        answer - c, [answer, c, answer - c - a, answer - c + a],
        `꼭짓점의 ${math('y')}좌표를 뺀 값은 ${math(`a(x-${b})^2`)}이다.`);
    }
    if (mode === 3) {
      const answer2 = d;
      return q(ctx, '대칭축 거리 해석', ['대칭축', '거리'],
        `${math(`y=${a}(x-${b})^2+${c}`)}에서 ${math(`x=${x}`)}는 대칭축에서 몇만큼 떨어져 있는가?`,
        answer2, [answer2 - 2, answer2 - 1, answer2 + 1, b],
        `대칭축 ${math(`x=${b}`)}와의 거리는 ${math(d)}이다.`);
    }
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
    if (mode === 1) {
      return q(ctx, '꼭짓점형 계수 추론', ['꼭짓점형', '계수 결정'],
        `꼭짓점이 ${math(`(${h},${k})`)}이고 점 ${math(`(${h - span},${y})`)}을 지나는 이차함수 ${math(`y=A(x-${h})^2+${k}`)}에서 ${math('A')}는?`,
        a, [a - 2, a - 1, a + 1, a + 2],
        `대칭인 점을 대입해 계수를 구한다.`);
    }
    if (mode === 2) {
      const answer2 = y - k;
      return q(ctx, '꼭짓점 차이 해석', ['이차함수', '차이'],
        `${math(`y=${a}(x-${h})^2+${k}`)}에서 ${math(`x=${x}`)}일 때 최솟값보다 얼마나 큰가?`,
        answer2, [answer2 - a, answer2 + a, y, k],
        `함수값에서 꼭짓점의 ${math('y')}좌표를 뺀다.`);
    }
    if (mode === 3) {
      const answer2 = h + span;
      return q(ctx, '함수값 조건 역추론', ['이차함수', '역추론'],
        `${math(`y=${a}(x-${h})^2+${k}`)}에서 함수값이 ${math(y)}가 되는 ${math('x')} 중 ${math(h)}보다 큰 값은?`,
        answer2, [h - span, h, answer2 + 1, y],
        `꼭짓점에서의 거리가 ${math(span)}인 두 점 중 큰 값을 고른다.`);
    }
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
  if (mode === 1) {
    const near = Math.min((left - h) ** 2, (right - h) ** 2);
    return q(ctx, '구간 최솟값 추론', ['이차함수', '구간', '대칭축'],
      `${math(`y=${a}(x-${h})^2+${k}`)}에서 ${math(`${left}\\le x\\le ${right}`)}일 때 최솟값은?`,
      k, [a * near + k, answer, k + a, h],
      `대칭축이 구간 안에 있으므로 최솟값은 꼭짓점의 값이다.`);
  }
  if (mode === 2) {
    const answer2 = right - h;
    return q(ctx, '구간 끝점 거리', ['이차함수', '구간 비교'],
      `${math(`${left}\\le x\\le ${right}`)}에서 ${math(right)}는 대칭축 ${math(`x=${h}`)}에서 얼마나 떨어져 있는가?`,
      answer2, [answer2 - 2, answer2 - 1, answer2 + 1, span],
      `끝점과 대칭축의 거리를 비교한다.`);
  }
  if (mode === 3) {
    const answer2 = answer - k;
    return q(ctx, '최댓값 차이 추론', ['이차함수', '구간', '최댓값'],
      `${math(`y=${a}(x-${h})^2+${k}`)}에서 ${math(`${left}\\le x\\le ${right}`)}일 때 최댓값은 최솟값보다 얼마나 큰가?`,
      answer2, [answer, k, answer2 - a, answer2 + a],
      `최댓값과 꼭짓점의 함수값 차이를 구한다.`);
  }
  return q(ctx, '구간 최댓값 추론', ['이차함수', '구간', '대칭축'],
    `${math(`y=${a}(x-${h})^2+${k}`)}에서 ${math(`${left}\\le x\\le ${right}`)}일 때 최댓값은?`,
    answer, [answer - a, answer + a, k, a * d * d + k],
    `위로 열린 포물선은 꼭짓점에서 멀수록 값이 커진다. 구간 양 끝 중 더 먼 점을 비교한다.`);
}

function trigonometryQuestion(ctx) {
  const { b, c } = nums(ctx);
  const mode = variantMode(ctx);
  const triples = [[3, 4, 5], [5, 12, 13], [8, 15, 17], [7, 24, 25]];
  const [ta, tb, tc] = triples[ctx.id % triples.length];
  const scale = 1 + (ctx.round % 2) + (ctx.difficulty === '킬러' ? 1 : 0);
  const x = ta * scale;
  const y = tb * scale;
  const z = tc * scale;
  if (ctx.difficulty === '기본') {
    if (mode === 1) {
      return q(ctx, '삼각비 기본값', ['직각삼각형', 'cos'],
        `직각삼각형에서 한 예각의 이웃한 변이 ${math(y)}, 빗변이 ${math(z)}일 때 코사인값은?`,
        frac(y, z), [frac(x, z), frac(x, y), frac(z, y), frac(y, x)],
        `코사인값은 이웃한 변을 빗변으로 나눈 값이다.`);
    }
    if (mode === 2) {
      return q(ctx, '삼각비 기본값', ['직각삼각형', 'tan'],
        `직각삼각형에서 한 예각의 대변이 ${math(x)}, 이웃한 변이 ${math(y)}일 때 탄젠트값은?`,
        frac(x, y), [frac(y, x), frac(x, z), frac(y, z), frac(z, x)],
        `탄젠트값은 대변을 이웃한 변으로 나눈 값이다.`);
    }
    if (mode === 3) {
      return q(ctx, '피타고라스와 삼각비', ['피타고라스', '삼각비'],
        `직각삼각형에서 두 변의 길이가 ${math(x)}, ${math(y)}이고 빗변이 ${math(z)}일 때 ${math('\\sin A+\\cos A')}의 값은?`,
        frac(x + y, z), [frac(x, z), frac(y, z), frac(z, x + y), frac(x + y + 1, z)],
        `사인값과 코사인값을 같은 분모로 더한다.`);
    }
    return q(ctx, '삼각비 기본값', ['직각삼각형', 'sin'],
      `직각삼각형에서 한 예각의 대변이 ${math(x)}, 빗변이 ${math(z)}일 때 사인값은?`,
      frac(x, z), [frac(y, z), frac(x, y), frac(z, x), frac(y, x)],
      `사인값은 대변을 빗변으로 나눈 값이다.`);
  }
  if (ctx.difficulty === '유형별') {
    if (mode === 1) {
      return q(ctx, '삼각비로 길이 구하기', ['sin', '비례식'],
        `${math(`\\sin A=\\frac{${x}}{${z}}`)}이고 빗변의 길이가 ${math(z + c)}일 때 대변의 길이는?`,
        frac(x * (z + c), z), [x, z, x + c, z + c],
        `사인값의 비례식을 세운다.`);
    }
    if (mode === 2) {
      return q(ctx, '삼각비 복합 계산', ['sin', 'cos'],
        `${math(`\\sin A=\\frac{${x}}{${z}}`)}, ${math(`\\cos A=\\frac{${y}}{${z}}`)}일 때 ${math(`\\frac{\\sin A}{\\cos A}`)}의 값은?`,
        frac(x, y), [frac(y, x), frac(x, z), frac(y, z), frac(z, y)],
        `사인값을 코사인값으로 나누면 탄젠트값이 된다.`);
    }
    if (mode === 3) {
      return q(ctx, '대표 도형 길이', ['tan', '길이'],
        `그림자 길이가 ${math(y)}m이고 태양의 고도에 대한 탄젠트값이 ${math(`\\frac{${x}}{${y}}`)}일 때 물체의 높이는?`,
        x, [y, z, x + 1, Math.max(1, x - 1)],
        `높이와 그림자 길이의 비가 탄젠트값이다.`);
    }
    return q(ctx, '삼각비 길이 구하기', ['tan', '비례식'],
      `${math(`\\tan A=\\frac{${x}}{${y}}`)}이고 이웃한 변의 길이가 ${math(y + b)}일 때 대변의 길이는?`,
      frac(x * (y + b), y), [x, y, x + b, y + b],
      `탄젠트의 비례식을 세워 대변의 길이를 구한다.`);
  }
  if (ctx.difficulty === '심화') {
    if (mode === 1) {
      const answer = x * y;
      return q(ctx, '삼각형 넓이 모델링', ['삼각비', '넓이'],
        `두 변의 길이가 ${math(x)}, ${math(y)}이고 끼인각의 사인값이 ${math(`\\frac{2}{${z}}`)}인 삼각형의 넓이는?`,
        frac(answer, z), [frac(answer, 2 * z), frac(answer + 1, z), x + y, z],
        `삼각형의 넓이 ${math('\\frac12 ab\\sin C')}를 이용한다.`);
    }
    if (mode === 2) {
      return q(ctx, '삼각비 식 해석', ['sin', 'cos', '식 변형'],
        `${math(`\\sin A=\\frac{${x}}{${z}}`)}, ${math(`\\cos A=\\frac{${y}}{${z}}`)}일 때 ${math(`${z}(\\sin A-\\cos A)`)}의 값은?`,
        x - y, [x + y, y - x, z, x],
        `같은 분모의 두 삼각비를 빼고 ${math(z)}를 곱한다.`);
    }
    if (mode === 3) {
      const answer = frac(x * x + y * y, z * z);
      return q(ctx, '삼각비 제곱합 확인', ['sin', 'cos', '항등식'],
        `${math(`\\sin A=\\frac{${x}}{${z}}`)}, ${math(`\\cos A=\\frac{${y}}{${z}}`)}일 때 ${math('\\sin^2 A+\\cos^2 A')}의 값은?`,
        answer, ['1', frac(x + y, z), frac(x * y, z * z), frac(x * x - y * y, z * z)],
        `직각삼각형의 삼각비는 ${math('\\sin^2 A+\\cos^2 A=1')}을 만족한다.`);
    }
    const answer = x + y;
    return q(ctx, '삼각비 복합식', ['sin', 'cos', '복합 계산'],
      `${math(`\\sin A=\\frac{${x}}{${z}}`)}, ${math(`\\cos A=\\frac{${y}}{${z}}`)}일 때 ${math(`${z}(\\sin A+\\cos A)`)}의 값은?`,
      answer, [x, y, z, answer + 1],
      `분모가 모두 ${math(z)}이므로 곱하면 ${math(`${x}+${y}`)}만 남는다.`);
  }
  const shadow = b;
  if (mode === 1) {
    const answer = x + b;
    return q(ctx, '최단거리 모델링', ['삼각비', '모델링', '최적화'],
      `두 직선 도로가 직각으로 만나고, 한 지점에서 한 도로까지의 거리가 ${math(x)}m, 다른 도로까지의 거리가 ${math(b)}m이다. 두 도로를 한 번씩 거쳐 돌아오는 최단 경로의 기본 길이는?`,
      answer, [answer - 2, answer + 2, x * b, z],
      `반사 아이디어로 두 거리 성분을 더해 비교하는 모델이다.`);
  }
  if (mode === 2) {
    const answer = frac(x * y, z);
    return q(ctx, '투영 길이 역추론', ['삼각비', '투영'],
      `길이가 ${math(y)}인 선분이 한 직선과 이루는 각의 사인값이 ${math(`\\frac{${x}}{${z}}`)}일 때, 그 직선에 수직인 방향의 성분 길이는?`,
      answer, [x, y, z, frac(y * z, x * 2)],
      `수직 성분은 전체 길이에 사인값을 곱한다.`);
  }
  if (mode === 3) {
    return q(ctx, '높이 조건 역추론', ['tan', '역추론', '상황 모델링'],
      `탑의 전체 높이가 ${math(x + shadow)}m이고 관찰자의 눈높이가 ${math(shadow)}m이다. 탑까지의 수평거리가 ${math(y)}m일 때 올려본 각의 탄젠트값은?`,
      frac(x, y), [frac(y, x), frac(x + shadow, y), frac(x, z), frac(shadow, y)],
      `눈높이를 제외한 높이와 수평거리의 비가 탄젠트값이다.`);
  }
  const distance = y;
  const height = frac(x * distance, y);
  const total = Number(height) || x + c;
  return q(ctx, '높이와 거리 복합 추론', ['tan', '상황 모델링', '비례식'],
    `기울어진 지점에서 탑까지의 수평거리가 ${math(distance)}m이고 올려본 각의 탄젠트가 ${math(`\\frac{${x}}{${y}}`)}이다. 눈높이 ${math(shadow)}m를 더한 탑의 전체 높이는?`,
    Number(height) ? total + shadow : `${height}+${shadow}`, [x + shadow, y + shadow, distance, total],
    `탄젠트로 눈높이 위의 높이를 구한 뒤 눈높이를 더한다.`);
}

function circleQuestion(ctx) {
  let { a, b, c, d } = nums(ctx);
  const offset = ctx.seed % 19;
  a = 3 + ((ctx.id + offset) % 40);
  b = 2 + ((Math.floor(ctx.id / 3) + offset) % 40);
  c = 2 + ((Math.floor(ctx.id / 5) + ctx.round + offset) % 12);
  d = 2 + ((Math.floor(ctx.id / 7) + ctx.variant.variantNo + offset) % 12);
  if (ctx.difficulty === '기본') {
    const angle = 30 + ((ctx.id * 7 + c + ctx.seed) % 70) * 2;
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
    const angle = 30 + ((ctx.id * 7 + d + ctx.seed) % 61) * 2;
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
  let { a, b, c, d } = nums(ctx);
  const offset = ctx.seed % 23;
  a = 3 + ((ctx.id + offset) % 18);
  b = 2 + ((Math.floor(ctx.id / 3) + offset) % 12);
  c = 1 + ((Math.floor(ctx.id / 5) + ctx.round + offset) % 8);
  d = 2 + ((Math.floor(ctx.id / 7) + ctx.variant.variantNo + offset) % 8);
  const mode = variantMode(ctx);
  if (ctx.difficulty === '기본') {
    const data = [a, a + 2, a + 4];
    const answer = a + 2;
    if (mode === 1) {
      return q(ctx, '범위 계산', ['범위', '자료'],
        `자료 ${math(data.join(', '))}의 범위는?`,
        4, [2, 3, 5, a + 4],
        `범위는 최댓값에서 최솟값을 뺀 값이다.`);
    }
    if (mode === 2) {
      return q(ctx, '중앙값 계산', ['중앙값', '자료'],
        `자료 ${math(data.join(', '))}의 중앙값은?`,
        answer, [a, a + 4, answer - 1, answer + 1],
        `크기순으로 놓인 세 자료의 가운데 값이 중앙값이다.`);
    }
    if (mode === 3) {
      return q(ctx, '자료 합 구하기', ['평균', '합'],
        `자료 ${math(data.join(', '))}의 합은?`,
        data.reduce((sum, value) => sum + value, 0), [answer, answer * 2, answer * 3 + 1, a + 4],
        `세 자료를 모두 더한다.`);
    }
    return q(ctx, '평균 계산', ['평균', '자료'],
      `자료 ${math(data.join(', '))}의 평균은?`,
      answer, [answer - 2, answer - 1, answer + 1, answer + 2],
      `세 수의 합을 ${math(3)}으로 나누면 ${math(answer)}이다.`);
  }
  if (ctx.difficulty === '유형별') {
    const values = [a, a + c, a + c + d, a + c + d + 2, a + c + d + b];
    const answer = values[2];
    if (mode === 1) {
      const range = values.at(-1) - values[0];
      return q(ctx, '범위와 중앙값', ['범위', '중앙값'],
        `자료 ${math(values.join(', '))}의 범위와 중앙값의 합은?`,
        range + answer, [range, answer, range + answer - 1, range + answer + 1],
        `범위와 중앙값을 각각 구해 더한다.`);
    }
    if (mode === 2) {
      const q1 = values[1];
      const q3 = values[3];
      return q(ctx, '사분위범위', ['사분위수', '자료 해석'],
        `자료 ${math(values.join(', '))}에서 제1사분위수를 ${math('Q_1')}, 제3사분위수를 ${math('Q_3')}라 할 때 ${math('Q_3-Q_1')}은?`,
        q3 - q1, [q1, q3, q3 + q1, q3 - q1 + 1],
        `사분위범위는 ${math('Q_3-Q_1')}이다.`);
    }
    if (mode === 3) {
      const sum = values.reduce((acc, value) => acc + value, 0);
      return q(ctx, '평균과 합', ['평균', '자료 해석'],
        `자료 ${math(values.join(', '))}의 평균을 ${math('m')}이라 할 때 ${math('5m')}의 값은?`,
        sum, [sum - 2, sum + 2, answer * 5, values.at(-1)],
        `${math('5m')}은 자료의 총합과 같다.`);
    }
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
    if (mode === 1) {
      const removed = mean - c;
      const nextMean = frac(mean * n - removed, n - 1);
      return q(ctx, '평균 변화 역산', ['평균', '자료 제거'],
        `평균이 ${math(mean)}인 자료 ${math(n)}개에서 ${math(removed)}를 하나 제거했다. 남은 자료의 평균은?`,
        nextMean, [mean, removed, frac(mean * n - removed + 1, n - 1), frac(mean * n - removed - 1, n - 1)],
        `전체 합에서 제거한 값을 뺀 뒤 남은 개수로 나눈다.`);
    }
    if (mode === 2) {
      const target = mean + 1;
      const need = target * (n + 1) - mean * n;
      return q(ctx, '목표 평균 만들기', ['평균', '역추론'],
        `평균이 ${math(mean)}인 자료 ${math(n)}개에 한 값을 추가하여 평균을 ${math(target)}로 만들려고 한다. 추가해야 할 값은?`,
        need, [need - 2, need - 1, need + 1, mean],
        `목표 총합에서 기존 총합을 뺀다.`);
    }
    if (mode === 3) {
      const changed = mean + c;
      return q(ctx, '자료 변화량 해석', ['평균', '변화량'],
        `자료 ${math(n)}개의 평균이 ${math(mean)}이다. 모든 자료에 ${math(c)}를 더하면 새 평균은?`,
        changed, [mean, mean - c, changed + 1, changed - 1],
        `모든 자료에 같은 값을 더하면 평균도 그만큼 커진다.`);
    }
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
  if (mode === 1) {
    return q(ctx, '상자그림 역추론', ['상자그림', '역추론'],
      `상자그림에서 제1사분위수는 ${math(q1)}, 제3사분위수는 ${math(q3)}이고 사분위범위가 범위의 절반이다. 최솟값이 ${math(min)}일 때 최댓값은?`,
      min + 2 * iqr, [max, min + iqr, min + 2 * iqr - 1, min + 2 * iqr + 1],
      `범위가 사분위범위의 두 배가 되도록 최댓값을 역산한다.`);
  }
  if (mode === 2) {
    const changedMax = max + c;
    return q(ctx, '상자그림 변화 해석', ['상자그림', '변화량'],
      `상자그림에서 최솟값 ${math(min)}, 제1사분위수 ${math(q1)}, 제3사분위수 ${math(q3)}, 최댓값 ${math(max)}이다. 최댓값만 ${math(c)}만큼 커지면 범위와 사분위범위의 차는?`,
      changedMax - min - iqr, [answer, answer + c - 1, answer + c + 1, range],
      `최댓값이 커지면 범위만 변하고 사분위범위는 그대로이다.`);
  }
  if (mode === 3) {
    return q(ctx, '조건 비교', ['상자그림', '조건 비교'],
      `상자그림에서 범위는 ${math(range)}, 사분위범위는 ${math(iqr)}이다. 범위가 사분위범위의 몇 배보다 큰지 비교할 때 ${math('범위-2×사분위범위')}의 값은?`,
      range - 2 * iqr, [range - iqr, range + iqr, 2 * iqr - range, answer],
      `범위와 사분위범위를 식으로 비교한다.`);
  }
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

const generatedQuestionTexts = new Set();

function stripQuestionEnding(question) {
  let text = String(question ?? '').replace(/\s+/g, ' ').trim();
  for (const ending of QUESTION_ENDINGS.filter(Boolean)) {
    if (text.endsWith(ending)) {
      text = text.slice(0, -ending.length).trim();
      break;
    }
  }
  return text;
}

function normalizeGeneratedQuestion(question) {
  return stripQuestionEnding(question);
}

function buildExam(file) {
  const filePath = path.join(mathDir, file);
  const current = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const profile = DIFFICULTY_PROFILE[current.difficulty];
  const family = familyFor(current.id);
  const generator = GENERATORS[family] ?? algebraQuestion;
  const core = titleCore(current.title);
  const seed = hashText(`${current.id}:${current.grade}:${current.unit}:${current.difficulty}`);
  const answerSlots = answerSlotsForExam(seed, 30);

  const localQuestionTexts = new Set();
  const questions = Array.from({ length: 30 }, (_, index) => {
    const variant = TYPE_VARIANTS[index % TYPE_VARIANTS.length];

    for (let attempt = 0; attempt < 50; attempt += 1) {
      const attemptSeed = seed + attempt * 104729;
      const ctx = {
        id: attemptSeed + index + 1 + variant.variantNo * 37 + Math.floor(index / TYPE_VARIANTS.length) * 101,
        displayId: index + 1,
        answerSlot: answerSlots[index],
        difficulty: current.difficulty,
        family,
        unit: current.unit,
        examCore: core,
        variant,
        round: Math.floor(index / TYPE_VARIANTS.length),
        seed: attemptSeed,
      };
      const candidate = generator(ctx);
      const key = normalizeGeneratedQuestion(candidate.question);
      if (!generatedQuestionTexts.has(key) && !localQuestionTexts.has(key)) {
        generatedQuestionTexts.add(key);
        localQuestionTexts.add(key);
        return candidate;
      }
    }

    throw new Error(`Unable to generate a unique question for ${current.id} Q${index + 1}`);
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
