'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { evaluateTranscript } from '@/lib/evaluate';
import {
  startSpeechRecognition,
  checkSpeechSupport,
  createSherpaRecognizer,
  preloadSherpaAssets,
  type SherpaRecognizer,
} from '@/lib/speech';
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
  const [isRecognizerLoading, setIsRecognizerLoading] = useState(false);
  const [isRecognizerReady, setIsRecognizerReady] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState('');

  const speechSupport = useMemo(() => checkSpeechSupport(), []);
  const sherpaRecognizerRef = useRef<SherpaRecognizer | null>(null);
  const pendingSegmentRef = useRef<{ segment: Segment; targetText: string } | null>(null);
  const handleTranscriptResultRef = useRef<(transcript: string) => Promise<void>>(async () => undefined);
  const handleSherpaErrorRef = useRef<(error: Error) => void>(() => undefined);
  const prevActiveSegmentIndexRef = useRef<number | null>(null);
  const isRecordingRef = useRef(isRecording);

  const {
    startRecording: startAudioRecording,
    stopRecording: stopAudioRecording,
    cancelRecording,
    isSupported: isRecorderSupported,
  } = useAudioRecorder();

  // 同步更新 isRecordingRef，以便在 useEffect 中访问最新值
  useEffect(() => {
    isRecordingRef.current = isRecording;
  }, [isRecording]);

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
      // 只有在 activeSegmentIndex 实际变化时才执行清理
      const prevIndex = prevActiveSegmentIndexRef.current;
      
      // 如果 segment 真的变化了（不是初始化），才执行清理
      if (prevIndex !== null && prevIndex !== activeSegmentIndex) {
        // 切换 segment 时重置状态
        setLiveTranscript('');
        setPracticeError('');
        // 如果正在录音，停止录音（使用 ref 访问最新值，避免闭包问题）
        if (isRecordingRef.current) {
          setIsRecording(false);
          cancelRecording();
          sherpaRecognizerRef.current?.stop();
          pendingSegmentRef.current = null;
        }
      }

      // 更新 prevActiveSegmentIndexRef
      prevActiveSegmentIndexRef.current = activeSegmentIndex;

      fetchSegmentLogs(segment.id);
    }
  }, [lesson, activeSegmentIndex, fetchSegmentLogs, cancelRecording]);

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

  const handleTranscriptResult = useCallback(
    async (transcript: string) => {
      const pending = pendingSegmentRef.current;
      if (!pending) {
        return;
      }

      pendingSegmentRef.current = null;
      const { segment, targetText } = pending;

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
        formData.append('segmentId', segment.id);
        formData.append('rating', rating);
        formData.append('userTranscript', transcript);
        if (audioResult?.blob) {
          formData.append('audio', audioResult.blob, `${segment.id}-${Date.now()}.webm`);
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
          [segment.id]: rating,
        }));
        updateSegmentLog(segment.id, data.log ?? null);

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
        sherpaRecognizerRef.current?.stop();
        setIsRecording(false);
      }
    },
    [lesson, setActiveSegmentIndex, stopAudioRecording, updateSegmentLog]
  );

  const handleSherpaError = useCallback(
    (error: Error) => {
      console.error('Sherpa 识别失败:', error);
      pendingSegmentRef.current = null;
      cancelRecording();
      sherpaRecognizerRef.current?.stop();
      setIsRecording(false);
      setPracticeError(error?.message || 'Sherpa 语音识别失败，请稍后重试');
      setLiveTranscript('');
    },
    [cancelRecording]
  );

  handleTranscriptResultRef.current = handleTranscriptResult;
  handleSherpaErrorRef.current = handleSherpaError;

  const getSherpaRecognizer = useCallback(() => {
    if (!sherpaRecognizerRef.current) {
      sherpaRecognizerRef.current = createSherpaRecognizer(
        {},
        {
          onFinal: (text) => {
            setLiveTranscript(text);
            handleTranscriptResultRef.current(text);
          },
          onPartial: (text) => {
            setLiveTranscript(text);
          },
          onError: (error) => {
            handleSherpaErrorRef.current(error);
          },
        }
      );
      setIsRecognizerReady(true);
    }
    return sherpaRecognizerRef.current;
  }, []);

  const loadSherpaModel = useCallback(async () => {
    if (isRecognizerReady) {
      return;
    }

    try {
      setPracticeError('');
      setIsRecognizerLoading(true);
      await preloadSherpaAssets();
      getSherpaRecognizer();
      setIsRecognizerReady(true);
    } catch (error) {
      console.error('预加载 Sherpa 模型失败:', error);
      setPracticeError(error instanceof Error ? error.message : '模型加载失败，请稍后重试');
    } finally {
      setIsRecognizerLoading(false);
    }
  }, [getSherpaRecognizer, isRecognizerReady]);

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
    setLiveTranscript('');
    pendingSegmentRef.current = { segment: currentSegment, targetText };

    const recorderStarted = await startAudioRecording();
    if (isRecorderSupported && !recorderStarted) {
      setPracticeError('无法启动录音，请检查麦克风权限');
      setIsRecording(false);
      pendingSegmentRef.current = null;
      return;
    }

    try {
      const sherpa = getSherpaRecognizer();
      const started = await sherpa.start();
      if (started) {
        return;
      }
    } catch (error) {
      console.warn('Sherpa 启动失败，尝试使用 Web Speech API', error);
    }

    const recognition = startSpeechRecognition(
      recognitionLang,
      async (transcript) => {
        setLiveTranscript(transcript);
        await handleTranscriptResult(transcript);
      },
      (error) => {
        console.error('录音失败:', error);
        pendingSegmentRef.current = null;
        cancelRecording();
        setIsRecording(false);
        setPracticeError('录音失败，请检查麦克风权限');
      }
    );

    if (!recognition) {
      cancelRecording();
      setIsRecording(false);
      pendingSegmentRef.current = null;
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
    getSherpaRecognizer,
    handleTranscriptResult,
  ]);

  const disablePracticeActions = isRecording || !canPractice;

  useEffect(() => {
    return () => {
      sherpaRecognizerRef.current?.dispose();
      sherpaRecognizerRef.current = null;
    };
  }, []);

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
    loadSherpaModel,
    isRecognizerLoading,
    isRecognizerReady,
    liveTranscript,
  };
}

