# 健身小程序全面重构 — 设计文档

> 日期：2026-07-09 | 状态：待审核

## 一、背景与目标

当前项目（v0.2.0）是一个功能完整的健身记录微信小程序，代码质量总体良好（TypeScript 严格模式、工具函数抽取、组件化）。但存在以下问题：

- 页面直接调用 `wx.cloud.database()`，业务逻辑与数据访问耦合
- 缓存策略不统一（仅首页手动做了 5 分钟缓存）
- 部分页面 TS 文件偏大（history 221 行、workout 198 行）
- 动作库仅 52 个预设，无动作说明、无动图演示

本次重构目标：

1. **分层架构** — 引入 DAL 层 + Service 层 + 统一缓存，页面瘦身
2. **UI/交互升级** — 动作卡片支持 GIF 预览、中文说明
3. **动作库扩展** — 从 [exercises-dataset](https://github.com/hasaneyldrm/exercises-dataset) 精选 ~200 个动作

采用**逐页迭代**策略，每次彻底重构一个页面（DAL → Service → UI），首轮从训练页开始。

---

## 二、整体架构

### 2.1 分层设计

```
┌─────────────────────────────────────────┐
│  UI 层                                   │
│  pages/ + components/                    │
│  纯展示 + 事件绑定，不含业务逻辑          │
├─────────────────────────────────────────┤
│  逻辑层                                  │
│  services/ （业务逻辑 + 状态协调）         │
│  每个页面一个 service，可独立测试          │
├─────────────────────────────────────────┤
│  数据访问层                              │
│  dal/ （统一查询 + 缓存策略 + 离线容错）   │
│  所有云数据库调用走这一层                  │
├─────────────────────────────────────────┤
│  基础设施                                 │
│  云数据库 / 云存储（GIF图片） / 云函数     │
└─────────────────────────────────────────┘
```

### 2.2 目录变化

```
miniprogram/
├── dal/                  ← 新：数据访问层
│   ├── exercise-dal.ts       # 动作库 CRUD + 搜索 + 缓存
│   ├── workout-dal.ts        # 训练记录 CRUD + 分页查询
│   └── cache.ts              # 统一缓存管理器
├── services/             ← 新：业务逻辑层
│   ├── workout-service.ts    # 训练页业务逻辑
│   ├── history-service.ts    # 记录页业务逻辑
│   └── profile-service.ts    # 个人页业务逻辑
├── data/                 ← 新：静态数据
│   └── exercises.ts          # 动作数据（内置52 + 扩展~150）
├── utils/                ← 保留，精简
│   ├── format.ts             # 日期/数字格式化
│   ├── error.ts              # 统一错误提示
│   └── constants.ts          # 全局常量
├── components/           ← 保留，升级
│   ├── exercise-card/        # 升级：支持 GIF 缩略图 + 中文说明
│   ├── set-row/              # 保留：组输入行
│   └── stat-summary/         # 保留：统计展示
├── pages/                ← 保留，瘦身
│   ├── index/
│   ├── workout/              # 首轮重构目标
│   ├── history/
│   ├── profile/
│   ├── workout-detail/
│   ├── exercise-pick/        # 升级：支持 GIF 预览 + 中英文搜索
│   └── history-detail/
└── app.ts
```

### 2.3 即将删除的文件

- `utils/db.ts` — 功能拆分到 dal/*.ts
- `utils/workout-helper.ts` — 功能合并到 WorkoutService
- `utils/seed.ts` — 数据迁移到 data/exercises.ts

---

## 三、数据模型变更

### 3.1 exercises 集合（扩展后）

```typescript
interface IExercise {
  _id: string;
  name: string;              // "杠铃卧推"
  name_en?: string;          // "Barbell Bench Press"（新增，便于中英文搜索）
  body_part: string;         // "胸"
  category: string;          // "自由重量"
  equipment?: string;        // "杠铃"（新增）
  target_muscle?: string;    // "胸大肌"（新增）
  instructions_zh?: string;  // 中文动作说明（新增）
  gif_url?: string;          // 云存储/CDN GIF 链接（新增，替代纯 emoji）
  icon: string;              // emoji，GIF 加载失败时兜底
  is_preset: boolean;        // true
  source: 'builtin' | 'extended';  // 新增：区分内置/扩展
}
```

### 3.2 workouts 和 sets 集合

字段不变，保持向后兼容。

---

## 四、DAL + Service 层设计

### 4.1 ExerciseDAL

```typescript
class ExerciseDAL {
  async getAll(): Promise<IDbResult<IExercise[]>>
  async getByBodyPart(part: string): Promise<IDbResult<IExercise[]>>
  async search(keyword: string): Promise<IDbResult<IExercise[]>>
  async getByIds(ids: string[]): Promise<IDbResult<IExercise[]>>
  async getRecent(limit?: number): Promise<IExercise[]>
  async seedIfEmpty(): Promise<void>   // 首次启动自动导入
}
```

核心行为：
- 所有查询先查缓存（CacheManager），未命中再查云数据库
- `getRecent` 完全走本地缓存（存储最近使用的动作 ID 列表）
- `seedIfEmpty` 检测集合是否空，空则分批写入内置 + 扩展动作

### 4.2 WorkoutDAL

```typescript
class WorkoutDAL {
  async save(workout: IWorkoutData): Promise<IDbResult>
  async update(id: string, data: Partial<IWorkoutData>): Promise<IDbResult>
  async delete(id: string): Promise<IDbResult>
  async getById(id: string): Promise<IDbResult<IWorkoutData>>
  async list(cursor?: string, pageSize?: number): Promise<IDbResult<IWorkoutData[]>>
  async getByDate(date: string): Promise<IDbResult<IWorkoutData[]>>
}
```

### 4.3 CacheManager

```typescript
// 单例模式，确保所有 DAL 共享同一缓存
class CacheManager {
  private static instance: CacheManager
  private store: Map<string, { data: any; expireAt: number }>
  private readonly DEFAULT_TTL = 5 * 60 * 1000  // 5 分钟

  static getInstance(): CacheManager
  get<T>(key: string): T | null
  set<T>(key: string, data: T, ttl?: number): void
  invalidate(pattern?: string): void
  has(key: string): boolean
}
```

### 4.4 WorkoutService

```typescript
class WorkoutService {
  private exerciseDAL: ExerciseDAL
  private workoutDAL: WorkoutDAL

  // 初始化训练页
  async initWorkout(recentIds?: string[]): Promise<{
    recentExercises: IExercise[]
    suggestions: IExercise[]
  }>

  // 状态操作（纯函数，返回新 WorkoutState）
  addExercise(state: WorkoutState, exercise: IExercise): WorkoutState
  removeExercise(state: WorkoutState, index: number): WorkoutState
  addSet(state: WorkoutState, exerciseIndex: number): WorkoutState
  removeSet(state: WorkoutState, exerciseIndex: number, setIndex: number): WorkoutState | null
  updateSet(state: WorkoutState, exIdx: number, setIdx: number, field: string, value: any): WorkoutState
  autoFill(state: WorkoutState, exerciseIndex: number): WorkoutState

  // 保存
  async saveWorkout(state: WorkoutState, durationMin: number, notes: string): Promise<IDbResult>
}
```

### 4.5 WorkoutState

```typescript
class WorkoutState {
  exercises: ExerciseWithSets[]
  recentExercises: IExercise[]
  suggestions: IExercise[]
  startedAt: number

  static create(recent: IExercise[], suggestions: IExercise[]): WorkoutState
  getExercise(index: number): ExerciseWithSets
  getTotalSets(): number
  isEmpty(): boolean
}
```

---

## 五、首轮迭代：训练页 workout 重构

### 5.1 Page TS 瘦身（198 行 → ~60 行）

页面只保留：生命周期、事件绑定（委托 service）、setData。

```typescript
Page({
  data: {
    state: null as WorkoutState | null,
    durationMin: 0,
    notes: '',
    isSaving: false,
  },

  async onLoad(query: { recentIds?: string }) {
    const service = new WorkoutService()
    const init = await service.initWorkout(query.recentIds?.split(','))
    this.setData({ state: WorkoutState.create(init.recentExercises, init.suggestions) })
  },

  onAddExercise() { /* navigateTo exercise-pick */ },
  onExercisePick(e: { detail: IExercise }) {
    this.setData({ state: new WorkoutService().addExercise(this.data.state!, e.detail) })
  },
  onRemoveExercise(e: { detail: { index: number } }) {
    this.setData({ state: new WorkoutService().removeExercise(this.data.state!, e.detail.index) })
  },
  onAddSet(e: { detail: { exerciseIndex: number } }) { /* 同模式 */ },
  onRemoveSet(e) { /* 同模式 */ },
  onSetChange(e) { /* 同模式 */ },

  async onFinish() {
    if (this.data.state!.isEmpty()) return
    const confirm = await showFinishModal()
    if (!confirm) return
    this.setData({ isSaving: true })
    const result = await new WorkoutService().saveWorkout(this.data.state!, this.data.durationMin, this.data.notes)
    if (result.success) {
      new CacheManager().invalidate('index')  // 清除首页缓存
      wx.switchTab({ url: '/pages/index/index' })
    }
    this.setData({ isSaving: false })
  },
})
```

### 5.2 UI 改进

| 现在 | 重构后 |
|------|--------|
| 动作卡片用 emoji | 左侧 GIF 缩略图，加载失败降级 emoji |
| 完成弹窗纯文字 | 摘要：总动作数、总组数、耗时 |
| 「添加动作」列表纯文字 | 列表项左侧 GIF 缩略图 + 部位/器械标签 |
| WXSS 169 行 | ~100 行（提取设计 token 复用） |

---

## 六、动作库扩展方案

### 6.1 精选规则（~200 个目标）

| 优先级 | 来源 | 预估数量 | 说明 |
|--------|------|---------|------|
| P0 | 现有 52 个内置 | 52 | 完全保留，`source: 'builtin'` |
| P1 | dataset 中健身房高频动作 | ~80 | 如"哑铃弯举""高位下拉"等，`source: 'extended'` |
| P2 | dataset 中 body weight 类 | ~40 | 自重训练，无器械门槛 |
| P3 | dataset 中其他常见器械 | ~30 | 壶铃、弹力带、史密斯机等 |

### 6.2 分类映射

dataset `category` → 中文 `body_part`：

| dataset | 中文 |
|---------|------|
| chest | 胸 |
| back | 背 |
| upper legs | 腿 |
| lower legs | 腿 |
| shoulders | 肩 |
| upper arms | 手臂 |
| lower arms | 手臂 |
| waist | 核心 |
| cardio | 全身 |
| neck | 全身 |

dataset `equipment` → 中文 `category`：

| dataset | 中文 |
|---------|------|
| barbell / dumbbell / kettlebell / ez barbell | 自由重量 |
| cable / leverage machine / smith machine | 器械 |
| body weight | 自重 |
| band / stability ball / weighted | 器械 |

### 6.3 GIF 图片策略

- 不在小程序包内打包图片（2MB 限制）
- 使用 jsDelivr CDN 直链：`https://cdn.jsdelivr.net/gh/hasaneyldrm/exercises-dataset@main/videos/{0001}-{media_id}.gif`
- GIF 加载失败时显示 emoji 兜底
- 数据文件 `data/exercises.ts` 中存储 `gif_url` 字段

