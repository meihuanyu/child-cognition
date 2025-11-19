'use client';

import { RefreshCcw } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { ChineseSegment } from '@/components/chinese-segment';
import { getFeedbackMessage } from '@/lib/evaluate';
import type { Lesson, Segment, StudyLogEntry } from '../types';
import { buildFileProxyPath } from '../utils';

const ratingBadgeStyles: Record<StudyLogEntry['rating'], string> = {
  GOOD: 'bg-green-100 text-green-700',
  OK: 'bg-amber-100 text-amber-700',
  RETRY: 'bg-blue-100 text-blue-700',
};

interface CurrentSegmentCardProps {
  lesson: Lesson;
  currentSegment: Segment;
  activeSegmentIndex: number;
  segmentCount: number;
  isRecorderSupported: boolean;
  practiceError: string;
  logsError: string;
  isLogsLoading: boolean;
  currentLog: StudyLogEntry | null;
  disablePracticeActions: boolean;
  onRefreshLogs: () => void | Promise<void>;
  onStartRecording: () => void | Promise<void>;
}

export function CurrentSegmentCard({
  lesson,
  currentSegment,
  activeSegmentIndex,
  segmentCount,
  isRecorderSupported,
  practiceError,
  logsError,
  isLogsLoading,
  currentLog,
  disablePracticeActions,
  onRefreshLogs,
  onStartRecording,
}: CurrentSegmentCardProps) {
  const currentLogCard = currentLog ? renderLogCard(currentLog, disablePracticeActions, onStartRecording) : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>当前句子</CardTitle>
        <CardDescription>
          句子 {activeSegmentIndex + 1} / {segmentCount}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="rounded-xl bg-gray-50 p-5">
          {lesson.language === 'en' ? (
            <>
              <p className="text-xl font-semibold text-gray-900 leading-relaxed">{currentSegment.originalText}</p>
              <p className="text-base text-blue-700 mt-3">{currentSegment.translatedText || '尚未生成中文翻译'}</p>
            </>
          ) : (
            <ChineseSegment
              originalText={currentSegment.originalText}
              pinyinText={currentSegment.pinyinText}
              isSelected
            />
          )}
        </div>
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-lg font-semibold text-gray-900">我的朗读</h3>
            <div className="flex items-center gap-2">
              {!isRecorderSupported && <span className="text-sm text-gray-500">当前浏览器不支持录音，仅记录文本</span>}
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  onRefreshLogs();
                }}
                disabled={isLogsLoading}
              >
                <RefreshCcw className="w-4 h-4 mr-2" />
                {isLogsLoading ? '刷新中...' : '刷新'}
              </Button>
            </div>
          </div>
          {practiceError && (
            <Alert variant='destructive'>
              <AlertDescription>{practiceError}</AlertDescription>
            </Alert>
          )}
          {logsError && (
            <Alert variant='destructive'>
              <AlertDescription>{logsError}</AlertDescription>
            </Alert>
          )}
          {isLogsLoading ? (
            <p className="text-sm text-gray-500">加载朗读记录...</p>
          ) : currentLogCard ? (
            currentLogCard
          ) : (
            <p className="text-sm text-gray-500">还没有朗读记录，点击下方“开始跟读”开启练习！</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function renderLogCard(
  log: StudyLogEntry,
  disablePracticeActions: boolean,
  onStartRecording: () => void | Promise<void>
): JSX.Element {
  const feedback = getFeedbackMessage(log.rating);
  const audioSrc = log.audioUrl ? buildFileProxyPath(log.audioUrl) : null;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <LogTimestamp log={log} />
        <span
          className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm font-semibold ${ratingBadgeStyles[log.rating]}`}
        >
          <span>{feedback?.emoji}</span>
          <span>{feedback?.title}</span>
        </span>
      </div>
      {log.userTranscript && <p className="text-sm text-gray-700 leading-relaxed">识别：{log.userTranscript}</p>}
      {audioSrc ? (
        <audio className="w-full rounded-lg border border-gray-200" controls preload="metadata" src={audioSrc} />
      ) : (
        <p className="text-xs text-gray-400">此记录无音频，仅保存文本。</p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            onStartRecording();
          }}
          disabled={disablePracticeActions}
        >
          <RefreshCcw className="w-4 h-4 mr-2" />
          重读
        </Button>
      </div>
    </div>
  );
}

function LogTimestamp({ log }: { log: StudyLogEntry }) {
  const timestamp = new Date(log.timestamp).toLocaleString('zh-CN', { hour12: false });
  const durationLabel = formatDurationLabel(log.durationMs);

  return (
    <div>
      <p className="text-sm text-gray-500">{timestamp}</p>
      <p className="text-xs text-gray-400">{durationLabel || '未记录时长'}</p>
    </div>
  );
}

function formatDurationLabel(value: number | null) {
  if (!value) return '';
  const seconds = Math.max(Math.round(value / 1000), 1);
  return `约 ${seconds} 秒`;
}

