'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Plus, Loader2, BookOpen, Clock } from 'lucide-react';

interface Lesson {
  id: string;
  title: string;
  sourceUrl: string;
  status: string;
  createdAt: string;
  _count: {
    segments: number;
  };
}

export default function LessonsPage() {
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // MVP: 使用固定的用户 ID
  const DEMO_USER_ID = 'demo-user-001';

  useEffect(() => {
    const fetchLessons = async () => {
      try {
        const response = await fetch(`/api/lessons/list?userId=${DEMO_USER_ID}`);
        if (response.ok) {
          const data = await response.json();
          setLessons(data);
        }
      } catch (error) {
        console.error('获取课程列表失败:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchLessons();
  }, []);

  const getStatusBadge = (status: string) => {
    const badges = {
      PENDING: { text: '等待中', color: 'bg-yellow-100 text-yellow-800' },
      PROCESSING: { text: '处理中', color: 'bg-blue-100 text-blue-800' },
      DONE: { text: '已完成', color: 'bg-green-100 text-green-800' },
      ERROR: { text: '失败', color: 'bg-red-100 text-red-800' },
    };
    const badge = badges[status as keyof typeof badges] || badges.PENDING;
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${badge.color}`}>
        {badge.text}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link href="/">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="w-4 h-4 mr-2" />
                返回首页
              </Button>
            </Link>
            <Link href="/create">
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                创建课程
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <h1 className="text-3xl font-bold mb-8">我的课程</h1>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        ) : lessons.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <BookOpen className="w-16 h-16 mx-auto mb-4 text-gray-400" />
              <h3 className="text-xl font-semibold mb-2">还没有课程</h3>
              <p className="text-gray-600 mb-6">
                创建您的第一个课程，开始学习之旅吧！
              </p>
              <Link href="/create">
                <Button size="lg">
                  <Plus className="w-5 h-5 mr-2" />
                  创建课程
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {lessons.map((lesson) => (
              <Card key={lesson.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between mb-2">
                    <CardTitle className="text-lg line-clamp-2">
                      {lesson.title}
                    </CardTitle>
                    {getStatusBadge(lesson.status)}
                  </div>
                  <CardDescription className="line-clamp-1">
                    {lesson.sourceUrl}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center text-sm text-gray-600">
                      <BookOpen className="w-4 h-4 mr-2" />
                      {lesson._count.segments} 个句子
                    </div>
                    <div className="flex items-center text-sm text-gray-600">
                      <Clock className="w-4 h-4 mr-2" />
                      {new Date(lesson.createdAt).toLocaleDateString('zh-CN')}
                    </div>
                    <Link href={`/lesson/${lesson.id}`}>
                      <Button className="w-full" disabled={lesson.status !== 'DONE'}>
                        {lesson.status === 'DONE' ? '开始学习' : '处理中...'}
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

