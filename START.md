# 🎯 快速启动指南

## 第一次运行？按照以下步骤操作：

### 1️⃣ 安装依赖

```bash
pnpm install
```

### 2️⃣ 初始化数据库

```bash
# 生成 Prisma Client
pnpm db:generate

# 创建数据库表
pnpm db:push
```

### 3️⃣ 初始化演示数据（可选）

```bash
npx tsx scripts/init-demo-user.ts
```

这会创建：
- 一个演示用户
- 一个示例课程（包含 5 个中文日常用语）

### 4️⃣ 启动开发服务器

```bash
pnpm dev
```

### 5️⃣ 打开浏览器

访问 http://localhost:3000

---

## 📖 使用流程

### 创建课程
1. 点击首页的 "开始创建课程" 或访问 `/create`
2. 粘贴 YouTube 链接（MVP 阶段使用模拟数据）
3. 等待处理完成（约 3-5 秒）

### 开始学习
1. 在课程列表 (`/lessons`) 选择一个课程
2. 选择学习模式（中文/英文）
3. 点击 "老师示范" 听发音
4. 点击 "开始跟读" 进行练习
5. 获得即时反馈（👍 很棒 / 🙂 不错 / 🔁 再试一次）

---

## 🎮 快速测试

如果你已经运行了初始化脚本，可以直接访问示例课程：

```
http://localhost:3000/lesson/[课程ID]
```

课程 ID 会在初始化脚本运行后显示。

---

## 🔧 常用命令

```bash
# 开发
pnpm dev

# 查看数据库（可视化工具）
pnpm db:studio

# 重置数据库
rm -rf db/dev.db
pnpm db:push
npx tsx scripts/init-demo-user.ts
```

---

## ⚠️ 注意事项

1. **浏览器要求**: 使用 Chrome 或 Edge 浏览器以获得完整的语音功能支持
2. **麦克风权限**: 首次使用跟读功能时，需要允许浏览器访问麦克风
3. **HTTPS**: 语音识别功能在生产环境需要 HTTPS（本地开发 localhost 可以）

---

## 🐛 遇到问题？

### 数据库错误
```bash
pnpm db:push
```

### Prisma Client 错误
```bash
pnpm db:generate
```

### 端口被占用
```bash
# 修改端口
pnpm dev -- -p 3001
```

### 语音功能不工作
- 检查浏览器是否为 Chrome/Edge
- 检查麦克风权限是否允许
- 打开浏览器控制台查看错误信息

---

## 📚 更多文档

- [SETUP.md](./SETUP.md) - 详细设置指南
- [README.md](./README.md) - 产品需求文档
- [CURSOR_READ.md](./CURSOR_READ.md) - 技术实现文档

---

## 🎉 开始使用

现在你已经准备好了！运行 `pnpm dev` 并访问 http://localhost:3000 开始探索吧！

