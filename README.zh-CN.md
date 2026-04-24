## Tokscale Dashboard

**[English](README.md)**

强大且精美的 AI 编程助手 Token 用量分析看板。基于 [tokscale](https://github.com/junhoyeo/tokscale) 数据，零运行时依赖的 Node.js 服务 + React 前端构建。

![Overview - Dark Mode](docs/screenshots/overview-dark.png)

## 为什么选择 Tokscale Dashboard？

如果你在使用 **Cursor**、**Codex CLI**、**Claude Code** 或 **Gemini CLI** 等 AI 编程助手，你很可能在 Token 上花费了不少钱，却没有清晰的成本可视化。Tokscale Dashboard 为你提供：

- **完整的费用可视化** — 清楚知道每一分钱花在了哪里
- **模型级分析** — 跨 60+ 模型对比费用、Token 用量和消息数
- **平台 vs API 定价对比** — 看看你的平台订阅是否真的比直接调 API 更省钱
- **精美分享卡片** — 生成 9 种风格的 PNG 卡片，分享你的 AI 使用统计

## 截图预览

| 深色模式 | 浅色模式 | 定价对比 |
|:-:|:-:|:-:|
| ![Dark](docs/screenshots/overview-dark.png) | ![Light](docs/screenshots/overview-light.png) | ![Pricing](docs/screenshots/pricing-dark.png) |

### 分享卡片

| 总览卡片 | 连续使用卡片 | 徽章卡片 |
|:-:|:-:|:-:|
| ![Overview](docs/screenshots/share-overview.png) | ![Streak](docs/screenshots/share-streak.png) | ![Badge](docs/screenshots/share-badge.png) |

## 快速开始

无需克隆、无需安装，直接运行：

```bash
# 使用 bun
bunx tokscale-dashboard

# 使用 npm
npx tokscale-dashboard

# 自定义端口
npx tokscale-dashboard --port 3000
```

然后打开 <http://localhost:8787>。

首次启动会自动：
1. 使用打包在 npm 包内的预构建前端资源
2. 在 `~/.tokscale-dashboard/data/` 下创建数据目录（保存 graph / pricing / settings）
3. 调用 `tokscale` CLI（默认 `bunx tokscale@latest`）采集初始数据

所有数据刷新与 tokscale runner 配置都在页面 "Settings" 弹窗里完成，无需再调用外部脚本。

## 核心功能

### 数据分析与可视化
- **总览仪表盘** — 总花费、Token 数量、消息数、活跃天数、峰值日、缓存统计一目了然
- **月度费用趋势** — 交互式折线图追踪费用和消息量的月度变化
- **月度明细** — 行可展开，查看该月的每模型用量
- **每日活动热力图** — GitHub 风格的 AI 使用贡献图
- **Provider/Source 分布** — 饼图展示各 Provider 的费用占比
- **Top 模型排行** — 按费用排名的最常用（最贵）模型
- **Token 类型分析** — Stacked（竖向柱）与 Grouped（水平柱）两种布局切换
- **每日用量图表** — 精细的每日费用和 Token 分析，行可展开按模型查看

### 定价智能
- **模型价格表** — 来自 LiteLLM 和 OpenRouter 的实时定价数据，覆盖 56+ 模型
- **成本对比** — 每个模型的平台费用 vs 估算的直接 API 费用
- **费率分析** — 一眼看出哪些模型在平台上更便宜，哪些直接调 API 更划算
- **自动模型映射** — 自动将平台内部模型名映射到公开 API 模型名

### 设置与数据刷新
- **页内设置弹窗** — 配置 tokscale runner（`bunx` / `npx`）、package spec（如 `tokscale@latest` 或指定版本）、以及额外 CLI 参数
- **分粒度刷新** — 从 UI 一键刷新全部、只刷 Token 数据或只刷定价
- **实时日志** — 可展开查看每一步刷新过程的输出

### 分享卡片
- **9 种卡片模板** — Overview、Compact、TopModels、Activity、Monthly、Providers、Tokens、Streak、Badge
- **PNG 导出** — 2 倍分辨率高清 PNG 下载

### 主题与体验
- **深色/浅色模式** — 完整的主题支持，偏好自动保存
- **毛玻璃效果 UI** — 现代磨砂玻璃设计，流畅动画
- **响应式布局** — 适配桌面和平板
- **CSV 导出** — 一键导出全部数据

## 技术栈

| 层 | 技术 |
|---|---|
| 运行时 | Node.js 18+（无运行时依赖） |
| 前端 | React 19 + TypeScript + Vite |
| 样式 | Tailwind CSS v4 |
| 图表 | Recharts |
| 图标 | Lucide React |
| 图片导出 | html-to-image |
| 数据源 | [tokscale](https://github.com/junhoyeo/tokscale) CLI |

## 本地开发

```bash
git clone https://github.com/pdajoy/tokendashboard.git
cd tokendashboard

# 构建前端
npm run build

# 启动合并后的 Node.js 服务（API + 静态前端）
npm start
# 打开 http://localhost:8787
```

### 热更新开发模式

```bash
npm run dev
# Vite:  http://localhost:5173
# API:   http://localhost:8787
```

## 环境变量

| 变量 | 说明 | 默认 |
|---|---|---|
| `PORT` | HTTP 端口 | `8787` |
| `DATA_DIR` | 数据目录（`graph.json`/`pricing.json`/`settings.json`） | 本地 `./data`；npm 安装后 `~/.tokscale-dashboard/data` |
| `FRONTEND_DIR` | 前端构建输出目录 | `./frontend/dist` |
| `API_ONLY` | 设为 `1` 表示仅提供 API（开发模式使用） | — |

## API 端点

| 端点 | 方法 | 说明 |
|---|---|---|
| `/api/models` | GET | 模型使用明细，实时从 `graph.json` 派生 |
| `/api/monthly` | GET | 月度汇总，实时从 `graph.json` 派生 |
| `/api/graph` | GET | 每日贡献数据 |
| `/api/pricing` | GET | 模型定价数据 |
| `/api/meta` | GET | 数据更新时间 |
| `/api/export/csv` | GET | 导出 CSV |
| `/api/settings` | GET/POST | 读取或更新设置（tokscale runner / spec / 额外参数） |
| `/api/refresh` | POST | 触发数据刷新。Body：`{ "target": "all" \| "graph" \| "pricing" }` |
| `/api/health` | GET | 健康检查 |

## 项目结构

```
tokscale-dashboard/
├── scripts/
│   ├── server.mjs           # HTTP 服务 + API 路由 + 静态资源
│   ├── data-utils.mjs       # JSON 派生工具函数（零依赖）
│   ├── data-refresh.mjs     # 内置数据刷新（调用 tokscale CLI）
│   ├── pricing-resolver.mjs # LiteLLM + OpenRouter 定价解析与缓存
│   ├── settings.mjs         # 设置读写
│   └── dev.mjs              # 开发模式启动器（Vite + API）
├── frontend/                # React 前端（Vite）
│   ├── src/
│   └── dist/                # 预构建输出（随 npm 包发布）
├── data/                    # 本地开发数据
└── docs/                    # 截图与文档
```

## 许可证

MIT

## 致谢

- 数据由 [tokscale](https://github.com/junhoyeo/tokscale)（Junho Yeo）驱动
- 灵感来自 [token-insight](https://github.com/mo2g/token-insight)
- 定价数据来自 [LiteLLM](https://github.com/BerriAI/litellm) 和 [OpenRouter](https://openrouter.ai)
