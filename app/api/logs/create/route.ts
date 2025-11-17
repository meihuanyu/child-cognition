import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/logs/create
 * 创建学习日志（记录孩子的跟读尝试）
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, segmentId, rating, userTranscript } = body;

    // 验证输入
    if (!userId || !segmentId || !rating) {
      return NextResponse.json(
        { error: '缺少必要参数' },
        { status: 400 }
      );
    }

    // 验证 rating 值
    if (!['GOOD', 'OK', 'RETRY'].includes(rating)) {
      return NextResponse.json(
        { error: 'rating 必须是 GOOD, OK 或 RETRY' },
        { status: 400 }
      );
    }

    // 创建学习日志
    const log = await prisma.studyLog.create({
      data: {
        userId,
        segmentId,
        rating,
        userTranscript: userTranscript || null,
      },
    });

    return NextResponse.json({
      success: true,
      log,
    });
  } catch (error) {
    console.error('创建学习日志失败:', error);
    return NextResponse.json(
      { error: '创建学习日志失败' },
      { status: 500 }
    );
  }
}

