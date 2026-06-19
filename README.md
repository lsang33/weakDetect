# 上岸 — 公务员备考助手

> PWA 错题分析应用，帮助公务员考试备考者追踪错题、AI 诊断错因、制定复习计划。所有数据存储在本地，不上传服务器。

**访问地址：** [https://lsang33.github.io/weakDetect/](https://lsang33.github.io/weakDetect/)

---

## 功能一览

### 📝 错题录入
| 功能 | 说明 |
|------|------|
| **手录** | 手动填写题目原文、答案、知识点、模块等信息 |
| **拍照 OCR** | 拍照或从相册选图，调用通义千问 VL 自动提取题目原文、正确答案、模块、知识点 |
| **图片裁剪** | 拍照后支持裁剪，去除无关区域 |
| **存疑模式** | 支持记录"做对了但不理解"的题，不计入薄弱点统计 |

### 🤖 AI 单题诊断
支持双模型、三风格、自动纠错：

| 特性 | 说明 |
|------|------|
| **双模型** | 通义千问（qwen-max，思考模式）/ DeepSeek（Flash 或 Pro，可切换） |
| **三风格** | 精炼（简洁结论）/ 详细（逐项辨析）/ 自由（自然语气） |
| **自动纠错** | 如果 AI 初答错了，自动用正确答案重新推导，显示"初答X→修正Y" |
| **多轮对比** | 可用不同风格/模型多次诊断，对比后选用最满意的一次 |
| **完整输出** | 难度、考点、关键区分点、逐项解析、陷阱、错因、改进方法 |
| **自动回填** | 诊断结果自动填充模块、知识点、细分考点到表单 |

### 🔬 AI 批量分析
| 功能 | 说明 |
|------|------|
| **跨题归因** | 一次性分析多道错题，识别共性弱点模式 |
| **严重度评估** | 每个弱点标记 high/medium/low，按优先级排序 |
| **模块变化** | 各模块的进步/退步/稳定趋势分析 |
| **改进计划** | 本周/下周重点 + 信心鼓励语 |
| **逐题分析** | 每道题的根因、思维偏差、具体做法 |
| **历史对比** | 与上次报告的弱点对比，标记改善/顽固/新增 |

### 📊 统计图表
| 模块 | 图表 |
|------|------|
| **模块正确率** | 雷达图（6 模块） |
| **错题分布** | 水平条形图（各模块错题数/待攻克数） |
| **错误类型** | 环状饼图（知识点盲区/粗心大意/时间不足/审题偏差） |
| **每周趋势** | 折线图（新增错题 vs 已复习，8 周） |
| **薄弱知识点** | Top 10 排名列表（含模块标签、趋势箭头、评分） |

### 🔁 智能复习计划
| 功能 | 说明 |
|------|------|
| **间隔重复** | 按 1 天 / 3 天 / 7 天 / 14 天 / 30 天间隔推送复习 |
| **优先级排序** | 薄弱分数 → 距上次复习时间 → 错误次数 |
| **每日限额** | 默认每天最多 20 道，单模块不超过 60% |
| **完成状态** | 点击切换完成，全完成后展示庆祝提示 |

### 📈 改进追踪
| 功能 | 说明 |
|------|------|
| **记录练习** | 记录每次练习的方法和效果（有帮助/不确定/没帮助） |
| **历史追踪** | 查看所有改进尝试的时间线 |
| **AI 反馈闭环** | 批量分析时传入改进历史，AI 根据有效/无效反馈调整建议 |

### 💾 数据管理
| 功能 | 说明 |
|------|------|
| **本地存储** | 所有数据存储在浏览器 IndexedDB，无服务器上传 |
| **导出/导入** | JSON 格式全量备份，支持迁移到另一设备 |
| **离线使用** | PWA Service Worker 缓存，无网络也可查看历史数据 |
| **主屏幕安装** | Android Chrome / iPhone Safari 添加到主屏幕，全屏运行 |

### ⚙️ 配置
| 设置 | 说明 |
|------|------|
| **通义千问 Key** | 拍照 OCR 必需（DashScope） |
| **DeepSeek Key** | AI 诊断和批量分析必需 |
| **Key 校验** | 保存时自动验证 Key 有效性，输入框显示 ✅/❌ |
| **模型切换** | DeepSeek 可选 Flash（快速）或 Pro（深度思考） |
| **风格切换** | 诊断风格：精炼 / 详细 / 自由 |

---

## 技术栈

| 层 | 技术 |
|----|------|
| 构建 | Vite 6 + TypeScript 5.7 |
| 框架 | React 19 |
| 路由 | React Router v7 |
| 样式 | Tailwind CSS v3 |
| 数据库 | Dexie.js (IndexedDB) |
| 图表 | Recharts |
| PWA | vite-plugin-pwa |
| 拍照识别 | DashScope API（通义千问 VL） |
| AI 诊断 | DashScope（qwen-max）+ DeepSeek API（deepseek-chat/reasoner） |

## 架构

```
Pages ──→ Hooks (useLiveQuery) ──→ Services ──→ Repositories (DAO) ──→ Dexie ──→ IndexedDB
                                      │
                                   AI API（通义千问 / DeepSeek）
```

- **数据层**：Dexie 封装 IndexedDB，Repository 模式隔离数据操作
- **服务层**：纯函数，无 React 依赖，可独立测试
- **AI 诊断**：共享诊断流程 `diagnosisCore.ts` + 模型适配层（~30 行/个）

## 开发

```bash
npm install
npm run dev        # http://localhost:5173/weakDetect/
npm run build      # → dist/
npm run preview    # 预览构建
```

## 部署（GitHub Pages）

```bash
npm run build
cd dist
git init && git checkout -b main
git add . && git commit -m "deploy"
git remote add origin https://github.com/你的用户名/weakDetect.git
git push -f origin main
```

然后在 GitHub 仓库 Settings → Pages → Source: Deploy from branch → `main` / (root) → Save。
