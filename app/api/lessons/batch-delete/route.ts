import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/lessons/batch-delete
 * 批量删除课程
 */
export async function POST(request: NextRequest) {
  try {
    const { userId, lessonIds } = await request.json();

    if (!userId || !Array.isArray(lessonIds) || lessonIds.length === 0) {
      return NextResponse.json(
        { error: '缺少必要参数' },
        { status: 400 }
      );
    }

    const result = await prisma.lesson.deleteMany({
      where: {
        id: {
          in: lessonIds,
        },
        userId,
      },
    });

    return NextResponse.json({
      success: true,
      deletedCount: result.count,
    });
  } catch (error) {
    console.error('批量删除课程失败:', error);
    return NextResponse.json(
      { error: '批量删除课程失败' },
      { status: 500 }
    );
  }
}


