import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/lessons/list
 * 获取用户的课程列表
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: '缺少 userId 参数' },
        { status: 400 }
      );
    }

    const lessons = await prisma.lesson.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { segments: true },
        },
      },
    });

    return NextResponse.json(lessons);
  } catch (error) {
    console.error('获取课程列表失败:', error);
    return NextResponse.json(
      { error: '获取课程列表失败' },
      { status: 500 }
    );
  }
}

