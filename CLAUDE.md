# CLAUDE.md

本文件为 Claude Code（claude.ai/code）在此仓库中工作时提供指导。

## 项目概述

健身记录微信小程序，当前版本：**v0.1.0 MVP**。基于原生微信小程序框架 + 微信云开发（云数据库 + 云函数），无需独立后端。

## 开发环境

唯一的开发工具是**微信开发者工具**。小程序源码没有 npm 构建步骤，也没有 package.json。

关键配置文件：
- `project.config.json` — IDE 设置，appid（`wx912227d31e9993fa`），基础库版本 `3.3.4`
- `miniprogram/app.json` — 页面路由、tabBar（4 个标签页）、`"cloud": true`
- `miniprogram/app.js` — 入口文件：初始化云开发环境 `cloud1-d4gn8zrwfeef1e9d8`，`globalData` 中存储身体部位和类别枚举

开发方式：用微信开发者工具打开 `fitness-miniprogram/` 目录，IDE 负责编译、预览和云函数部署。

## 技术约束

**WXSS** 接近 CSS 2.1 —— 不支持 CSS 变量（`var()`），不支持复杂选择器。使用 `rpx` 作为响应式单位（750rpx = 屏幕宽度）。全局设计变量以注释形式记录在 `miniprogram/app.wxss` 中。

**WXML** 支持 `wx:if`、`wx:for`、`{{ }}` 数据绑定、`bind:*` 组件事件。没有计算属性 —— 逻辑必须在 JS 文件中处理。

**云数据库** 基于 MongoDB 风格的文档模型，通过 `wx.cloud.database()` 访问。所有读写操作均通过 `utils/db.js` 模块封装，统一返回 `{ success: boolean, data?, error? }` 格式。

**云函数** 运行在 CloudBase 的 Node.js 环境中。目前只有一个：`cloudfunctions/initDB/`。通过 IDE 的云函数面板部署（右键 → 上传并部署）。

## 数据模型

共 3 个集合，均由 `initDB` 云函数创建：

### `exercises` —— 动作库（52 个预设动作）
| 字段 | 类型 | 说明 |
|---|---|---|
| `name` | string | 如"杠铃卧推" |
| `body_part` | string | 枚举：胸/背/腿/肩/手臂/核心/全身 |
| `category` | string | 枚举：自由重量/器械/自重/有氧 |
| `is_preset` | bool | 预设数据固定为 `true` |
| `icon` | string | emoji 图标 |
| `created_at` | Date | 服务器时间 |

### `workouts` —— 训练记录
| 字段 | 类型 | 说明 |
|---|---|---|
| `_openid` | string | 云开发安全规则自动添加 |
| `date` | string | `"YYYY-MM-DD"` 格式 |
| `duration_min` | number | 训练时长（分钟） |
| `notes` | string | 整体训练备注 |
| `created_at` | Date | 创建时间 |

### `sets` —— 组记录
| 字段 | 类型 | 说明 |
|---|---|---|
| `workout_id` | string | 关联 workouts._id |
| `exercise_id` | string | 关联 exercises._id |
| `exercise_name` | string | 冗余存储，方便展示 |
| `weight_kg` | number | 重量（kg） |
| `reps` | number | 次数 |
| `notes` | string | 该组备注 |
| `sort_order` | number | 组内排序 |

## 数据访问层（`miniprogram/utils/db.js`）

所有数据库操作均通过此模块。导出内容：

- **通用方法**：`query(collection, where?, options?)`、`getById(collection, id)`、`add(collection, data)`、`update(collection, id, data)`、`remove(collection, id)`
- **业务方法**：`getExercises(where?)`、`getWorkouts(page, pageSize)`、`getWorkoutsByDate(date)`、`getSetsByWorkout(workoutId)`

每个函数返回 `{ success: boolean, data?, error? }`。`add()` 额外返回 `_id`。同时也导出 `_`（db.command）用于构建查询条件。

## 云函数：`initDB`

一次性初始化函数，首次打开项目后运行：
1. 创建三个集合（`exercises`、`workouts`、`sets`），已存在则跳过
2. 检查预设动作是否已存在（幂等操作）
3. 插入 52 个覆盖所有身体部位和类别的预设动作

