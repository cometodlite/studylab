import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const dataDir = path.join(root, 'src', 'data');
const qualityFile = path.join(dataDir, 'practice-exam-quality.json');
const skipDirs = new Set(['archive', 'school-exams', 'roadway', 'workbooks']);
const failOnUnblockedIssues = process.argv.includes('--fail-on-unblocked-issues');
const minTypeTagsPerExam = 5;
const minTypeTagsPerUnit = 20;
const maxSimilarQuestionsPerExam = 2;
const maxReasonableNumber = 999;

const redFlagPatterns = [
  /보기 없음/,
  /정답:/,
  /재계산/,
  /불성립/,
  /모순/,
  /해 없음/,
  /오류/,
  /복잡\.?$/,
  /복잡합니다\.?$/,
  /성립하지 않음/,
  /없다\.?$/,
];

const visibleScaffoldingPatterns = [
  /^EBS\s/,
  /\d+형\./,
  /교과서 대표 풀이 흐름/,
  /학교 시험 변형처럼/,
  /풀이 과정을 단계별/,
  /발전 문항처럼/,
  /2차 변형/,
  /최종 조건까지 압축/,
  /기본 정의를 바로 적용/,
  /대표 풀이 흐름에 맞추어/,
  /에서\s.*하여,\s/,
];

const numberPattern = /(?<![A-Za-z])[-+]?\d+(?:\.\d+)?/g;

const ebsRoles = {
  '기본': { role: '개념 확인 연산', steps: 1, middleStage: '개념 확인 연산 유형' },
  '유형별': { role: '대표 교과서 유형', steps: 2, middleStage: '대표 교과서 유형' },
  '심화': { role: '기출 변형 핵심', steps: 4, middleStage: '기출 변형 핵심 유형' },
  '킬러': { role: '최고 수준 발전', steps: 6, middleStage: '최고 수준/발전 유형' },
};

const ebsDescriptionPhrases = [
  'EBS 중학 개념 확인형: 핵심 공식과 정의를 바로 적용합니다.',
  'EBS 중학 대표 유형형: 교과서 필수 표준 문항을 연습합니다.',
  'EBS 중학 기출 변형형: 내신 빈출 조건을 해석하고 연결합니다.',
  'EBS 중학 발전형: 복합 조건과 추론으로 변별력 문항을 대비합니다.',
  'EBS 개념 확인형: 핵심 정의와 공식 1개를 바로 적용합니다.',
  'EBS 대표 유형형: 자주 출제되는 풀이 틀을 숫자와 조건을 바꾸어 적용합니다.',
  'EBS 심화형: 두 개 이상의 조건을 연결하고 중간값을 해석합니다.',
  'EBS 킬러형: 매개변수, 숨은 조건, 역추론을 함께 사용합니다.',
];

const middleBuildUpStages = new Set([
  '개념 확인 연산 유형',
  '대표 교과서 유형',
  '기출 변형 핵심 유형',
  '서술형 대비 유형',
  '최고 수준/발전 유형',
]);

const middleSchoolExamTypes = new Set([
  '개념 정의 직접 확인',
  '대표 표준 문항',
  '말장난 방지 보기 고르기',
  '실생활 문장제 독해',
  '도형의 성질 및 보조선 추론',
  '오류 찾기 및 과정 교정',
]);

const ebsTransformPatterns = new Set([
  '개념·원리 직접 활용',
  '문항의 축소·확대·변형',
  '조건 및 구하는 값 변경',
  '풀이 과정 단계화',
  '조건의 강화·완화',
  '자료 및 상황 활용',
]);

function scanJsonFiles(dir) {
  if (!fs.existsSync(dir)) return [];

  const result = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (skipDirs.has(entry.name)) continue;

    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      result.push(...scanJsonFiles(fullPath));
    } else if (entry.name.endsWith('.json')) {
      result.push(fullPath);
    }
  }
  return result;
}

