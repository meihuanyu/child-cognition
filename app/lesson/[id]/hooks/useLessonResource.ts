'use client';

import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import type { Lesson, LessonStatus } from '../types';
import { buildFileProxyPath, extractS3KeyFromUrl } from '../utils';

type StatusTone = 'info' | 'warn' | 'error' | 'success';

export interface StatusMeta {
  label: string;
  description: string;
  tone: StatusTone;
}

const STATUS_META: Record<LessonStatus, StatusMeta> = {
  PENDING: {
    label: '准备资源',
    description: '后台正在下载音频和字幕，稍后可进行分段。',
    tone: 'info',
  },
  PROCESSING: {
    label: '处理中',
    description: '系统正在整理课程资源，完成后即可分段。',
    tone: 'info',
  },
  READY_FOR_SEGMENT: {
    label: '可分段',
    description: '点击“分段”生成可练习的句子列表。',
    tone: 'success',
  },
  SEGMENTING: {
    label: '分段进行中',
    description: '正在拆分字幕，稍候几秒即可完成。',
    tone: 'info',
  },
  READY_FOR_TRANSLATION: {
    label: '可翻译',
    description: '分段已完成，可继续生成中文翻译与拼音。',
    tone: 'success',
  },
  TRANSLATING: {
    label: '翻译进行中',
    description: '正在生成中文翻译和拼音，请稍候。',
    tone: 'info',
  },
  DONE: {
    label: '已完成',
    description: '可以直接开始跟读练习。',
    tone: 'success',
  },
  ERROR: {
    label: '处理失败',
    description: '可尝试重新分段或翻译，如果仍失败请联系支持。',
    tone: 'error',
  },
};

const FALLBACK_STATUS: StatusMeta = {
  label: '未知状态',
  description: '请刷新页面或稍后重试。',
  tone: 'warn',
};

export function useLessonResource(lessonId: string | undefined, audioRef: RefObject<HTMLAudioElement>) {
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [infoMessage, setInfoMessage] = useState('');
  const [isSegmenting, setIsSegmenting] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [proxiedAudioUrl, setProxiedAudioUrl] = useState<string | null>(null);

  const lessonIdRef = useRef(lessonId);
  lessonIdRef.current = lessonId;

  const fetchLesson = useCallback(async () => {
    const id = lessonIdRef.current;
    if (!id) {
      setError('课程不存在');
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch(`/api/lessons/${id}`);
      if (!response.ok) {
        throw new Error('课程不存在');
      }
      const data = await response.json();
      setLesson(data);
      setError('');
    } catch (err: any) {
      setError(err?.message || '加载课程失败');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLesson();
  }, [fetchLesson]);

  useEffect(() => {
    if (!lesson?.audioUrl) {
      setProxiedAudioUrl(null);
      return;
    }

    const key = extractS3KeyFromUrl(lesson.audioUrl);
    if (!key) {
      setProxiedAudioUrl(null);
      return;
    }
    setProxiedAudioUrl(buildFileProxyPath(key));
  }, [lesson?.audioUrl]);

  useEffect(() => {
    return () => {
      const audio = audioRef.current;
      if (audio) {
        audio.pause();
        audio.removeAttribute('src');
      }
    };
  }, [audioRef]);

  useEffect(() => {
    const autoRefreshStatuses: LessonStatus[] = ['PENDING', 'PROCESSING', 'SEGMENTING', 'TRANSLATING'];
    if (!lesson || !autoRefreshStatuses.includes(lesson.status)) {
      return;
    }

    const interval = setInterval(() => {
      fetchLesson();
    }, 3000);

    return () => clearInterval(interval);
  }, [lesson, fetchLesson]);

  const handleSegmentLesson = useCallback(async () => {
    if (!lesson) return;
    setIsSegmenting(true);
    setError('');
    setInfoMessage('');

    try {
      const response = await fetch(`/api/lessons/segment/${lesson.id}`, { method: 'POST' });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || data.message || '分段失败');
      }
      setInfoMessage(`分段完成，生成 ${data.segmentsCount} 个句子`);
      await fetchLesson();
    } catch (err: any) {
      setError(err?.message || '分段失败，请重试');
    } finally {
      setIsSegmenting(false);
    }
  }, [lesson, fetchLesson]);

  const handleTranslateLesson = useCallback(async () => {
    if (!lesson) return;
    setIsTranslating(true);
    setError('');
    setInfoMessage('');

    try {
      const response = await fetch(`/api/lessons/translate/${lesson.id}`, { method: 'POST' });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || data.message || '翻译失败');
      }
      setInfoMessage(`翻译完成，共 ${data.translatedCount} 个句子`);
      await fetchLesson();
    } catch (err: any) {
      setError(err?.message || '翻译失败，请重试');
    } finally {
      setIsTranslating(false);
    }
  }, [lesson, fetchLesson]);

  const currentStatus = lesson ? STATUS_META[lesson.status] ?? FALLBACK_STATUS : FALLBACK_STATUS;

  return {
    lesson,
    isLoading,
    error,
    setError,
    infoMessage,
    setInfoMessage,
    proxiedAudioUrl,
    isSegmenting,
    isTranslating,
    currentStatus,
    handleSegmentLesson,
    handleTranslateLesson,
  };
}

