import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

interface RouteParams {
  params: { segmentId: string };
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { segmentId } = params;
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('userId');

    if (!segmentId) {
      return NextResponse.json({ error: '缺少 segmentId' }, { status: 400 });
    }

    if (!userId) {
      return NextResponse.json({ error: '缺少 userId' }, { status: 400 });
    }

    const log = await prisma.studyLog.findUnique({
      where: {
        userId_segmentId: {
          userId,
          segmentId,
        },
      },
    });

    return NextResponse.json({ log });
  } catch (error) {
    console.error('获取学习日志失败:', error);
    return NextResponse.json({ error: '获取学习日志失败' }, { status: 500 });
  }
}