部署方式：IDE 中右键云函数目录 → "上传并部署"，然后在云函数控制台中触发，或通过 `wx.cloud.callFunction({ name: 'initDB' })` 调用。

## 页面架构

4 个 tabBar 页面 + 3 个子页面：

```
tabBar:
├── pages/index/index           # 首页 — 今日训练状态、最近记录、本周统计
├── pages/workout/workout       # 训练 — 核心记录流程（计时器 + 动作/组管理）
├── pages/history/history       # 记录 — 按日期分组的历史列表，支持无限滚动
└── pages/profile/profile       # 我的 — 用户信息、累计数据、常用动作

子页面（navigateTo）:
├── pages/workout-detail/index  # 训练详情 — 查看/编辑某次训练
├── pages/exercise-pick/index   # 选择动作 — 支持筛选的动作选择器，通过 EventChannel 返回结果
└── pages/history-detail/index  # 历史详情 — 只读视角，提供"再来一次"按钮
```

### 关键数据流

- **首页 → 训练页**：`wx.switchTab`（tabBar 切换），不传数据
- **训练页 → 选动作**：`wx.navigateTo`，选中动作通过 `EventChannel` 回传
- **训练保存**：先创建 `workouts` 文档，再遍历动作和组分别创建 `sets` 文档
- **记录 → 训练详情**：`wx.navigateTo`，通过查询参数传递 workout `_id`
- **训练详情编辑模式**：删除该次训练所有旧组记录，全量重新插入 —— "删后重建"模式，非增量更新

### 训练页状态模型

训练页（`pages/workout/workout`）是最复杂的页面，核心状态：
- `isWorkoutActive` —— 控制计时器和 UI 模式（休息中 vs 训练中）
- `selectedExercises` —— `[{ exercise, sets: [{ weight_kg, reps, notes }] }]` 数组，每个动作至少保留一组
- `elapsedSeconds` —— 由 `setInterval` 每秒更新
- 防重复机制：同一动作不能重复添加
- 与 exercise-pick 页面通过 EventChannel 通信接收选中动作

## 设计系统

配色（在 `miniprogram/app.wxss` 中以注释形式记录 —— WXSS 不支持 CSS 变量）：

| 用途 | 色值 |
|---|---|
| 主色/强调 | `#e94560` |
| 深色辅助 | `#0f3460` |
| 导航栏背景 | `#1a1a2e` |
| 页面背景 | `#f5f5f5` |
| 卡片背景 | `#ffffff` |
| 主文字 | `#333333` |
| 次要文字 | `#666666` |
| 辅助文字 | `#999999` |
| 成功 | `#27ae60` |
| 警告 | `#f39c12` |

所有页面使用统一的设计模式：`border-radius: 16rpx` 圆角卡片、轻阴影、一致的按钮样式。tabBar 选中态使用主色 `#e94560`。

## 工具模块

- `miniprogram/utils/format.js` —— `formatDate()`、`formatDateRelative()`（今天/昨天/前天）、`formatDuration()`、`formatTimer()`（mm:ss）、`getWeekRange()`
- `miniprogram/utils/db.js` —— 数据库访问层（上文已描述）

## 当前状态与路线图

- **v0.1.0**（当前）：MVP 完成 —— 7 个页面全部可用，52 个预设动作，训练增删改查完整闭环
- **v0.2.0**（下一步）：体验打磨 —— 最近使用、自动填充、下拉刷新、左滑删除
- 完整路线图：`docs/ROADMAP.md`（v0.2.0 → v1.0.0）
- 原始设计文档：`docs/PLAN.md`

v0.1.0 已知缺口：
- 尚未实现自定义组件（PLAN.md 规划的 `exercise-card`、`set-row`、`stat-summary` —— 所有页面目前使用内联 WXML）
- tabBar 图标缺失（`miniprogram/images/tabbar/` 需要 8 张 PNG）
- `history-detail` 页面存在但 `history.js` 实际跳转到 `workout-detail` —— 存在一个未使用的只读详情页
- 周统计通过客户端拉取所有训练记录后过滤计算（MVP 阶段数据量小，可接受）
- 无请求中断机制 —— 即使离开页面，训练计时器仍继续运行
- 无错误边界处理 —— 云 API 失败时静默捕获并记录日志
