'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ArrowLeft, Loader2, Volume2, Mic, Play, RefreshCcw } from 'lucide-react';
import { startSpeechRecognition, checkSpeechSupport } from '@/lib/speech';
import { evaluateTranscript, getFeedbackMessage } from '@/lib/evaluate';
import { handlePlayOriginal as handleOriginalPlayback } from '@/lib/audio/handle-play-original';
import { ChineseSegment } from '@/components/chinese-segment';

interface Segment {
  id: string;
  order: number;
  originalText: string;          // 原文（英文或中文）
  translatedText: string | null; // 中文翻译（仅英文片源）
  pinyinText: string | null;     // 拼音
  startTime: number | null;      // 开始时间（秒）
  endTime: number | null;        // 结束时间（秒）
}

interface Lesson {
  id: string;
  title: string;
  sourceUrl: string;
  status: string;
  language: string | null;       // 源语言 ('en' 或 'zh')
  audioUrl: string | null;       // 完整音频 URL
  segments: Segment[];
}

function extractS3KeyFromUrl(input: string | null): string | null {
  if (!input) return null;

  try {
    const parsed = new URL(input);
    const key = parsed.pathname.replace(/^\/+/, '');
    return key || null;
  } catch {
    const normalized = input.replace(/^\/+/, '');
    return normalized || null;
  }
}

function buildFileProxyPath(key: string): string {
  const encoded = key
    .split('/')
    .filter((segment) => segment.length > 0)
    .map((segment) => encodeURIComponent(segment));

  return `/api/files/${encoded.join('/')}`;
}

