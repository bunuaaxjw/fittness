# 健身记录微信小程序 🏋️

一个帮助你记录和追踪健身训练的微信小程序。

## 功能

- **今日概览**：查看今日训练状态和本周统计
- **训练记录**：选择动作、记录每组重量和次数、计时
- **历史回顾**：按日期查看所有训练记录
- **个人中心**：累计数据、常用动作管理

## 技术栈

- 原生微信小程序（WXML + WXSS + JavaScript）
- 微信云开发（CloudBase）— 云数据库 + 云函数
- 无需搭建独立后端服务器

## 环境准备

1. 注册微信小程序账号：https://mp.weixin.qq.com
2. 下载微信开发者工具
3. 开通云开发：
   - 在微信开发者工具中点击「云开发」按钮
   - 创建环境，获取环境 ID
   - 将 `miniprogram/app.js` 中的 `env: 'fitness-xxx'` 替换为你的环境 ID
4. 替换 `project.config.json` 中的 `appid` 为你的小程序 AppID
5. 准备 tabBar 图标（40x40px 的 PNG），放到 `miniprogram/images/tabbar/` 目录：
   - `home.png` / `home-active.png`
   - `workout.png` / `workout-active.png`
   - `history.png` / `history-active.png`
   - `profile.png` / `profile-active.png`

## 目录结构

```
fitness-miniprogram/
├── miniprogram/
│   ├── app.js                          # 入口文件
│   ├── app.json                        # 全局配置（路由、tabBar）
│   ├── app.wxss                        # 全局样式
│   ├── pages/
│   │   ├── index/                      # 首页
│   │   ├── workout/                    # 训练页
│   │   ├── history/                    # 记录页
│   │   ├── profile/                    # 我的
│   │   ├── workout-detail/             # 训练详情
│   │   ├── exercise-pick/              # 选择动作
│   │   └── history-detail/             # 历史详情
│   ├── components/                     # 复用组件（待添加）
│   ├── utils/
│   │   ├── db.js                       # 云数据库封装
│   │   └── format.js                   # 格式化工具
│   └── images/
│       └── tabbar/                     # tabBar 图标（需自行添加）
├── cloudfunctions/                     # 云函数目录
├── docs/
│   └── PLAN.md                         # 开发方案
├── project.config.json                 # 微信开发者工具配置
└── README.md
```

## 开发进度

- [x] 阶段①：项目骨架 — 全局配置、页面路由、骨架文件
- [ ] 阶段②：全局框架 — tabBar 图标、云开发配置验证
- [ ] 阶段③：数据层 — 云数据库初始化、CRUD 连接
- [ ] 阶段④：动作库 — 预设数据导入、动作选择页面
- [ ] 阶段⑤：训练记录 — 核心训练流程
- [ ] 阶段⑥：首页 — 今日状态、快速入口
- [ ] 阶段⑦：历史+个人 — 记录回顾、个人中心

## 开始开发

1. 用微信开发者工具打开本目录
2. 在开发者工具中填写你的 AppID
3. 开通云开发并修改 `app.js` 中的环境 ID
4. 添加 tabBar 图标到 `miniprogram/images/tabbar/`
5. 开始编译预览！
