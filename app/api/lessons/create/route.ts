import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/lessons/create
 * 创建新课程（步骤 1：同步创建记录）
 * 支持两种模式：
 * 1. 从 YouTube 链接创建（提供 sourceUrl）
 * 2. 从文本创建（提供 text，通常来自音频识别）
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sourceUrl, text, userId, sourceType, fileName } = body;

    // 验证输入
    if (!userId) {
      return NextResponse.json(
        { error: '缺少必要参数: userId' },
        { status: 400 }
      );
    }

    // 模式 1：从 YouTube 链接创建
    if (sourceUrl) {
      // 验证 YouTube URL（简单验证）
      if (!sourceUrl.includes('youtube.com') && !sourceUrl.includes('youtu.be')) {
        return NextResponse.json(
          { error: '请提供有效的 YouTube 链接' },
          { status: 400 }
        );
      }

      // 创建课程记录（状态为 PENDING）
      const lesson = await prisma.lesson.create({
        data: {
          userId,
          sourceUrl,
          title: '正在处理中...',
          status: 'PENDING',
        },
      });

      // 触发异步处理（即发即忘）
      // 在生产环境中，这应该使用队列系统（如 Bull, BullMQ）或 Vercel Cron
      fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/lessons/process/${lesson.id}`, {
        method: 'POST',
      }).catch(err => console.error('触发处理失败:', err));

      return NextResponse.json({
        success: true,
        lessonId: lesson.id,
        message: '课程创建成功，正在处理中...',
      });
    }

    // 模式 2：从文本创建（音频识别）
    if (text) {
      const { segments } = body;
      
      const title = fileName 
        ? fileName.replace(/\.[^/.]+$/, '') // 去除扩展名
        : '音频课程';

      // 创建课程记录（状态为 PENDING）
      const lesson = await prisma.lesson.create({
        data: {
          userId,
          sourceUrl: sourceType === 'audio' ? `audio://${fileName || 'uploaded'}` : 'text://direct',
          title,
          status: 'PENDING',
        },
      });

      // 触发异步处理，传递文本内容和片段信息
      fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/lessons/process/${lesson.id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          text,
          segments: segments || [] // 包含时间戳的片段
        }),
      }).catch(err => console.error('触发处理失败:', err));

      return NextResponse.json({
        success: true,
        lessonId: lesson.id,
        message: '课程创建成功，正在处理中...',
      });
    }

    // 两者都没有提供
    return NextResponse.json(
      { error: '缺少必要参数: sourceUrl 或 text' },
      { status: 400 }
    );
  } catch (error) {
    console.error('创建课程失败:', error);
    return NextResponse.json(
      { error: '创建课程失败' },
      { status: 500 }
    );
  }
}

