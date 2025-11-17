import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BookOpen, Mic, TrendingUp, FileText } from 'lucide-react';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-blue-600">🧩 儿童认知学习</h1>
          <nav className="space-x-4">
            <Link href="/create">
              <Button variant="outline">创建课程</Button>
            </Link>
            <Link href="/lessons">
              <Button>我的课程</Button>
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-16 text-center">
        <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
          让孩子在快乐中学习
          <br />
          <span className="text-blue-600">中文认知 + 英文跟读</span>
        </h2>
        <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
          通过 YouTube 视频，自动生成互动学习内容，
          帮助孩子掌握中文拼音和英文发音
        </p>
        <div className="space-x-4">
          <Link href="/create">
            <Button size="lg" className="text-lg px-8">
              🚀 开始创建课程
            </Button>
          </Link>
          <Link href="/demo">
            <Button size="lg" variant="outline" className="text-lg px-8">
              👀 查看演示
            </Button>
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="container mx-auto px-4 py-16">
        <h3 className="text-3xl font-bold text-center mb-12">核心功能</h3>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardHeader>
              <BookOpen className="w-12 h-12 text-blue-600 mb-2" />
              <CardTitle>智能内容生成</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                粘贴 YouTube 链接，自动提取字幕，
                生成拼音和英文释义
              </CardDescription>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <Mic className="w-12 h-12 text-green-600 mb-2" />
              <CardTitle>跟读训练</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                使用 Web Speech API，
                让孩子跟读并获得即时反馈
              </CardDescription>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <TrendingUp className="w-12 h-12 text-purple-600 mb-2" />
              <CardTitle>学习统计</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                记录每次学习尝试，
                生成进步报告和趋势分析
              </CardDescription>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <FileText className="w-12 h-12 text-orange-600 mb-2" />
              <CardTitle>学习报告</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                自动生成周报/月报，
                支持打印和邮件发送
              </CardDescription>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-blue-600 text-white py-16">
        <div className="container mx-auto px-4 text-center">
          <h3 className="text-3xl font-bold mb-4">准备好开始了吗？</h3>
          <p className="text-xl mb-8 opacity-90">
            只需要一个 YouTube 链接，就能创建专属的学习课程
          </p>
          <Link href="/create">
            <Button size="lg" variant="secondary" className="text-lg px-8">
              立即创建第一个课程
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8 text-center text-gray-600">
        <p>© 2024 儿童认知学习 App. 使用 Next.js + Prisma + Tailwind CSS 构建</p>
      </footer>
    </div>
  );
}

