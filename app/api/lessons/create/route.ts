import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/lessons/create
 * 创建新课程（步骤 1：同步创建记录）
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sourceUrl, userId } = body;

    // 验证输入
    if (!sourceUrl || !userId) {
      return NextResponse.json(
        { error: '缺少必要参数: sourceUrl 或 userId' },
        { status: 400 }
      );
    }

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
  } catch (error) {
    console.error('创建课程失败:', error);
    return NextResponse.json(
      { error: '创建课程失败' },
      { status: 500 }
    );
  }
}

