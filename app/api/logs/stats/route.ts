import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/logs/stats
 * 获取学习统计数据
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const lessonId = searchParams.get('lessonId');

    if (!userId) {
      return NextResponse.json(
        { error: '缺少 userId 参数' },
        { status: 400 }
      );
    }

    // 构建查询条件
    const where: any = { userId };
    
    if (lessonId) {
      where.segment = {
        lessonId,
      };
    }

    // 获取学习日志
    const logs = await prisma.studyLog.findMany({
      where,
      include: {
        segment: {
          select: {
            originalText: true,
            lessonId: true,
          },
        },
      },
      orderBy: { timestamp: 'desc' },
    });

    // 统计数据
    const totalAttempts = logs.length;
    const goodCount = logs.filter(log => log.rating === 'GOOD').length;
    const okCount = logs.filter(log => log.rating === 'OK').length;
    const retryCount = logs.filter(log => log.rating === 'RETRY').length;

    // 计算总字数（去重）
    const uniqueTexts = new Set(logs.map(log => log.segment.originalText));
    const totalCharacters = Array.from(uniqueTexts).reduce(
      (sum, text) => sum + text.length,
      0
    );

    return NextResponse.json({
      totalAttempts,
      goodCount,
      okCount,
      retryCount,
      totalCharacters,
      successRate: totalAttempts > 0 ? (goodCount / totalAttempts * 100).toFixed(1) : 0,
      logs: logs.slice(0, 20), // 返回最近 20 条记录
    });
  } catch (error) {
    console.error('获取学习统计失败:', error);
    return NextResponse.json(
      { error: '获取学习统计失败' },
      { status: 500 }
    );
  }
}

