<div align="center">
  <img src="icons/icon128.png" alt="ReplyPilot Logo" width="128" height="128">
  <h1>ReplyPilot for Gmail</h1>
  <p><strong>AI 驱动的 Gmail 客服回复助手 · AI-Powered Gmail Reply Assistant</strong></p>
  <p>专为电商卖家设计，一键生成专业客服回复</p>

  <p>
    <a href="https://chromewebstore.google.com/detail/replypilot-for-gmail/aeeapbjpefjokopgbklkalmonchijdfk?authuser=0&hl=zh-CN">
      <img src="https://img.shields.io/badge/Chrome%20Web%20Store-ReplyPilot-4285F4?style=for-the-badge&logo=google-chrome&logoColor=white" alt="Chrome Web Store">
    </a>
    <a href="LICENSE">
      <img src="https://img.shields.io/badge/license-Non--Commercial-blue?style=for-the-badge" alt="License">
    </a>
    <img src="https://img.shields.io/badge/Manifest-V3-important?style=for-the-badge" alt="Manifest V3">
  </p>
</div>

---

## 📖 简介 · Overview

**ReplyPilot** 是一个 Manifest V3 Chrome 扩展，专为 **Gmail Web** 用户设计。它能读取当前打开的邮件内容，调用 AI 模型（支持 SiliconFlow / OpenAI / 自定义端点）生成 **3 种不同立场**的专业客服回复方案，一键插入到 Gmail 回复框或复制到剪贴板。

> 适合场景：电商客服、售后邮件、客户咨询回复等需要快速、专业回应的场合。

---

## ✨ 核心功能 · Features

| 功能 | 说明 |
|------|------|
| 🤖 **AI 智能生成** | 一次生成 3 种回复方案：**积极支持** / **客观中性** / **委婉拒绝** |
| 🔌 **多 AI 提供商** | 支持 SiliconFlow、OpenAI 及任意 OpenAI 兼容 API 端点 |
| 🎯 **语气定制** | 支持 4 种回复语气：专业、友好、简洁、奢侈品牌 |
| 🌐 **多语言回复** | 自动检测或手动指定回复语言（中文/英文/自动） |
| 🧠 **AI 记忆** | 可填入店铺名、常用回复、个人风格，AI 自动参考 |
| 📝 **一键插入** | 选中的回复直接插入 Gmail 回复框，无需复制粘贴 |
| 📋 **一键复制** | 也可一键复制到剪贴板，手动粘贴 |
| 🔄 **重新生成** | 不满意可随时重新生成 |
| 🗣️ **双语界面** | 支持中文（简体）和英文界面，运行时即时切换 |
| 🔒 **隐私安全** | API Key 仅存储在本地，绝不记录到日志 |
| 🖱️ **可拖动卡片** | 浮动卡片可任意拖动位置，不遮挡邮件内容 |
| 📦 **开箱即用** | 安装后打开 Gmail 邮件 → 点击回复 → 自动显示 |

---

## 📸 预览 · Screenshots

<table>
  <tr>
    <td align="center"><strong>AI 回复方案生成</strong></td>
    <td align="center"><strong>3 种回复选择</strong></td>
    <td align="center"><strong>一键插入回复</strong></td>
  </tr>
  <tr>
    <td><img src="store-assets/screenshots/zh/screenshot-01.png" width="400" alt="打开邮件，ReplyPilot 卡片自动出现"></td>
    <td><img src="store-assets/screenshots/zh/screenshot-02.png" width="400" alt="AI 生成三种回复方案"></td>
    <td><img src="store-assets/screenshots/zh/screenshot-03.png" width="400" alt="选择方案并插入回复框"></td>
  </tr>
</table>

---

## 🚀 安装 · Installation

### Chrome Web Store（推荐）

