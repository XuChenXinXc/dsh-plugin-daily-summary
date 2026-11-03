# DSH 每日对话总结与待办管理插件 (Daily Summary & TODO)

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Platform: DeepSeek Harness](https://img.shields.io/badge/Platform-DeepSeek%20Harness-1f6feb.svg)](https://github.com/deepseek-ai)
[![Cordis: Supported](https://img.shields.io/badge/Cordis-Ready-green.svg)](https://cordis.moe)

为 **DeepSeek Harness (DSH)** 深度定制的每日工作回顾与待办跟进插件。每天准时为您推送昨日所有对话的核心要点提炼，并将重要待办事项清晰呈现于网页端悬浮 Toast 弹窗中，助您开启专注、从容的高效每一天！

---

## 🌟 核心特性

### 1. ⏰ 自定义定时主动唤醒
- **毫秒级精准触达**：支持在界面中自由配置每日推送时刻（如 `09:00`）。
- **主动弹窗提醒**：到达指定时刻，网页右下角自动平滑弹出 Toast 浮层，无需手动翻找历史记录。
- **常驻悬浮入口**：右下角提供精巧悬浮胶囊按钮（FAB），未读时伴随呼吸红点提示，点击随时开启或收起。

### 2. 💬 昨日全量会话智能提炼
- **自动化跨会话扫描**：全天候覆盖昨日自然日（00:00:00 - 23:59:59）内的所有活跃对话。
- **对话要点浓缩**：提取核心提问、助手执行关键操作与关键技术结论，快速回溯上下文。

### 3. 📋 双轨分层待办事项清单
- **📌 我的备忘待办（重要 · 跨天保留）**：
  - 用户可在面板输入框中直接添加个人任务，按回车快速保存；
  - **跨天自动延续**：只要未勾选完成，第二天推送时自动置顶提醒，重要事项绝不遗漏；
  - 支持打勾标记完成、单项删除。
- **🤖 昨日会话提炼待办（AI提炼 · 仅供参考）**：
  - 自动提炼昨天对话中的任务规划、代码 TODO 及工具记录；
  - 明确标注来源会话与「仅供参考」醒目徽标；
  - 提供 **「➕ 转为我的待办」** 按钮，一键提升为个人长期跟踪任务。
- **📋 一键导出**：一键复制所有未完成待办，格式化排版直接粘贴至笔记或工作汇报。

### 4. 🎛️ 推送内容模块自由定制
在设置面板中可自由勾选开启或关闭以下模块：
- [x] 🌟 **晨间鼓励/励志箴言**：每日精选一条积极高效的晨间引言，带来满满能量；
- [x] 💬 **昨日核心会话与互动总结**：昨日多轮交互的凝练概述与探索统计；
- [x] 📋 **待办事项清单**：备忘待办与自动提炼待办合流展示。

### 5. 🎨 极致流畅的微交互体验
- **玻璃拟态质感**：采用深色毛玻璃（Backdrop Filter Glassmorphism）与层次阴影，与 DSH 原生主题完美契合。
- **局部 DOM 极速渲染**：新增、勾选、删除待办均采用局部 DOM 精确微调，**滚动条纹丝不动，彻底消除跳顶和页面闪烁**。
- **单次弹性动效守卫**：展开时呈现柔和弹性动效，数据刷新静默更新，杜绝重复弹跳。

---

## 📦 项目结构

```text
dsh-plugin-daily-summary/
├── cordis.patch.yml       # Cordis 容器声明与默认服务注入配置
├── package.json           # 插件元信息与客户端脚本导出配置
├── icon.svg               # 插件矢量图标
├── index.js               # 服务端核心：Cordis 插件服务、定时调度、会话分析与 REST API
├── client.js              # 客户端核心：Toast 弹窗 UI、双轨待办交互、系统时间比对器
├── lib/                   # 独立构建导出产物
├── locale/                # 国际化语言包 (zh-CN, en-US)
└── README.md              # 插件说明文档
```

---

## 🚀 安装与使用

### 1. 本地安装到 DSH Profile

将本项目 clone 或软链接到您的 DSH profile 的 `node_modules` 目录下：

```bash
cd ~/.dsh/profiles/<profile-name>/node_modules
git clone https://github.com/XuChenXinXc/dsh-plugin-daily-summary.git dsh-plugin-daily-summary
```

### 2. 启用插件

在 DSH 控制台中使用 Plugin Manager 或直接配置启用该 Bundle：

```json
{
  "dsh-plugin-daily-summary": {
    "enabled": true
  }
}
```

### 3. 开始使用

1. 刷新 DSH Web 网页（**F5**）；
2. 页面右下角将出现蓝色便签悬浮按钮；
3. 点击齿轮图标 ⚙️ 可设置您偏好的每日推送时间（默认 `09:00`）及各展示模块；
4. 在输入框添加您的待办，明日到点将自动为您推送总结与待办！

---

## 🛡️ 数据安全与隐私保障

- **全本地化运行**：所有会话扫描、待办持久化与时间判断均在本地/专属 DSH 实例内完成，**不向任何外部第三方服务器传输数据**；
- **只读会话安全**：仅调用 DSH 系统只读 API 分析会话记录，不修改、不污染原生历史对话数据库；
- **自动忽略隐私文件**：运行时生成的配置与缓存文件均已加入 `.gitignore`。

---

## 📄 开源许可

本项目遵循 [MIT License](LICENSE) 开源协议。

