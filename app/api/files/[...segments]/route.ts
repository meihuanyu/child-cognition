import { NextRequest, NextResponse } from 'next/server';
import { getPresignedUrl } from '@/lib/s3';

type RouteParams = {
  segments?: string[];
};

const MIN_EXPIRES = 60; // 1 minute
const MAX_EXPIRES = 3600; // 1 hour
const DEFAULT_EXPIRES = 300; // 5 minutes

function sanitizeKey(segments?: string[]) {
  if (!segments || segments.length === 0) {
    throw new Error('缺少文件路径');
  }

  const decoded = segments.map((segment) => {
    const value = decodeURIComponent(segment);
    if (!value || value.includes('..')) {
      throw new Error('非法的路径参数');
    }
    return value;
  });

  return decoded.join('/');
}

function resolveExpires(url: URL) {
  const expiresParam = url.searchParams.get('expiresIn');
  if (!expiresParam) {
    return DEFAULT_EXPIRES;
  }

  const parsed = Number(expiresParam);
  if (Number.isNaN(parsed)) {
    return DEFAULT_EXPIRES;
  }

  return Math.min(Math.max(parsed, MIN_EXPIRES), MAX_EXPIRES);
}

async function buildResponse(
  req: NextRequest,
  params: RouteParams
) {
  const key = sanitizeKey(params.segments);
  const expiresIn = resolveExpires(req.nextUrl);
  const mode = req.nextUrl.searchParams.get('mode');

  const signedUrl = await getPresignedUrl(key, expiresIn);

  if (mode === 'json') {
    return NextResponse.json({
      key,
      url: signedUrl,
      expiresIn,
    });
  }

  // 默认使用 307 临时重定向，这样 Audio 标签等可以直接复用
  return NextResponse.redirect(signedUrl, { status: 307 });
}

export async function GET(
  request: NextRequest,
  context: { params: RouteParams }
) {
  try {
    return await buildResponse(request, context.params);
  } catch (error: any) {
    console.error('获取 S3 文件失败:', error);
    return NextResponse.json(
      {
        error: '无法获取文件',
        message: error?.message || '未知错误',
      },
      { status: 400 }
    );
  }
}

export async function HEAD(
  request: NextRequest,
  context: { params: RouteParams }
) {
  return GET(request, context);
}


