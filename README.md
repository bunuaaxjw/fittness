# 健身记录微信小程序 🏋️

一个帮助你记录和追踪健身训练的微信小程序。

## 当前版本

**v0.2.0** — 体验打磨完成，生产可用

## 功能

- **今日概览**：今日训练状态、动作详情、本周统计、下拉刷新
- **训练记录**：选择动作、记录每组重量和次数、计时器、自动填充、最近使用
- **历史回顾**：按日期分组列表、搜索筛选、删除记录、无限滚动
- **个人中心**：累计数据（次数/分钟/组数/天数）、常用动作、点击跳转历史

## 技术栈

- 原生微信小程序 + **TypeScript**（严格模式）
- 微信云开发（CloudBase）— 云数据库 + 3 个云函数
- 无需搭建独立后端服务器

## 环境准备

1. 注册微信小程序账号：https://mp.weixin.qq.com
2. 下载微信开发者工具
3. 开通云开发：
   - 在微信开发者工具中点击「云开发」按钮
   - 创建环境，获取环境 ID
   - 将 `miniprogram/app.ts` 中的 `env: 'cloud1-d4gn8zrwfeef1e9d8'` 替换为你的环境 ID
4. 替换 `project.config.json` 中的 `appid` 为你的小程序 AppID
5. tabBar 图标已内置在 `miniprogram/images/tabbar/` 中

## 快速开始

1. 用微信开发者工具打开 `fitness-miniprogram/` 目录
2. 部署 3 个云函数（右键 → "上传并部署：云端安装依赖"）：
   - `cloudfunctions/initDB/` — 初始化动作库
   - `cloudfunctions/saveWorkout/` — 事务性保存训练
   - `cloudfunctions/getProfileStats/` — 个人统计聚合
3. 触发 `initDB` 云函数初始化数据
4. 开始编译预览！

## 目录结构

```
fitness-miniprogram/
├── miniprogram/
│   ├── app.ts                           # 入口文件
│   ├── app.json                         # 全局配置（路由、tabBar）
│   ├── app.wxss                         # 全局样式 + 设计变量
│   ├── pages/
│   │   ├── index/                       # 首页（缓存 + 下拉刷新）
│   │   ├── workout/                     # 训练页（核心记录流程）
│   │   ├── history/                     # 记录页（搜索 + 删除）
│   │   ├── profile/                     # 我的（云函数统计）
│   │   ├── workout-detail/             # 训练详情/编辑
│   │   ├── exercise-pick/              # 选择动作（最近使用）
│   │   └── history-detail/             # 历史详情（只读）
│   ├── components/
│   │   ├── set-row/                     # 组输入行组件
│   │   ├── exercise-card/               # 动作卡片组件
│   │   └── stat-summary/                # 统计展示组件
│   ├── utils/
│   │   ├── db.ts                        # 云数据库封装 + 重试
│   │   ├── format.ts                    # 格式化工具
│   │   ├── error.ts                     # 统一错误处理
│   │   ├── constants.ts                 # 全局常量
│   │   └── workout-helper.ts            # 组管理共享逻辑
│   └── images/tabbar/                   # tabBar 图标
├── cloudfunctions/
│   ├── initDB/                          # 初始化动作库
│   ├── saveWorkout/                     # 事务性保存训练
│   └── getProfileStats/                 # 聚合查询统计
├── typings/index.d.ts                   # 全局类型定义
├── tsconfig.json                        # TypeScript 配置
├── docs/                                # 设计文档
│   ├── PLAN.md
│   └── ROADMAP.md
└── project.config.json
```

## 数据模型

共 3 个集合，由 `initDB` 云函数创建：

| 集合 | 说明 | 关键字段 |
|------|------|---------|
| `exercises` | 52 个预设动作 | name, body_part, category, icon |
| `workouts` | 训练记录 | date, duration_min, notes |
| `sets` | 组记录 | workout_id, exercise_id, weight_kg, reps |

## 生产部署

1. 部署全部云函数
2. 触发 `initDB` 初始化数据库
3. 上传代码 → 微信公众平台
4. 添加体验成员（最多 15 人）
5. 数据库权限：exercises 所有人可读，workouts/sets 仅创建者可读写

详见 CLAUDE.md 获取完整技术文档。
