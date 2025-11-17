'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ArrowLeft, Loader2, Volume2, Mic, Play } from 'lucide-react';
import { speakText, startSpeechRecognition, stopSpeechRecognition, checkSpeechSupport } from '@/lib/speech';
import { evaluateTranscript, getFeedbackMessage } from '@/lib/evaluate';

interface Segment {
  id: string;
  order: number;
  originalText: string;
  pinyinText: string | null;
  englishMeaning: string | null;
}

interface Lesson {
  id: string;
  title: string;
  sourceUrl: string;
  status: string;
  segments: Segment[];
}

export default function LessonPage() {
  const params = useParams();
  const router = useRouter();
  const lessonId = params.id as string;

  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeSegmentIndex, setActiveSegmentIndex] = useState(0);
  const [mode, setMode] = useState<'chinese' | 'english'>('chinese');
  const [isRecording, setIsRecording] = useState(false);
  const [feedbackDialog, setFeedbackDialog] = useState<{
    open: boolean;
    rating: 'GOOD' | 'OK' | 'RETRY' | null;
  }>({ open: false, rating: null });

  // MVP: 使用固定的用户 ID
  const DEMO_USER_ID = 'demo-user-001';

  // 检查浏览器支持
  const speechSupport = checkSpeechSupport();

  // 加载课程数据
  useEffect(() => {
    const fetchLesson = async () => {
      try {
        const response = await fetch(`/api/lessons/${lessonId}`);
        if (!response.ok) {
          throw new Error('课程不存在');
        }
        const data = await response.json();
        setLesson(data);
        setIsLoading(false);
      } catch (err: any) {
        setError(err.message);
        setIsLoading(false);
      }
    };

    fetchLesson();

    // 轮询检查课程状态（如果正在处理中）
    const interval = setInterval(async () => {
      if (lesson?.status === 'PENDING' || lesson?.status === 'PROCESSING') {
        fetchLesson();
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [lessonId, lesson?.status]);

  // 播放当前句子
  const handlePlayOriginal = async () => {
    if (!lesson) return;
    const segment = lesson.segments[activeSegmentIndex];
    const lang = mode === 'chinese' ? 'zh-CN' : 'en-US';

    try {
      await speakText(segment.originalText, lang);
    } catch (error) {
      console.error('播放失败:', error);
    }
  };

  // 开始录音跟读
  const handleStartRecording = () => {
    if (!lesson) return;
    const segment = lesson.segments[activeSegmentIndex];
    const lang = mode === 'chinese' ? 'zh-CN' : 'en-US';

    setIsRecording(true);

    startSpeechRecognition(
      lang,
      async (transcript) => {
        // 评分
        const rating = evaluateTranscript(segment.originalText, transcript);

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

  // 课程正在处理中
  if (lesson.status === 'PENDING' || lesson.status === 'PROCESSING') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>课程处理中...</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Loader2 className="w-12 h-12 animate-spin mx-auto text-blue-600" />
            <p className="text-center text-gray-600">
              正在生成学习内容，请稍候...
            </p>
            <Progress value={33} />
          </CardContent>
        </Card>
      </div>
    );
  }

  const currentSegment = lesson.segments[activeSegmentIndex];
  const progress = ((activeSegmentIndex + 1) / lesson.segments.length) * 100;

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
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
              {activeSegmentIndex + 1} / {lesson.segments.length}
            </div>
          </div>
          <Progress value={progress} className="mt-2" />
        </div>
      </header>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8 pb-32 max-w-4xl">
        {/* 浏览器支持检查 */}
        {!speechSupport.fullSupport && (
          <Alert className="mb-6">
            <AlertDescription>
              您的浏览器不完全支持语音功能。建议使用 Chrome 或 Edge 浏览器以获得最佳体验。
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-2">
          {lesson.segments.map((segment, index) => (
            <button
              key={segment.id}
              onClick={() => setActiveSegmentIndex(index)}
              className={`w-full text-left p-3 rounded-lg transition-colors ${index === activeSegmentIndex
                  ? 'bg-blue-100 border-2 border-blue-500'
                  : 'bg-gray-50 hover:bg-gray-100'
                }`}
            >
              <div className="flex items-start gap-3">
                <span className="font-semibold text-gray-500 min-w-[2rem]">
                  {index + 1}.
                </span>
                <div className="flex-1">
                  <p className="font-medium">{segment.originalText}</p>
                  <p className="text-sm text-gray-600 mt-1">
                    {mode === 'chinese' ? segment.pinyinText : segment.englishMeaning}
                  </p>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* 底部悬浮按钮 */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-sm border-t shadow-lg z-20">
        <div className="container mx-auto px-4 py-4 max-w-4xl">
          <div className="flex justify-center gap-4">
            <Button
              size="lg"
              variant="outline"
              onClick={handlePlayOriginal}
              disabled={!speechSupport.synthesis}
              className="flex-1 max-w-xs"
            >
              <Volume2 className="w-5 h-5 mr-2" />
              老师跟读
            </Button>
            <Button
              size="lg"
              onClick={handleStartRecording}
              disabled={isRecording || !speechSupport.recognition}
              className="bg-green-600 hover:bg-green-700 flex-1 max-w-xs"
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

