# 错题分析 — 公务员备考助手

> **开发规则：任何代码修改前，必须先与用户讨论设计并取得明确同意。不可自行决定直接开发。**

## 项目概述

PWA 应用，帮助公务员考试备考者追踪错题、分析薄弱点、制定复习计划。

- 纯前端，无后端服务
- 数据存储在浏览器 IndexedDB（不上传）
- 支持离线使用，可添加到手机主屏幕

## 技术栈

| 层 | 技术 |
|----|------|
| 构建 | Vite + TypeScript |
| 框架 | React 19 |
| 路由 | React Router v7 |
| 样式 | Tailwind CSS v3 |
| 数据库 | Dexie.js (IndexedDB) |
| 图表 | Recharts |
| PWA | vite-plugin-pwa |

## 目录结构

```
src/
├── models/          # TypeScript 类型定义
│   ├── exam.ts      # 枚举（模块、错误类型等）+ 中文标签
│   ├── mistake.ts   # MistakeRecord 核心实体
│   ├── analytics.ts # 分析/报告类型
│   └── review.ts    # 复习计划类型
├── db/              # 数据访问层
│   ├── database.ts  # Dexie 实例 + Schema 定义
│   └── repositories/ # mistakeRepository / reviewPlanRepository / analysisReportRepository
├── services/        # 纯业务逻辑（无 React 依赖）
│   ├── analyticsService.ts  # 薄弱点检测算法
│   ├── reviewPlanner.ts     # 间隔复习 + 优先级排序
│   └── statsCalculator.ts   # 统计计算
├── hooks/           # React hooks（useLiveQuery 响应式数据）
├── components/
│   ├── layout/      # MobileShell / BottomNav / PageHeader / FAB
│   └── charts/      # WeakPointRadar / ErrorTypePie / ModuleBar / TrendLine
├── pages/           # 页面组件
│   ├── DashboardPage.tsx       # 首页概览
│   ├── MistakeLogPage.tsx      # 错题录入
│   ├── MistakeListPage.tsx     # 错题本
│   ├── MistakeDetailPage.tsx   # 错题详情 + AI 诊断 + 改进追踪
│   ├── AnalyticsPage.tsx       # 统计分析图表
│   ├── ReviewPlanPage.tsx      # 复习计划
│   └── SettingsPage.tsx        # 设置（导出/导入）
└── lib/             # 工具函数
```

## 架构分层

```
Pages (Controller)
  ↓
Hooks (依赖注入)
  ↓
Services (纯函数业务逻辑)
  ↓
Repositories (DAO，封装 IndexedDB 操作)
  ↓
Dexie.js (ORM)
  ↓
IndexedDB (浏览器内置数据库)
```

## 核心算法

### 薄弱点检测

```
weaknessScore = 错误次数×2 + 近7天×3 + 重复≥3次×5 - 已掌握×1 - 复习次数×0.5
```

### 智能复习计划

按薄弱分数 DESC → 距上次复习时间 DESC → 错误次数 DESC 排序，每日上限 20 题，单模块不超过 60%。

## 开发

```bash
npm install
npm run dev        # 启动开发服务器 http://localhost:5173
npm run build      # 生产构建 → dist/
npm run preview    # 预览构建结果
```

## Git 工作流

### 仓库结构

weakDetect 是一个**独立的 git 仓库**，remote 指向 `github.com:lsang33/weakDetect.git`。

```bash
# 源码分支（本地主要工作分支）
  master → 推送源码到 GitHub

# 部署分支（dist 子目录独立仓库）
  dist/ → 独立 git，推送 main 分支 → GitHub Pages
```

### 源码推送（master）

```bash
git add .
git commit -m "改了什么"
git push origin master
```

### 部署到 GitHub Pages

```bash
npm run build
git -C dist add .
git -C dist commit -m "deploy"
git -C dist push origin HEAD:main -f
```

**访问地址**：`https://lsang33.github.io/weakDetect`

**SPA 路由说明**：每次 `npm run build` 会自动生成 `404.html`，React Router 能处理所有路径。

### 历史清理

如果需要清理 git 历史（如误提交大文件），用 `git filter-branch` 或 `git subtree split` 处理。

### PWA 安装

部署后：
- Android：Chrome 打开 → 底部弹窗「添加到主屏幕」
- iPhone：Safari 打开 → 分享按钮 → 「添加到主屏幕」

## 数据结构说明

### MistakeRecord（错题记录）

| 字段 | 说明 |
|------|------|
| entryType | manual / photo（录入方式） |
| questionType | mistake / doubtful（错题还是存疑） |
| questionStem | 题目原文（AI 深度分析必需） |
| correctAnswer / myAnswer | 正确答案 / 用户答案 |
| quickDiagnosis | AI 实时诊断结果 |
| batchAnalysis | AI 批量分析后的归类 |
| improvementAttempts | 改进尝试记录 |

### 分析覆盖率

错题列表页顶部会提示：有多少道题缺少题目原文（无法参与 AI 分析）。详情页可补录原文。

## 综合分析页面规则（BatchAnalysisPage）

### 页面的工作方式
- 按模块分析，每个模块独立调一次 DeepSeek API
- 顶部有时间范围筛选（全部 / 近7天 / 近30天），基于 `createdAt` 过滤
- 每个模块显示有原文的错题数（`questionStem` 不为空），少于 3 道不展示分析入口
- 分析结果存储在 IndexedDB `moduleAnalyses` 表，按模块名 + 时间查询

### 调用逻辑
- 每次点「分析」只发当前模块的错题，按当前时间范围筛选后的题数
- 模型用 `deepseek-reasoner`，prompt 在 `moduleAnalysisService.ts`
- Prompt 核心：先逐题看操作失误 → 再聚类找共性 → 输出模式
- 每条模式必须写具体操作动作，不能写"XX能力不足"
- `perQuestion` 字段每道题一句话根因
- 分析完成后自动保存到 IndexedDB，不刷新页面，`useLiveQuery` 响应式更新

### 用户交互
- 模块卡片可展开查看分析结果（模式 + 关联题号 + 逐题分析）
- 关联题号（#1、#3 等）和逐题分析行点击弹出题目详情弹窗
- 弹窗显示知识点标签、题目原文、正确答案、你的答案、错因
- 历史记录列表可点击，弹出旧的分析报告详情
- 历史报告的题号不可点击（与当前数据不对应）

### 注意事项
- 分析期间用户可以切换到其他页面，请求在后台继续运行
- 切页面再回来时 `useLiveQuery` 自动获取最新分析结果
- 缺少原文的题不参与分析，弹窗里提示"该题缺少题目原文"

## 后续计划

- [ ] 改进效果追踪反馈闭环