### 6.4 导入策略

首次启动时自动检测导入：

```
exercises 集合是否有记录？
├── 有 → 跳过
└── 无 → 分批写入 P0(52) → P1(~80) → P2(~40) → P3(~30)
         每批 50 条，写完后更新本地标记
```

### 6.5 版权处理

- 每个扩展动作的 `instructions_zh` 末尾追加来源标注
- 选择动作详情弹窗底部显示 `© Gym visual — https://gymvisual.com/`

---

## 七、后续迭代计划

| 轮次 | 页面 | 内容 |
|------|------|------|
| 第 1 轮 | workout | DAL + Service + WorkoutState + UI 升级 |
| 第 2 轮 | index | DAL + Service + 统一缓存刷新 |
| 第 3 轮 | history | DAL + Service + 搜索优化 |
| 第 4 轮 | profile | DAL + Service + 统计优化 |
| 第 5 轮 | 子页面 + 组件 | workout-detail / history-detail / exercise-pick 升级 + 组件打磨 |
| 第 6 轮 | 清理 | 删除 utils/db.ts / workout-helper.ts / seed.ts，统一出口 |

---

## 八、不做的

- ❌ 训练模板（v0.3.0 路线图内容，重构后再做）
- ❌ 进度图表（v0.4.0）
- ❌ 激励系统（v0.6.0）
- ❌ 迁移到 Taro/uni-app（保持原生小程序）
- ❌ 全部 1,324 个动作导入（精选 ~200 个即可）

---

## 九、风险与对策

| 风险 | 对策 |
|------|------|
| GIF 图 jsDelivr CDN 在国内可能慢 | 备选方案：上传到微信云存储，使用云文件 ID |
| 旧数据兼容 | exercises 新增字段均为可选，works/sets 结构不变 |
| 重构期间破坏现有功能 | 逐页迭代，每个页面独立重构，测试通过再进下一轮 |
| 页面状态重构引入 bug | WorkoutState 为不可变对象，每次操作返回新实例，便于追踪 |
