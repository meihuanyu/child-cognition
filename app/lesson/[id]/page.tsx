'use client';

import { useRef } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

import { LessonHeader } from './components/LessonHeader';
import { StatusPanel } from './components/StatusPanel';
import { CurrentSegmentCard } from './components/CurrentSegmentCard';
import { SegmentList } from './components/SegmentList';
import { PracticeActionBar } from './components/PracticeActionBar';
import { useLessonResource } from './hooks/useLessonResource';
import { useSegmentLogs } from './hooks/useSegmentLogs';
import { usePracticeController } from './hooks/usePracticeController';
import { DEMO_USER_ID } from './types';

export default function LessonPage() {
  const params = useParams();
  const lessonId = params.id as string;
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const {
    lesson,
    isLoading,
    error,
    infoMessage,
    proxiedAudioUrl,
    isSegmenting,
    isTranslating,
    currentStatus,
    handleSegmentLesson,
    handleTranslateLesson,
  } = useLessonResource(lessonId, audioRef);

  const { segmentLogs, logsError, logsLoadingSegmentId, fetchSegmentLogs, updateSegmentLog } =
    useSegmentLogs(DEMO_USER_ID);

  const segmentCount = lesson?.segments.length ?? 0;
  const hasSegments = segmentCount > 0;
  const canPractice = Boolean(lesson && lesson.status === 'DONE' && hasSegments);

  const {
    activeSegmentIndex,
    setActiveSegmentIndex,
    currentSegment,
    segmentPracticeResults,
    isRecording,
    practiceError,
    handleStartRecording,
    handlePlayOriginal,
    disablePracticeActions,
    isRecorderSupported,
    speechSupport,
    loadSherpaModel,
    isRecognizerLoading,
    isRecognizerReady,
    liveTranscript,
  } = usePracticeController({
    lesson,
    canPractice,
    proxiedAudioUrl,
    audioRef,
    fetchSegmentLogs,
    updateSegmentLog,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-lg text-gray-600">加载课程中...</p>
        </div>
      </div>
    );
  }

  if (!lesson) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle className="text-red-600">加载失败</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600 mb-4">{error || '课程不存在'}</p>
            <Link href="/">
              <Button>返回首页</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const progress = hasSegments ? ((activeSegmentIndex + 1) / segmentCount) * 100 : 0;
  const currentSegmentLog = currentSegment ? segmentLogs[currentSegment.id] ?? null : null;
  const isCurrentLogsLoading = currentSegment ? logsLoadingSegmentId === currentSegment.id : false;
  const showTranslationButton = lesson.language === 'en';
  const showStatusAlerts = currentStatus.tone !== 'success';

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      <LessonHeader
        title={lesson.title}
        activeSegmentIndex={activeSegmentIndex}
        totalSegments={segmentCount}
        progress={progress}
      />

      <div className="container mx-auto px-4 pt-8 pb-32 max-w-4xl space-y-8">
        <StatusPanel
          showStatusAlerts={showStatusAlerts}
          infoMessage={infoMessage}
          error={error}
          currentStatus={currentStatus}
          language={lesson.language}
          audioRef={audioRef}
          proxiedAudioUrl={proxiedAudioUrl}
        />

        {currentSegment && (
          <CurrentSegmentCard
            key={currentSegment.id}
            lesson={lesson}
            currentSegment={currentSegment}
            activeSegmentIndex={activeSegmentIndex}
            segmentCount={segmentCount}
            isRecorderSupported={isRecorderSupported}
            practiceError={practiceError}
            logsError={logsError}
            isLogsLoading={isCurrentLogsLoading}
            currentLog={currentSegmentLog}
            disablePracticeActions={disablePracticeActions}
            isRecording={isRecording}
            onLoadRecognizer={loadSherpaModel}
            isRecognizerLoading={isRecognizerLoading}
            isRecognizerReady={isRecognizerReady}
            liveTranscript={liveTranscript}
            onRefreshLogs={() => fetchSegmentLogs(currentSegment.id)}
            onStartRecording={handleStartRecording}
          />
        )}

        {hasSegments ? (
          <SegmentList
            lesson={lesson}
            activeSegmentIndex={activeSegmentIndex}
            segmentPracticeResults={segmentPracticeResults}
            onSelect={(index) => setActiveSegmentIndex(index)}
          />
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl font-semibold">暂无句子</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-base text-gray-600 leading-relaxed">
                还没有可练习的内容。请先点击下方“分段”按钮生成句子，再继续翻译或练习。
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      <PracticeActionBar
        lesson={lesson}
        currentSegment={currentSegment}
        showTranslationButton={showTranslationButton}
        isSegmenting={isSegmenting}
        isTranslating={isTranslating}
        onSegmentLesson={handleSegmentLesson}
        onTranslateLesson={handleTranslateLesson}
        onPlayOriginal={handlePlayOriginal}
        speechSupport={speechSupport}
      />
    </div>
  );
}

