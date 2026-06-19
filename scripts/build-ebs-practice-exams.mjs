import fs from 'node:fs';
import path from 'node:path';

const mathDir = path.join(process.cwd(), 'src', 'data', 'math');

const DIFFICULTY_PROFILE = {
  '기본': {
    role: '개념 확인',
    steps: 1,
    description: 'EBS 개념 확인형: 핵심 정의와 공식 1개를 바로 적용합니다.',
  },
  '유형별': {
    role: '대표 유형',
    steps: 2,
    description: 'EBS 대표 유형형: 자주 출제되는 풀이 틀을 숫자와 조건을 바꾸어 적용합니다.',
  },
  '심화': {
    role: '조건 결합',
    steps: 4,
    description: 'EBS 심화형: 두 개 이상의 조건을 연결하고 중간값을 해석합니다.',
  },
  '킬러': {
    role: '고난도 추론',
    steps: 6,
    description: 'EBS 킬러형: 매개변수, 숨은 조건, 역추론을 함께 사용합니다.',
  },
};

const TYPE_VARIANTS = [
  {
    id: 1,
    label: '핵심 계산',
    skill: '핵심 계산',
    stem: '',
    explanation: '',
  },
  {
    id: 2,
    label: '조건 해석',
    skill: '조건 해석',
    stem: '조건을 식으로 옮기는 과정을 먼저 생각하시오. ',
    explanation: '조건을 수식으로 정리한 뒤 계산한다. ',
  },
  {
    id: 3,
    label: '역추론',
    skill: '역추론',
    stem: '구하려는 값을 거꾸로 추적하여 해결하시오. ',
    explanation: '목표값에서 필요한 중간 조건을 거꾸로 확인한다. ',
  },
  {
    id: 4,
    label: '보기 판별',
    skill: '보기 판별',
    stem: '보기 중 조건을 만족하는 값을 고르시오. ',
    explanation: '각 보기의 의미를 조건과 대조하면 정답을 고를 수 있다. ',
  },
  {
    id: 5,
    label: '실전 적용',
    skill: '실전 적용',
    stem: '실전 문항처럼 필요한 개념을 연결하여 해결하시오. ',
    explanation: '핵심 개념을 적용한 뒤 계산 결과를 확인한다. ',
  },
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

function gcd(a, b) {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) [a, b] = [b, a % b];
  return a;
}

function lcm(a, b) {
  return Math.abs(a * b) / gcd(a, b);
}

function removeFactors(value, factors) {
  let result = value;
  for (const factor of factors) {
    while (result % factor === 0) result /= factor;
  }
  return result;
}

