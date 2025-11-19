-- 为 StudyLog 添加 (userId, segmentId) 唯一索引，确保每个孩子每句只保留一条记录
CREATE UNIQUE INDEX "StudyLog_userId_segmentId_key" ON "StudyLog"("userId", "segmentId");