export default function LessonPage() {
  const params = useParams();
  const lessonId = params.id as string;

  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeSegmentIndex, setActiveSegmentIndex] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [proxiedAudioUrl, setProxiedAudioUrl] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [infoMessage, setInfoMessage] = useState('');
  const [isSegmenting, setIsSegmenting] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [segmentPracticeResults, setSegmentPracticeResults] = useState<
    Record<string, 'GOOD' | 'OK' | 'RETRY'>
  >({});

  // MVP: 使用固定的用户 ID
  const DEMO_USER_ID = 'demo-user-001';

  // 检查浏览器支持
  const speechSupport = checkSpeechSupport();

  const fetchLesson = useCallback(async () => {
    try {
      const response = await fetch(`/api/lessons/${lessonId}`);
      if (!response.ok) {
        throw new Error('课程不存在');
      }
      const data = await response.json();
      setLesson(data);
      setError('');
      setIsLoading(false);
    } catch (err: any) {
      setError(err.message);
      setIsLoading(false);
    }
  }, [lessonId]);

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
    const autoRefreshStatuses = ['PENDING', 'PROCESSING', 'SEGMENTING', 'TRANSLATING'];
    if (!lesson || !autoRefreshStatuses.includes(lesson.status)) {
      return;
    }

    const interval = setInterval(() => {
      fetchLesson();
    }, 3000);

    return () => clearInterval(interval);
  }, [lesson, fetchLesson]);

  const handleSegmentLesson = async () => {
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
      setError(err.message || '分段失败，请重试');
    } finally {
      setIsSegmenting(false);
    }
  };

  const handleTranslateLesson = async () => {
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
      setError(err.message || '翻译失败，请重试');
    } finally {
      setIsTranslating(false);
    }
  };

  // 页面卸载时清理音频播放
  useEffect(() => {
    return () => {
      const audio = audioRef.current;
      if (audio) {
        audio.pause();
        audio.removeAttribute('src');
      }
    };
  }, []);

  // 播放当前句子
  const handlePlayOriginal = async () => {
    await handleOriginalPlayback({
      segment: lesson?.segments?.[activeSegmentIndex],
      proxiedAudioUrl,
      audioElement: audioRef.current,
    });
  };

  // 开始录音跟读
  const handleStartRecording = () => {
    if (!lesson || lesson.segments.length === 0) return;
    const segment = lesson.segments[activeSegmentIndex];

    const isEnglishLesson = lesson.language === 'en';
    const targetText = segment.originalText?.trim();
    const recognitionLang: 'zh-CN' | 'en-US' = isEnglishLesson ? 'en-US' : 'zh-CN';

    if (!targetText) {
      alert('该句子暂不可用，请选择其他句子继续练习。');
      return;
    }

    setIsRecording(true);

    startSpeechRecognition(
      recognitionLang,
      async (transcript) => {
        // 评分（与目标文本比较）
        const rating = evaluateTranscript(targetText, transcript);

        // 记录日志
        await fetch('/api/logs/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: DEMO_USER_ID,
            segmentId: segment.id,
            rating,
            userTranscript: transcript,
          }),
        });

        setSegmentPracticeResults((prev) => ({
          ...prev,
          [segment.id]: rating,
        }));
        setIsRecording(false);

        if (rating === 'GOOD') {
          setActiveSegmentIndex((prevIndex) => {
            if (!lesson) return prevIndex;
            if (prevIndex < lesson.segments.length - 1) {
              return prevIndex + 1;
            }
            return prevIndex;
          });
          return;
        }
      },
      (error) => {
        console.error('录音失败:', error);
        setIsRecording(false);
        alert('录音失败，请检查麦克风权限');
      }
    );
  };

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

  if (error || !lesson) {
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

  const hasSegments = lesson.segments.length > 0;
  const currentSegment = hasSegments ? lesson.segments[activeSegmentIndex] : null;
  const progress = hasSegments
    ? ((activeSegmentIndex + 1) / lesson.segments.length) * 100
    : 0;
  const statusMeta: Record<
    Lesson['status'],
    { label: string; description: string; tone: 'info' | 'warn' | 'error' | 'success' }
  > = {
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
  const fallbackStatus = {
    label: '未知状态',
    description: '请刷新页面或稍后重试。',
    tone: 'warn' as const,
  };
  const currentStatus = statusMeta[lesson.status] ?? fallbackStatus;
  const showTranslationButton = lesson.language === 'en';
  const canPractice = hasSegments && lesson.status === 'DONE';

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm  z-10">
        <div className="container mx-auto px-4 py-5 md:py-6">
          <div className="flex items-center justify-between">
            <Link href="/">
              <Button variant="ghost" size="sm" className="text-base font-semibold">
                <ArrowLeft className="w-4 h-4 mr-2" />
                返回
              </Button>
            </Link>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900">{lesson.title}</h1>
            <div className="text-base font-medium text-gray-600">
              {hasSegments ? `${activeSegmentIndex + 1} / ${lesson.segments.length}` : '0 / 0'}
            </div>
          </div>
          <Progress value={progress} className="mt-4" />
        </div>
      </header>

      {/* Main Content */}
      <div className="container mx-auto px-4 pt-8 pb-32 max-w-4xl space-y-8">
        {currentStatus.tone !== 'success' && <div className="space-y-3">
          {infoMessage && (
            <Alert>
              <AlertDescription>{infoMessage}</AlertDescription>
            </Alert>
          )}
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <Alert variant={currentStatus.tone === 'error' ? 'destructive' : 'default'}>
            <AlertDescription>
              <span className="font-medium">课程状态：{currentStatus.label}</span>
              <br />
              {currentStatus.description}
            </AlertDescription>
          </Alert>
        </div>}


        {/* 语言标识 */}
        <div className="mb-8 text-center">
          <span className="inline-block px-5 py-2.5 bg-blue-100 text-blue-700 rounded-full text-base font-semibold">
            {lesson.language === 'en' ? '🇬🇧 英文片源 → 中文学习' : '🇨🇳 中文片源'}
          </span>
        </div>
        <Card>
          <CardContent className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <audio
              ref={audioRef}
              src={proxiedAudioUrl ?? undefined}
              preload="auto"
              controls
              className="w-full mt-6 rounded-lg border border-gray-200"
            />

          </CardContent>
        </Card>
        {/* 所有句子列表 */}
        {hasSegments ? (
          <div className="space-y-3">
            {lesson.segments.map((segment, index) => (
              <button
                key={segment.id}
                onClick={() => setActiveSegmentIndex(index)}
                className={`w-full text-left p-4 md:p-5 rounded-xl transition-all border ${segmentPracticeResults[segment.id] === 'RETRY'
                    ? 'border-red-400 bg-red-50'
                    : index === activeSegmentIndex
                      ? 'border-blue-400 bg-blue-50 shadow-sm'
                      : 'border-transparent bg-gray-50 hover:bg-gray-100'
                  }`}
              >
                <div className="flex items-start gap-3">
                  <span className="text-base font-semibold text-gray-500 min-w-[2.5rem]">
                    {index + 1}.
                  </span>
                  <div className="flex-1">
                    {lesson.language === 'en' ? (
                      <>
                        <p className="text-lg font-semibold text-gray-900 leading-relaxed">
                          {segment.originalText}
                        </p>
                        <p className="text-sm text-blue-600 mt-2">
                          {segment.translatedText || '尚未生成中文翻译'}
                        </p>
                      </>
                    ) : (
                      <ChineseSegment
                        originalText={segment.originalText}
                        pinyinText={segment.pinyinText}
                        isSelected={index === activeSegmentIndex}
                      />
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl font-semibold">暂无句子</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-base text-gray-600 leading-relaxed">
                还没有可练习的内容。请先点击上方“分段”按钮生成句子，再继续翻译或练习。
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 border-t bg-white/80 backdrop-blur-sm shadow-lg">
        <div className="container mx-auto px-4 py-4 flex flex-wrap gap-3 justify-center">
          <Button
            variant="outline"
            onClick={handleSegmentLesson}
            disabled={isSegmenting || ['PENDING', 'PROCESSING'].includes(lesson.status)}
            className="px-5 py-5 text-base font-semibold"
          >
            {isSegmenting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                正在分段...
              </>
            ) : (
              <>
                <RefreshCcw className="w-4 h-4 mr-2" />
                分段
              </>
            )}
          </Button>
          {showTranslationButton && (
            <Button
              variant="outline"
              onClick={handleTranslateLesson}
              disabled={
                isTranslating ||
                lesson.segments.length === 0 ||
                ['PENDING', 'PROCESSING', 'SEGMENTING'].includes(lesson.status)
              }
              className="px-5 py-5 text-base font-semibold"
            >
              {isTranslating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  正在翻译...
                </>
              ) : (
                <>
                  <RefreshCcw className="w-4 h-4 mr-2" />
                  翻译
                </>
              )}
            </Button>
          )}

          <Button
            size="lg"
            variant="outline"
            onClick={handlePlayOriginal}
            disabled={!speechSupport.synthesis || !currentSegment}
            className="px-8 py-5 text-lg font-semibold"
          >
            <Volume2 className="w-5 h-5 mr-2" />
            示范
          </Button>
          <Button
            size="lg"
            onClick={handleStartRecording}
            disabled={isRecording || !speechSupport.recognition || !canPractice}
            className="px-8 py-5 text-lg font-semibold bg-green-600 hover:bg-green-700"
          >
            {isRecording ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                正在录音...
              </>
            ) : (
              <>
                <Mic className="w-5 h-5 mr-2" />
                开始跟读
              </>
            )}
          </Button>

        </div>
      </div>

    </div>
  );
}

