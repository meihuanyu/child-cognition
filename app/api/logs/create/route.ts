import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { prisma } from '@/lib/prisma';
import { uploadBufferToS3 } from '@/lib/s3';

type Rating = 'GOOD' | 'OK' | 'RETRY';

interface ParsedPayload {
  userId: string;
  segmentId: string;
  rating: Rating;
  userTranscript?: string | null;
  durationMs?: number | null;
  audioBuffer?: Buffer;
  audioMime?: string;
  originalFileName?: string;
}

function validateRating(rating: string | null): rating is Rating {
  return rating === 'GOOD' || rating === 'OK' || rating === 'RETRY';
}

async function parseRequestBody(request: NextRequest): Promise<ParsedPayload> {
  const contentType = request.headers.get('content-type') || '';

  if (contentType.includes('multipart/form-data')) {
    const formData = await request.formData();
    const userId = (formData.get('userId') || '').toString();
    const segmentId = (formData.get('segmentId') || '').toString();
    const rating = (formData.get('rating') || '').toString() as Rating;
    const userTranscript = formData.get('userTranscript')?.toString() || null;
    const durationRaw = formData.get('durationMs');
    const durationMs =
      typeof durationRaw === 'string'
        ? Number(durationRaw)
        : typeof durationRaw === 'number'
          ? durationRaw
          : null;

    const audioFile = formData.get('audio');
    let audioBuffer: Buffer | undefined;
    let audioMime: string | undefined;
    let originalFileName: string | undefined;

    if (audioFile && audioFile instanceof File && audioFile.size > 0) {
      const arrayBuffer = await audioFile.arrayBuffer();
      audioBuffer = Buffer.from(arrayBuffer);
      audioMime = audioFile.type || 'audio/webm';
      originalFileName = audioFile.name;
    }

    return {
      userId,
      segmentId,
      rating,
      userTranscript,
      durationMs: Number.isFinite(durationMs || NaN) ? Number(durationMs) : null,
      audioBuffer,
      audioMime,
      originalFileName,
    };
  }

  const body = await request.json();

  return {
    userId: body.userId,
    segmentId: body.segmentId,
    rating: body.rating,
    userTranscript: body.userTranscript || null,
    durationMs: typeof body.durationMs === 'number' ? body.durationMs : null,
  };
}

function resolveFileExtension(mime?: string, fallbackName?: string) {
  if (!mime && fallbackName) {
    const parts = fallbackName.split('.');
    return parts.length > 1 ? parts.pop() : 'webm';
  }

  if (!mime) {
    return 'webm';
  }

  switch (mime) {
    case 'audio/mpeg':
    case 'audio/mp3':
      return 'mp3';
    case 'audio/wav':
      return 'wav';
    case 'audio/ogg':
      return 'ogg';
    default: {
      const [, subtype] = mime.split('/');
      return subtype?.split(';')[0] || 'webm';
    }
  }
}

/**
 * POST /api/logs/create
 * 创建学习日志（记录孩子的跟读尝试）
 */
export async function POST(request: NextRequest) {
  try {
    const payload = await parseRequestBody(request);
    const { userId, segmentId, rating, userTranscript, durationMs, audioBuffer, audioMime, originalFileName } =
      payload;

    if (!userId || !segmentId || !rating) {
      return NextResponse.json({ error: '缺少必要参数' }, { status: 400 });
    }

    if (!validateRating(rating)) {
      return NextResponse.json({ error: 'rating 必须是 GOOD, OK 或 RETRY' }, { status: 400 });
    }

    let audioKey: string | null = null;
    if (audioBuffer) {
      const segment = await prisma.segment.findUnique({
        where: { id: segmentId },
        select: { lessonId: true },
      });

      if (!segment) {
        return NextResponse.json({ error: '句子不存在' }, { status: 404 });
      }

      const extension = resolveFileExtension(audioMime, originalFileName);
      audioKey = `lessons/${segment.lessonId}/segments/${segmentId}/reads/${randomUUID()}.${extension}`;

      await uploadBufferToS3(audioBuffer, audioKey, audioMime || 'application/octet-stream');
    }

    const log = await prisma.studyLog.upsert({
      where: {
        userId_segmentId: {
          userId,
          segmentId,
        },
      },
      update: {
        rating,
        userTranscript: userTranscript || null,
        audioUrl: audioKey,
        durationMs: durationMs ?? null,
        timestamp: new Date(),
      },
      create: {
        userId,
        segmentId,
        rating,
        userTranscript: userTranscript || null,
        audioUrl: audioKey,
        durationMs: durationMs ?? null,
      },
    });

    return NextResponse.json({
      success: true,
      log,
    });
  } catch (error) {
    console.error('创建学习日志失败:', error);
    return NextResponse.json({ error: '创建学习日志失败' }, { status: 500 });
  }
}