function squareFreePart(value) {
  let result = value;
  for (let factor = 2; factor * factor <= result; factor += 1) {
    while (result % (factor * factor) === 0) {
      result /= factor * factor;
    }
  }
  return result;
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

function math(value) {
  return `$${value}$`;
}

function signed(value) {
  return value >= 0 ? `+${value}` : `${value}`;
}

function linearExpr(m, b) {
  const xTerm = m === 1 ? 'x' : `${m}x`;
  return `${xTerm}${signed(b)}`;
}

function textChoice(value) {
  if (/[가-힣]/.test(value)) return value;
  return value.includes('$') ? value : math(value);
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
  const clean = unique([correct, ...distractors]).slice(0, 5);
  const numericCorrect = Number(correct);
  let pad = 1;
  while (clean.length < 5) {
    const candidate = Number.isFinite(numericCorrect)
      ? String(numericCorrect + pad)
      : `${correct}${pad}`;
    if (!clean.includes(candidate)) clean.push(candidate);
    pad += 1;
  }

  const answer = [0, 2, 4, 1, 3][(id - 1) % 5];
  const choices = clean.filter(value => value !== String(correct)).slice(0, 4);
  choices.splice(answer, 0, String(correct));
  return { choices: choices.map(textChoice), answer };
}

function q(id, difficulty, typeTag, skills, question, correct, distractors, explanation) {
  const { choices, answer } = makeChoices(String(correct), distractors.map(String), id);
  const profile = DIFFICULTY_PROFILE[difficulty];
  return {
    id,
    question,
    choices,
    answer,
    explanation,
    ebs: {
      role: profile.role,
      steps: profile.steps,
      typeTag,
      skills,
    },
  };
}

function familyFor(id) {
  return FILE_FAMILIES.find(([pattern]) => pattern.test(id))?.[1] ?? 'algebra';
}

function hashText(text) {
  let hash = 0;
  for (const char of text) {
    hash = (hash * 31 + char.charCodeAt(0)) % 9973;
  }
  return hash;
}

function titleCore(title) {
  return title.split('—')[0].trim();
}

function decorateQuestion(question, core, role, typeTag, index) {
  const variantNo = String(index + 1).padStart(2, '0');
  return `EBS ${core} ${role} · ${typeTag} ${variantNo}형. ${question}`;
}

function cleanDescription(description = '') {
  let cleaned = description;
  for (const profile of Object.values(DIFFICULTY_PROFILE)) {
    cleaned = cleaned.split(profile.description).join('');
  }

  return cleaned
    .replace(/\s+/g, ' ')
    .trim();
}

function applyTypeVariant(question, variant) {
  return {
    ...question,
    question: `${variant.stem}${question.question}`,
    explanation: `${variant.explanation}${question.explanation}`,
    ebs: {
      ...question.ebs,
      typeTag: `${question.ebs.typeTag} · ${variant.label}`,
      typeVariant: variant.label,
      typeVariantId: variant.id,
      skills: unique([...question.ebs.skills, variant.skill]),
    },
  };
}

function factorizationQuestion(id, difficulty) {
  if (difficulty === '기본') {
    const twos = id % 3 + 1;
    const threes = id % 2 + 1;
    const extra = [5, 7, 11, 13][id % 4];
    const n = 2 ** twos * 3 ** threes * extra;
    const answer = twos + threes;
    return q(id, difficulty, '소인수분해 지수 확인', ['소인수분해', '지수'],
      `${math(n)}을 소인수분해했을 때, 소인수 ${math(2)}의 지수와 소인수 ${math(3)}의 지수의 합은?`,
      answer, [answer - 2, answer - 1, answer + 1, answer + 2],
      `${math(n)}=${math(`2^{${twos}}\\times3^{${threes}}\\times${extra}`)}이므로 두 지수의 합은 ${math(`${twos}+${threes}=${answer}`)}이다.`);
  }

  if (difficulty === '유형별') {
    const a = 18 + id * 2;
    const b = 24 + id * 3;
    const g = gcd(a, b);
    const l = lcm(a, b);
    const answer = g + l / g;
    return q(id, difficulty, '최대공약수와 최소공배수', ['최대공약수', '최소공배수'],
      `${math(a)}와 ${math(b)}의 최대공약수를 ${math('G')}, 최소공배수를 ${math('L')}이라 할 때, ${math('G+\\frac{L}{G}')}의 값은?`,
      answer, [answer - g, answer + g, l, g],
      `${math(`G=${g}`)}, ${math(`L=${l}`)}이므로 ${math(`G+\\frac{L}{G}=${g}+${l / g}=${answer}`)}이다.`);
  }

  if (difficulty === '심화') {
    const a = id % 4 + 1;
    const b = id % 3 + 2;
    const n = 2 ** a * 3 ** b * 5;
    const need = (a % 2 ? 2 : 1) * (b % 2 ? 3 : 1) * 5;
    return q(id, difficulty, '제곱수 조건 만들기', ['소인수분해', '제곱수 조건'],
      `${math(n)}에 자연수 ${math('m')}을 곱해 완전제곱수가 되게 하려고 한다. 가장 작은 ${math('m')}의 값은?`,
      need, [need * 2, need * 3, Math.max(1, need / 5), need + 2],
      `완전제곱수는 모든 소인수의 지수가 짝수이다. ${math(n)}의 부족한 지수를 보충하면 ${math(`m=${need}`)}이 최소이다.`);
  }

  const a = id % 5 + 2;
  const b = id % 4 + 2;
  const n = 2 ** a * 3 ** b;
  const answer = (a + 1) * Math.floor((b + 2) / 2);
  return q(id, difficulty, '약수 개수 추론', ['약수', '짝수 조건', '경우의 수'],
    `${math(n)}의 양의 약수 중 ${math(9)}의 배수인 약수의 개수는?`,
    answer, [answer - 2, answer - 1, answer + 2, (a + 1) * (b + 1)],
    `${math(n)}=${math(`2^{${a}}\\times3^{${b}}`)}이다. ${math(9)}의 배수이려면 ${math(3)}의 지수가 ${math(2)} 이상이어야 하므로 경우의 수는 ${math(`(${a}+1)\\times(${b}-2+1)=${answer}`)}이다.`);
}

function rationalQuestion(id, difficulty) {
  if (difficulty === '기본') {
    const d = [8, 20, 25, 40, 50][id % 5];
    const n = id % (d - 1) + 1;
    const terminates = (() => {
      let reduced = d / gcd(n, d);
      while (reduced % 2 === 0) reduced /= 2;
      while (reduced % 5 === 0) reduced /= 5;
      return reduced === 1;
    })();
    const answer = terminates ? '유한소수' : '순환소수';
    return q(id, difficulty, '유한소수 판별', ['기약분수', '소인수'],
      `기약분수로 나타낸 ${math(`\\frac{${n}}{${d}}`)}는 어떤 소수인가?`,
      answer, ['무한소수이지만 순환하지 않음', '자연수', '정수', '판별할 수 없음'],
      `분모를 기약분수로 만든 뒤 소인수가 ${math(2)}와 ${math(5)}뿐이면 유한소수이다. 따라서 ${answer}이다.`);
  }

  if (difficulty === '유형별') {
    const a = id % 7 + 1;
    const b = id % 3 + 2;
    const num = 9 * a + b;
    const answer = frac(num, 90);
    return q(id, difficulty, '순환소수 분수화', ['순환소수', '분수 변환'],
      `순환소수 ${math(`0.${a}\\dot{${b}}`)}를 기약분수로 나타내면?`,
      answer, [frac(num + 1, 90), frac(num, 99), frac(num - 1, 90), frac(num, 900)],
      `${math(`0.${a}\\dot{${b}}=\\frac{${a}${b}-${a}}{90}=\\frac{${num}}{90}=${answer}`)}이다.`);
  }

  if (difficulty === '심화') {
    const base = [12, 18, 28, 42, 44][id % 5] + 5 * Math.floor(id / 5);
    const need = removeFactors(base, [2, 5]);
    return q(id, difficulty, '유한소수 조건', ['분모 소인수', '배수 조건'],
      `분수 ${math(`\\frac{x}{${base}}`)}가 유한소수가 되도록 하는 가장 작은 자연수 ${math('x')}는?`,
      need, [need + 1, need + 2, Math.max(1, need - 1), base],
      `${math(base)}의 소인수 중 ${math(2)}, ${math(5)}가 아닌 부분을 약분해야 한다. 그 부분을 포함하는 가장 작은 ${math('x')}는 ${math(need)}이다.`);
  }

  const p = id % 6 + 2;
  const qv = id % 5 + 3;
  const num = p * 99 + qv * 9;
  const answer = frac(num, 990);
  return q(id, difficulty, '복합 순환소수 역추론', ['순환소수', '자리값', '기약분수'],
    `순환소수 ${math(`0.${p}\\dot{${qv}}\\dot{${p}}`)}를 기약분수로 나타내면?`,
    answer, [frac(num + 9, 990), frac(num, 999), frac(num - 9, 990), frac(num, 99)],
    `순환마디가 ${math(`${qv}${p}`)}이고 순환하지 않는 자리가 1개이므로 ${math(`\\frac{${p}${qv}${p}-${p}}{990}=\\frac{${num}}{990}=${answer}`)}이다.`);
}

function algebraQuestion(id, difficulty) {
  if (difficulty === '기본') {
    const a = id % 5 + 2;
    const b = id % 4 + 1;
    const answer = a * b;
    return q(id, difficulty, '단항식 곱셈', ['계수', '지수법칙'],
      `${math(`${a}x^2y`)}와 ${math(`${b}xy^3`)}를 곱했을 때 ${math('x^3y^4')}의 계수는?`,
      answer, [answer - a, answer + a, a + b, a * b + 2],
      `계수는 ${math(`${a}\\times${b}=${answer}`)}이고 문자는 ${math('x^3y^4')}가 된다.`);
  }

  if (difficulty === '유형별') {
    const a = id % 5 + 1;
    const b = id % 6 + 2;
    const c = id % 4 + 1;
    const answer = a * c + b;
    return q(id, difficulty, '전개 후 계수 구하기', ['분배법칙', '동류항'],
      `${math(`(${a}x+${b})(${c}x+1)`)}을 전개했을 때 ${math('x')}의 계수는?`,
      answer, [answer - 2, answer + 2, a * c, b * c],
      `${math('x')}항은 ${math(`${a}x\\cdot1`)}과 ${math(`${b}\\cdot${c}x`)}에서 나오므로 계수는 ${math(`${a}+${b * c}=${answer}`)}이다.`);
  }

  if (difficulty === '심화') {
    const a = id % 4 + 2;
    const b = id % 5 + 1;
    const answer = 2 * (a + b);
    return q(id, difficulty, '항등식 계수 비교', ['전개', '계수 비교'],
      `${math(`(x+${a})^2-(x-${b})^2`)}을 간단히 했을 때 ${math('x')}의 계수는?`,
      answer, [answer - 2, answer + 2, 2 * (a + b), a - b],
      `차의 제곱을 전개하면 ${math(`2(${a}+${b})x+${a * a - b * b}`)}가 된다. 따라서 ${math('x')}의 계수는 ${math(2 * (a + b))}이다.`);
  }

  const a = id % 9 + 2;
  const b = (id * 2) % 7 + 1;
  const answer = a * a + 2 * a * b;
  return q(id, difficulty, '식 변형과 대입', ['완전제곱식', '역추론'],
    `${math('x+y=')}${math(a + b)}, ${math('x-y=')}${math(a - b)}일 때, ${math('x^2+2xy')}의 값은?`,
    answer, [answer - a, answer + b, (a + b) ** 2, a * b],
    `두 식을 더하면 ${math(`2x=${2 * a}`)}이므로 ${math(`x=${a}`)}, ${math(`y=${b}`)}이다. 따라서 ${math(`x^2+2xy=${a * a}+${2 * a * b}=${answer}`)}이다.`);
}

function inequalityQuestion(id, difficulty) {
  if (difficulty === '기본') {
    const a = id % 6 + 2;
    const b = id % 5 + 1;
    const answer = a + b;
    return q(id, difficulty, '일차부등식 기본 풀이', ['이항', '부등식'],
      `부등식 ${math(`x-${a}>${b}`)}를 만족하는 가장 작은 정수 ${math('x')}는?`,
      answer + 1, [answer - 1, answer, answer + 2, answer + 3],
      `${math(`x>${a + b}`)}이므로 가장 작은 정수는 ${math(answer + 1)}이다.`);
  }

  if (difficulty === '유형별') {
    const a = id % 4 + 2;
    const b = id % 5 + 3;
    const c = a * (id % 4 + 2) + b;
    const bound = (c - b) / a;
    return q(id, difficulty, '계수 있는 부등식', ['부등식 풀이', '정수해'],
      `${math(`${a}x+${b}\\le ${c}`)}을 만족하는 자연수 ${math('x')}의 개수는?`,
      bound, [bound - 1, bound + 1, bound + 2, Math.max(0, bound - 2)],
      `${math(`${a}x\\le ${c - b}`)}이므로 ${math(`x\\le ${bound}`)}이다. 자연수 해는 ${math(`1,2,\\cdots,${bound}`)}로 ${math(bound)}개이다.`);
  }

  if (difficulty === '심화') {
    const a = id % 5 + 2;
    const lower = id % 4 + 1;
    const upper = lower + a;
    const answer = upper - lower + 1;
    return q(id, difficulty, '연립부등식 정수해', ['연립부등식', '정수 범위'],
      `연립부등식 ${math(`${lower - 1}<x\\le ${upper}`)}를 만족하는 정수 ${math('x')}의 개수는?`,
      answer, [answer - 2, answer - 1, answer + 1, answer + 2],
      `정수 ${math('x')}는 ${math(`${lower},${lower + 1},\\cdots,${upper}`)}이므로 개수는 ${math(answer)}개이다.`);
  }

  const a = id % 4 + 2;
  const k = id % 5 + 3;
  const answer = a * k - 1;
  return q(id, difficulty, '매개변수 부등식 추론', ['매개변수', '최대 정수해'],
    `부등식 ${math(`\\frac{x+1}{${a}}<${k}`)}를 만족하는 가장 큰 정수 ${math('x')}는?`,
    answer, [answer - 2, answer - 1, answer + 1, answer + 2],
    `${math(`x+1<${a * k}`)}이므로 ${math(`x<${a * k - 1}`)}이다. 가장 큰 정수는 ${math(answer)}이다.`);
}

function linearQuestion(id, difficulty) {
  if (difficulty === '기본') {
    const m = id % 5 + 1;
    const b = id % 7 - 3;
    const x = id % 4 + 1;
    const answer = m * x + b;
    return q(id, difficulty, '일차함수 값 구하기', ['기울기', '대입'],
      `일차함수 ${math(`y=${linearExpr(m, b)}`)}에서 ${math(`x=${x}`)}일 때 ${math('y')}의 값은?`,
      answer, [answer - m, answer + m, answer - 1, answer + 1],
      `${math(`y=${m}\\times${x}${signed(b)}=${answer}`)}이다.`);
  }

  if (difficulty === '유형별') {
    const x1 = id % 3;
    const y1 = id % 5 + 1;
    const m = id % 4 + 1;
    const x2 = x1 + 2;
    const y2 = y1 + 2 * m;
    const b = y1 - m * x1;
    return q(id, difficulty, '두 점을 지나는 직선', ['기울기', '직선의 식'],
      `두 점 ${math(`(${x1},${y1})`)}, ${math(`(${x2},${y2})`)}를 지나는 직선의 ${math('y')}절편은?`,
      b, [b - 2, b - 1, b + 1, b + 2],
      `기울기는 ${math(`\\frac{${y2}-${y1}}{${x2}-${x1}}=${m}`)}이다. ${math(`y=${m}x+b`)}에 ${math(`(${x1},${y1})`)}를 대입하면 ${math(`b=${b}`)}이다.`);
  }

  if (difficulty === '심화') {
    const a = id % 5 + 2;
    const b = id % 4 + 3;
    return q(id, difficulty, '절편과 넓이', ['절편', '삼각형 넓이'],
      `${math(`\\frac{x}{${a}}+\\frac{y}{${b}}=1`)}의 그래프와 두 좌표축으로 둘러싸인 삼각형의 넓이는?`,
      frac(a * b, 2), [frac(a + b, 2), a * b, frac(a * b + 2, 2), Math.abs(a - b)],
      `${math('x')}절편은 ${math(a)}, ${math('y')}절편은 ${math(b)}이므로 넓이는 ${math(`\\frac12\\times${a}\\times${b}=${frac(a * b, 2)}`)}이다.`);
  }

  const a = id % 5 + 2;
  const b = id % 4 + 1;
  const x = -b;
  const y = a * x + 1;
  return q(id, difficulty, '항상 지나는 점', ['매개변수', '불변 조건'],
    `직선 ${math(`y=k(x+${b})+${a}x+1`)}은 ${math('k')}의 값에 관계없이 항상 한 점을 지난다. 그 점의 ${math('x+y')}의 값은?`,
    x + y, [x + y - 2, x + y - 1, x + y + 1, x + y + 2],
    `${math('k')}의 영향을 없애려면 ${math(`x+${b}=0`)}, 즉 ${math(`x=${x}`)}이다. 이때 ${math(`y=${a}(${x})+1=${y}`)}이므로 ${math(`x+y=${x + y}`)}이다.`);
}

function radicalQuestion(id, difficulty) {
  if (difficulty === '기본') {
    const a = id % 6 + 2;
    const b = [2, 3, 5, 6, 7][id % 5];
    return q(id, difficulty, '제곱근 간단히 하기', ['제곱근', '근호 밖으로 빼기'],
      `${math(`\\sqrt{${a * a * b}}`)}을 간단히 하면?`,
      `${a}\\sqrt{${b}}`, [`${a + 1}\\sqrt{${b}}`, `${a}\\sqrt{${b + 1}}`, `${a * b}`, `\\sqrt{${a * b}}`],
      `${math(`${a * a * b}=${a}^2\\times${b}`)}이므로 ${math(`\\sqrt{${a * a * b}}=${a}\\sqrt{${b}}`)}이다.`);
  }

  if (difficulty === '유형별') {
    const a = id % 4 + 2;
    const b = id % 3 + 1;
    const c = [2, 3, 5][id % 3];
    const answer = a + b;
    return q(id, difficulty, '동류근호 계산', ['근호', '동류항'],
      `${math(`${a}\\sqrt{${c}}+${b}\\sqrt{${c}}`)}를 간단히 하면 ${math(`A\\sqrt{${c}}`)}이다. ${math('A')}의 값은?`,
      answer, [answer - 2, answer - 1, answer + 1, answer + 2],
      `같은 근호끼리 계수를 더하면 ${math(`(${a}+${b})\\sqrt{${c}}=${answer}\\sqrt{${c}}`)}이다.`);
  }

  if (difficulty === '심화') {
    const a = id % 5 + 2;
    const b = id % 4 + 1;
    const answer = a * a - b;
    return q(id, difficulty, '근호식 전개', ['제곱근', '곱셈공식'],
      `${math(`(\\sqrt{${a * a}}+\\sqrt{${b}})(\\sqrt{${a * a}}-\\sqrt{${b}})`)}의 값은?`,
      answer, [answer - 2, answer - 1, answer + 1, answer + 2],
      `합차공식으로 ${math(`${a * a}-${b}=${answer}`)}이다.`);
  }

  const squareFree = [2, 3, 5, 6, 7, 10][id % 6];
  const scale = Math.floor(id / 6) + 1;
  const radicand = squareFree * scale * scale;
  const answer = squareFreePart(radicand);
  return q(id, difficulty, '제곱근 조건 역추론', ['제곱근', '자연수 조건'],
    `${math(`\\sqrt{${radicand}n}`)}이 자연수가 되도록 하는 가장 작은 자연수 ${math('n')}의 값은?`,
    answer, [answer * 2, answer * 3, answer * answer, answer + scale],
    `${math(radicand)}의 제곱인수를 제거하면 남는 부분은 ${math(answer)}이다. 따라서 최소 ${math(`n=${answer}`)}를 곱하면 근호 안이 완전제곱수가 된다.`);
}

function quadraticEquationQuestion(id, difficulty) {
  if (difficulty === '기본') {
    const r1 = id % 5 + 1;
    const r2 = r1 + (id % 3 + 1);
    return q(id, difficulty, '인수분해로 이차방정식 풀기', ['이차방정식', '인수분해'],
      `${math(`(x-${r1})(x-${r2})=0`)}의 두 근의 합은?`,
      r1 + r2, [r1 + r2 - 2, r1 + r2 - 1, r1 * r2, Math.abs(r2 - r1)],
      `두 근은 ${math(r1)}, ${math(r2)}이므로 합은 ${math(r1 + r2)}이다.`);
  }

  if (difficulty === '유형별') {
    const s = id % 6 + 3;
    const p = id % 5 + 2;
    return q(id, difficulty, '근과 계수의 관계', ['근의 합', '근의 곱'],
      `이차방정식 ${math(`x^2-${s}x+${p}=0`)}의 두 근을 ${math('\\alpha,\\beta')}라 할 때 ${math('\\alpha+\\beta')}의 값은?`,
      s, [s - 2, s - 1, p, s + 1],
      `근과 계수의 관계에서 두 근의 합은 ${math(s)}이다.`);
  }

  if (difficulty === '심화') {
    const r = id % 5 + 1;
    const k = r * r + (id % 4 + 1);
    return q(id, difficulty, '중근 조건', ['판별식', '매개변수'],
      `${math(`x^2-${2 * r}x+k=0`)}이 중근을 갖도록 하는 ${math('k')}의 값은?`,
      r * r, [k, r * r - 1, r * r + 1, 2 * r],
      `중근이면 ${math(`D=0`)}이고 ${math(`k=(${2 * r}/2)^2=${r * r}`)}이다.`);
  }

  const a = id % 4 + 2;
  const b = id % 5 + 1;
  const answer = a + b;
  return q(id, difficulty, '공통근 추론', ['공통근', '매개변수'],
    `두 방정식 ${math(`x^2-${a + b}x+${a * b}=0`)}, ${math(`x^2-px+${a * b}=0`)}이 두 근을 모두 공유할 때 ${math('p')}의 값은?`,
    answer, [answer - 2, answer - 1, answer + 1, answer + 2],
    `첫 방정식의 두 근은 ${math(a)}, ${math(b)}이다. 두 근을 모두 공유하려면 두 번째 방정식의 근의 합도 ${math(`${a}+${b}=${answer}`)}이어야 한다.`);
}

function quadraticFunctionQuestion(id, difficulty) {
  if (difficulty === '기본') {
    const a = id % 4 + 1;
    const h = id % 5 + 1;
    const k = id % 6 + 1;
    return q(id, difficulty, '꼭짓점 읽기', ['이차함수', '꼭짓점'],
      `이차함수 ${math(`y=${a}(x-${h})^2${signed(k)}`)}의 꼭짓점의 ${math('x')}좌표는?`,
      h, [h - 2, h - 1, h + 1, k],
      `꼭짓점은 ${math(`(${h},${k})`)}이므로 ${math('x')}좌표는 ${math(h)}이다.`);
  }

  if (difficulty === '유형별') {
    const a = id % 3 + 1;
    const h = id % 4;
    const x = h + 2;
    const y = a * (x - h) ** 2;
    return q(id, difficulty, '대칭축과 함수값', ['대칭축', '대입'],
      `이차함수 ${math(`y=${a}(x-${h})^2`)}에서 ${math(`x=${x}`)}일 때 ${math('y')}의 값은?`,
      y, [y - a, y + a, y + 2 * a, Math.max(0, y - 2 * a)],
      `${math(`y=${a}(${x}-${h})^2=${y}`)}이다.`);
  }

  if (difficulty === '심화') {
    const h = id % 5 + 1;
    const k = id % 4 + 1;
    const x = h + 3;
    const y = (x - h) ** 2 + k;
    return q(id, difficulty, '꼭짓점형 역추론', ['꼭짓점형', '계수 결정'],
      `꼭짓점이 ${math(`(${h},${k})`)}이고 점 ${math(`(${x},${y})`)}을 지나는 이차함수 ${math(`y=a(x-${h})^2${signed(k)}`)}에서 ${math('a')}의 값은?`,
      1, [2, 3, -1, 4],
      `점의 좌표를 대입하면 ${math(`${y}=a\\cdot${(x - h) ** 2}+${k}`)}이므로 ${math('a=1')}이다.`);
  }

  const h = id % 4 + 1;
  const k = id % 5 + 1;
  const answer = k;
  return q(id, difficulty, '최솟값과 조건 추론', ['최솟값', '범위'],
    `이차함수 ${math(`y=2(x-${h})^2+${k}`)}의 그래프에서 ${math('x')}가 모든 실수일 때 가능한 ${math('y')}의 최솟값은?`,
    answer, [answer - 2, answer - 1, answer + 1, answer + 2],
    `제곱항은 항상 ${math('0')} 이상이고 ${math(`x=${h}`)}에서 ${math('0')}이 된다. 따라서 최솟값은 ${math(k)}이다.`);
}

function trigonometryQuestion(id, difficulty) {
  const triples = [[3, 4, 5], [5, 12, 13], [8, 15, 17], [7, 24, 25]];
  const scale = Math.floor(id / triples.length) + 1;
  const [ta, tb, tc] = triples[id % triples.length];
  const [a, b, c] = [ta * scale, tb * scale, tc * scale];
  if (difficulty === '기본') {
    return q(id, difficulty, '삼각비 기본', ['직각삼각형', 'sin'],
      `직각삼각형에서 한 예각 ${math('A')}의 대변이 ${math(a)}, 빗변이 ${math(c)}일 때 ${math('\\sin A')}의 값은?`,
      frac(a, c), [frac(b, c), frac(a, b), frac(c, a), frac(c, b)],
      `${math(`\\sin A=\\frac{대변}{빗변}=\\frac{${a}}{${c}}`)}이다.`);
  }
  if (difficulty === '유형별') {
    return q(id, difficulty, '삼각비로 길이 구하기', ['tan', '길이'],
      `직각삼각형에서 ${math(`\\tan A=\\frac{${a}}{${b}}`)}이고 이웃한 변의 길이가 ${math(b * 2)}일 때 대변의 길이는?`,
      a * 2, [a, b, a * 2 + 1, b * 2],
      `${math(`\\frac{대변}{${b * 2}}=\\frac{${a}}{${b}}`)}이므로 대변은 ${math(a * 2)}이다.`);
  }
  if (difficulty === '심화') {
    return q(id, difficulty, '삼각비 복합 계산', ['sin', 'cos', '비례식'],
      `${math(`\\sin A=\\frac{${a}}{${c}}`)}, ${math(`\\cos A=\\frac{${b}}{${c}}`)}일 때 ${math(`c(\\sin A+\\cos A)`)}의 값은?`,
      a + b, [a, b, c, a + b + 1],
      `${math(`c(\\frac{${a}}{${c}}+\\frac{${b}}{${c}})=${a}+${b}=${a + b}`)}이다.`);
  }
  return q(id, difficulty, '높이와 거리 추론', ['tan', '실생활 모델'],
    `어떤 지점에서 탑의 꼭대기를 올려본 각의 탄젠트가 ${math(`\\frac{${a}}{${b}}`)}이고 탑까지의 거리가 ${math(b * 3)}m이다. 탑의 높이는?`,
    a * 3, [a * 2, b * 3, a * 3 + 1, c],
    `${math(`\\frac{높이}{${b * 3}}=\\frac{${a}}{${b}}`)}이므로 높이는 ${math(`${a * 3}`)}m이다.`);
}

function circleQuestion(id, difficulty) {
  if (difficulty === '기본') {
    const angle = 30 + (id % 30) * 4;
    return q(id, difficulty, '원주각', ['중심각', '원주각'],
      `같은 호에 대한 중심각의 크기가 ${math(`${angle}^\\circ`)}일 때 원주각의 크기는?`,
      `${angle / 2}^\\circ`, [`${angle}^\\circ`, `${angle / 2 + 10}^\\circ`, `${angle - 10}^\\circ`, `${90 - angle / 2}^\\circ`],
      `같은 호에 대한 원주각은 중심각의 절반이므로 ${math(`${angle / 2}^\\circ`)}이다.`);
  }
  if (difficulty === '유형별') {
    const a = id + 4;
    return q(id, difficulty, '접선의 길이', ['접선', '외부점'],
      `한 외부점에서 원에 그은 두 접선의 길이 중 하나가 ${math(a)}일 때 다른 접선의 길이는?`,
      a, [a - 2, a - 1, a + 1, a + 2],
      `한 외부점에서 그은 두 접선의 길이는 같으므로 다른 접선도 ${math(a)}이다.`);
  }
  if (difficulty === '심화') {
    const a = 60 + (id % 12) * 5;
    const answer = 180 - a;
    return q(id, difficulty, '원에 내접하는 사각형', ['내접사각형', '대각'],
      `원에 내접하는 사각형에서 한 각의 크기가 ${math(`${a}^\\circ`)}일 때 그 대각의 크기는?`,
      `${answer}^\\circ`, [`${a}^\\circ`, `${answer - 10}^\\circ`, `${answer + 10}^\\circ`, `${90}^\\circ`],
      `원에 내접하는 사각형의 대각의 합은 ${math('180^\\circ')}이므로 ${math(`${180}-${a}=${answer}^\\circ`)}이다.`);
  }
  const x = id + 3;
  const y = x + (id % 4 + 2);
  const answer = x * y;
  return q(id, difficulty, '현의 교차 정리', ['현', '곱의 관계'],
    `원 안에서 두 현이 만나고 한 현의 두 부분이 ${math(x)}, ${math(y)}이다. 다른 현의 한 부분이 ${math(2)}일 때 나머지 부분의 길이는?`,
    frac(answer, 2), [answer, frac(answer + 2, 2), frac(answer - 2, 2), x + y],
    `현의 교차 정리에 의해 ${math(`${x}\\times${y}=2\\times t`)}이므로 ${math(`t=${frac(answer, 2)}`)}이다.`);
}

function statisticsQuestion(id, difficulty) {
  if (difficulty === '기본') {
    const a = id + 2;
    const data = [a, a + 2, a + 4];
    const answer = a + 2;
    return q(id, difficulty, '평균', ['평균'],
      `자료 ${math(`${data.join(', ')}`)}의 평균은?`,
      answer, [answer - 2, answer - 1, answer + 1, answer + 2],
      `평균은 ${math(`\\frac{${data.join('+')}}{3}=${answer}`)}이다.`);
  }
  if (difficulty === '유형별') {
    const q1 = id + 2;
    const q3 = q1 + id % 5 + 4;
    const answer = q3 - q1;
    return q(id, difficulty, '사분위범위', ['상자그림', '사분위수'],
      `어떤 자료의 제1사분위수가 ${math(q1)}, 제3사분위수가 ${math(q3)}일 때 사분위범위는?`,
      answer, [answer - 2, answer - 1, answer + 1, q3 + q1],
      `사분위범위는 ${math(`Q_3-Q_1=${q3}-${q1}=${answer}`)}이다.`);
  }
  if (difficulty === '심화') {
    const mean = id % 5 + 6;
    const n = 5;
    const newValue = mean + id % 4 + 2;
    const newMean = frac(mean * n + newValue, n + 1);
    return q(id, difficulty, '평균 변화', ['평균', '자료 추가'],
      `평균이 ${math(mean)}인 자료 ${math(n)}개에 ${math(newValue)}를 하나 추가했다. 새 평균은?`,
      newMean, [mean, frac(mean * n + newValue + 1, n + 1), frac(mean * n + newValue - 1, n + 1), newValue],
      `기존 합은 ${math(`${mean}\\times${n}=${mean * n}`)}이고 새 합은 ${math(mean * n + newValue)}이다. 새 평균은 ${math(newMean)}이다.`);
  }
  const min = id + 1;
  const q1 = min + 2;
  const q3 = q1 + id % 7 + 4;
  const max = q3 + id % 5 + 3;
  const answer = max - min + q3 - q1;
  return q(id, difficulty, '상자그림 복합 해석', ['범위', '사분위범위', '복합 계산'],
    `상자그림에서 최솟값 ${math(min)}, 제1사분위수 ${math(q1)}, 제3사분위수 ${math(q3)}, 최댓값 ${math(max)}이다. 범위와 사분위범위의 합은?`,
    answer, [answer - 2, answer - 1, answer + 1, max - min],
    `범위는 ${math(`${max}-${min}=${max - min}`)}, 사분위범위는 ${math(`${q3}-${q1}=${q3 - q1}`)}이므로 합은 ${math(answer)}이다.`);
}

function levelOf(difficulty) {
  return { '기본': 0, '유형별': 1, '심화': 2, '킬러': 3 }[difficulty] ?? 0;
}

function familyTypeQuestion(family, id, difficulty, variantId, fallback) {
  if (variantId === 1) return fallback;

  const level = levelOf(difficulty);
  const a = id % 6 + 2 + level;
  const b = id % 5 + 3 + level;
  const c = id % 4 + 1 + level;

  if (family === 'factorization') {
    if (variantId === 2) {
      const p = id % 4 + 2;
      const qv = id % 3 + 1 + level;
      const answer = (p + 1) * (qv + 1);
      return q(id, difficulty, '약수의 개수 판별', ['소인수분해', '약수의 개수'],
        `${math(`2^{${p}}\\times3^{${qv}}`)}의 양의 약수의 개수는?`,
        answer, [answer - 2, answer - 1, answer + 1, answer + 2],
        `약수의 개수는 각 지수에 ${math(1)}을 더해 곱하므로 ${math(`(${p}+1)(${qv}+1)=${answer}`)}이다.`);
    }
    if (variantId === 3) {
      const x = 12 + id + level * 3;
      const y = 18 + id * 2 + level * 5;
      const answer = gcd(x, y);
      return q(id, difficulty, '최대공약수 조건', ['최대공약수', '공약수'],
        `${math(x)}와 ${math(y)}의 공약수 중 가장 큰 수는?`,
        answer, [Math.max(1, answer - 2), answer + 1, answer + 2, x + y],
        `두 수의 공통 소인수를 모으면 최대공약수는 ${math(answer)}이다.`);
    }
    if (variantId === 4) {
      const p = id % 3 + 1 + level;
      const qv = id % 4 + 1;
      const n = 2 ** p * 3 ** qv * 5;
      const answer = (p % 2 ? 2 : 1) * (qv % 2 ? 3 : 1) * 5;
      return q(id, difficulty, '완전제곱수 만들기', ['소인수분해', '제곱수 조건'],
        `${math(n)}에 가장 작은 자연수 ${math('m')}을 곱해 완전제곱수를 만들 때 ${math('m')}은?`,
        answer, [answer * 2, answer + 1, Math.max(1, answer - 1), answer * 3],
        `완전제곱수는 소인수의 지수가 모두 짝수여야 하므로 부족한 지수를 보충하면 ${math(answer)}이다.`);
    }
    const p = id % 4 + 2 + level;
    const qv = id % 3 + 2;
    const answer = p * qv;
    return q(id, difficulty, '최소공배수 활용', ['최소공배수', '배수 조건'],
      `${math(p)}일마다 오는 일정과 ${math(qv)}일마다 오는 일정이 오늘 겹쳤다. 다시 겹치는 가장 빠른 날은 며칠 뒤인가?`,
      lcm(p, qv), [answer, p + qv, Math.abs(p - qv), lcm(p, qv) + 1],
      `두 일정이 다시 겹치는 주기는 ${math(p)}와 ${math(qv)}의 최소공배수이므로 ${math(lcm(p, qv))}일이다.`);
  }

  if (family === 'rational') {
    if (variantId === 2) {
      const den = [6, 8, 12, 20, 28][id % 5] + level * 5;
      const answer = removeFactors(den, [2, 5]);
      return q(id, difficulty, '유한소수 약분 조건', ['유한소수', '분모 소인수'],
        `${math(`\\frac{x}{${den}}`)}가 유한소수가 되게 하는 가장 작은 자연수 ${math('x')}는?`,
        answer, [answer + 1, answer + 2, Math.max(1, answer - 1), den],
        `분모에서 ${math(2)}, ${math(5)}가 아닌 소인수를 약분해야 하므로 최소 ${math(answer)}가 필요하다.`);
    }
    if (variantId === 3) {
      const n = id % 9 + 1;
      const answer = frac(9 * n + a, 90);
      return q(id, difficulty, '순환소수 분수 변환', ['순환소수', '분수 변환'],
        `${math(`0.${n}\\dot{${a}}`)}를 분수로 나타낸 꼴과 같은 것은?`,
        answer, [frac(9 * n + a + 1, 90), frac(n * 10 + a, 99), frac(n + a, 90), frac(9 * n + a, 900)],
        `${math(`0.${n}\\dot{${a}}=\\frac{${n}${a}-${n}}{90}=\\frac{${9 * n + a}}{90}`)}이다.`);
    }
    if (variantId === 4) {
      const den = [7, 11, 13, 17][id % 4];
      return q(id, difficulty, '순환마디 길이 판별', ['순환소수', '나눗셈'],
        `${math(`\\frac{1}{${den}}`)}를 소수로 나타내면 어떤 소수인가?`,
        '순환소수', ['유한소수', '정수', '자연수', '무리수'],
        `분모에 ${math(2)}, ${math(5)}가 아닌 소인수가 있으므로 유한소수가 아니라 순환소수이다.`);
    }
    const n = id % 7 + 2;
    const den = [4, 5, 8, 10, 20][id % 5];
    return q(id, difficulty, '소수와 분수 크기 비교', ['유리수', '크기 비교'],
      `${math(`\\frac{${n}}{${den}}`)}을 소수로 나타낸 값에 가장 가까운 것은?`,
      frac(n, den), [frac(n + 1, den), frac(n, den + 1), frac(Math.max(1, n - 1), den), frac(n, den * 2)],
      `분수의 크기를 비교할 때는 같은 분모로 만들거나 소수로 바꾸어 확인한다.`);
  }

  if (family === 'algebra') {
    if (variantId === 2) {
      const answer = a + b - c;
      return q(id, difficulty, '동류항 정리', ['동류항', '문자식'],
        `${math(`${a}x+${b}x-${c}x`)}를 간단히 하면 ${math('kx')}이다. ${math('k')}는?`,
        answer, [answer - 2, answer - 1, answer + 1, answer + 2],
        `동류항의 계수만 더하면 ${math(`${a}+${b}-${c}=${answer}`)}이다.`);
    }
    if (variantId === 3) {
      return q(id, difficulty, '단항식 나눗셈', ['지수법칙', '단항식'],
        `${math(`${a * b}x^{${c + 2}}y`)}를 ${math(`${a}x^2`)}로 나누었을 때 계수는?`,
        b, [a, a + b, b + 1, Math.max(1, b - 1)],
        `계수는 ${math(`${a * b}\\div${a}=${b}`)}이고 문자는 지수법칙으로 정리한다.`);
    }
    if (variantId === 4) {
      const answer = a * c + b;
      return q(id, difficulty, '전개식 계수 찾기', ['분배법칙', '계수'],
        `${math(`(${a}x+${b})(${c}x+1)`)}을 전개했을 때 ${math('x')}의 계수는?`,
        answer, [answer - a, answer + c, a * c, b * c],
        `${math('x')}항은 ${math(`${a}x`)}와 ${math(`${b * c}x`)}에서 나오므로 계수는 ${math(answer)}이다.`);
    }
    const x = id % 4 + 1;
    const answer = a * x + b;
    return q(id, difficulty, '문자식 대입', ['대입', '식의 값'],
      `${math(`A=${a}x+${b}`)}일 때, ${math(`x=${x}`)}이면 ${math('A')}의 값은?`,
      answer, [answer - a, answer + a, a + b, a * b],
      `문자 ${math('x')}에 ${math(x)}를 대입하면 ${math(`${a}\\times${x}+${b}=${answer}`)}이다.`);
  }

  if (family === 'inequality') {
    if (variantId === 2) {
      const answer = a + b + 1;
      return q(id, difficulty, '가장 작은 정수해', ['부등식', '정수해'],
        `${math(`x-${a}>${b}`)}를 만족하는 가장 작은 정수 ${math('x')}는?`,
        answer, [answer - 2, answer - 1, answer + 1, answer + 2],
        `${math(`x>${a + b}`)}이므로 가장 작은 정수는 ${math(answer)}이다.`);
    }
    if (variantId === 3) {
      const limit = b + level;
      return q(id, difficulty, '자연수해 개수', ['일차부등식', '해의 개수'],
        `${math(`${a}x\\le ${a * limit}`)}을 만족하는 자연수 ${math('x')}의 개수는?`,
        limit, [limit - 1, limit + 1, limit + 2, a],
        `${math(`x\\le${limit}`)}이므로 자연수 해는 ${math(limit)}개이다.`);
    }
    if (variantId === 4) {
      const low = c;
      const high = c + b;
      const answer = high - low + 1;
      return q(id, difficulty, '범위 안 정수 개수', ['연립부등식', '정수 범위'],
        `${math(`${low - 1}<x\\le${high}`)}를 만족하는 정수의 개수는?`,
        answer, [answer - 2, answer - 1, answer + 1, answer + 2],
        `가능한 정수는 ${math(`${low}`)}부터 ${math(`${high}`)}까지이므로 ${math(answer)}개이다.`);
    }
    const answer = a * b - 1;
    return q(id, difficulty, '매개변수 최대 정수', ['매개변수', '최대 정수해'],
      `${math(`\\frac{x+1}{${a}}<${b}`)}를 만족하는 가장 큰 정수 ${math('x')}는?`,
      answer, [answer - 2, answer - 1, answer + 1, answer + 2],
      `${math(`x+1<${a * b}`)}이므로 ${math(`x<${a * b - 1}`)}이다.`);
  }

  if (family === 'linear') {
    if (variantId === 2) {
      const x = c;
      const answer = a * x - b;
      return q(id, difficulty, '일차함수 값', ['일차함수', '대입'],
        `${math(`y=${a}x-${b}`)}에서 ${math(`x=${x}`)}일 때 ${math('y')}는?`,
        answer, [answer - a, answer + a, answer - 1, answer + 1],
        `대입하면 ${math(`y=${a}\\times${x}-${b}=${answer}`)}이다.`);
    }
    if (variantId === 3) {
      const x1 = 1;
      const x2 = 3;
      const y1 = b;
      const y2 = b + 2 * a;
      return q(id, difficulty, '기울기 구하기', ['두 점', '기울기'],
        `두 점 ${math(`(${x1},${y1})`)}, ${math(`(${x2},${y2})`)}를 지나는 직선의 기울기는?`,
        a, [a - 2, a - 1, a + 1, a + 2],
        `기울기는 ${math(`\\frac{${y2}-${y1}}{${x2}-${x1}}=${a}`)}이다.`);
    }
    if (variantId === 4) {
      const answer = b - a;
      return q(id, difficulty, 'y절편 찾기', ['직선의 식', '절편'],
        `기울기가 ${math(a)}이고 점 ${math(`(1,${b})`)}을 지나는 직선의 ${math('y')}절편은?`,
        answer, [answer - 2, answer - 1, answer + 1, answer + 2],
        `${math(`y=${a}x+n`)}에 ${math(`(1,${b})`)}를 대입하면 ${math(`n=${answer}`)}이다.`);
    }
    return q(id, difficulty, '두 직선의 교점', ['연립방정식', '교점'],
      `두 직선 ${math(`y=${a}x+${b}`)}, ${math(`y=${a + 1}x`)}의 교점의 ${math('x')}좌표는?`,
      b, [b - 2, b - 1, b + 1, b + 2],
      `두 식을 같게 두면 ${math(`${a}x+${b}=${a + 1}x`)}이므로 ${math(`x=${b}`)}이다.`);
  }

  if (family === 'radical') {
    const sf = [2, 3, 5, 6, 7][id % 5];
    if (variantId === 2) {
      return q(id, difficulty, '근호 간단히 하기', ['제곱근', '근호 밖으로 빼기'],
        `${math(`\\sqrt{${a * a * sf}}`)}을 간단히 하면?`,
        `${a}\\sqrt{${sf}}`, [`${a + 1}\\sqrt{${sf}}`, `${a}\\sqrt{${sf + 1}}`, `${a * sf}`, `\\sqrt{${a * sf}}`],
        `${math(`${a * a * sf}=${a}^2\\times${sf}`)}이므로 ${math(`${a}\\sqrt{${sf}}`)}이다.`);
    }
    if (variantId === 3) {
      const answer = a + b;
      return q(id, difficulty, '동류근호 덧셈', ['동류근호', '계수'],
        `${math(`${a}\\sqrt{${sf}}+${b}\\sqrt{${sf}}`)}를 ${math(`k\\sqrt{${sf}}`)}로 나타낼 때 ${math('k')}는?`,
        answer, [answer - 2, answer - 1, answer + 1, answer + 2],
        `같은 근호끼리는 계수를 더하므로 ${math(`${a}+${b}=${answer}`)}이다.`);
    }
    if (variantId === 4) {
      const answer = a * b * sf;
      return q(id, difficulty, '근호의 곱셈', ['제곱근', '곱셈'],
        `${math(`${a}\\sqrt{${sf}}\\times${b}\\sqrt{${sf}}`)}의 값은?`,
        answer, [answer - sf, answer + sf, a * b, sf],
        `${math(`(${a}\\times${b})\\times${sf}=${answer}`)}이다.`);
    }
    const answer = squareFreePart(a * b * sf);
    return q(id, difficulty, '자연수 조건', ['제곱근', '완전제곱수'],
      `${math(`\\sqrt{${a * b * sf}n}`)}이 자연수가 되도록 하는 가장 작은 자연수 ${math('n')}은?`,
      answer, [answer + 1, answer * 2, answer * 3, Math.max(1, answer - 1)],
      `근호 안이 완전제곱수가 되도록 남는 제곱인수 없는 부분 ${math(answer)}를 곱한다.`);
  }

  if (family === 'quadraticEquation') {
    if (variantId === 2) {
      return q(id, difficulty, '두 근의 합', ['이차방정식', '근'],
        `${math(`(x-${a})(x-${b})=0`)}의 두 근의 합은?`,
        a + b, [a, b, a * b, Math.abs(a - b)],
        `두 근은 ${math(a)}, ${math(b)}이므로 합은 ${math(a + b)}이다.`);
    }
    if (variantId === 3) {
      return q(id, difficulty, '두 근의 곱', ['이차방정식', '근과 계수'],
        `${math(`x^2-${a + b}x+${a * b}=0`)}의 두 근의 곱은?`,
        a * b, [a + b, a * b - 1, a * b + 1, Math.abs(a - b)],
        `근과 계수의 관계에서 두 근의 곱은 상수항 ${math(a * b)}이다.`);
    }
    if (variantId === 4) {
      const d = (a + b) ** 2 - 4 * a * b;
      return q(id, difficulty, '판별식 계산', ['판별식', '실근'],
        `${math(`x^2-${a + b}x+${a * b}=0`)}의 판별식 ${math('D')}는?`,
        d, [d - 2, d - 1, d + 1, d + 2],
        `${math(`D=b^2-4ac=${a + b}^2-4\\times${a * b}=${d}`)}이다.`);
    }
    return q(id, difficulty, '중근 조건', ['중근', '매개변수'],
      `${math(`x^2-${2 * a}x+k=0`)}이 중근을 갖게 하는 ${math('k')}는?`,
      a * a, [a * a - 1, a * a + 1, 2 * a, a],
      `중근이면 ${math(`k=(${2 * a}/2)^2=${a * a}`)}이다.`);
  }

  if (family === 'quadraticFunction') {
    if (variantId === 2) {
      return q(id, difficulty, '꼭짓점 좌표', ['이차함수', '꼭짓점'],
        `${math(`y=${a}(x-${b})^2+${c}`)}의 꼭짓점의 ${math('x')}좌표는?`,
        b, [b - 2, b - 1, b + 1, c],
        `꼭짓점형 ${math(`y=a(x-p)^2+q`)}의 꼭짓점은 ${math('(p,q)')}이다.`);
    }
    if (variantId === 3) {
      return q(id, difficulty, '대칭축 판별', ['이차함수', '대칭축'],
        `${math(`y=${a}(x+${b})^2-${c}`)}의 대칭축은 ${math('x=k')}이다. ${math('k')}는?`,
        -b, [b, -b - 1, -b + 1, c],
        `대칭축은 괄호 안이 ${math(0)}이 되는 ${math(`x=${-b}`)}이다.`);
    }
    if (variantId === 4) {
      const x = b + 1;
      const answer = a * (x - b) ** 2 + c;
      return q(id, difficulty, '함수값 계산', ['이차함수', '대입'],
        `${math(`y=${a}(x-${b})^2+${c}`)}에서 ${math(`x=${x}`)}일 때 ${math('y')}는?`,
        answer, [answer - a, answer + a, c, a + c],
        `대입하면 ${math(`${a}(${x}-${b})^2+${c}=${answer}`)}이다.`);
    }
    return q(id, difficulty, '최솟값 찾기', ['최솟값', '꼭짓점형'],
      `${math(`y=${a}(x-${b})^2+${c}`)}의 최솟값은?`,
      c, [a, b, c - 1, c + 1],
      `제곱항은 ${math(0)} 이상이므로 최솟값은 상수항 ${math(c)}이다.`);
  }

  if (family === 'trigonometry') {
    const triples = [[3, 4, 5], [5, 12, 13], [8, 15, 17], [7, 24, 25]];
    const [ta, tb, tc] = triples[id % triples.length];
    const [x, y, z] = [ta * (level + 1), tb * (level + 1), tc * (level + 1)];
    if (variantId === 2) {
      return q(id, difficulty, '사인값', ['삼각비', 'sin'],
        `직각삼각형에서 대변이 ${math(x)}, 빗변이 ${math(z)}일 때 ${math('\\sin A')}는?`,
        frac(x, z), [frac(y, z), frac(x, y), frac(z, x), frac(y, x)],
        `${math(`\\sin A=\\frac{대변}{빗변}=\\frac{${x}}{${z}}`)}이다.`);
    }
    if (variantId === 3) {
      return q(id, difficulty, '코사인값', ['삼각비', 'cos'],
        `직각삼각형에서 이웃한 변이 ${math(y)}, 빗변이 ${math(z)}일 때 ${math('\\cos A')}는?`,
        frac(y, z), [frac(x, z), frac(y, x), frac(z, y), frac(x, y)],
        `${math(`\\cos A=\\frac{이웃한 변}{빗변}=\\frac{${y}}{${z}}`)}이다.`);
    }
    if (variantId === 4) {
      return q(id, difficulty, '탄젠트 길이', ['tan', '길이'],
        `${math(`\\tan A=\\frac{${x}}{${y}}`)}이고 이웃한 변이 ${math(y * 2)}일 때 대변은?`,
        x * 2, [x, y, x * 2 + 1, y * 2],
        `비례식 ${math(`\\frac{대변}{${y * 2}}=\\frac{${x}}{${y}}`)}에서 대변은 ${math(x * 2)}이다.`);
    }
    return q(id, difficulty, '삼각비 복합식', ['sin', 'cos', '복합 계산'],
      `${math(`\\sin A=\\frac{${x}}{${z}}`)}, ${math(`\\cos A=\\frac{${y}}{${z}}`)}일 때 ${math(`z(\\sin A+\\cos A)`)}는?`,
      x + y, [x, y, z, x + y + 1],
      `${math(`z(\\frac{${x}}{${z}}+\\frac{${y}}{${z}})=${x + y}`)}이다.`);
  }

  if (family === 'circle') {
    if (variantId === 2) {
      const angle = 40 + id % 20 * 4;
      return q(id, difficulty, '원주각 계산', ['원주각', '중심각'],
        `같은 호에 대한 중심각이 ${math(`${angle}^\\circ`)}일 때 원주각은?`,
        `${angle / 2}^\\circ`, [`${angle}^\\circ`, `${angle / 2 + 10}^\\circ`, `${angle - 10}^\\circ`, `${90 - angle / 2}^\\circ`],
        `원주각은 같은 호에 대한 중심각의 절반이다.`);
    }
    if (variantId === 3) {
      return q(id, difficulty, '접선 길이', ['접선', '외부점'],
        `한 외부점에서 원에 그은 두 접선 중 하나의 길이가 ${math(a)}일 때 다른 접선의 길이는?`,
        a, [a - 2, a - 1, a + 1, a + 2],
        `한 외부점에서 그은 두 접선의 길이는 같다.`);
    }
    if (variantId === 4) {
      const angle = 70 + id % 10 * 5;
      return q(id, difficulty, '내접사각형 대각', ['내접사각형', '대각'],
        `원에 내접하는 사각형에서 한 각이 ${math(`${angle}^\\circ`)}일 때 그 대각은?`,
        `${180 - angle}^\\circ`, [`${angle}^\\circ`, `${180 - angle + 10}^\\circ`, `${90}^\\circ`, `${angle - 10}^\\circ`],
        `내접사각형의 대각의 합은 ${math('180^\\circ')}이다.`);
    }
    const answer = a * b;
    return q(id, difficulty, '현의 교차', ['현', '곱의 관계'],
      `원 안에서 두 현이 만나고 한 현의 두 부분이 ${math(a)}, ${math(b)}이다. 다른 현의 한 부분이 ${math(2)}이면 나머지 부분은?`,
      frac(answer, 2), [answer, frac(answer + 2, 2), frac(answer - 2, 2), a + b],
      `현의 교차 정리에 의해 ${math(`${a}\\times${b}=2t`)}이다.`);
  }

  if (family === 'statistics') {
    if (variantId === 2) {
      const answer = a + 2;
      return q(id, difficulty, '평균 계산', ['평균', '자료'],
        `자료 ${math(`${a}, ${a + 2}, ${a + 4}`)}의 평균은?`,
        answer, [answer - 2, answer - 1, answer + 1, answer + 2],
        `평균은 ${math(`\\frac{${a}+${a + 2}+${a + 4}}{3}=${answer}`)}이다.`);
    }
    if (variantId === 3) {
      const values = [a, a + 1, a + 4, a + 6, a + 9];
      return q(id, difficulty, '중앙값 찾기', ['중앙값', '자료 해석'],
        `자료 ${math(values.join(', '))}의 중앙값은?`,
        values[2], [values[0], values[1], values[3], values[4]],
        `자료가 이미 크기순이므로 가운데 값은 ${math(values[2])}이다.`);
    }
    if (variantId === 4) {
      const values = [a, a + 3, a + 5, a + b];
      const answer = values.at(-1) - values[0];
      return q(id, difficulty, '범위 계산', ['범위', '최댓값', '최솟값'],
        `자료 ${math(values.join(', '))}의 범위는?`,
        answer, [answer - 2, answer - 1, answer + 1, values.at(-1)],
        `범위는 최댓값에서 최솟값을 뺀 ${math(answer)}이다.`);
    }
    const q1 = a;
    const q3 = a + b;
    return q(id, difficulty, '사분위범위', ['사분위수', '상자그림'],
      `제1사분위수가 ${math(q1)}, 제3사분위수가 ${math(q3)}일 때 사분위범위는?`,
      q3 - q1, [q3 + q1, q3 - q1 - 1, q3 - q1 + 1, q3],
      `사분위범위는 ${math(`Q_3-Q_1=${q3}-${q1}=${q3 - q1}`)}이다.`);
  }

  return fallback;
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
  const seedOffset = hashText(current.id) % 37;
  const legacyDescription = cleanDescription(current.description);

  const questions = Array.from({ length: 30 }, (_, index) => {
    const variant = TYPE_VARIANTS[index % TYPE_VARIANTS.length];
    const rawQuestion = generator(index + 1 + seedOffset, current.difficulty, current.id);
    const question = applyTypeVariant(
      familyTypeQuestion(family, index + 1 + seedOffset, current.difficulty, variant.id, rawQuestion),
      variant
    );
    return {
      ...question,
      id: index + 1,
      question: decorateQuestion(question.question, core, profile.role, question.ebs.typeTag, index),
      ebs: {
        ...question.ebs,
        sourceFormat: 'EBS 단계형 5지선다',
        difficulty: current.difficulty,
        family,
      },
    };
  });

  return {
    id: current.id,
    title: `${core} — ${current.difficulty}`,
    description: `${profile.description}${legacyDescription ? ` ${legacyDescription}` : ''}`,
    grade: current.grade,
    unit: current.unit,
    difficulty: current.difficulty,
    ebsStyle: {
      version: 2,
      role: profile.role,
      expectedSteps: profile.steps,
      typeVariantCount: TYPE_VARIANTS.length,
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
