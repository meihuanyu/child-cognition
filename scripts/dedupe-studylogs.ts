import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const dryRun = process.argv.includes('--dry-run');

  const duplicateGroups = (await prisma.$queryRaw<
    { userId: string; segmentId: string; cnt: bigint }[]
  >`SELECT "userId", "segmentId", COUNT(*) AS cnt
    FROM "StudyLog"
    GROUP BY "userId", "segmentId"
    HAVING COUNT(*) > 1`) as { userId: string; segmentId: string; cnt: bigint }[];

  if (duplicateGroups.length === 0) {
    console.log('✅ 没有需要清理的重复记录。');
    return;
  }

  console.log(`发现 ${duplicateGroups.length} 组重复记录。${dryRun ? '(dry-run)' : ''}`);

  for (const group of duplicateGroups) {
    const { userId, segmentId } = group;
    const logs = await prisma.studyLog.findMany({
      where: { userId, segmentId },
      orderBy: { timestamp: 'desc' },
    });

    if (logs.length <= 1) continue;

    const [latest, ...others] = logs;
    const idsToDelete = others.map((log) => log.id);

    console.log(
      `用户 ${userId} / 句子 ${segmentId}: 保留 ${latest.id} (${latest.timestamp.toISOString()}), 删除 ${idsToDelete.length} 条`
    );

    if (!dryRun && idsToDelete.length > 0) {
      await prisma.studyLog.deleteMany({
        where: {
          id: { in: idsToDelete },
        },
      });
    }
  }

  if (!dryRun) {
    console.log('✅ 重复记录已清理完毕。');
  } else {
    console.log('✨ dry-run 完成（未实际删除数据）。');
  }
}

main()
  .catch((error) => {
    console.error('清理失败:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

