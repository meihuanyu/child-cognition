import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { translateLesson } from '@/lib/lesson-processing';

export async function POST(
  _request: NextRequest,
  { params }: { params: { lessonId: string } }
) {
  const { lessonId } = params;

  try {
    const lesson = await prisma.lesson.findUnique({
      where: { id: lessonId },
      select: { id: true },
    });

    if (!lesson) {
      return NextResponse.json(
        { error: '课程不存在' },
        { status: 404 }
      );
    }

    await prisma.lesson.update({
      where: { id: lessonId },
      data: { status: 'TRANSLATING' },
    });

    const result = await translateLesson(lessonId);

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error: any) {
    console.error('翻译失败:', error);

    try {
      await prisma.lesson.update({
        where: { id: lessonId },
        data: {
          status: 'ERROR',
          title: `翻译失败: ${error.message}`,
        },
      });
    } catch (updateError) {
      console.error('更新翻译失败状态时出错:', updateError);
    }

    return NextResponse.json(
      {
        error: '翻译失败',
        message: error.message || '未知错误',
      },
      { status: 500 }
    );
  }
}

