import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/users/create
 * 创建用户（MVP 简化版 - 无密码认证）
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, name } = body;

    if (!email) {
      return NextResponse.json(
        { error: '缺少 email 参数' },
        { status: 400 }
      );
    }

    // 检查用户是否已存在
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json({
        success: true,
        user: existingUser,
        message: '用户已存在',
      });
    }

    // 创建新用户
    const user = await prisma.user.create({
      data: {
        email,
        name: name || email.split('@')[0],
      },
    });

    return NextResponse.json({
      success: true,
      user,
      message: '用户创建成功',
    });
  } catch (error) {
    console.error('创建用户失败:', error);
    return NextResponse.json(
      { error: '创建用户失败' },
      { status: 500 }
    );
  }
}

