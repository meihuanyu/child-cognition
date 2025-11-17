'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, ArrowLeft, Youtube } from 'lucide-react';

export default function CreateLessonPage() {
  const router = useRouter();
  const [sourceUrl, setSourceUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // MVP: 使用固定的用户 ID（生产环境应使用 NextAuth）
  const DEMO_USER_ID = 'demo-user-001';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      // 验证 URL
      if (!sourceUrl.includes('youtube.com') && !sourceUrl.includes('youtu.be')) {
        setError('请输入有效的 YouTube 链接');
        setIsLoading(false);
        return;
      }

      // 调用 API 创建课程
      const response = await fetch('/api/lessons/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sourceUrl,
          userId: DEMO_USER_ID,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '创建课程失败');
      }

      // 跳转到课程详情页
      router.push(`/lesson/${data.lessonId}`);
    } catch (err: any) {
      setError(err.message || '创建课程失败，请重试');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4">
          <Link href="/">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              返回首页
            </Button>
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-16 max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle className="text-3xl flex items-center gap-2">
              <Youtube className="w-8 h-8 text-red-600" />
              创建新课程
            </CardTitle>
            <CardDescription className="text-base">
              粘贴 YouTube 视频链接，我们将自动提取内容并生成学习材料
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="sourceUrl" className="text-base">
                  YouTube 视频链接
                </Label>
                <Input
                  id="sourceUrl"
                  type="url"
                  placeholder="https://www.youtube.com/watch?v=..."
                  value={sourceUrl}
                  onChange={(e) => setSourceUrl(e.target.value)}
                  disabled={isLoading}
                  className="text-base"
                  required
                />
                <p className="text-sm text-gray-500">
                  支持标准 YouTube 链接和短链接（youtu.be）
                </p>
              </div>

              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-semibold text-blue-900 mb-2">
                  📝 处理流程说明
                </h4>
                <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
                  <li>提取视频字幕或音频内容</li>
                  <li>自动分段并生成拼音标注</li>
                  <li>添加简易英文释义</li>
                  <li>生成互动学习界面</li>
                </ol>
                <p className="text-xs text-blue-700 mt-2">
                  ⏱️ 处理时间约 1-3 分钟，请耐心等待
                </p>
              </div>

              <Button
                type="submit"
                size="lg"
                className="w-full text-lg"
                disabled={isLoading || !sourceUrl}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    正在创建课程...
                  </>
                ) : (
                  '🚀 开始生成课程'
                )}
              </Button>
            </form>

            {/* Demo Links */}
            <div className="mt-8 pt-6 border-t">
              <p className="text-sm text-gray-600 mb-3">
                💡 没有合适的视频？试试这些示例：
              </p>
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => setSourceUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ')}
                  className="text-sm text-blue-600 hover:underline block"
                  disabled={isLoading}
                >
                  示例 1: 儿童中文学习视频
                </button>
                <button
                  type="button"
                  onClick={() => setSourceUrl('https://www.youtube.com/watch?v=example123')}
                  className="text-sm text-blue-600 hover:underline block"
                  disabled={isLoading}
                >
                  示例 2: 英文跟读练习
                </button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

