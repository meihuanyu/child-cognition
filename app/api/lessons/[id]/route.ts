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
 * PATCH /api/lessons/[id]
 * 修改课程信息
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await request.json();
    const { title, sourceUrl, status, language, audioUrl } = body;

    // 检查课程是否存在
    const existingLesson = await prisma.lesson.findUnique({
      where: { id },
    });

    if (!existingLesson) {
      return NextResponse.json(
        { error: '课程不存在' },
        { status: 404 }
      );
    }

    // 构建更新数据（只包含提供的字段）
    const updateData: {
      title?: string;
      sourceUrl?: string;
      status?: string;
      language?: string;
      audioUrl?: string | null;
    } = {};

    if (title !== undefined) updateData.title = title;
    if (sourceUrl !== undefined) updateData.sourceUrl = sourceUrl;
    if (status !== undefined) updateData.status = status;
    if (language !== undefined) updateData.language = language;
    if (audioUrl !== undefined) updateData.audioUrl = audioUrl;

    // 如果没有提供任何可更新的字段
    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: '请提供至少一个要更新的字段' },
        { status: 400 }
      );
    }

    // 更新课程
    const updatedLesson = await prisma.lesson.update({
      where: { id },
      data: updateData,
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

    return NextResponse.json({
      success: true,
      lesson: updatedLesson,
      message: '课程更新成功',
    });
  } catch (error) {
    console.error('修改课程失败:', error);
    return NextResponse.json(
      { error: '修改课程失败' },
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

