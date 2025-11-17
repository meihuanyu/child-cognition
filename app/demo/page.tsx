import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft } from 'lucide-react';

export default function DemoPage() {
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
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <h1 className="text-3xl font-bold mb-8">功能演示</h1>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>🎬 视频演示</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="aspect-video bg-gray-200 rounded-lg flex items-center justify-center">
                <p className="text-gray-500">演示视频占位符</p>
              </div>
              <p className="mt-4 text-gray-600">
                这里将展示完整的使用流程：从创建课程到跟读训练的全过程。
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>📖 使用指南</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2">1. 创建课程</h3>
                <p className="text-gray-600">
                  复制 YouTube 视频链接，粘贴到创建页面，系统会自动提取内容并生成学习材料。
                </p>
              </div>
              <div>
                <h3 className="font-semibold mb-2">2. 选择模式</h3>
                <p className="text-gray-600">
                  在中文模式下学习拼音，在英文模式下学习单词释义。
                </p>
              </div>
              <div>
                <h3 className="font-semibold mb-2">3. 跟读练习</h3>
                <p className="text-gray-600">
                  点击"老师示范"听发音，然后点击"开始跟读"进行练习，系统会自动评分。
                </p>
              </div>
              <div>
                <h3 className="font-semibold mb-2">4. 查看进度</h3>
                <p className="text-gray-600">
                  所有学习记录都会被保存，您可以随时查看学习统计和进步报告。
                </p>
              </div>
            </CardContent>
          </Card>

          <div className="text-center">
            <Link href="/create">
              <Button size="lg">
                开始体验
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

