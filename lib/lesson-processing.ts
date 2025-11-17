import fs from 'fs';
import path from 'path';
import { prisma } from '@/lib/prisma';
import { convertToPinyin } from '@/lib/pinyin-converter';
import { batchTranslateToZh } from '@/lib/translate';
import { segmentTextsWithNLP, type SubtitleSegment } from '@/lib/segmentation';

const subtitleCacheDir = path.join(process.cwd(), 'temp', 'subtitles');

function normalizeSubtitleSegments(subtitles: unknown): SubtitleSegment[] {
  if (!Array.isArray(subtitles)) {
    return [];
  }

  return subtitles
    .map((item) => {
      if (
        item &&
        typeof item === 'object' &&
        'text' in item &&
        typeof (item as any).text === 'string'
      ) {
        return {
          text: (item as any).text as string,
          startTime: typeof (item as any).startTime === 'number' ? (item as any).startTime : 0,
          endTime: typeof (item as any).endTime === 'number' ? (item as any).endTime : 0,
        } satisfies SubtitleSegment;
      }
      return null;
    })
    .filter((item): item is SubtitleSegment => item !== null);
}

function loadSubtitleSegments(lessonId: string): SubtitleSegment[] {
  const cachePath = path.join(subtitleCacheDir, `${lessonId}.json`);
  if (!fs.existsSync(cachePath)) {
    return [];
  }

  try {
    const content = fs.readFileSync(cachePath, 'utf-8');
    const parsed = JSON.parse(content);
    return normalizeSubtitleSegments(parsed);
  } catch (error) {
    console.error('读取字幕缓存失败:', error);
    return [];
  }
}

export async function segmentLesson(lessonId: string) {
  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    select: {
      id: true,
      language: true,
    },
  });

  if (!lesson) {
    throw new Error('课程不存在');
  }

  const cachedSegments = loadSubtitleSegments(lessonId);
  if (cachedSegments.length === 0) {
    throw new Error('缺少可用字幕，请重新执行下载流程');
  }

  const processedSegments = await segmentTextsWithNLP(cachedSegments, lesson.language || undefined);
  if (processedSegments.length === 0) {
    throw new Error('字幕内容为空，无法分段');
  }

  const requiresTranslation = lesson.language === 'en';

  await prisma.$transaction(async (tx) => {
    await tx.segment.deleteMany({ where: { lessonId } });

    await tx.segment.createMany({
      data: processedSegments.map((segment, index) => ({
        lessonId,
        order: index,
        originalText: segment.text,
        translatedText: null,
        pinyinText: lesson.language === 'zh' ? convertToPinyin(segment.text) : null,
        startTime: segment.startTime,
        endTime: segment.endTime,
      })),
    });

    await tx.lesson.update({
      where: { id: lessonId },
      data: {
        status: requiresTranslation ? 'READY_FOR_TRANSLATION' : 'DONE',
      },
    });
  });

  return {
    segmentsCount: processedSegments.length,
    requiresTranslation,
  };
}

export async function translateLesson(lessonId: string) {
  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    select: {
      id: true,
      language: true,
      segments: {
        select: {
          id: true,
          order: true,
          originalText: true,
        },
        orderBy: { order: 'asc' },
      },
    },
  });

  if (!lesson) {
    throw new Error('课程不存在');
  }

  if (lesson.language !== 'en') {
    throw new Error('当前课程不需要翻译');
  }

  if (lesson.segments.length === 0) {
    throw new Error('请先完成分段');
  }

  const textsToTranslate = lesson.segments.map((segment) => segment.originalText);
  const translations = await batchTranslateToZh(textsToTranslate);

  await prisma.$transaction(async (tx) => {
    for (let i = 0; i < lesson.segments.length; i++) {
      const segment = lesson.segments[i];
      const translatedText = translations[i] || '';

      await tx.segment.update({
        where: { id: segment.id },
        data: {
          translatedText,
          pinyinText: convertToPinyin(translatedText),
        },
      });
    }

    await tx.lesson.update({
      where: { id: lessonId },
      data: { status: 'DONE' },
    });
  });

  return {
    translatedCount: lesson.segments.length,
  };
}