[![Chrome Web Store](https://img.shields.io/badge/安装-Chrome%20Web%20Store-4285F4?style=for-the-badge&logo=google-chrome&logoColor=white)](https://chromewebstore.google.com/detail/replypilot-for-gmail/aeeapbjpefjokopgbklkalmonchijdfk?authuser=0&hl=zh-CN)

点击上方徽章或访问 Chrome Web Store 直接安装。

### 开发者模式（本地加载）

1. 打开 Chrome，访问 `chrome://extensions`
2. 开启右上角 **开发者模式（Developer mode）**
3. 点击 **加载已解压的扩展程序（Load unpacked）**
4. 选择本项目所在文件夹
5. 扩展图标出现在工具栏中

---

## ⚙️ 快速配置 · Quick Setup

1. **获取 API Key**
   - [SiliconFlow](https://siliconflow.cn)：注册后进入控制台 → API 密钥 → 创建密钥
   - [OpenAI](https://platform.openai.com)：获取 API Key

2. **打开设置**
   - 点击工具栏 `ReplyPilot` 图标 → **Open Settings**
   - 或右键扩展图标 → **选项（Options）**

3. **填写配置**
   - **AI Provider**：选择 SiliconFlow / OpenAI / Custom
   - **API Base URL**：根据提供商自动填充（如 https://api.siliconflow.cn/v1），Custom 模式可填入任意 OpenAI 兼容端点
   - **API Key**：输入你的密钥（安全存储在 `chrome.storage.local`）
   - **Model ID**：如 `deepseek-ai/DeepSeek-V4-Flash`、`gpt-4o-mini` 等
   - **界面语言**：中文 / English
   - **回复语气**：Professional / Friendly / Short / Luxury Brand
   - **回复语言**：Auto / 中文 / English

4. **完善 AI 记忆（可选）**
   - 填写店铺名称、常用回复、个人风格等，AI 会自动参考

5. **点击保存**

---

## 🎯 使用指南 · How to Use

1. 打开 [Gmail](https://mail.google.com) 并打开任意一封邮件
2. 点击 **回复（Reply）** → `✨ ReplyPilot` 浮动卡片自动出现在回复框上方
3. 点击 **Generate Reply** → AI 分析邮件内容，生成 3 个回复方案
4. 预览各方案，点击「选择此方案」选中
5. 可在文本框内编辑微调
6. 点击 **Insert Reply** → 文本自动插入 Gmail 回复框
7. 或点击 **Copy Reply** → 复制到剪贴板，自行粘贴发送

> 切换邮件不会创建重复卡片（每个回复框有去重标记）。

---

## 🧩 支持的工作模式

### 回复语气

| 语气 | 说明 |
|------|------|
| 📋 **Professional** | 正式专业的客服语气 |
| 😊 **Friendly** | 友好亲切的口吻 |
| 📝 **Short** | 简洁高效 |
| 💎 **Luxury Brand** | 高端奢侈品牌调性 |

### AI 提供商

| 提供商 | API 端点 | 默认模型 | 特点 |
|--------|----------|----------|------|
| **SiliconFlow** | `api.siliconflow.cn` | `deepseek-ai/DeepSeek-V4-Flash` | 国内可用，性价比高 |
| **OpenAI** | `api.openai.com` | `gpt-4o-mini` | 全球知名 |
| **Custom** | 用户自定义 | 用户自定义 | 兼容任何 OpenAI 兼容 API |

---

## 🌐 多语言支持 · i18n

- 支持 **中文（简体）** 和 **English** 两种界面语言
- 语言可在设置页面运行时即时切换，无需重启扩展
- 回复语言可独立设置：Auto / 中文 / English
- 语言选择优先级：URL 参数 `?lang=` > 存储设置 > 浏览器语言

---

## 🔒 隐私与安全 · Privacy & Security

- **API Key** 仅存储在 `chrome.storage.local`，绝不到处日志或上传
- 邮件内容**仅发送**到用户选择的 AI 提供商（您配置的 API 端点）
- **不会**自动发送邮件，所有发送需用户手动确认
- 日志器有显式安全机制，密钥永远不会被记录
- 扩展**不收集**任何用户数据
- 远程代码：仅用 `fetch()` 调用用户配置的 AI API，**不使用** `eval` 或其他远程代码执行

> 完整隐私政策：[ReplyPilot Privacy Policy](https://vaxicy.github.io/replypilot-privacy/privacy-policy.html)

---

## 🏗️ 技术架构 · Architecture

```
ReplyPilot/
├── manifest.json                  # MV3 清单文件
├── background/
│   └── service-worker.js          # 后台 Service Worker
├── content/
│   ├── gmail-content.js           # 内容脚本入口：MutationObserver + 注入编排
│   ├── gmail-dom.js               # Gmail DOM 读取 + 回复插入
│   ├── reply-ui.js                # 构建并管理注入的 ReplyPilot 浮动卡片
│   └── content.css                # 注入卡片的样式
├── popup/                         # 工具栏弹窗
├── options/                       # 设置页面
├── services/
│   ├── ai-service.js              # AI 服务编排
│   └── siliconflow.js             # SiliconFlow/OpenAI 兼容客户端
├── utils/
│   ├── storage.js                 # chrome.storage.local 封装
│   ├── parser.js                  # 语言检测 + 提示词构建
│   ├── i18n.js                    # 运行时国际化
│   └── logger.js                  # 安全日志器
├── _locales/                      # 国际化字符串（中/英）
├── icons/                         # 扩展图标
├── store-assets/                  # Chrome Web Store 素材
└── scripts/                       # 素材生成脚本
```

### 技术亮点

- **Manifest V3**：最新的 Chrome 扩展标准
- **单一全局命名空间 `window.RP`**：多文件内容脚本间通信
- **容错选择器系统**：20+ 种备选选择器适应 Gmail 频繁的标记变化
- **结构回退检测**：选择器均失败时自动检测回复框位置
- **健壮 JSON 解析**：自动处理 AI 返回的各种格式变体

---

## 📋 已知限制 · Known Limitations

- 仅支持 **Gmail Web**（`https://mail.google.com/*`）
- Gmail 标记变更可能导致选择器失效，需更新 `GMAIL_SELECTORS`
- 用户需**手动**点击生成/插入（不自动发送）
- 暂不支持 Outlook、Yahoo、网易邮箱等

---

## 🤝 贡献 · Contributing

欢迎提交 Issue 或 Pull Request 改进本项目。请确保：

1. Fork 本仓库
2. 创建特性分支：`git checkout -b feature/your-feature`
3. 提交改动：`git commit -m 'Add your feature'`
4. 推送到分支：`git push origin feature/your-feature`
5. 提交 Pull Request

---

## 📄 许可证 · License

本项目采用 **非商业使用许可证（Non-Commercial License）**。

- ✅ 个人学习、非营利组织、教育机构可免费使用
- ✅ 可修改代码并分发，但衍生作品必须采用相同许可证
- ❌ **禁止任何商业用途**（如需商业授权，请联系作者）

查看 [LICENSE](LICENSE) 文件获取完整条款。

---

<div align="center">
  <p>
    <a href="https://chromewebstore.google.com/detail/replypilot-for-gmail/aeeapbjpefjokopgbklkalmonchijdfk?authuser=0&hl=zh-CN">
      <img src="https://img.shields.io/badge/Chrome%20Web%20Store-立即安装-4285F4?style=for-the-badge&logo=google-chrome&logoColor=white" alt="立即安装">
    </a>
  </p>
  <p>Made with ❤️ for e-commerce sellers</p>
</div>
