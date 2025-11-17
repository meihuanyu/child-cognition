import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { convertToPinyin, getEnglishMeaning } from '@/lib/pinyin-converter';

/**
 * POST /api/lessons/process/[lessonId]
 * 处理课程内容（步骤 2：异步处理）
 * 
 * MVP 实现：
 * 1. 模拟从 YouTube 获取字幕/文本
 * 2. 分段处理
 * 3. 生成拼音和英文释义
 * 4. 存入数据库
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { lessonId: string } }
) {
  try {
    const { lessonId } = params;

    // 获取课程信息
    const lesson = await prisma.lesson.findUnique({
      where: { id: lessonId },
    });

    if (!lesson) {
      return NextResponse.json(
        { error: '课程不存在' },
        { status: 404 }
      );
    }

    // 更新状态为 PROCESSING
    await prisma.lesson.update({
      where: { id: lessonId },
      data: { status: 'PROCESSING' },
    });

    // ========== MVP 模拟数据 ==========
    // 生产环境应使用 ytdl-core 或 YouTube Data API
    // 这里我们使用示例数据
    const mockSegments = [
      '你好，欢迎来到中文学习课堂',
      '今天我们要学习一些简单的日常用语',
      '早上好，你好吗？',
      '我很好，谢谢你',
      '再见，明天见',
    ];

    const mockTitle = '中文日常用语 - 第1课';

    // 处理每个分段
    for (let i = 0; i < mockSegments.length; i++) {
      const text = mockSegments[i];
      
      // 转换拼音
      const pinyinText = convertToPinyin(text);
      
      // 获取英文释义
      const englishMeaning = await getEnglishMeaning(text);

      // 存入数据库
      await prisma.segment.create({
        data: {
          lessonId,
          order: i,
          originalText: text,
          pinyinText,
          englishMeaning,
        },
      });
    }

    // 更新课程状态为 DONE
    await prisma.lesson.update({
      where: { id: lessonId },
      data: {
        status: 'DONE',
        title: mockTitle,
      },
    });

    return NextResponse.json({
      success: true,
      message: '课程处理完成',
    });
  } catch (error) {
    console.error('处理课程失败:', error);
    
    // 更新状态为 ERROR
    try {
      await prisma.lesson.update({
        where: { id: params.lessonId },
        data: { status: 'ERROR' },
      });
    } catch (updateError) {
      console.error('更新错误状态失败:', updateError);
    }

    return NextResponse.json(
      { error: '处理课程失败' },
      { status: 500 }
    );
  }
}

