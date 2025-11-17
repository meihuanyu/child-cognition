# ⚡ 快速启动指南

## 🎯 实现的功能

✅ **YouTube 视频抓取** - 使用 `ytdl-core` 获取视频信息和字幕
✅ **音频下载** - 自动下载最高质量音频
✅ **S3 存储** - 音频文件上传到 AWS S3
✅ **字幕提取** - 自动提取中文字幕（支持多语言）
✅ **智能分段** - 按标点符号自动分段
✅ **拼音生成** - 自动生成拼音标注
✅ **英文翻译** - 生成简易英文释义

---

## 🚀 快速开始（3 步）

### 1️⃣ 安装依赖

```bash
pnpm install
```

### 2️⃣ 配置环境变量

创建 `.env` 文件：

```env
DATABASE_URL="file:./prisma/child.db"
AWS_ACCESS_KEY_ID=your-key
AWS_SECRET_ACCESS_KEY=your-secret
AWS_REGION=us-east-1
AWS_BUCKET_NAME=your-bucket
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 3️⃣ 初始化数据库

```bash
pnpm db:generate
pnpm db:push
```

### 4️⃣ 启动项目

```bash
pnpm dev
```

---

## 📝 使用流程

1. **访问** http://localhost:3000
2. **点击** "创建课程"
3. **输入** YouTube 链接（例如：`https://www.youtube.com/watch?v=...`）
4. **等待** 处理完成（约 1-3 分钟）
5. **开始** 学习！

---

## 🔧 配置 AWS S3

### 快速设置（5 分钟）

1. **创建 Bucket**
   - 登录 AWS 控制台
   - 进入 S3 → 创建 Bucket
   - 名称：`child-cognition-audio`
   - 区域：选择最近的区域

2. **创建 IAM 用户**
   - 进入 IAM → 用户 → 创建用户
   - 用户名：`s3-uploader`
   - 附加策略：`AmazonS3FullAccess`
   - 创建访问密钥

3. **配置环境变量**
   ```env
   AWS_ACCESS_KEY_ID=AKIA...
   AWS_SECRET_ACCESS_KEY=xxx...
   AWS_REGION=us-east-1
   AWS_BUCKET_NAME=child-cognition-audio
   ```

---

## ✅ 验证功能

### 测试 YouTube 抓取

```bash
# 在浏览器控制台或 API 测试工具中
POST http://localhost:3000/api/lessons/create
{
  "sourceUrl": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  "userId": "demo-user-001"
}
```

### 检查处理状态

访问 `/lessons` 页面查看课程列表和处理状态。

---

## 🐛 故障排除

### 问题：音频上传失败
**解决**：检查 AWS 凭证和 Bucket 名称

### 问题：字幕获取失败
**解决**：确保视频有字幕，系统会自动使用备用方案

### 问题：数据库错误
**解决**：运行 `pnpm db:push` 更新 Schema

---

## 📚 详细文档

- [YOUTUBE_S3_SETUP.md](./YOUTUBE_S3_SETUP.md) - 详细配置指南
- [SETUP.md](./SETUP.md) - 项目设置说明
- [START.md](./START.md) - 完整启动指南

---

## 🎉 完成！

现在你可以：
- ✅ 从 YouTube 抓取视频
- ✅ 自动下载音频到 S3
- ✅ 提取字幕并分段
- ✅ 生成拼音和翻译

开始创建你的第一个课程吧！🚀

