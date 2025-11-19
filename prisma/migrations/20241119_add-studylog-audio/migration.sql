-- 此迁移为 StudyLog 新增 S3 音频元数据字段

ALTER TABLE "StudyLog" ADD COLUMN "audioUrl" TEXT;
ALTER TABLE "StudyLog" ADD COLUMN "durationMs" INTEGER;

