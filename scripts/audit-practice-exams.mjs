import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const dataDir = path.join(root, 'src', 'data');
const qualityFile = path.join(dataDir, 'practice-exam-quality.json');
const skipDirs = new Set(['archive', 'school-exams', 'roadway', 'workbooks']);
const failOnUnblockedIssues = process.argv.includes('--fail-on-unblocked-issues');

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

const ebsRoles = {
  '기본': { role: '개념 확인', steps: 1 },
  '유형별': { role: '대표 유형', steps: 2 },
  '심화': { role: '조건 결합', steps: 4 },
  '킬러': { role: '고난도 추론', steps: 6 },
};

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
  const answerCounts = new Map();
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
      }
    }
  }

  const answerIndex0Rate = multipleChoiceCount > 0
    ? Number((((answerCounts.get(0) ?? 0) / multipleChoiceCount) * 100).toFixed(1))
    : 0;

  const issueIds = [...issueQuestionIds].sort((a, b) => a - b);

  return {
    id: exam.id ?? path.basename(filePath, '.json'),
    title: exam.title ?? '',
    difficulty: exam.difficulty ?? null,
    unit: exam.unit ?? null,
    relativePath,
    questionCount: exam.questions.length,
    issueQuestionIds: issueIds,
    ebsProblems,
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

console.log(`Practice exam audit`);
console.log(`- scanned files: ${reports.length}`);
console.log(`- blocked in quality metadata: ${blockedCount}`);
console.log(`- high-risk files detected: ${highRiskReports.length}`);
console.log(`- unblocked high-risk files: ${unblockedHighRisk.length}`);
console.log(`- exact duplicate question texts across all files: ${duplicateQuestionTexts.length}`);
console.log(`- exact duplicate question texts across difficulties: ${crossDifficultyDuplicates.length}`);

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

if (duplicateQuestionTexts.length > 0 && failOnUnblockedIssues) {
  console.error('\nExact duplicate question texts must be removed before publishing practice exams.');
  for (const duplicate of duplicateQuestionTexts.slice(0, 10)) {
    const refs = duplicate.reports
      .slice(0, 5)
      .map(report => `${report.id}:Q${report.questionId}`)
      .join(', ');
    console.error(`- ${refs}: ${duplicate.text}`);
  }
  process.exit(1);
}
