import { NextRequest, NextResponse } from 'next/server';
import { verifyFirebaseToken } from '@/lib/firebase-jwt';
import { fsGet } from '@/lib/firestore-rest';
import fs from 'fs';
import path from 'path';

const SCHOOL_EXAM_DIR = path.join(process.cwd(), 'src', 'data', 'school-exams');
const DEBUG_HISTORY_FILE = path.join(process.cwd(), 'src', 'data', 'debug-history.json');
const SCHOOL_EXAM_REPO_DIR = 'src/data/school-exams';
const DEBUG_HISTORY_REPO_PATH = 'src/data/debug-history.json';

type SchoolExamQuestion = {
  id: number;
  type: 'mc' | 'short' | 'essay';
  score: number;
  question: string;
  choices?: string[];
  answer?: number | string;
  expectedAnswer?: string;
  explanation?: string;
  rubric?: string;
};

type SchoolExamJson = {
  id: string;
  title: string;
  school?: string;
  grade?: number;
  subject?: string;
  sheet?: number;
  difficulty?: string;
  timeLimit: number;
  totalScore: number;
  questions: SchoolExamQuestion[];
  [key: string]: unknown;
};

type DebugHistoryEntry = {
  id: string;
  date: string;
  category: string;
  description: string;
  files: string[];
  author: string;
};

type GithubRefResponse = {
  object: { sha: string };
};

type GithubCommitResponse = {
  sha: string;
  tree: { sha: string };
};

type GithubBlobResponse = {
  sha: string;
};

type GithubTreeResponse = {
  sha: string;
};

type GithubPullRequestResponse = {
  html_url: string;
};

async function requireAdmin(req: NextRequest): Promise<NextResponse | null> {
  const token = req.headers.get('Authorization')?.split('Bearer ')[1];
  if (!token) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });

  let uid: string;
  try {
    uid = await verifyFirebaseToken(token);
  } catch {
    return NextResponse.json({ error: '유효하지 않은 토큰입니다.' }, { status: 401 });
  }

  const userDoc = await fsGet(`users/${uid}`, token);
  if (!userDoc || userDoc.role !== 'admin') {
    return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });
  }

  return null;
}

function validateFilename(filename: unknown): filename is string {
  return (
    typeof filename === 'string' &&
    filename.endsWith('.json') &&
    path.basename(filename) === filename
  );
}

function validateExam(filename: string, exam: unknown): { exam?: SchoolExamJson; errors: string[] } {
  const errors: string[] = [];
  if (!exam || typeof exam !== 'object') {
    return { errors: ['시험 데이터가 올바르지 않습니다.'] };
  }

  const data = exam as Partial<SchoolExamJson>;
  const expectedId = filename.replace(/\.json$/, '');

  if (typeof data.id !== 'string' || data.id.trim() === '') errors.push('id는 필수입니다.');
  if (data.id && data.id !== expectedId) errors.push(`id는 파일명과 같은 "${expectedId}"이어야 합니다.`);
  if (typeof data.title !== 'string' || data.title.trim() === '') errors.push('title은 필수입니다.');
  if (typeof data.timeLimit !== 'number' || !Number.isFinite(data.timeLimit) || data.timeLimit <= 0) {
    errors.push('timeLimit은 1 이상의 숫자여야 합니다.');
  }
  if (typeof data.totalScore !== 'number' || !Number.isFinite(data.totalScore) || data.totalScore <= 0) {
    errors.push('totalScore는 1 이상의 숫자여야 합니다.');
  }
  if (!Array.isArray(data.questions) || data.questions.length === 0) {
    errors.push('questions는 1개 이상의 문제 배열이어야 합니다.');
  }

  let scoreSum = 0;
  if (Array.isArray(data.questions)) {
    data.questions.forEach((question, index) => {
      const label = `Q${index + 1}`;
      if (!question || typeof question !== 'object') {
        errors.push(`${label}: 문제 데이터가 올바르지 않습니다.`);
        return;
      }

      const q = question as Partial<SchoolExamQuestion>;
      if (typeof q.id !== 'number' || !Number.isInteger(q.id) || q.id <= 0) errors.push(`${label}: id는 양의 정수여야 합니다.`);
      if (!['mc', 'short', 'essay'].includes(q.type ?? '')) errors.push(`${label}: type은 mc, short, essay 중 하나여야 합니다.`);
      if (typeof q.score !== 'number' || !Number.isFinite(q.score) || q.score <= 0) {
        errors.push(`${label}: score는 1 이상의 숫자여야 합니다.`);
      } else {
        scoreSum += q.score;
      }
      if (typeof q.question !== 'string' || q.question.trim() === '') errors.push(`${label}: question은 필수입니다.`);

      if (q.type === 'mc') {
        if (!Array.isArray(q.choices) || q.choices.length < 2) {
          errors.push(`${label}: 객관식은 선택지가 2개 이상이어야 합니다.`);
        } else if (q.choices.some(choice => typeof choice !== 'string' || choice.trim() === '')) {
          errors.push(`${label}: 선택지는 비어 있을 수 없습니다.`);
        }
        if (typeof q.answer !== 'number' || !Number.isInteger(q.answer)) {
          errors.push(`${label}: 객관식 정답은 숫자 인덱스여야 합니다.`);
        } else if (Array.isArray(q.choices) && (q.answer < 0 || q.answer >= q.choices.length)) {
          errors.push(`${label}: 객관식 정답은 선택지 범위 안이어야 합니다.`);
        }
      }

      if (q.type === 'short' || q.type === 'essay') {
        const answer = typeof q.answer === 'string' ? q.answer.trim() : '';
        const expectedAnswer = typeof q.expectedAnswer === 'string' ? q.expectedAnswer.trim() : '';
        if (!answer && !expectedAnswer) errors.push(`${label}: 주관식/서술형은 answer 또는 expectedAnswer가 필요합니다.`);
      }
    });
  }

  if (
    typeof data.totalScore === 'number' &&
    Number.isFinite(data.totalScore) &&
    scoreSum > 0 &&
    scoreSum !== data.totalScore
  ) {
    errors.push(`문제 점수 합계(${scoreSum})와 totalScore(${data.totalScore})가 일치해야 합니다.`);
  }

  return errors.length > 0 ? { errors } : { exam: data as SchoolExamJson, errors: [] };
}

