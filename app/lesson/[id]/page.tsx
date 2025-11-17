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
import { speakText, startSpeechRecognition, stopSpeechRecognition, checkSpeechSupport } from '@/lib/speech';
import { evaluateTranscript, getFeedbackMessage } from '@/lib/evaluate';
import { handlePlayOriginal as handleOriginalPlayback } from '@/lib/audio/handle-play-original';

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
  const [feedbackDialog, setFeedbackDialog] = useState<{
    open: boolean;
    rating: 'GOOD' | 'OK' | 'RETRY' | null;
  }>({ open: false, rating: null });
  const [infoMessage, setInfoMessage] = useState('');
  const [isSegmenting, setIsSegmenting] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);

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
      fallbackToTTS,
    });
  };

  // TTS 回退方案
  const fallbackToTTS = async () => {
    if (!lesson) return;
    const segment = lesson.segments[activeSegmentIndex];

    // 根据源语言决定播放什么
    let textToSpeak = segment.originalText;
    let lang: 'zh-CN' | 'en-US' = 'zh-CN';

    if (lesson.language === 'en') {
      // 英文片源：播放中文翻译
      textToSpeak = segment.translatedText || segment.originalText;
      lang = 'zh-CN';
    } else {
      // 中文片源：播放中文原文
      textToSpeak = segment.originalText;
      lang = 'zh-CN';
    }

    try {
      await speakText(textToSpeak, lang);
    } catch (error) {
      console.error('TTS 播放失败:', error);
    }
  };

  // 开始录音跟读
  const handleStartRecording = () => {
    if (!lesson || lesson.segments.length === 0) return;
    const segment = lesson.segments[activeSegmentIndex];

    // 确定跟读的目标文本
    let targetText = segment.originalText;
    if (lesson.language === 'en') {
      // 英文片源：跟读中文翻译
      targetText = segment.translatedText || segment.originalText;
    }
    // 中文片源：跟读中文原文（已经是 originalText）

    // 始终使用中文识别（因为学习目标是中文）
    const lang = 'zh-CN';

    setIsRecording(true);

    startSpeechRecognition(
      lang,
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

        // 显示反馈
        setFeedbackDialog({ open: true, rating });
        setIsRecording(false);
      },
      (error) => {
        console.error('录音失败:', error);
        setIsRecording(false);
        alert('录音失败，请检查麦克风权限');
      }
    );
  };

  // 下一句
  const handleNext = () => {
    if (lesson && activeSegmentIndex < lesson.segments.length - 1) {
      setActiveSegmentIndex(activeSegmentIndex + 1);
    }
  };

  // 上一句
  const handlePrevious = () => {
    if (activeSegmentIndex > 0) {
      setActiveSegmentIndex(activeSegmentIndex - 1);
    }
  };

  // 关闭反馈对话框
  const handleCloseFeedback = () => {
    setFeedbackDialog({ open: false, rating: null });

    // 如果是 GOOD，自动跳到下一句
    if (feedbackDialog.rating === 'GOOD') {
      handleNext();
    }
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
      <audio
        ref={audioRef}
        src={proxiedAudioUrl ?? undefined}
        preload="auto"
        className="hidden"
        aria-hidden="true"
      />
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link href="/">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="w-4 h-4 mr-2" />
                返回
              </Button>
            </Link>
            <h1 className="text-xl font-bold text-gray-900">{lesson.title}</h1>
            <div className="text-sm text-gray-600">
              {hasSegments ? `${activeSegmentIndex + 1} / ${lesson.segments.length}` : '0 / 0'}
            </div>
          </div>
          <Progress value={progress} className="mt-2" />
        </div>
      </header>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8 max-w-4xl space-y-6">
        <div className="space-y-3">
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
        </div>

        {/* 浏览器支持检查 */}
        {!speechSupport.fullSupport && (
          <Alert className="mb-6">
            <AlertDescription>
              您的浏览器不完全支持语音功能。建议使用 Chrome 或 Edge 浏览器以获得最佳体验。
            </AlertDescription>
          </Alert>
        )}

        {/* 语言标识 */}
        <div className="mb-6 text-center">
          <span className="inline-block px-4 py-2 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
            {lesson.language === 'en' ? '🇬🇧 英文片源 → 中文学习' : '🇨🇳 中文片源'}
          </span>
        </div>
        <Card>
          <CardContent className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm text-gray-500">当前状态</p>
              <p className="text-lg font-medium text-gray-900">{currentStatus.label}</p>
              <p className="text-sm text-gray-600 mt-1">{currentStatus.description}</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button
                variant="outline"
                onClick={handleSegmentLesson}
                disabled={isSegmenting || ['PENDING', 'PROCESSING'].includes(lesson.status)}
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
                >
                  {isTranslating ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      正在翻译...
                    </>
                  ) : (
                    <>
                      <RefreshCcw className="w-4 h-4 mr-2" />
                      翻译（含拼音）
                    </>
                  )}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>


        <div className="flex justify-center gap-4">
          <Button
            size="lg"
            variant="outline"
            onClick={handlePlayOriginal}
            disabled={!speechSupport.synthesis || !currentSegment}
          >
            <Volume2 className="w-5 h-5 mr-2" />
            老师示范
          </Button>
          <Button
            size="lg"
            onClick={handleStartRecording}
            disabled={isRecording || !speechSupport.recognition || !canPractice}
            className="bg-green-600 hover:bg-green-700"
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
        {/* 所有句子列表 */}
        {hasSegments ? (
          <Card>
            <CardHeader>
              <CardTitle>课程内容</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {lesson.segments.map((segment, index) => (
                  <button
                    key={segment.id}
                    onClick={() => setActiveSegmentIndex(index)}
                    className={`w-full text-left p-3 rounded-lg transition-colors ${
                      index === activeSegmentIndex
                        ? 'bg-blue-100 border-2 border-blue-500'
                        : 'bg-gray-50 hover:bg-gray-100'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <span className="font-semibold text-gray-500 min-w-[2rem]">
                        {index + 1}.
                      </span>
                      <div className="flex-1">
                        {lesson.language === 'en' ? (
                          <>
                            <p className="text-sm text-gray-500">{segment.originalText}</p>
                            <p className="font-medium text-blue-600">
                              {segment.translatedText || '尚未生成中文翻译'}
                            </p>
                          </>
                        ) : (
                          <>
                            <p className="font-medium">{segment.originalText}</p>
                            <p className="text-sm text-gray-600 mt-1">
                              {segment.pinyinText || '尚未生成拼音'}
                            </p>
                          </>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>暂无句子</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">
                还没有可练习的内容。请先点击上方“分段”按钮生成句子，再继续翻译或练习。
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* 反馈对话框 */}
      <Dialog open={feedbackDialog.open} onOpenChange={(open) => !open && handleCloseFeedback()}>
        <DialogContent>
          {feedbackDialog.rating && (
            <>
              <DialogHeader>
                <DialogTitle className="text-center text-4xl mb-4">
                  {getFeedbackMessage(feedbackDialog.rating).emoji}
                </DialogTitle>
                <DialogTitle className={`text-center text-2xl ${getFeedbackMessage(feedbackDialog.rating).color}`}>
                  {getFeedbackMessage(feedbackDialog.rating).title}
                </DialogTitle>
                <DialogDescription className="text-center text-lg">
                  {getFeedbackMessage(feedbackDialog.rating).message}
                </DialogDescription>
              </DialogHeader>
              <div className="flex gap-4 mt-4">
                {feedbackDialog.rating === 'GOOD' ? (
                  <Button onClick={handleCloseFeedback} className="w-full" size="lg">
                    继续下一句 →
                  </Button>
                ) : (
                  <>
                    <Button onClick={handleCloseFeedback} variant="outline" className="flex-1">
                      关闭
                    </Button>
                    <Button onClick={handleStartRecording} className="flex-1">
                      再试一次
                    </Button>
                  </>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

