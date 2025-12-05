import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { downloadYouTubeContent } from '@/lib/youtube';
import { type SubtitleSegment } from '@/lib/segmentation';
import { uploadAudioToS3, cleanupTempFile } from '@/lib/s3';
import fs from 'fs';
import path from 'path';
const projectTempDir = path.join(process.cwd(), "temp");
const subtitleCacheDir = path.join(projectTempDir, 'subtitles');

/**
 * POST /api/lessons/process/[lessonId]
 * 处理课程内容（步骤 2：异步处理）
 * 
 * 实现：
 * 1. 使用 ytdl-core 获取 YouTube 视频信息
 * 2. 下载音频并上传到 S3
 * 3. 获取字幕并分段
 * 4. 生成拼音和英文释义
 * 5. 存入数据库
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { lessonId: string } }
) {
  let tempAudioPath: string | null = null;

  try {
    const { lessonId } = params;
    const body = await request.json().catch(() => ({}));
    const { text } = body;

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

    try {
      let fullAudioUrl: string | null = null;
      let subtitleSegments: SubtitleSegment[] = [];
      let videoTitle = lesson.title || '处理中...';
      let language = 'zh'; // 默认中文

      // 模式 1: 从文本直接创建（音频识别）
      if (text) {
        console.log('从提供的文本创建课程...');
        
        // 检查是否有segments数据（包含时间戳）
        const bodySegments = body.segments;
        
        if (bodySegments && Array.isArray(bodySegments) && bodySegments.length > 0) {
          // 使用从 Sherpa 获取的带时间戳的片段
          subtitleSegments = bodySegments;
          console.log(`使用带时间戳的 ${subtitleSegments.length} 条片段`);
        } else {
          // 备用方案：将文本转换为字幕片段格式
          // 简单处理：按句子分割
          const sentences = text.split(/[。！？\n]+/).filter((s: string) => s.trim().length > 0);
          let currentTime = 0;
          const avgDuration = 3; // 假设每句话3秒

          subtitleSegments = sentences.map((sentence: string, index: number) => ({
            text: sentence.trim(),
            startTime: currentTime + index * avgDuration,
            endTime: currentTime + (index + 1) * avgDuration,
          }));

          console.log(`从文本生成了 ${subtitleSegments.length} 条片段`);
        }
      } else {
        // 模式 2: 从 YouTube 下载
        console.log('正在下载 YouTube 内容（音频、字幕、元数据）...');

        // 创建临时文件路径
        tempAudioPath = path.join(projectTempDir, `audio-${lessonId}-${Date.now()}.mp3`);

        // 一次性下载所有内容（包含语言和时间戳）
        const content = await downloadYouTubeContent(lesson.sourceUrl, tempAudioPath);
        console.log('下载完成:', content.title);
        console.log('检测到语言:', content.language);

        videoTitle = content.title;
        subtitleSegments = content.subtitles;
        language = content.language;

        // 上传音频到 S3
        fullAudioUrl = await uploadAudioToS3(content.audioPath, lessonId);
        console.log('音频上传成功:', fullAudioUrl);

        // 清理临时文件
        cleanupTempFile(content.audioPath);
        tempAudioPath = null;
      }

      // 更新课程标题、语言和音频 URL
      await prisma.lesson.update({
        where: { id: lessonId },
        data: {
          title: videoTitle,
          language: language,
          audioUrl: fullAudioUrl,
        },
      });

      console.log(`获取到 ${subtitleSegments.length} 条字幕片段`);

      if (subtitleSegments.length === 0) {
        throw new Error('无法获取视频内容，请确保视频有字幕或描述');
      }

      console.log(`基础处理完成，缓存 ${subtitleSegments.length} 条字幕片段，等待分段/翻译步骤`);

      if (!fs.existsSync(subtitleCacheDir)) {
        fs.mkdirSync(subtitleCacheDir, { recursive: true });
      }
      const subtitleCachePath = path.join(subtitleCacheDir, `${lessonId}.json`);
      fs.writeFileSync(subtitleCachePath, JSON.stringify(subtitleSegments), 'utf-8');

      await prisma.lesson.update({
        where: { id: lessonId },
        data: {
          title: videoTitle,
          language: language,
          audioUrl: fullAudioUrl,
          status: 'READY_FOR_SEGMENT',
        },
      });

      return NextResponse.json({
        success: true,
        message: '基础信息已准备好，请继续分段与翻译',
        language: language,
        subtitlesCount: subtitleSegments.length,
        audioUrl: fullAudioUrl,
      });
    } catch (processingError: any) {
      console.error('处理过程中出错:', processingError);

      // 更新状态为 ERROR
      await prisma.lesson.update({
        where: { id: lessonId },
        data: {
          status: 'ERROR',
          title: `处理失败: ${processingError.message}`,
        },
      });

      throw processingError;
    }
  } catch (error: any) {
    console.error('处理课程失败:', error);

    // 确保临时文件被清理
    if (tempAudioPath) {
      cleanupTempFile(tempAudioPath);
    }

    // 确保错误状态已更新
    try {
      await prisma.lesson.update({
        where: { id: params.lessonId },
        data: { status: 'ERROR' },
      });
    } catch (updateError) {
      console.error('更新错误状态失败:', updateError);
    }

    return NextResponse.json(
      {
        error: '处理课程失败',
        message: error.message || '未知错误',
      },
      { status: 500 }
    );
  }
}

