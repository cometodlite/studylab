import qualityData from '@/data/practice-exam-quality.json';

export type PracticeExamQualityStatus = 'ok' | 'needs_review' | 'blocked';

export type PracticeExamQualityEntry = {
  status: PracticeExamQualityStatus;
  filename?: string;
  reason?: string;
  issueQuestionIds?: number[];
  metrics?: {
    issueCount?: number;
    answerIndex0Rate?: number;
  };
};

type PracticeExamQualityFile = {
  schemaVersion: number;
  updatedAt: string;
  exams: Record<string, PracticeExamQualityEntry>;
};

const quality = qualityData as PracticeExamQualityFile;

export function getPracticeExamQuality(id: string): PracticeExamQualityEntry {
  return quality.exams[id] ?? { status: 'ok' };
}

export function isPracticeExamBlocked(id: string): boolean {
  return getPracticeExamQuality(id).status === 'blocked';
}
