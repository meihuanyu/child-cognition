# 火山引擎机器翻译 API 配置指南

本项目使用火山引擎的机器翻译服务将英文字幕翻译成中文。

## 为什么选择火山引擎？

- ✅ 国内访问速度快，无需科学上网
- ✅ 支持批量翻译，性能优异
- ✅ 翻译质量高，适合中文场景
- ✅ API 调用简单，费用透明

官方文档：https://www.volcengine.com/docs/4640/65067

---

## 配置步骤

### 1. 注册火山引擎账号

1. 访问 [火山引擎官网](https://www.volcengine.com/)
2. 点击右上角"注册"按钮
3. 完成账号注册和实名认证

### 2. 开通机器翻译服务

1. 登录后，进入 [机器翻译产品页](https://www.volcengine.com/product/machine-translation)
2. 点击"立即使用"或"开通服务"
3. 根据提示完成服务开通（可能需要充值或开通后付费）

### 3. 获取 API 密钥

1. 进入 [控制台](https://console.volcengine.com/)
2. 点击右上角用户名 → "密钥管理"
3. 在"API 访问密钥"页面，创建新的访问密钥
4. 记录以下信息：
   - **Access Key ID**（访问密钥 ID）
   - **Secret Access Key**（秘密访问密钥）

⚠️ **安全提示**：Secret Access Key 只在创建时显示一次，请妥善保存！

### 4. 配置环境变量

在项目根目录创建 `.env.local` 文件（如果不存在），添加以下内容：

```bash
# 火山引擎机器翻译配置
VOLCENGINE_ACCESS_KEY_ID=你的Access_Key_ID
VOLCENGINE_SECRET_ACCESS_KEY=你的Secret_Access_Key
```

替换为你的实际密钥。

**示例**：

```bash
VOLCENGINE_ACCESS_KEY_ID=AKLT1234567890ABCDEF
VOLCENGINE_SECRET_ACCESS_KEY=xyz123abc456def789ghi012jkl345mno678pqr901
```

### 5. 验证配置

重启开发服务器：

```bash
pnpm dev
```

尝试创建一个英文视频课程，系统会自动调用翻译 API 将英文字幕翻译成中文。

---

## 占位符模式

如果你**暂时不想配置**翻译 API，系统会自动进入"占位符模式"：

- 翻译结果会显示为 `[翻译: 原文]`
- 功能流程正常运行，方便开发测试
- 配置 API 后会自动切换到真实翻译

---

## API 费用说明

火山引擎机器翻译采用**按量计费**：

- 计费单位：字符数
- 新用户通常有免费额度（具体以官网为准）
- 费用透明，可在控制台查看用量和账单

详见：[火山引擎机器翻译价格](https://www.volcengine.com/pricing/machine-translation)

---

## 常见问题

### Q1: 提示"API 调用失败"怎么办？

**可能原因**：
1. Access Key ID 或 Secret Access Key 配置错误
2. 账号未开通机器翻译服务
3. 账号余额不足或超出免费额度

**解决方法**：
1. 检查 `.env.local` 文件中的密钥是否正确
2. 登录火山引擎控制台，确认服务已开通
3. 查看账号余额和用量

### Q2: 支持哪些语言？

当前实现支持：
- **英文 → 中文**（en → zh）

火山引擎支持更多语言对，如需其他语言，可修改 `lib/translate.ts` 中的语言代码。

支持的语言列表：[火山引擎支持语言](https://www.volcengine.com/docs/4640/65067)

### Q3: 翻译速度慢怎么办？

项目使用了**批量翻译**优化性能：

```typescript
// 一次性翻译多个句子，而不是逐个翻译
const translations = await batchTranslateToZh(texts);
```

如果仍然较慢，可能是：
1. 网络连接不稳定
2. 翻译文本量过大
3. API 服务端负载较高

### Q4: 如何查看 API 调用日志？

在开发模式下，控制台会输出详细日志：

```bash
pnpm dev
```

翻译过程中会显示：
- 翻译的文本内容
- API 调用状态
- 错误信息（如果有）

---

## 技术实现

本项目实现了火山引擎 API v4 签名算法：

- 使用 Node.js 原生 `crypto` 模块
- 无需额外依赖，轻量高效
- 支持批量翻译，性能优异

核心文件：`lib/translate.ts`

---

## 迁移说明

如果你之前使用 Google Translate，现在已经完全迁移到火山引擎：

- ✅ API 接口保持不变（`translateToZh`、`batchTranslateToZh`）
- ✅ 现有代码无需修改
- ✅ 只需更新环境变量即可

---

## 相关链接

- [火山引擎机器翻译文档](https://www.volcengine.com/docs/4640/65067)
- [火山引擎控制台](https://console.volcengine.com/)
- [API 密钥管理](https://console.volcengine.com/iam/keymanage/)
- [价格说明](https://www.volcengine.com/pricing/machine-translation)

---

## 需要帮助？

- 查看 [火山引擎官方文档](https://www.volcengine.com/docs/4640/65067)
- 联系火山引擎技术支持
- 提交 GitHub Issue

