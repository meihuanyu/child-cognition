# 🧩 儿童中文认知 + 英文跟读 App

> 一个帮助儿童学习中文拼音和英文发音的互动教育应用

[![Next.js](https://img.shields.io/badge/Next.js-14-black)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)](https://www.typescriptlang.org/)
[![Prisma](https://img.shields.io/badge/Prisma-5-2D3748)](https://www.prisma.io/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3-38B2AC)](https://tailwindcss.com/)

## ✨ 特性

- 🎬 **智能内容生成** - 从 YouTube 视频自动提取学习内容
- 🗣️ **语音跟读训练** - 使用 Web Speech API 进行实时语音识别和评分
- 🇨🇳 **中文拼音标注** - 自动生成准确的拼音标注
- 🇬🇧 **英文释义** - 提供简易英文翻译
- 📊 **学习统计** - 记录每次学习尝试，生成进步报告
- 📱 **响应式设计** - 完美适配桌面和移动设备

## 🚀 快速开始

### 前置要求

- Node.js 18+
- pnpm（推荐）或 npm

### 安装

```bash
# 1. 克隆仓库
git clone <your-repo-url>
cd child-cognition

# 2. 安装依赖
pnpm install

# 3. 初始化数据库和演示数据
pnpm init

# 4. 启动开发服务器
pnpm dev
```

访问 http://localhost:3000 开始使用！

## 📖 使用指南

### 创建课程

1. 点击首页的 "开始创建课程"
2. 粘贴 YouTube 视频链接
3. 等待系统自动处理（约 3-5 秒）
4. 开始学习！

### 跟读练习

1. 选择学习模式（中文/英文）
2. 点击 "老师示范" 听标准发音
3. 点击 "开始跟读" 进行练习
4. 获得即时反馈：
   - 👍 **很棒** - 发音准确（相似度 > 70%）
   - 🙂 **不错** - 需要改进（相似度 30-70%）
   - 🔁 **再试一次** - 需要重新练习（相似度 < 30%）

## 🏗️ 技术栈

- **框架**: Next.js 14 (App Router)
- **语言**: TypeScript
- **数据库**: Prisma + SQLite
- **样式**: Tailwind CSS
- **UI 组件**: shadcn/ui
- **语音**: Web Speech API
- **拼音**: pinyin 库
- **评分**: fast-levenshtein 算法

## 📁 项目结构

```
child-cognition/
├── app/                    # Next.js 页面和 API
│   ├── api/               # API Routes
│   ├── create/            # 创建课程页面
│   ├── lesson/[id]/       # 课程详情页面
│   └── lessons/           # 课程列表页面
├── components/            # React 组件
│   └── ui/               # shadcn/ui 组件
├── lib/                   # 工具库
│   ├── evaluate.ts       # 评分算法
│   ├── pinyin-converter.ts # 拼音转换
│   └── speech.ts         # 语音处理
├── prisma/               # 数据库配置
│   └── schema.prisma     # 数据库 Schema
└── scripts/              # 工具脚本
```

## 🔧 开发命令

```bash
# 开发
pnpm dev

# 构建
pnpm build

# 启动生产服务器
pnpm start

# 代码检查
pnpm lint

# 数据库管理
pnpm db:generate    # 生成 Prisma Client
pnpm db:push        # 同步数据库 Schema
pnpm db:studio      # 打开数据库可视化工具

# 初始化项目（包含演示数据）
pnpm init
```

## 🌐 浏览器支持

**推荐浏览器**:
- Chrome 85+
- Edge 85+

**注意**: 语音功能需要浏览器支持 Web Speech API。

## 📊 API 端点

### 课程管理
- `POST /api/lessons/create` - 创建课程
- `GET /api/lessons/[id]` - 获取课程详情
- `GET /api/lessons/list` - 获取课程列表
- `POST /api/lessons/process/[lessonId]` - 处理课程内容

### 学习日志
- `POST /api/logs/create` - 创建学习日志
- `GET /api/logs/stats` - 获取学习统计

### 用户
- `POST /api/users/create` - 创建用户

## 🎯 核心功能实现

### 评分算法

使用 Levenshtein 距离算法计算用户发音与标准发音的相似度：

```typescript
// 相似度 >= 70% → 👍 很棒
// 相似度 30-70% → 🙂 不错
// 相似度 < 30%  → 🔁 再试一次
```

### 拼音转换

使用 `pinyin` 库自动将中文转换为带声调的拼音：

```typescript
"你好" → "nǐ hǎo"
"谢谢" → "xiè xie"
```

## 📝 MVP 说明

当前版本是 MVP（最小可行产品），包含核心功能但有以下限制：

- ✅ 完整的跟读训练功能
- ✅ 自动拼音生成
- ✅ 学习日志记录
- ⚠️ 使用固定的演示用户（未集成认证）
- ⚠️ YouTube 处理使用模拟数据
- ⚠️ 英文翻译使用简单词典

## 🚀 部署

### Vercel（推荐）

1. 推送代码到 GitHub
2. 在 [Vercel](https://vercel.com) 导入项目
3. 配置环境变量
4. 部署

### 环境变量

```env
DATABASE_URL="file:./dev.db"
NEXT_PUBLIC_APP_URL=https://your-domain.com
```

## 📚 文档

- [NEXT_STEPS.md](./NEXT_STEPS.md) - 下一步操作指南
- [START.md](./START.md) - 快速启动指南
- [SETUP.md](./SETUP.md) - 详细设置说明
- [PROJECT_SUMMARY.md](./PROJECT_SUMMARY.md) - 项目总结
- [CURSOR_READ.md](./CURSOR_READ.md) - 技术实现文档

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 许可证

MIT License

## 🙏 致谢

- [Next.js](https://nextjs.org/)
- [Prisma](https://www.prisma.io/)
- [shadcn/ui](https://ui.shadcn.com/)
- [Tailwind CSS](https://tailwindcss.com/)
- [Web Speech API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API)

---

Made with ❤️ for children's education