function getGithubConfig() {
  const token = process.env.GITHUB_CONTENT_TOKEN;
  const owner = process.env.GITHUB_REPO_OWNER ?? 'cometodlite';
  const repo = process.env.GITHUB_REPO_NAME ?? 'studylab';
  const baseBranch = process.env.GITHUB_BASE_BRANCH ?? 'main';

  if (!token) {
    throw new Error('GITHUB_CONTENT_TOKEN 환경변수가 필요합니다.');
  }

  return { token, owner, repo, baseBranch };
}

async function githubRequest<T>(
  pathName: string,
  init: RequestInit & { token: string; owner: string; repo: string }
): Promise<T> {
  const { token, owner, repo, ...requestInit } = init;
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}${pathName}`, {
    ...requestInit,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(requestInit.headers ?? {}),
    },
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`GitHub API ${res.status}: ${detail}`);
  }

  return res.json() as Promise<T>;
}

async function createGithubBlob(content: string, config: { token: string; owner: string; repo: string }) {
  const blob = await githubRequest<GithubBlobResponse>('/git/blobs', {
    ...config,
    method: 'POST',
    body: JSON.stringify({ content, encoding: 'utf-8' }),
  });
  return blob.sha;
}

async function createContentPullRequest(filename: string, exam: SchoolExamJson, changeSummary: string) {
  const config = getGithubConfig();
  const repoFilePath = `${SCHOOL_EXAM_REPO_DIR}/${filename}`;
  const branch = `content/exam-edit-${Date.now()}`;
  const examContent = `${JSON.stringify(exam, null, 2)}\n`;

  const history = fs.existsSync(DEBUG_HISTORY_FILE)
    ? JSON.parse(fs.readFileSync(DEBUG_HISTORY_FILE, 'utf8')) as DebugHistoryEntry[]
    : [];
  const date = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });
  const historyEntry: DebugHistoryEntry = {
    id: `dbg-${Date.now().toString(36)}`,
    date,
    category: 'question_fix',
    description: changeSummary,
    files: [repoFilePath],
    author: 'admin',
  };
  const historyContent = `${JSON.stringify([...history, historyEntry], null, 2)}\n`;

  const baseRef = await githubRequest<GithubRefResponse>(`/git/ref/heads/${config.baseBranch}`, {
    ...config,
    method: 'GET',
  });
  const baseCommit = await githubRequest<GithubCommitResponse>(`/git/commits/${baseRef.object.sha}`, {
    ...config,
    method: 'GET',
  });
  const [examBlobSha, historyBlobSha] = await Promise.all([
    createGithubBlob(examContent, config),
    createGithubBlob(historyContent, config),
  ]);

  const tree = await githubRequest<GithubTreeResponse>('/git/trees', {
    ...config,
    method: 'POST',
    body: JSON.stringify({
      base_tree: baseCommit.tree.sha,
      tree: [
        { path: repoFilePath, mode: '100644', type: 'blob', sha: examBlobSha },
        { path: DEBUG_HISTORY_REPO_PATH, mode: '100644', type: 'blob', sha: historyBlobSha },
      ],
    }),
  });
  const commit = await githubRequest<GithubCommitResponse>('/git/commits', {
    ...config,
    method: 'POST',
    body: JSON.stringify({
      message: `content: 시험 콘텐츠 수정 - ${exam.title}`,
      tree: tree.sha,
      parents: [baseRef.object.sha],
    }),
  });
  await githubRequest(`/git/refs`, {
    ...config,
    method: 'POST',
    body: JSON.stringify({
      ref: `refs/heads/${branch}`,
      sha: commit.sha,
    }),
  });
  const pr = await githubRequest<GithubPullRequestResponse>('/pulls', {
    ...config,
    method: 'POST',
    body: JSON.stringify({
      title: `content: 시험 콘텐츠 수정 - ${exam.title}`,
      head: branch,
      base: config.baseBranch,
      body: [
        '관리자 대시보드에서 생성된 시험 콘텐츠 수정 PR입니다.',
        '',
        `- 파일: ${repoFilePath}`,
        `- 변경 메모: ${changeSummary}`,
      ].join('\n'),
    }),
  });

  return { branch, commitSha: commit.sha, pullRequestUrl: pr.html_url };
}

export async function GET(req: NextRequest) {
  const adminError = await requireAdmin(req);
  if (adminError) return adminError;

  if (!fs.existsSync(SCHOOL_EXAM_DIR)) {
    return NextResponse.json([]);
  }

  const files = fs
    .readdirSync(SCHOOL_EXAM_DIR)
    .filter(f => f.endsWith('.json'))
    .map(f => {
      const filePath = path.join(SCHOOL_EXAM_DIR, f);
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      return {
        filename: f,
        id: data.id,
        title: data.title,
        school: data.school,
        questionCount: data.questions?.length ?? 0,
        category: data.category ?? '미분류',
      };
    })
    .sort((a, b) => a.filename.localeCompare(b.filename));

  return NextResponse.json(files);
}

export async function POST(req: NextRequest) {
  const adminError = await requireAdmin(req);
  if (adminError) return adminError;

  const { filename } = await req.json();
  if (
    typeof filename !== 'string' ||
    !filename.endsWith('.json') ||
    path.basename(filename) !== filename
  ) {
    return NextResponse.json({ error: '유효한 파일명이 아닙니다.' }, { status: 400 });
  }

  const filePath = path.join(SCHOOL_EXAM_DIR, filename);
  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ error: '파일을 찾을 수 없습니다.' }, { status: 404 });
  }

  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  return NextResponse.json(data);
}

export async function PATCH(req: NextRequest) {
  const adminError = await requireAdmin(req);
  if (adminError) return adminError;

  let body: { filename?: unknown; exam?: unknown; changeSummary?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: '요청 JSON이 올바르지 않습니다.' }, { status: 400 });
  }

  if (!validateFilename(body.filename)) {
    return NextResponse.json({ error: '유효한 파일명이 아닙니다.' }, { status: 400 });
  }

  const filePath = path.join(SCHOOL_EXAM_DIR, body.filename);
  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ error: '기존 시험 파일만 수정할 수 있습니다.' }, { status: 404 });
  }

  const changeSummary = typeof body.changeSummary === 'string' ? body.changeSummary.trim() : '';
  if (!changeSummary) {
    return NextResponse.json({ error: '변경 메모는 필수입니다.' }, { status: 400 });
  }

  const validation = validateExam(body.filename, body.exam);
  if (!validation.exam) {
    return NextResponse.json({ error: '시험 데이터 검증에 실패했습니다.', details: validation.errors }, { status: 400 });
  }

  try {
    const result = await createContentPullRequest(body.filename, validation.exam, changeSummary);
    return NextResponse.json({ success: true, ...result });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error('[admin/exam-files] create PR failed:', message);
    return NextResponse.json({ error: '검토 PR 생성에 실패했습니다.', details: [message] }, { status: 500 });
  }
}
