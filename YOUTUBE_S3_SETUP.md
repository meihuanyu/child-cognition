# 🎬 YouTube 抓取 + S3 存储配置指南

## ✅ 已实现功能

### 1. YouTube 视频处理
- ✅ 使用 `ytdl-core` 获取视频信息
- ✅ 下载音频文件
- ✅ 提取字幕（支持中文、英文）
- ✅ 自动分段处理

### 2. S3 音频存储
- ✅ 上传音频到 AWS S3
- ✅ 生成公共访问 URL
- ✅ 支持预签名 URL（私有文件）
- ✅ 自动清理临时文件

### 3. 数据库更新
- ✅ Segment 模型添加 `audioUrl` 字段
- ✅ 修复 Prisma schema 配置

---

## 🔧 环境变量配置

在 `.env` 文件中添加以下配置：

```env
# 数据库
DATABASE_URL="file:./prisma/child.db"

# AWS S3 配置（必需）
AWS_ACCESS_KEY_ID=your-access-key-id
AWS_SECRET_ACCESS_KEY=your-secret-access-key
AWS_REGION=us-east-1
AWS_BUCKET_NAME=your-bucket-name

# App URL
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## 📦 安装依赖

运行以下命令安装新增的依赖：

```bash
pnpm install
```

新增依赖：
- `@aws-sdk/client-s3` - AWS S3 客户端
- `@aws-sdk/s3-request-presigner` - S3 预签名 URL

---

## 🗄️ 数据库迁移

由于添加了 `audioUrl` 字段，需要更新数据库：

```bash
# 生成 Prisma Client
pnpm db:generate

# 推送 Schema 到数据库
pnpm db:push
```

---

## ☁️ AWS S3 设置

### 1. 创建 S3 Bucket

1. 登录 AWS 控制台
2. 进入 S3 服务
3. 创建新 Bucket
4. 选择区域（建议与服务器区域一致）
5. 配置权限：
   - **公开访问**：如果音频需要公开访问，可以设置为公开读取
   - **私有访问**：如果音频需要私有，保持默认设置，使用预签名 URL

### 2. 创建 IAM 用户

1. 进入 IAM 服务
2. 创建新用户（例如：`child-cognition-s3-user`）
3. 附加策略：`AmazonS3FullAccess`（或自定义策略，只允许特定 Bucket）
4. 创建访问密钥（Access Key）
5. 保存 `Access Key ID` 和 `Secret Access Key`

### 3. 配置环境变量

将获取的凭证添加到 `.env` 文件：

```env
AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
AWS_REGION=us-east-1
AWS_BUCKET_NAME=child-cognition-audio
```

---

## 🚀 使用流程

### 1. 创建课程

用户在前端输入 YouTube 链接，系统会：

1. **获取视频信息** - 使用 `ytdl-core` 获取标题、描述等
2. **下载音频** - 下载最高质量的音频到临时文件
3. **上传到 S3** - 将音频上传到 S3，路径格式：`lessons/{lessonId}/full-audio.mp3`
4. **提取字幕** - 尝试获取中文字幕，如果没有则使用英文字幕
5. **分段处理** - 将字幕按句号、问号、感叹号分段
6. **生成内容** - 为每段生成拼音和英文释义
7. **保存数据库** - 将分段和音频 URL 保存到数据库

### 2. 音频访问

- **公开访问**：如果 S3 Bucket 设置为公开读取，可以直接使用 URL
- **私有访问**：使用预签名 URL（在 `lib/s3.ts` 中的 `getPresignedUrl` 函数）

---

## 📁 文件结构

```
lib/
├── youtube.ts      # YouTube 处理函数
│   ├── extractVideoId()      # 提取视频 ID
│   ├── getYouTubeInfo()      # 获取视频信息
│   ├── downloadAudio()       # 下载音频
│   ├── getYouTubeSubtitles() # 获取字幕
│   └── segmentTexts()        # 文本分段
│
└── s3.ts           # S3 上传函数
    ├── uploadToS3()          # 上传文件到 S3
    ├── uploadAudioToS3()      # 上传音频（专用）
    ├── getPresignedUrl()      # 获取预签名 URL
    └── cleanupTempFile()       # 清理临时文件
```

---

## 🔍 功能说明

### YouTube 字幕提取

系统会按以下优先级尝试获取字幕：

1. **中文字幕**（`zh`, `zh-CN`, `zh-Hans`）
2. **英文字幕**（`en`, `en-US`）
3. **其他可用字幕**（第一个可用的）

如果无法获取字幕，会：
- 尝试使用视频描述
- 如果描述也没有，使用默认示例文本

### 音频存储

- **完整音频**：每个课程下载一个完整音频文件
- **存储路径**：`lessons/{lessonId}/full-audio.mp3`
- **分段共享**：所有分段共享同一个音频 URL（可以后续扩展为分段音频）

### 错误处理

- 音频下载失败：不影响字幕处理，继续执行
- 字幕获取失败：使用视频描述或默认文本
- S3 上传失败：记录错误，但不中断处理

---

## 🐛 常见问题

### Q: 音频上传失败？
**A:** 检查：
1. AWS 凭证是否正确
2. S3 Bucket 名称是否正确
3. IAM 用户是否有写入权限
4. 网络连接是否正常

### Q: 字幕获取失败？
**A:** 可能原因：
1. 视频没有字幕
2. 字幕语言不支持
3. YouTube API 限制

**解决方案**：系统会自动使用视频描述或默认文本

### Q: 音频下载很慢？
**A:** 可能原因：
1. 视频文件很大
2. 网络速度慢
3. YouTube 限流

**建议**：对于长视频，考虑使用队列系统异步处理

### Q: 临时文件没有清理？
**A:** 系统会在以下情况自动清理：
- 上传成功后
- 发生错误时
- 处理完成后

如果仍有残留，可以手动清理系统临时目录。

---

## 🔐 安全建议

1. **不要提交 `.env` 文件** - 确保 `.gitignore` 包含 `.env`
2. **使用 IAM 角色** - 生产环境建议使用 IAM 角色而非访问密钥
3. **限制权限** - IAM 用户只授予必要的 S3 权限
4. **定期轮换密钥** - 定期更新访问密钥
5. **使用私有 Bucket** - 如果音频包含敏感内容，使用私有 Bucket + 预签名 URL

---

## 📊 性能优化建议

1. **使用 CDN** - 将 S3 Bucket 配置为 CloudFront 分发
2. **音频压缩** - 下载后可以压缩音频文件
3. **分段音频** - 为每个分段生成独立音频（需要音频分割工具）
4. **队列处理** - 使用 Bull/BullMQ 处理长视频
5. **缓存策略** - 缓存视频信息，避免重复请求

---

## 🚀 下一步

- [ ] 实现分段音频（为每个分段生成独立音频）
- [ ] 添加音频压缩功能
- [ ] 集成 CloudFront CDN
- [ ] 实现队列系统处理长视频
- [ ] 添加音频格式转换（MP3, AAC, OGG）

---

## 📚 相关文档

- [AWS S3 文档](https://docs.aws.amazon.com/s3/)
- [ytdl-core 文档](https://github.com/fent/node-ytdl-core)
- [Prisma 文档](https://www.prisma.io/docs)

---

配置完成后，运行 `pnpm dev` 启动项目，然后创建课程测试功能！

