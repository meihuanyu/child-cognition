'use client';

import { useCallback, useEffect, useMemo, useState, type RefObject } from 'react';
import { evaluateTranscript } from '@/lib/evaluate';
import { startSpeechRecognition, checkSpeechSupport } from '@/lib/speech';
import { handlePlayOriginal as handleOriginalPlayback } from '@/lib/audio/handle-play-original';
import { useAudioRecorder, RecorderStopResult } from '@/lib/use-audio-recorder';
import type { Lesson, Segment, SegmentPracticeResults, StudyLogEntry } from '../types';
import { DEMO_USER_ID } from '../types';

interface PracticeControllerParams {
  lesson: Lesson | null;
  canPractice: boolean;
  proxiedAudioUrl: string | null;
  audioRef: RefObject<HTMLAudioElement>;
  fetchSegmentLogs: (segmentId: string) => Promise<void> | void;
  updateSegmentLog: (segmentId: string, log: StudyLogEntry | null) => void;
}

export function usePracticeController({
  lesson,
  canPractice,
  proxiedAudioUrl,
  audioRef,
  fetchSegmentLogs,
  updateSegmentLog,
}: PracticeControllerParams) {
  const [activeSegmentIndex, setActiveSegmentIndex] = useState(0);
  const [segmentPracticeResults, setSegmentPracticeResults] = useState<SegmentPracticeResults>({});
  const [isRecording, setIsRecording] = useState(false);
  const [practiceError, setPracticeError] = useState('');

  const speechSupport = useMemo(() => checkSpeechSupport(), []);

  const {
    startRecording: startAudioRecording,
    stopRecording: stopAudioRecording,
    cancelRecording,
    isSupported: isRecorderSupported,
  } = useAudioRecorder();

  useEffect(() => {
    if (!lesson || lesson.segments.length === 0) {
      setActiveSegmentIndex(0);
      return;
    }
    setActiveSegmentIndex((prev) => Math.min(prev, lesson.segments.length - 1));
  }, [lesson?.segments.length]);

  useEffect(() => {
    if (!lesson || lesson.segments.length === 0) return;
    const segment = lesson.segments[activeSegmentIndex];
    if (segment) {
      fetchSegmentLogs(segment.id);
    }
  }, [lesson, activeSegmentIndex, fetchSegmentLogs]);

  const currentSegment: Segment | null =
    lesson && lesson.segments.length > 0 ? lesson.segments[activeSegmentIndex] : null;

  const handlePlayOriginal = useCallback(async () => {
    if (!lesson) return;
    await handleOriginalPlayback({
      segment: currentSegment ?? undefined,
      proxiedAudioUrl,
      audioElement: audioRef.current,
    });
  }, [lesson, currentSegment, proxiedAudioUrl, audioRef]);

  const handleStartRecording = useCallback(async () => {
    if (!lesson || !currentSegment) return;

    const isEnglishLesson = lesson.language === 'en';
    const targetText = currentSegment.originalText?.trim();
    const recognitionLang: 'zh-CN' | 'en-US' = isEnglishLesson ? 'en-US' : 'zh-CN';

    if (!targetText) {
      alert('该句子暂不可用，请选择其他句子继续练习。');
      return;
    }

    setPracticeError('');
    setIsRecording(true);

    const recorderStarted = await startAudioRecording();
    if (isRecorderSupported && !recorderStarted) {
      setPracticeError('无法启动录音，请检查麦克风权限');
      setIsRecording(false);
      return;
    }

    const recognition = startSpeechRecognition(
      recognitionLang,
      async (transcript) => {
        try {
          const rating = evaluateTranscript(targetText, transcript);
          let audioResult: RecorderStopResult | null = null;
          try {
            audioResult = await stopAudioRecording();
          } catch (err) {
            console.error('停止录音失败:', err);
          }

          const formData = new FormData();
          formData.append('userId', DEMO_USER_ID);
          formData.append('segmentId', currentSegment.id);
          formData.append('rating', rating);
          formData.append('userTranscript', transcript);
          if (audioResult?.blob) {
            formData.append('audio', audioResult.blob, `${currentSegment.id}-${Date.now()}.webm`);
            if (audioResult.durationMs) {
              formData.append('durationMs', `${audioResult.durationMs}`);
            }
          }

          const response = await fetch('/api/logs/create', {
            method: 'POST',
            body: formData,
          });
          const data = await response.json();
          if (!response.ok) {
            throw new Error(data.error || '保存朗读记录失败');
          }

          setSegmentPracticeResults((prev) => ({
            ...prev,
            [currentSegment.id]: rating,
          }));
          updateSegmentLog(currentSegment.id, data.log ?? null);

          if (rating === 'GOOD') {
            setActiveSegmentIndex((prevIndex) => {
              if (!lesson) return prevIndex;
              if (prevIndex < lesson.segments.length - 1) {
                return prevIndex + 1;
              }
              return prevIndex;
            });
          }
        } catch (err: any) {
          console.error('保存朗读记录失败:', err);
          setPracticeError(err?.message || '保存朗读记录失败，请稍后重试');
        } finally {
          setIsRecording(false);
        }
      },
      (error) => {
        console.error('录音失败:', error);
        cancelRecording();
        setIsRecording(false);
        setPracticeError('录音失败，请检查麦克风权限');
      }
    );

    if (!recognition) {
      cancelRecording();
      setIsRecording(false);
      setPracticeError('浏览器暂不支持语音识别，请更换或更新浏览器');
      return;
    }
  }, [
    lesson,
    currentSegment,
    setActiveSegmentIndex,
    startAudioRecording,
    isRecorderSupported,
    startSpeechRecognition,
    stopAudioRecording,
    updateSegmentLog,
    cancelRecording,
  ]);

  const disablePracticeActions = isRecording || !speechSupport.recognition || !canPractice;

  return {
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
  };
}

