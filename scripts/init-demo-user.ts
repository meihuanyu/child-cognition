/**
 * 初始化演示用户
 * 运行: npx tsx scripts/init-demo-user.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🚀 初始化演示用户...');

  // 创建演示用户
  const user = await prisma.user.upsert({
    where: { email: 'demo@example.com' },
    update: {},
    create: {
      id: 'demo-user-001',
      email: 'demo@example.com',
      name: '演示用户',
      subscriptionStatus: 'FREE',
    },
  });

  console.log('✅ 演示用户创建成功:', user);

  // 创建示例课程
  const lesson = await prisma.lesson.create({
    data: {
      userId: user.id,
      title: '中文日常用语 - 示例课程',
      sourceUrl: 'https://www.youtube.com/watch?v=example',
      status: 'DONE',
    },
  });

  console.log('✅ 示例课程创建成功:', lesson);

  // 创建示例分段
  const segments = [
    { text: '你好', pinyin: 'nǐ hǎo', english: 'Hello' },
    { text: '谢谢', pinyin: 'xiè xie', english: 'Thank you' },
    { text: '再见', pinyin: 'zài jiàn', english: 'Goodbye' },
    { text: '早上好', pinyin: 'zǎo shang hǎo', english: 'Good morning' },
    { text: '晚安', pinyin: 'wǎn ān', english: 'Good night' },
  ];

  for (let i = 0; i < segments.length; i++) {
    await prisma.segment.create({
      data: {
        lessonId: lesson.id,
        order: i,
        originalText: segments[i].text,
        pinyinText: segments[i].pinyin,
      },
    });
  }

  console.log('✅ 示例分段创建成功');
  console.log('\n🎉 初始化完成！');
  console.log('📝 演示用户 ID:', user.id);
  console.log('📚 示例课程 ID:', lesson.id);
  console.log('\n🚀 运行 pnpm dev 启动开发服务器');
}

main()
  .catch((e) => {
    console.error('❌ 初始化失败:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