function normalizeText(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function unique(values) {
  return [...new Set(values.map(value => String(value)))];
}

function normalizeQuestionShape(value) {
  const text = normalizeText(value);
  const coreStart = text.indexOf(', ');
  const coreText = coreStart >= 0 ? text.slice(coreStart + 2) : text;
  const preservedMath = [];
  return coreText
    .replace(/\$[^$]*A[^$]*\$/g, formula => {
      const token = `__FORMULA${String.fromCharCode(65 + preservedMath.length)}__`;
      preservedMath.push(formula);
      return token;
    })
    .replace(/\$[^$]*\$/g, '$#')
    .replace(numberPattern, '#')
    .replace(/__FORMULA([A-Z])__/g, (_, letter) => preservedMath[letter.charCodeAt(0) - 65] ?? '$#');
}

function collectLargeNumbers(value) {
  return [...String(value ?? '').matchAll(numberPattern)]
    .map(match => Number(match[0]))
    .filter(number => Number.isFinite(number) && Math.abs(number) > maxReasonableNumber);
}

function loadQualityMap() {
  if (!fs.existsSync(qualityFile)) return {};

  const quality = JSON.parse(fs.readFileSync(qualityFile, 'utf8'));
  return quality.exams ?? {};
}

function auditExam(filePath) {
  const relativePath = path.relative(root, filePath);
  let exam;

  try {
    exam = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    return {
      id: path.basename(filePath, '.json'),
      relativePath,
      parseError: error instanceof Error ? error.message : String(error),
      highRisk: true,
      issueQuestionIds: [],
      answerIndex0Rate: 0,
      duplicateQuestionTexts: [],
    };
  }

  if (!Array.isArray(exam.questions)) return null;

  const issueQuestionIds = new Set();
  const ebsProblems = [];
  const duplicateQuestionTexts = [];
  const questionTextCounts = new Map();
  const questionShapeCounts = new Map();
  const answerCounts = new Map();
  const typeTags = new Set();
  let multipleChoiceCount = 0;
  const expectedEbs = ebsRoles[exam.difficulty];

  if (!exam.ebsStyle || typeof exam.ebsStyle !== 'object') {
    ebsProblems.push('top-level ebsStyle metadata is missing');
  } else if (expectedEbs) {
    if (exam.ebsStyle.role !== expectedEbs.role) {
      ebsProblems.push(`ebsStyle.role should be "${expectedEbs.role}"`);
    }
    if (exam.ebsStyle.expectedSteps !== expectedEbs.steps) {
      ebsProblems.push(`ebsStyle.expectedSteps should be ${expectedEbs.steps}`);
    }
    if (exam.ebsStyle.middleStage !== expectedEbs.middleStage) {
      ebsProblems.push(`ebsStyle.middleStage should be "${expectedEbs.middleStage}"`);
    }
    if (!exam.ebsStyle.middleTaxonomy || typeof exam.ebsStyle.middleTaxonomy !== 'object') {
      ebsProblems.push('ebsStyle.middleTaxonomy metadata is missing');
    }
  }

  if (typeof exam.description === 'string') {
    if (exam.description.length > 180) {
      ebsProblems.push('description is too long for the practice list');
    }
    for (const phrase of ebsDescriptionPhrases) {
      const count = exam.description.split(phrase).length - 1;
      if (count > 1) {
        ebsProblems.push(`description repeats "${phrase}" ${count} times`);
      }
    }
  }

  for (const question of exam.questions) {
    const qId = Number.isFinite(question?.id) ? question.id : exam.questions.indexOf(question) + 1;
    const choices = Array.isArray(question?.choices) ? question.choices : [];

    if (choices.length > 0) {
      multipleChoiceCount += 1;
      answerCounts.set(question.answer, (answerCounts.get(question.answer) ?? 0) + 1);

      if (!Number.isInteger(question.answer) || question.answer < 0 || question.answer >= choices.length) {
        issueQuestionIds.add(qId);
      }

      const normalizedChoices = choices.map(normalizeText);
      if (new Set(normalizedChoices).size !== normalizedChoices.length) {
        issueQuestionIds.add(qId);
      }
    }

    const searchableText = [
      question?.question,
      question?.explanation,
      ...(Array.isArray(question?.choices) ? question.choices : []),
    ].filter(Boolean).join('\n');

    if (redFlagPatterns.some(pattern => pattern.test(searchableText))) {
      issueQuestionIds.add(qId);
    }

    const questionText = normalizeText(question?.question);
    if (questionText) {
      const textRefs = questionTextCounts.get(questionText) ?? [];
      textRefs.push(qId);
      questionTextCounts.set(questionText, textRefs);

      const questionShape = normalizeQuestionShape(questionText);
      const shapeRefs = questionShapeCounts.get(questionShape) ?? [];
      shapeRefs.push(qId);
      questionShapeCounts.set(questionShape, shapeRefs);
    }

    const largeNumbers = collectLargeNumbers(searchableText);
    if (largeNumbers.length > 0) {
      ebsProblems.push(`Q${qId}: contains unreasonable number(s): ${unique(largeNumbers).join(', ')}`);
    }

    if (visibleScaffoldingPatterns.some(pattern => pattern.test(questionText))) {
      ebsProblems.push(`Q${qId}: internal EBS scaffolding is visible in question text`);
    }

    if (!question?.ebs || typeof question.ebs !== 'object') {
      ebsProblems.push(`Q${qId}: ebs metadata is missing`);
    } else if (expectedEbs) {
      if (question.ebs.role !== expectedEbs.role) {
        ebsProblems.push(`Q${qId}: ebs.role should be "${expectedEbs.role}"`);
      }
      if (question.ebs.steps !== expectedEbs.steps) {
        ebsProblems.push(`Q${qId}: ebs.steps should be ${expectedEbs.steps}`);
      }
      if (question.ebs.difficulty !== exam.difficulty) {
        ebsProblems.push(`Q${qId}: ebs.difficulty should match exam difficulty`);
      }
      if (!question.ebs.typeTag) {
        ebsProblems.push(`Q${qId}: ebs.typeTag is missing`);
      } else {
        typeTags.add(question.ebs.typeTag);
      }
      if (!question.ebs.typeVariant) {
        ebsProblems.push(`Q${qId}: ebs.typeVariant is missing`);
      }
      if (!middleBuildUpStages.has(question.ebs.buildUpStage)) {
        ebsProblems.push(`Q${qId}: ebs.buildUpStage is invalid or missing`);
      }
      if (!middleSchoolExamTypes.has(question.ebs.schoolExamType)) {
        ebsProblems.push(`Q${qId}: ebs.schoolExamType is invalid or missing`);
      }
      if (!ebsTransformPatterns.has(question.ebs.transformPattern)) {
        ebsProblems.push(`Q${qId}: ebs.transformPattern is invalid or missing`);
      }
    }
  }

  if (expectedEbs && typeTags.size < minTypeTagsPerExam) {
    ebsProblems.push(`only ${typeTags.size} unique typeTags; expected at least ${minTypeTagsPerExam} per exam`);
  }

  for (const [text, refs] of questionTextCounts.entries()) {
    if (refs.length > 1) {
      duplicateQuestionTexts.push({ text, questionIds: refs });
      ebsProblems.push(`duplicate question text appears in Q${refs.join(', Q')}`);
    }
  }

  for (const [shape, refs] of questionShapeCounts.entries()) {
    if (refs.length > maxSimilarQuestionsPerExam) {
      ebsProblems.push(`similar question shape appears ${refs.length} times in Q${refs.join(', Q')}: ${shape}`);
    }
  }

  const answerIndex0Rate = multipleChoiceCount > 0
    ? Number((((answerCounts.get(0) ?? 0) / multipleChoiceCount) * 100).toFixed(1))
    : 0;

  const issueIds = [...issueQuestionIds].sort((a, b) => a - b);

  return {
    id: exam.id ?? path.basename(filePath, '.json'),
    title: exam.title ?? '',
    grade: exam.grade ?? null,
    difficulty: exam.difficulty ?? null,
    unit: exam.unit ?? null,
    relativePath,
    questionCount: exam.questions.length,
    issueQuestionIds: issueIds,
    ebsProblems,
    typeTags: [...typeTags],
    answerIndex0Rate,
    duplicateQuestionTexts,
    highRisk: issueIds.length > 0 || answerIndex0Rate >= 90 || ebsProblems.length > 0,
  };
}

function collectCrossDifficultyDuplicates(reportsByQuestionText) {
  const duplicates = [];

  for (const [text, reports] of reportsByQuestionText.entries()) {
    const difficulties = new Set(reports.map(report => report.difficulty).filter(Boolean));
    if (difficulties.size < 2) continue;
    duplicates.push({ text, reports });
  }

  return duplicates;
}

function collectDuplicateQuestionTexts(reportsByQuestionText) {
  return [...reportsByQuestionText.entries()]
    .filter(([, reports]) => reports.length > 1)
    .map(([text, reports]) => ({ text, reports }));
}

const qualityMap = loadQualityMap();
const reports = [];
const reportsByQuestionText = new Map();

for (const filePath of scanJsonFiles(dataDir)) {
  const report = auditExam(filePath);
  if (!report) continue;

  reports.push(report);

  if (!report.parseError) {
    const exam = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    for (const question of exam.questions) {
      const key = normalizeText(question?.question);
      if (!key) continue;
      const current = reportsByQuestionText.get(key) ?? [];
      current.push({
        id: report.id,
        difficulty: report.difficulty,
        relativePath: report.relativePath,
        questionId: question?.id,
      });
      reportsByQuestionText.set(key, current);
    }
  }
}

const highRiskReports = reports.filter(report => report.highRisk);
const unblockedHighRisk = highRiskReports.filter(report => qualityMap[report.id]?.status !== 'blocked');
const blockedCount = Object.values(qualityMap).filter(entry => entry?.status === 'blocked').length;
const duplicateQuestionTexts = collectDuplicateQuestionTexts(reportsByQuestionText);
const crossDifficultyDuplicates = collectCrossDifficultyDuplicates(reportsByQuestionText);
const unitTypeTags = new Map();

for (const report of reports) {
  if (!report.grade || !report.unit || !Array.isArray(report.typeTags)) continue;
  const key = `${report.grade}학년 ${report.unit}`;
  const typeTags = unitTypeTags.get(key) ?? new Set();
  for (const tag of report.typeTags) {
    typeTags.add(`${report.difficulty}:${tag}`);
  }
  unitTypeTags.set(key, typeTags);
}

const lowDiversityUnits = [...unitTypeTags.entries()]
  .map(([unit, typeTags]) => ({ unit, typeTagCount: typeTags.size }))
  .filter(report => report.typeTagCount < minTypeTagsPerUnit);

console.log(`Practice exam audit`);
console.log(`- scanned files: ${reports.length}`);
console.log(`- blocked in quality metadata: ${blockedCount}`);
console.log(`- high-risk files detected: ${highRiskReports.length}`);
console.log(`- unblocked high-risk files: ${unblockedHighRisk.length}`);
console.log(`- exact duplicate question texts across all files: ${duplicateQuestionTexts.length}`);
console.log(`- exact duplicate question texts across difficulties: ${crossDifficultyDuplicates.length}`);
console.log(`- units below ${minTypeTagsPerUnit} type variants: ${lowDiversityUnits.length}`);

if (highRiskReports.length > 0) {
  console.log('\nHigh-risk files:');
  for (const report of highRiskReports) {
    const status = qualityMap[report.id]?.status ?? 'ok';
    const issueText = report.issueQuestionIds.length > 0 ? `issues Q${report.issueQuestionIds.join(',')}` : 'no issue ids';
    const ebsText = report.ebsProblems.length > 0 ? `, ebs ${report.ebsProblems.length}` : '';
    console.log(`- [${status}] ${report.id} (${report.relativePath}) - ${issueText}, answer0 ${report.answerIndex0Rate}%${ebsText}`);
  }
}

if (unblockedHighRisk.length > 0 && failOnUnblockedIssues) {
  console.error('\nUnblocked high-risk files must be fixed or added to src/data/practice-exam-quality.json as blocked.');
  process.exit(1);
}

if (lowDiversityUnits.length > 0 && failOnUnblockedIssues) {
  console.error(`\nEvery unit must expose at least ${minTypeTagsPerUnit} type variants across its difficulty set.`);
  for (const report of lowDiversityUnits.slice(0, 10)) {
    console.error(`- ${report.unit}: ${report.typeTagCount} type variants`);
  }
  process.exit(1);
}

if (duplicateQuestionTexts.length > 0) {
  console.warn('\nExact duplicate question texts are tracked for content review.');
  for (const duplicate of duplicateQuestionTexts.slice(0, 10)) {
    const refs = duplicate.reports
      .slice(0, 5)
      .map(report => `${report.id}:Q${report.questionId}`)
      .join(', ');
    console.warn(`- ${refs}: ${duplicate.text}`);
  }
}

if (duplicateQuestionTexts.length > 0 && failOnUnblockedIssues) {
  console.error('\nExact duplicate question texts are not allowed.');
  process.exit(1);
}

if (crossDifficultyDuplicates.length > 0 && failOnUnblockedIssues) {
  console.error('\nExact duplicate question texts across difficulties are not allowed.');
  process.exit(1);
}
