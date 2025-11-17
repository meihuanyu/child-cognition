import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/lessons/[id]
 * 获取课程详情（包括所有分段）
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    const lesson = await prisma.lesson.findUnique({
      where: { id },
      include: {
        segments: {
          orderBy: { order: 'asc' },
        },
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!lesson) {
      return NextResponse.json(
        { error: '课程不存在' },
        { status: 404 }
      );
    }

    return NextResponse.json(lesson);
  } catch (error) {
    console.error('获取课程失败:', error);
    return NextResponse.json(
      { error: '获取课程失败' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/lessons/[id]
 * 删除课程
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    await prisma.lesson.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: '课程删除成功',
    });
  } catch (error) {
    console.error('删除课程失败:', error);
    return NextResponse.json(
      { error: '删除课程失败' },
      { status: 500 }
    );
  }
}

