# CLAUDE.md

本文件为 Claude Code（claude.ai/code）在此仓库中工作时提供指导。

## 项目概述

健身记录微信小程序，当前版本：**v0.2.0**。基于原生微信小程序框架 + TypeScript + 微信云开发（云数据库 + 3 个云函数），无需独立后端。

## 开发环境

唯一的开发工具是**微信开发者工具**。TypeScript 由 IDE 自动编译，无 npm / webpack 构建步骤。

关键配置文件：
- `project.config.json` — appid `wx912227d31e9993fa`，lib `3.3.4`，`useCompilerPlugins: ["typescript"]`
- `tsconfig.json` — strict 模式，target ES2020，路径 alias `@utils/*`
- `typings/index.d.ts` — 全局类型定义（IExercise / IWorkout / ISetRecord / IAppOption 等）
- `miniprogram/app.json` — 7 页路由 + 4 tabBar + `"cloud": true`
- `miniprogram/app.ts` — 云开发初始化 `cloud1-d4gn8zrwfeef1e9d8`

开发方式：用微信开发者工具打开 `fitness-miniprogram/` 目录，IDE 负责 TS → JS 编译、预览和云函数部署。

## 技术约束

**WXSS** 接近 CSS 2.1 —— 不支持 CSS 变量（`var()`），不支持复杂选择器。使用 `rpx` 响应式单位（750rpx = 屏幕宽度）。设计 token 以注释形式记录在 `app.wxss`。

**WXML** 支持 `wx:if/wx:for/{{ }}/bind:*`。没有计算属性 —— 逻辑在 TS 文件中处理。

**云数据库** MongoDB 风格文档模型。所有操作通过 `utils/db.ts` 封装，返回 `{ success, data?, error? }`。内置指数退避重试（1 次，超时跳过）。

**云函数** 3 个，通过 IDE 右键 → "上传并部署：云端安装依赖"。

## 数据模型

### `exercises` — 52 个预设动作
| 字段 | 类型 | 说明 |
|---|---|---|
| name | string | 如"杠铃卧推" |
| body_part | string | 胸/背/腿/肩/手臂/核心/全身 |
| category | string | 自由重量/器械/自重/有氧 |
| is_preset | bool | 预设固定 true |
| icon | string | emoji |

### `workouts` — 训练记录
| 字段 | 类型 | 说明 |
|---|---|---|
| date | string | YYYY-MM-DD |
| duration_min | number | 训练时长 |
| notes | string | 备注 |

### `sets` — 组记录
| 字段 | 类型 | 说明 |
|---|---|---|
| workout_id | string | FK → workouts |
| exercise_id | string | FK → exercises |
| exercise_name | string | 冗余展示 |
| weight_kg | number | 重量 |
| reps | number | 次数 |
| sort_order | number | 排序 |

## 工具模块

| 文件 | 导出 |
|------|------|
| `utils/db.ts` | query / getById / add / update / remove / getExercises / getWorkouts / getWorkoutsCursor / getWorkoutsByDate / getSetsByWorkout / COLLECTIONS / _ |
| `utils/format.ts` | formatDate / formatDateShort / formatDateRelative / formatDuration / formatTimer / getWeekRange |
| `utils/error.ts` | showError(toast+log) / showSuccess / showLoading / hideLoading |
| `utils/constants.ts` | BODY_PARTS / CATEGORIES / PAGE_SIZE / MAX_RECENT_WORKOUTS 等 |
| `utils/workout-helper.ts` | addSet / removeSet / buildSetUpdatePath / groupSetsByExercise / buildSaveSets |

## 自定义组件

| 组件 | 路径 | 用途 |
|------|------|------|
| set-row | `components/set-row/` | 组输入行（重量/次数/备注/删除） |
| exercise-card | `components/exercise-card/` | 动作卡片（内部使用 set-row） |
| stat-summary | `components/stat-summary/` | 统计数据展示 |

## 云函数

| 函数 | 用途 |
|------|------|
| `initDB` | 一次性初始化：建集合 + 插入 52 个预设动作 |
| `saveWorkout` | 事务性保存/更新训练（create/update 模式），失败回滚 |
| `getProfileStats` | 服务端聚合查询个人统计 + 常用动作 |

## 页面架构

```
tabBar:
├── pages/index/index           # 首页 — 今日状态 + 动作名 + 最近训练 + 周统计 + 下拉刷新 + 5min 缓存
├── pages/workout/workout       # 训练 — 计时器 + 动作/组管理 + 自动填充 + 完成摘要（使用 exercise-card）
├── pages/history/history       # 记录 — 日期分组 + 搜索筛选 + 删除 + 游标分页
└── pages/profile/profile       # 我的 — 云函数聚合统计 + 常用动作点击跳转（使用 stat-summary）

子页面:
├── pages/workout-detail/index  # 训练详情 — 查看/编辑（删后重建 + 云函数事务）
├── pages/exercise-pick/index   # 选择动作 — 筛选 + 最近使用优先
└── pages/history-detail/index  # 历史详情 — 只读 + 再来一次
```

### 关键数据流

- **首页 → 训练**：`wx.switchTab`
- **训练 → 选动作**：`wx.navigateTo` + EventChannel 回传 + recentIds 参数
- **训练保存**：前端构建数据 → `wx.cloud.callFunction({ name: 'saveWorkout' })` → 云函数事务写入
- **记录 → 详情**：`wx.navigateTo` + workout `_id`
- **个人 → 记录**：`app.globalData._historyFilter` 传递筛选词

## 设计系统

| 用途 | 色值 |
|---|---|
| 主色/强调 | `#e94560` |
| 深色辅助 | `#0f3460` |
| 导航栏 | `#1a1a2e` |
| 页面背景 | `#f5f5f5` |
| 卡片 | `#ffffff` |
| 主/次/辅文字 | `#333` / `#666` / `#999` |
| 成功/警告 | `#27ae60` / `#f39c12` |

统一模式：`border-radius: 16rpx` 圆角卡片、轻阴影。tabBar 选中色 `#e94560`。

## 当前状态

- **v0.2.0**（当前）：体验打磨完成，TypeScript 全量迁移，3 个自定义组件，3 个云函数，生产可用
- **v0.3.0**（下一步）：训练模板
- 完整路线图：`docs/ROADMAP.md`
