# 数据库重构迁移说明

## 概述

本次更新实现了多语言字幕支持、时间戳精确播放和 Google Translate API 集成。

## 主要变更

### 1. 数据库 Schema（Breaking Changes）

#### Lesson 表新增字段：
- `language: String?` - 源语言（'en' 或 'zh'），从 VTT 头部解析
- `audioUrl: String?` - 完整音频文件的 S3 URL

#### Segment 表字段调整：
**新增字段：**
- `translatedText: String?` - 英文→中文翻译（仅英文片源时有值）
- `startTime: Float?` - 开始时间（秒）
- `endTime: Float?` - 结束时间（秒）

**删除字段：**
- ~~`englishMeaning: String?`~~ - 已移除
- ~~`audioUrl: String?`~~ - 已移至 Lesson 表

### 2. 功能增强

#### 语言识别
- VTT 文件头部解析：`Language: en` / `Language: zh`
- 自动识别源语言并存储到数据库

#### 时间戳支持
- 解析 VTT 时间戳：`00:00:03.680 --> 00:00:05.770`
- 存储每个字幕片段的精确时间
- 前端使用 HTML5 Audio API 播放特定片段

#### 翻译集成
- 英文片源自动翻译成中文
- 使用 Google Cloud Translate API
- 批量翻译提高性能
- 支持占位符模式（未配置 API 时）

### 3. 前端更新

#### 自动模式识别
- 移除手动模式切换
- 根据 `lesson.language` 自动显示：
  - **英文片源**：英文原文 + 中文翻译 + 拼音
  - **中文片源**：中文原文 + 拼音

#### 音频播放
- 使用完整音频 + 时间戳播放片段
- 自动在片段结束时暂停
- TTS 作为回退方案

#### 录音识别
- 统一使用中文识别（学习目标）
- 英文片源：跟读中文翻译
- 中文片源：跟读中文原文

## 数据迁移

### ⚠️ 重要提示

此次更新包含 Breaking Changes，现有数据需要迁移或重新生成。

### 选项 1：清空数据库（推荐用于开发环境）

```bash
# 1. 删除现有数据库
rm prisma/child.db prisma/prisma/child.db

# 2. 推送新 schema
pnpm db:push

# 3. 初始化演示数据
pnpm init
```

### 选项 2：手动迁移数据

如果需要保留现有数据，可以编写迁移脚本：

```typescript
// scripts/migrate-data.ts
import { prisma } from '@/lib/prisma';

async function migrate() {
  // 1. 为所有 Lesson 添加默认语言
  await prisma.lesson.updateMany({
    where: { language: null },
    data: { language: 'zh' }
  });

  // 2. 为所有 Segment 添加默认时间戳
  const segments = await prisma.segment.findMany();
  for (let i = 0; i < segments.length; i++) {
    await prisma.segment.update({
      where: { id: segments[i].id },
      data: {
        startTime: i * 3,
        endTime: (i + 1) * 3,
      }
    });
  }

  console.log('迁移完成');
}

migrate();
```

## 配置要求

### 必需配置（已有）
- `DATABASE_URL` - SQLite 数据库路径
- `AWS_*` - S3 存储配置

### 新增配置（可选）
- `GOOGLE_TRANSLATE_API_KEY` - Google Translate API 密钥

详细配置说明请参考：
- `.env.example` - 环境变量模板
- `SETUP_GOOGLE_TRANSLATE.md` - Google Translate API 配置指南

## 测试建议

### 1. 测试中文片源
```bash
# 使用中文 YouTube 视频测试
# 应该显示：中文原文 + 拼音
```

### 2. 测试英文片源
```bash
# 使用英文 YouTube 视频测试
# 应该显示：英文原文 + 中文翻译 + 拼音
```

### 3. 测试时间戳播放
- 点击"老师示范"按钮
- 检查是否播放正确的音频片段
- 检查是否在片段结束时自动停止

### 4. 测试翻译功能
- 确保配置了 `GOOGLE_TRANSLATE_API_KEY`
- 处理英文视频
- 检查翻译质量

## 性能优化

### 批量翻译
- 使用 `batchTranslateToZh()` 代替单个翻译
- 减少 API 调用次数
- 降低处理时间

### 音频缓存
- 前端缓存 Audio 元素
- 避免重复加载完整音频
- 提高播放响应速度

## 已知限制

1. **时间戳精度**
   - 依赖 VTT 文件的时间戳质量
   - 自动分句会估算时间（按比例分配）

2. **翻译质量**
   - 依赖 Google Translate API
   - 技术术语可能不准确
   - 考虑添加人工校对功能

3. **音频同步**
   - 使用 setTimeout 控制播放时长
   - 可能存在轻微延迟（±100ms）
   - 考虑使用 Web Audio API 提高精度

## 未来改进

1. **缓存翻译结果**
   - 避免重复翻译相同内容
   - 降低 API 成本

2. **支持更多语言**
   - 扩展语言识别
   - 支持其他学习模式

3. **离线翻译**
   - 集成本地翻译模型
   - 减少 API 依赖

4. **翻译质量评分**
   - 人工标注
   - 机器学习优化

## 回滚方案

如果需要回滚到旧版本：

```bash
# 1. 恢复旧的 schema.prisma
git checkout HEAD~1 prisma/schema.prisma

# 2. 推送旧 schema
pnpm db:push

# 3. 恢复旧代码
git checkout HEAD~1 lib/ app/
```

## 技术栈更新

### 新增依赖
- `@google-cloud/translate` ^9.3.0 - Google Translate API 客户端

### 更新文件
- `prisma/schema.prisma` - 数据库 schema
- `lib/youtube.ts` - VTT 解析增强
- `lib/translate.ts` - 新建翻译模块
- `app/api/lessons/process/[lessonId]/route.ts` - 处理流程更新
- `app/lesson/[id]/page.tsx` - 前端重构

## 问题排查

### 问题：翻译显示为 "[翻译: ...]"
**原因**：未配置 Google Translate API  
**解决**：配置 `GOOGLE_TRANSLATE_API_KEY` 环境变量

### 问题：音频播放不正确
**原因**：时间戳可能不准确  
**解决**：检查 VTT 文件质量，或调整分句逻辑

### 问题：数据库字段不存在
**原因**：未执行 schema 迁移  
**解决**：运行 `pnpm db:push`

## 联系支持

如有问题，请查看：
- 项目 README
- GitHub Issues
- 开发文档

---

**更新日期**: 2025-11-17  
**版本**: v2.0.0  
**作者**: AI Assistant

