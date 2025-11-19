export interface Segment {
  id: string;
  order: number;
  originalText: string;
  translatedText: string | null;
  pinyinText: string | null;
  startTime: number | null;
  endTime: number | null;
}

export interface Lesson {
  id: string;
  title: string;
  sourceUrl: string;
  status: LessonStatus;
  language: string | null;
  audioUrl: string | null;
  segments: Segment[];
}

export type LessonStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'READY_FOR_SEGMENT'
  | 'SEGMENTING'
  | 'READY_FOR_TRANSLATION'
  | 'TRANSLATING'
  | 'DONE'
  | 'ERROR';

export interface StudyLogEntry {
  id: string;
  rating: SegmentPracticeResult;
  userTranscript: string | null;
  audioUrl: string | null;
  durationMs: number | null;
  timestamp: string;
}

export type SegmentPracticeResult = 'GOOD' | 'OK' | 'RETRY';

export type SegmentPracticeResults = Record<string, SegmentPracticeResult>;

export const DEMO_USER_ID = 'demo-user-001';

