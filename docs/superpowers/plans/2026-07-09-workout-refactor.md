# 第1轮：训练页 workout 重构 — 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 重构训练页（workout），引入 DAL + Service + WorkoutState 分层架构，同时升级 exercise-card 组件支持 GIF 缩略图，并扩展动作库从 52 → ~200 个。

**Architecture:** 新建 `dal/`（CacheManager、ExerciseDAL、WorkoutDAL）、`services/`（WorkoutService + WorkoutState）、`data/exercises.ts`。重构 `pages/workout/workout.ts`（198行 → ~80行），升级 `components/exercise-card/` 支持 GIF。其他页面暂时继续使用旧的 `utils/db.ts` / `utils/workout-helper.ts`，后续轮次再迁移。

**Tech Stack:** 微信小程序原生框架 + TypeScript 严格模式 + 微信云开发（云数据库）

## Global Constraints

- WXSS 不支持 CSS 变量（`var()`）、复杂选择器；使用 `rpx` 响应式单位
- 小程序包大小限制 2MB，GIF 图片必须走 CDN 外链，不打包
- 云数据库 MongoDB 风格文档模型，所有调用通过 DAL 封装
- 现有 workouts/sets 数据模型不变，exercises 新增可选字段向后兼容
- 旧 utils（db.ts, workout-helper.ts, seed.ts）暂不删除，其他页面仍依赖它们
- 设计 token：主色 `#e94560`，深色 `#0f3460`，导航 `#1a1a2e`，背景 `#f5f5f5`，卡片 `#ffffff`

---

## File Structure

| 操作 | 文件 | 职责 |
|------|------|------|
| Create | `miniprogram/dal/cache.ts` | 单例缓存管理器，TTL 过期 + 前缀匹配清除 |
| Create | `miniprogram/dal/exercise-dal.ts` | 动作库 CRUD + 搜索 + 首次启动种子导入 |
| Create | `miniprogram/dal/workout-dal.ts` | 训练记录 CRUD + 游标分页 + 日期查询 |
| Create | `miniprogram/data/exercises.ts` | 52 个内置 + ~150 个扩展动作数据 |
| Create | `miniprogram/services/workout-service.ts` | WorkoutState + WorkoutService 业务逻辑 |
| Modify | `miniprogram/typings/index.d.ts` | 新增 IExercise 扩展字段、IWorkoutData、ExerciseWithSets 类型 |
| Modify | `miniprogram/components/exercise-card/index.ts` | 新增 icon、gifUrl、instructionsZh 属性 |
| Modify | `miniprogram/components/exercise-card/index.wxml` | GIF 缩略图 + emoji 兜底 + 说明文字 |
| Modify | `miniprogram/components/exercise-card/index.wxss` | 新布局样式 |
| Modify | `miniprogram/pages/workout/workout.ts` | 瘦身为 ~80 行，使用 WorkoutService |
| Modify | `miniprogram/pages/workout/workout.wxml` | 适配新的数据结构 |
| Modify | `miniprogram/pages/workout/workout.wxss` | 精简 + 新增完成摘要弹窗样式 |

---

### Task 1: 更新类型定义

**Files:**
- Modify: `miniprogram/typings/index.d.ts`

**Interfaces:**
- Produces: `IExerciseExtended`（扩展后的动作类型）、`IWorkoutData`（训练数据格式）、`ExerciseWithSets`（动作+组）、`WorkoutStateData`（页面状态）

- [ ] **Step 1: 在 typings/index.d.ts 末尾追加新类型定义**

在文件末尾（`IUserInfo` 接口之后）追加以下内容：

```typescript
// ===== v0.3.0 重构新增类型 =====

/** 扩展后的动作类型（兼容旧字段，新增可选字段） */
interface IExerciseExtended extends IExercise {
  name_en?: string;          // 英文名，便于搜索
  equipment?: string;        // 器械类型（中文），如"杠铃"
  target_muscle?: string;    // 目标肌肉，如"胸大肌"
  instructions_zh?: string;  // 中文动作说明
  gif_url?: string;          // CDN GIF 链接
  source?: 'builtin' | 'extended';  // 内置 vs 扩展
}

/** 训练保存数据格式 */
interface IWorkoutData {
  _id?: string;
  date: string;
  duration_min: number;
  notes: string;
  created_at?: Date;
  sets: Array<{
    exercise_id: string;
    exercise_name: string;
    weight_kg: number;
    reps: number;
    notes: string;
    sort_order: number;
  }>;
}

/** 动作 + 组数据（训练页状态用） */
interface ExerciseWithSets {
  exercise: IExerciseExtended;
  sets: Array<{ weight_kg: number | string; reps: number | string; notes: string }>;
}

/** 训练页状态数据 */
interface WorkoutStateData {
  exercises: ExerciseWithSets[];
  recentExercises: IExerciseExtended[];
  suggestions: IExerciseExtended[];
  startedAt: number;
}
```

- [ ] **Step 2: 提交**

```bash
git add miniprogram/typings/index.d.ts
git commit -m "feat: 扩展类型定义，支持重构后的数据模型"
```

---

### Task 2: 创建 CacheManager 单例

**Files:**
- Create: `miniprogram/dal/cache.ts`

**Interfaces:**
- Produces: `CacheManager.getInstance(): CacheManager`, `get<T>(key: string): T | null`, `set<T>(key: string, data: T, ttl?: number): void`, `invalidate(pattern?: string): void`

- [ ] **Step 1: 创建 `miniprogram/dal/cache.ts`**

```typescript
/**
 * 统一缓存管理器（单例）
 * 所有 DAL 共享同一缓存实例，确保缓存一致性
 */
class CacheManager {
  private static instance: CacheManager;
  private store: Map<string, { data: any; expireAt: number }>;
  private readonly DEFAULT_TTL = 5 * 60 * 1000; // 5 分钟

  private constructor() {
    this.store = new Map();
  }

  static getInstance(): CacheManager {
    if (!CacheManager.instance) {
      CacheManager.instance = new CacheManager();
    }
    return CacheManager.instance;
  }

  /** 获取缓存，过期返回 null */
  get<T>(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expireAt) {
      this.store.delete(key);
      return null;
    }
    return entry.data as T;
  }

  /** 写入缓存，默认 5 分钟 TTL */
  set<T>(key: string, data: T, ttl?: number): void {
    this.store.set(key, {
      data,
      expireAt: Date.now() + (ttl || this.DEFAULT_TTL),
    });
  }

  /** 是否有效缓存 */
  has(key: string): boolean {
    return this.get(key) !== null;
  }

  /**
   * 清除匹配前缀的缓存
   * @param pattern 前缀字符串，如 "exercises" 清除所有动作缓存，"index" 清除首页缓存
   */
  invalidate(pattern?: string): void {
    if (!pattern) {
      this.store.clear();
      return;
    }
    for (const key of this.store.keys()) {
      if (key.startsWith(pattern)) {
        this.store.delete(key);
      }
    }
  }
}

export { CacheManager };
```

- [ ] **Step 2: 提交**

```bash
git add miniprogram/dal/cache.ts
git commit -m "feat: 添加 CacheManager 单例缓存管理器"
```

---

### Task 3: 创建动作数据文件（52 内置 + ~150 扩展）

**Files:**
- Create: `miniprogram/data/exercises.ts`

**Interfaces:**
- Consumes: `IExerciseExtended` (from typings/index.d.ts)
- Produces: `BUILTIN_EXERCISES: IExerciseExtended[]`（52个）、`EXTENDED_EXERCISES: IExerciseExtended[]`（~150个）、`ALL_EXERCISES: IExerciseExtended[]`（合并）

- [ ] **Step 1: 从数据集提取并生成 exercises.ts**

将 `/tmp/exercises-dataset/data/exercises.json` 读取，按精选规则筛选 ~150 个扩展动作。分类映射规则见设计文档 6.2 节。

文件结构：

```typescript
/**
 * 健身动作数据
 * - BUILTIN: 52 个原内置动作（source: 'builtin'）
 * - EXTENDED: ~150 个精选扩展动作（source: 'extended'，来自 exercises-dataset）
 * cdnBase: jsDelivr CDN 基础路径
 */

const CDN_BASE = 'https://cdn.jsdelivr.net/gh/hasaneyldrm/exercises-dataset@main';

// 分类映射
const BODY_PART_MAP: Record<string, string> = {
  chest: '胸', back: '背', 'upper legs': '腿', 'lower legs': '腿',
  shoulders: '肩', 'upper arms': '手臂', 'lower arms': '手臂',
  waist: '核心', cardio: '全身', neck: '全身',
};

const CATEGORY_MAP: Record<string, string> = {
  barbell: '自由重量', dumbbell: '自由重量', kettlebell: '自由重量',
  'ez barbell': '自由重量', cable: '器械', 'leverage machine': '器械',
  'smith machine': '器械', 'body weight': '自重', band: '器械',
  'stability ball': '器械', weighted: '器械',
};

const BUILTIN_EXERCISES: IExerciseExtended[] = [
  // 胸 (8)
  { name: '杠铃卧推', body_part: '胸', category: '自由重量', is_preset: true, icon: '🏋️', source: 'builtin' },
  // ... 共 52 个（从当前 utils/seed.ts 迁移，每个加上 source: 'builtin'）
];

const EXTENDED_EXERCISES: IExerciseExtended[] = [
  // 精选扩展动作，格式：
  // {
  //   name: '哑铃卧推',           // 使用 dataset 的 name 或中文俗称
  //   name_en: 'Dumbbell Bench Press',
  //   body_part: '胸',            // 通过 BODY_PART_MAP 映射
  //   category: '自由重量',        // 通过 CATEGORY_MAP 映射
  //   equipment: '哑铃',
  //   target_muscle: '胸大肌',
  //   instructions_zh: '...' + '\n\n© Gym visual — https://gymvisual.com/',
  //   gif_url: `${CDN_BASE}/videos/{id}-{media_id}.gif`,
  //   icon: '🏋️',
  //   is_preset: true,
  //   source: 'extended',
  // }
];

const ALL_EXERCISES: IExerciseExtended[] = [...BUILTIN_EXERCISES, ...EXTENDED_EXERCISES];

export { BUILTIN_EXERCISES, EXTENDED_EXERCISES, ALL_EXERCISES, CDN_BASE, BODY_PART_MAP, CATEGORY_MAP };
```

> **注意**：完整的 52 个内置动作数据从 `utils/seed.ts` 复制过来，每个对象追加 `source: 'builtin'`。扩展动作从 dataset JSON 中精选约 150 个（P1 高频动作 ~80 + P2 自重 ~40 + P3 其他器械 ~30），按分类映射规则转换字段。

- [ ] **Step 2: 提交**

```bash
git add miniprogram/data/exercises.ts
git commit -m "feat: 动作数据从 52 个扩展到 ~200 个，支持 GIF 和中文说明"
```

---

### Task 4: 创建 ExerciseDAL

**Files:**
- Create: `miniprogram/dal/exercise-dal.ts`

**Interfaces:**
- Consumes: `CacheManager` (from dal/cache.ts), `ALL_EXERCISES` (from data/exercises.ts), `IDbResult`, `IExerciseExtended` (from typings/index.d.ts)
- Produces: `ExerciseDAL` class with `getAll()`, `getByBodyPart()`, `search()`, `getByIds()`, `getRecent()`, `seedIfEmpty()`

- [ ] **Step 1: 创建 `miniprogram/dal/exercise-dal.ts`**

```typescript
/**
 * 动作数据访问层
 * 封装 exercises 集合的所有 CRUD 操作 + 缓存 + 种子导入
 */
import { CacheManager } from './cache';
import { ALL_EXERCISES } from '../data/exercises';

const db = wx.cloud.database();
const COLLECTION = 'exercises';
const RECENT_KEY = 'recent_exercise_ids';
const MAX_RECENT = 20;

class ExerciseDAL {
  private cache: CacheManager;

  constructor() {
    this.cache = CacheManager.getInstance();
  }

  /** 获取全部动作（缓存优先） */
  async getAll(): Promise<IDbResult<IExerciseExtended[]>> {
    const cacheKey = 'exercises:all';
    const cached = this.cache.get<IExerciseExtended[]>(cacheKey);
    if (cached) return { success: true, data: cached };

    try {
      const res = await db.collection(COLLECTION)
        .orderBy('name', 'asc')
        .limit(1000)
        .get();
      this.cache.set(cacheKey, res.data);
      return { success: true, data: res.data as IExerciseExtended[] };
    } catch (err) {
      return { success: false, error: err };
    }
  }

  /** 按身体部位筛选 */
  async getByBodyPart(part: string): Promise<IDbResult<IExerciseExtended[]>> {
    const cacheKey = `exercises:body_part:${part}`;
    const cached = this.cache.get<IExerciseExtended[]>(cacheKey);
    if (cached) return { success: true, data: cached };

    try {
      const res = await db.collection(COLLECTION)
        .where({ body_part: part })
        .orderBy('name', 'asc')
        .get();
      this.cache.set(cacheKey, res.data);
      return { success: true, data: res.data as IExerciseExtended[] };
    } catch (err) {
      return { success: false, error: err };
    }
  }

  /** 搜索动作（名称模糊匹配，中英文均可） */
  async search(keyword: string): Promise<IDbResult<IExerciseExtended[]>> {
    const cacheKey = `exercises:search:${keyword}`;
    const cached = this.cache.get<IExerciseExtended[]>(cacheKey);
    if (cached) return { success: true, data: cached };

    try {
      const _ = db.command;
      const regex = db.RegExp({ regexp: keyword, options: 'i' });
      const res = await db.collection(COLLECTION)
        .where(_.or([{ name: regex }, { name_en: regex || '' }]))
        .orderBy('name', 'asc')
        .limit(50)
        .get();
      this.cache.set(cacheKey, res.data);
      return { success: true, data: res.data as IExerciseExtended[] };
    } catch (err) {
      return { success: false, error: err };
    }
  }

  /** 按 ID 列表批量获取 */
  async getByIds(ids: string[]): Promise<IDbResult<IExerciseExtended[]>> {
    if (ids.length === 0) return { success: true, data: [] };
    const cacheKey = `exercises:ids:${ids.sort().join(',')}`;
    const cached = this.cache.get<IExerciseExtended[]>(cacheKey);
    if (cached) return { success: true, data: cached };

    try {
      const _ = db.command;
      const res = await db.collection(COLLECTION)
        .where({ _id: _.in(ids) })
        .get();
      this.cache.set(cacheKey, res.data);
      return { success: true, data: res.data as IExerciseExtended[] };
    } catch (err) {
      return { success: false, error: err };
    }
  }

  /** 获取最近使用的动作（本地存储 + 云数据库查具体数据） */
  async getRecent(limit: number = 10): Promise<IExerciseExtended[]> {
    try {
      const recentIds: string[] = wx.getStorageSync(RECENT_KEY) || [];
      if (recentIds.length === 0) return [];
      const result = await this.getByIds(recentIds.slice(0, limit));
      if (!result.success || !result.data) return [];
      // 按最近使用顺序排序
      const idOrder = new Map(recentIds.map((id, i) => [id, i]));
      return result.data.sort((a, b) => (idOrder.get(a._id) || 99) - (idOrder.get(b._id) || 99));
    } catch {
      return [];
    }
  }

  /** 记录动作使用（更新最近使用列表） */
  recordUsage(exerciseIds: string[]): void {
    try {
      const recentIds: string[] = wx.getStorageSync(RECENT_KEY) || [];
      const newIds = [...exerciseIds, ...recentIds.filter((id) => !exerciseIds.includes(id))];
      wx.setStorageSync(RECENT_KEY, newIds.slice(0, MAX_RECENT));
    } catch { /* 非关键路径 */ }
  }

  /**
   * 首次启动种子导入
   * 检测 exercises 集合是否为空，空则分批写入 ALL_EXERCISES
   */
  async seedIfEmpty(): Promise<void> {
    try {
      const countRes = await db.collection(COLLECTION).count();
      if (countRes.total > 0) return; // 已有数据，跳过
    } catch {
      // 集合可能不存在，继续导入
    }

    const BATCH_SIZE = 50;
    for (let i = 0; i < ALL_EXERCISES.length; i += BATCH_SIZE) {
      const batch = ALL_EXERCISES.slice(i, i + BATCH_SIZE);
      try {
        await Promise.all(
          batch.map((ex) => db.collection(COLLECTION).add({ data: ex }))
        );
      } catch (err) {
        console.warn(`[ExerciseDAL] 种子导入第 ${Math.floor(i / BATCH_SIZE) + 1} 批失败`, err);
      }
    }
    console.log(`[ExerciseDAL] 种子导入完成，共 ${ALL_EXERCISES.length} 个动作`);
  }
}

export { ExerciseDAL };
```

- [ ] **Step 2: 提交**

```bash
git add miniprogram/dal/exercise-dal.ts
git commit -m "feat: 添加 ExerciseDAL 数据访问层（缓存+搜索+种子导入）"
```

---

### Task 5: 创建 WorkoutDAL

**Files:**
- Create: `miniprogram/dal/workout-dal.ts`

**Interfaces:**
- Consumes: `CacheManager` (from dal/cache.ts), `IDbResult`, `IWorkoutData` (from typings/index.d.ts)
- Produces: `WorkoutDAL` class with `save()`, `update()`, `delete()`, `getById()`, `list()`, `getByDate()`

- [ ] **Step 1: 创建 `miniprogram/dal/workout-dal.ts`**

```typescript
/**
 * 训练记录数据访问层
 * 封装 workouts + sets 集合的 CRUD 操作
 */
import { CacheManager } from './cache';
import { showError } from '../utils/error';

const db = wx.cloud.database();
const COLL_WORKOUTS = 'workouts';
const COLL_SETS = 'sets';

class WorkoutDAL {
  private cache: CacheManager;

  constructor() {
    this.cache = CacheManager.getInstance();
  }

  /** 保存训练（workout + sets 事务性写入） */
  async save(data: IWorkoutData): Promise<IDbResult> {
    try {
      // 优先使用云函数事务写入
      const res: ICloudFunctionResult = await wx.cloud.callFunction({
        name: 'saveWorkout',
        data: { mode: 'create', date: data.date, duration_min: data.duration_min, notes: data.notes, sets: data.sets },
      });
      if (res.result.success) {
        this.cache.invalidate('workouts');
        return { success: true };
      }
      return { success: false, error: res.result.error };
    } catch {
      // 云函数不可用，降级为客户端直接写入
      return this.clientSave(data);
    }
  }

  /** 客户端降级保存 */
  private async clientSave(data: IWorkoutData): Promise<IDbResult> {
    try {
      const workoutRes = await db.collection(COLL_WORKOUTS).add({
        data: {
          date: data.date,
          duration_min: data.duration_min,
          notes: data.notes,
          created_at: new Date(),
        },
      });
      const workoutId = workoutRes._id;
      let sortOrder = 0;
      for (const set of data.sets) {
        await db.collection(COLL_SETS).add({
          data: {
            workout_id: workoutId,
            exercise_id: set.exercise_id,
            exercise_name: set.exercise_name,
            weight_kg: set.weight_kg,
            reps: set.reps,
            notes: set.notes,
            sort_order: sortOrder++,
          },
        });
      }
      this.cache.invalidate('workouts');
      return { success: true };
    } catch (err) {
      showError('保存失败，请重试', err);
      return { success: false, error: err };
    }
  }

  /** 更新训练（云函数 update 模式） */
  async update(id: string, data: Partial<IWorkoutData>): Promise<IDbResult> {
    try {
      const res: ICloudFunctionResult = await wx.cloud.callFunction({
        name: 'saveWorkout',
        data: { mode: 'update', workout_id: id, ...data },
      });
      if (res.result.success) {
        this.cache.invalidate('workouts');
        return { success: true };
      }
      return { success: false, error: res.result.error };
    } catch (err) {
      showError('更新失败', err);
      return { success: false, error: err };
    }
  }

  /** 删除训练记录 */
  async delete(id: string): Promise<IDbResult> {
    try {
      await db.collection(COLL_SETS).where({ workout_id: id }).remove();
      await db.collection(COLL_WORKOUTS).doc(id).remove();
      this.cache.invalidate('workouts');
      return { success: true };
    } catch (err) {
      showError('删除失败', err);
      return { success: false, error: err };
    }
  }

  /** 按 ID 获取单条训练 */
  async getById(id: string): Promise<IDbResult<IWorkoutData>> {
    try {
      const workout = await db.collection(COLL_WORKOUTS).doc(id).get();
      const sets = await db.collection(COLL_SETS)
        .where({ workout_id: id })
        .orderBy('sort_order', 'asc')
        .get();
      return {
        success: true,
        data: { ...workout.data, sets: sets.data } as IWorkoutData,
      };
    } catch (err) {
      showError('数据加载失败', err);
      return { success: false, error: err };
    }
  }

  /** 游标分页查询训练列表 */
  async list(cursor?: string, pageSize: number = 20): Promise<IDbResult<IWorkoutData[]>> {
    const cacheKey = `workouts:list:${cursor || 'head'}`;
    const cached = this.cache.get<IWorkoutData[]>(cacheKey);
    if (cached) return { success: true, data: cached };

    try {
      const _ = db.command;
      let query = db.collection(COLL_WORKOUTS).orderBy('_id', 'desc').limit(pageSize);
      if (cursor) {
        query = query.where({ _id: _.lt(cursor) });
      }
      const res = await query.get();
      this.cache.set(cacheKey, res.data);
      return { success: true, data: res.data as IWorkoutData[] };
    } catch (err) {
      showError('数据加载失败', err);
      return { success: false, error: err };
    }
  }

  /** 按日期查询训练 */
  async getByDate(date: string): Promise<IDbResult<IWorkoutData[]>> {
    const cacheKey = `workouts:date:${date}`;
    const cached = this.cache.get<IWorkoutData[]>(cacheKey);
    if (cached) return { success: true, data: cached };

    try {
      const res = await db.collection(COLL_WORKOUTS).where({ date }).get();
      this.cache.set(cacheKey, res.data);
      return { success: true, data: res.data as IWorkoutData[] };
    } catch (err) {
      return { success: false, error: err };
    }
  }
}

export { WorkoutDAL };
```

- [ ] **Step 2: 提交**

```bash
git add miniprogram/dal/workout-dal.ts
git commit -m "feat: 添加 WorkoutDAL 数据访问层（事务保存+分页+缓存）"
```

---

### Task 6: 创建 WorkoutState + WorkoutService

**Files:**
- Create: `miniprogram/services/workout-service.ts`

**Interfaces:**
- Consumes: `ExerciseDAL`, `WorkoutDAL`, `IExerciseExtended`, `ExerciseWithSets`, `WorkoutStateData` (from typings)
- Produces: `WorkoutState` class, `WorkoutService` class

- [ ] **Step 1: 创建 `miniprogram/services/workout-service.ts`**

```typescript
/**
 * 训练页业务逻辑
 * WorkoutState: 不可变状态对象
 * WorkoutService: 业务操作 + 数据协调
 */
import { ExerciseDAL } from '../dal/exercise-dal';
import { WorkoutDAL } from '../dal/workout-dal';
import { formatDate } from '../utils/format';

// ===== WorkoutState =====

class WorkoutState {
  exercises: ExerciseWithSets[];
  recentExercises: IExerciseExtended[];
  suggestions: IExerciseExtended[];
  startedAt: number;

  private constructor(
    exercises: ExerciseWithSets[],
    recent: IExerciseExtended[],
    suggestions: IExerciseExtended[],
    startedAt: number,
  ) {
    this.exercises = exercises;
    this.recentExercises = recent;
    this.suggestions = suggestions;
    this.startedAt = startedAt;
  }

  static create(recent: IExerciseExtended[], suggestions: IExerciseExtended[]): WorkoutState {
    return new WorkoutState([], recent, suggestions, Date.now());
  }

  getExercise(index: number): ExerciseWithSets {
    return this.exercises[index];
  }

  getTotalSets(): number {
    return this.exercises.reduce((sum, ex) =>
      sum + ex.sets.filter((s) => s.weight_kg || s.reps).length, 0
    );
  }

  isEmpty(): boolean {
    return this.exercises.length === 0;
  }

  /** 深拷贝 exercises 数组用于不可变更新 */
  private cloneExercises(): ExerciseWithSets[] {
    return this.exercises.map((ex) => ({
      ...ex,
      sets: ex.sets.map((s) => ({ ...s })),
    }));
  }
}

// ===== WorkoutService =====

class WorkoutService {
  private exerciseDAL: ExerciseDAL;
  private workoutDAL: WorkoutDAL;

  constructor() {
    this.exerciseDAL = new ExerciseDAL();
    this.workoutDAL = new WorkoutDAL();
  }

  /** 初始化训练页：获取最近动作 + 推荐 */
  async initWorkout(recentIds?: string[]): Promise<{
    recentExercises: IExerciseExtended[];
    suggestions: IExerciseExtended[];
  }> {
    // 确保动作库已初始化
    await this.exerciseDAL.seedIfEmpty();

    let recentExercises: IExerciseExtended[] = [];
    if (recentIds && recentIds.length > 0) {
      const res = await this.exerciseDAL.getByIds(recentIds);
      if (res.success && res.data) recentExercises = res.data;
    } else {
      recentExercises = await this.exerciseDAL.getRecent(10);
    }

    // 推荐动作：获取全部后取前 10 个（非最近使用过的）
    const allRes = await this.exerciseDAL.getAll();
    const recentIdSet = new Set(recentExercises.map((e) => e._id));
    const suggestions = (allRes.success && allRes.data)
      ? allRes.data.filter((e) => !recentIdSet.has(e._id)).slice(0, 10)
      : [];

    return { recentExercises, suggestions };
  }

  /** 添加动作 */
  addExercise(state: WorkoutState, exercise: IExerciseExtended): WorkoutState {
    const exists = state.exercises.some((e) => e.exercise._id === exercise._id);
    if (exists) return state;
    const exercises = [
      ...state.cloneExercises(),
      { exercise, sets: [{ weight_kg: '', reps: '', notes: '' }] },
    ];
    return new WorkoutState(exercises, state.recentExercises, state.suggestions, state.startedAt);
  }

  /** 移除动作 */
  removeExercise(state: WorkoutState, index: number): WorkoutState {
    const exercises = state.cloneExercises();
    exercises.splice(index, 1);
    return new WorkoutState(exercises, state.recentExercises, state.suggestions, state.startedAt);
  }

  /** 添加组（自动填充上一组数据） */
  addSet(state: WorkoutState, exerciseIndex: number): WorkoutState {
    const exercises = state.cloneExercises();
    const sets = exercises[exerciseIndex].sets;
    const newSet = { weight_kg: '', reps: '', notes: '' };
    if (sets.length >= 1) {
      const prev = sets[sets.length - 1];
      newSet.weight_kg = prev.weight_kg;
      newSet.reps = prev.reps;
    }
    sets.push(newSet);
    return new WorkoutState(exercises, state.recentExercises, state.suggestions, state.startedAt);
  }

  /** 移除组（至少保留一组，返回 null 表示不可删除） */
  removeSet(state: WorkoutState, exerciseIndex: number, setIndex: number): WorkoutState | null {
    if (state.exercises[exerciseIndex].sets.length <= 1) return null;
    const exercises = state.cloneExercises();
    exercises[exerciseIndex].sets.splice(setIndex, 1);
    return new WorkoutState(exercises, state.recentExercises, state.suggestions, state.startedAt);
  }

  /** 更新组字段 */
  updateSet(state: WorkoutState, exIdx: number, setIdx: number, field: string, value: any): WorkoutState {
    const exercises = state.cloneExercises();
    (exercises[exIdx].sets[setIdx] as any)[field] = value;
    return new WorkoutState(exercises, state.recentExercises, state.suggestions, state.startedAt);
  }

  /** 构建保存数据 */
  private buildSaveData(state: WorkoutState, durationMin: number, notes: string): IWorkoutData {
    const sets: IWorkoutData['sets'] = [];
    let sortOrder = 0;
    for (const ex of state.exercises) {
      for (const set of ex.sets) {
        if (!set.weight_kg && !set.reps) continue; // 跳过空组
        sets.push({
          exercise_id: ex.exercise._id,
          exercise_name: ex.exercise.name,
          weight_kg: parseFloat(String(set.weight_kg)) || 0,
          reps: parseInt(String(set.reps)) || 0,
          notes: set.notes || '',
          sort_order: sortOrder++,
        });
      }
    }
    return { date: formatDate(), duration_min: durationMin, notes, sets };
  }

  /** 保存训练 */
  async saveWorkout(state: WorkoutState, durationMin: number, notes: string): Promise<IDbResult> {
    const data = this.buildSaveData(state, durationMin, notes);
    const result = await this.workoutDAL.save(data);
    if (result.success) {
      // 记录动作使用
      const ids = state.exercises.map((ex) => ex.exercise._id);
      this.exerciseDAL.recordUsage(ids);
    }
    return result;
  }
}

export { WorkoutState, WorkoutService };
```

- [ ] **Step 2: 提交**

```bash
git add miniprogram/services/workout-service.ts
git commit -m "feat: 添加 WorkoutState + WorkoutService 业务逻辑层"
```

---

### Task 7: 升级 exercise-card 组件支持 GIF 缩略图

**Files:**
- Modify: `miniprogram/components/exercise-card/index.ts`
- Modify: `miniprogram/components/exercise-card/index.wxml`
- Modify: `miniprogram/components/exercise-card/index.wxss`

**Interfaces:**
- Consumes: `IExerciseExtended` (typings)

- [ ] **Step 1: 升级组件 TS**

替换 `miniprogram/components/exercise-card/index.ts`：

```typescript
// components/exercise-card/index.ts
Component({
  properties: {
    name: { type: String, value: '' },
    bodyPart: { type: String, value: '' },
    icon: { type: String, value: '🏋️' },            // 新增：emoji 兜底
    gifUrl: { type: String, value: '' },             // 新增：GIF CDN 链接
    instructionsZh: { type: String, value: '' },     // 新增：中文说明
    sets: { type: Array, value: [] },
    exerciseIndex: { type: Number, value: 0 },
    showRemove: { type: Boolean, value: false },
  },

  data: {
    gifError: false,   // GIF 加载失败时切回 emoji
    showInstructions: false,  // 展开/收起说明
  },

  methods: {
    onGifError() {
      this.setData({ gifError: true });
    },
    onToggleInstructions() {
      this.setData({ showInstructions: !this.data.showInstructions });
    },
    onAddSet() {
      this.triggerEvent('addset', { index: this.properties.exerciseIndex });
    },
    onRemoveExercise() {
      this.triggerEvent('removeexercise', { index: this.properties.exerciseIndex });
    },
    onSetUpdate(e: any) {
      this.triggerEvent('setupdate', e.detail);
    },
    onSetRemove(e: any) {
      this.triggerEvent('setremove', e.detail);
    },
  },
});
```

- [ ] **Step 2: 升级组件 WXML**

替换 `miniprogram/components/exercise-card/index.wxml`：

```xml
<!-- components/exercise-card/index.wxml -->
<view class="card exercise-card">
  <!-- 动作标题行：GIF 缩略图 + 名称 + 部位 + 说明按钮 -->
  <view class="ex-header">
    <view class="ex-media" wx:if="{{gifUrl && !gifError}}">
      <image class="ex-gif" src="{{gifUrl}}" mode="aspectFill" binderror="onGifError" />
    </view>
    <text class="ex-icon" wx:else>{{icon}}</text>

    <view class="ex-info">
      <view class="ex-name-row">
        <text class="ex-name">{{name}}</text>
        <text class="ex-part">{{bodyPart}}</text>
      </view>
      <text
        wx:if="{{instructionsZh}}"
        class="ex-instructions-toggle"
        bindtap="onToggleInstructions"
      >{{showInstructions ? '收起说明 ▲' : '动作说明 ▼'}}</text>
    </view>

    <text
      wx:if="{{showRemove}}"
      class="ex-remove"
      bindtap="onRemoveExercise"
    >✕</text>
  </view>

  <!-- 动作说明（可折叠） -->
  <view wx:if="{{showInstructions && instructionsZh}}" class="ex-instructions">
    <text>{{instructionsZh}}</text>
  </view>

  <view class="divider"></view>

  <!-- 组列表头 -->
  <view class="set-header flex-row">
    <text class="set-col set-col--num">组</text>
    <text class="set-col set-col--weight">重量(kg)</text>
    <text class="set-col set-col--reps">次数</text>
    <text class="set-col set-col--notes">备注</text>
    <text class="set-col set-col--action"></text>
  </view>

  <!-- 每组记录 -->
  <set-row
    wx:for="{{sets}}"
    wx:key="index"
    weight="{{item.weight_kg}}"
    reps="{{item.reps}}"
    notes="{{item.notes}}"
    set-index="{{index}}"
    ex-index="{{exerciseIndex}}"
    current-sets-count="{{sets.length}}"
    show-delete="{{showRemove}}"
    bind:update="onSetUpdate"
    bind:remove="onSetRemove"
  />

  <!-- 添加组按钮 -->
  <button
    wx:if="{{showRemove}}"
    class="btn-outline btn-add-set"
    bindtap="onAddSet"
  >+ 添加组</button>
</view>
```

- [ ] **Step 3: 升级组件 WXSS**

替换 `miniprogram/components/exercise-card/index.wxss`：

```css
/* components/exercise-card/index.wxss */
.exercise-card {
  margin-bottom: 16rpx;
  padding: 24rpx 28rpx;
}

/* ===== 动作头部 ===== */
.ex-header {
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  margin-bottom: 12rpx;
}

.ex-media {
  width: 72rpx;
  height: 72rpx;
  border-radius: 12rpx;
  overflow: hidden;
  margin-right: 16rpx;
  flex-shrink: 0;
  background: #f5f5f5;
}

.ex-gif {
  width: 72rpx;
  height: 72rpx;
}

.ex-icon {
  font-size: 48rpx;
  margin-right: 16rpx;
  flex-shrink: 0;
  width: 72rpx;
  text-align: center;
}

.ex-info {
  flex: 1;
  min-width: 0;
}

.ex-name-row {
  display: flex;
  flex-direction: row;
  align-items: center;
  flex-wrap: wrap;
}

.ex-name {
  font-size: 30rpx;
  font-weight: 700;
  color: #333;
}

.ex-part {
  font-size: 22rpx;
  color: #e94560;
  background: #fce4e8;
  padding: 4rpx 12rpx;
  border-radius: 8rpx;
  margin-left: 12rpx;
}

.ex-instructions-toggle {
  font-size: 22rpx;
  color: #0f3460;
  margin-top: 6rpx;
  display: inline-block;
}

.ex-instructions {
  background: #f8f9fa;
  border-radius: 8rpx;
  padding: 16rpx 20rpx;
  margin-bottom: 12rpx;
  font-size: 24rpx;
  color: #666;
  line-height: 1.6;
}

.ex-remove {
  font-size: 28rpx;
  color: #ccc;
  padding: 8rpx 12rpx;
  flex-shrink: 0;
}

/* ===== 分隔线 ===== */
.divider {
  height: 1rpx;
  background: #f0f0f0;
  margin-bottom: 12rpx;
}

/* ===== 组列表头 ===== */
.set-header {
  padding: 8rpx 0;
  margin-bottom: 4rpx;
}

.set-col {
  font-size: 22rpx;
  color: #999;
}

.set-col--num { width: 60rpx; text-align: center; }
.set-col--weight { flex: 1; text-align: center; }
.set-col--reps { flex: 1; text-align: center; }
.set-col--notes { flex: 1.5; text-align: center; }
.set-col--action { width: 50rpx; text-align: center; }

/* ===== 添加组按钮 ===== */
.btn-add-set {
  width: 100%;
  margin-top: 8rpx;
  padding: 12rpx;
  font-size: 24rpx;
  border: 2rpx dashed #ddd;
  color: #999;
  text-align: center;
  border-radius: 12rpx;
  background: transparent;
}

.btn-add-set::after { border: none; }
```

- [ ] **Step 4: 提交**

```bash
git add miniprogram/components/exercise-card/
git commit -m "feat: 升级 exercise-card 支持 GIF 缩略图 + 中文动作说明"
```

---

### Task 8: 重构 workout 页面 TS（瘦身）

**Files:**
- Modify: `miniprogram/pages/workout/workout.ts`

**Interfaces:**
- Consumes: `WorkoutState`, `WorkoutService` (from services/workout-service.ts), `CacheManager` (from dal/cache.ts)

- [ ] **Step 1: 重写 `miniprogram/pages/workout/workout.ts`**

```typescript
// pages/workout/workout.ts — 训练页（重构后）
import { WorkoutState, WorkoutService } from '../../services/workout-service';
import { CacheManager } from '../../dal/cache';

interface IPageData {
  isWorkoutActive: boolean;
  state: WorkoutState | null;
  elapsedSeconds: number;
  timerText: string;
  saving: boolean;
}

Page<IPageData, {}>({
  data: {
    isWorkoutActive: false,
    state: null,
    elapsedSeconds: 0,
    timerText: '00:00',
    saving: false,
  },

  _timerInterval: null as number | null,
  _startTime: null as number | null,
  _service: null as WorkoutService | null,

  onUnload() {
    this.stopTimer();
  },

  // ===== 训练流程 =====

  async startWorkout() {
    this._startTime = Date.now();
    const service = new WorkoutService();
    this._service = service;
    const { recentExercises, suggestions } = await service.initWorkout();
    this.setData({
      isWorkoutActive: true,
      state: WorkoutState.create(recentExercises, suggestions),
      elapsedSeconds: 0,
      timerText: '00:00',
    });
    this.startTimer();
  },

  openExercisePicker() {
    const state = this.data.state;
    const recentIds = state
      ? state.recentExercises.map((e) => e._id).join(',')
      : '';
    wx.navigateTo({
      url: `/pages/exercise-pick/index?mode=pick${recentIds ? `&recentIds=${recentIds}` : ''}`,
      events: {
        selectExercise: (data: { exercise: IExerciseExtended }) => {
          this.addExercise(data.exercise);
        },
      },
    });
  },

  addExercise(exercise: IExerciseExtended) {
    if (!exercise || !this.data.state) return;
    const service = this._service || new WorkoutService();
    const newState = service.addExercise(this.data.state, exercise);
    if (newState === this.data.state) {
      wx.showToast({ title: '该动作已添加', icon: 'none' });
      return;
    }
    this.setData({ state: newState });
  },

  // ===== 组件事件 =====

  onRemoveExercise(e: any) {
    const { index } = e.detail;
    const state = this.data.state!;
    const name = state.exercises[index].exercise.name;
    wx.showModal({
      title: '移除动作',
      content: `确定要移除 ${name} 吗？`,
      success: (res) => {
        if (res.confirm) {
          const service = this._service || new WorkoutService();
          this.setData({ state: service.removeExercise(this.data.state!, index) });
        }
      },
    });
  },

  onAddSet(e: any) {
    const { index } = e.detail;
    const service = this._service || new WorkoutService();
    this.setData({ state: service.addSet(this.data.state!, index) });
  },

  onSetRemove(e: any) {
    const { exIndex, setIndex } = e.detail;
    const service = this._service || new WorkoutService();
    const newState = service.removeSet(this.data.state!, exIndex, setIndex);
    if (!newState) {
      wx.showToast({ title: '每个动作至少保留一组', icon: 'none' });
      return;
    }
    this.setData({ state: newState });
  },

  onSetUpdate(e: any) {
    const { exIndex, setIndex, field, value } = e.detail;
    const service = this._service || new WorkoutService();
    const newState = service.updateSet(this.data.state!, exIndex, setIndex, field, value);
    this.setData({ state: newState });
  },

  // ===== 完成训练 =====

  finishWorkout() {
    if (!this.data.state || this.data.state.isEmpty()) {
      wx.showToast({ title: '请至少添加一个动作', icon: 'none' });
      return;
    }
    wx.showModal({
      title: '完成训练',
      content: '确定要结束本次训练吗？',
      success: (res) => { if (res.confirm) this.saveWorkout(); },
    });
  },

  async saveWorkout() {
    this.setData({ saving: true });
    wx.showLoading({ title: '保存中...' });

    const state = this.data.state!;
    const durationMin = Math.round(this.data.elapsedSeconds / 60);
    const service = this._service || new WorkoutService();
    const result = await service.saveWorkout(state, durationMin, '');

    wx.hideLoading();
    if (result.success) {
      this.showWorkoutSummary(durationMin);
      this.resetWorkout();
    }
    this.setData({ saving: false });
  },

  showWorkoutSummary(durationMin: number) {
    const state = this.data.state!;
    const exerciseCount = state.exercises.length;
    const totalSets = state.getTotalSets();
    const names = state.exercises.map((ex) => ex.exercise.name).join('、');
    wx.showModal({
      title: '💪 训练完成！',
      content: `${exerciseCount} 个动作 · ${totalSets} 组 · ${durationMin} 分钟\n\n${names}`,
      showCancel: false,
      confirmText: '好的',
    });
  },

  resetWorkout() {
    this.stopTimer();
    this._startTime = null;
    this._service = null;
    CacheManager.getInstance().invalidate('index');
    wx.removeStorageSync('index_cache');
    this.setData({
      isWorkoutActive: false,
      state: null,
      elapsedSeconds: 0,
      timerText: '00:00',
    });
  },

  // ===== 计时器 =====

  startTimer() {
    this._timerInterval = setInterval(() => {
      if (!this._startTime) return;
      const elapsed = Math.floor((Date.now() - this._startTime) / 1000);
      const min = String(Math.floor(elapsed / 60)).padStart(2, '0');
      const sec = String(elapsed % 60).padStart(2, '0');
      this.setData({ elapsedSeconds: elapsed, timerText: `${min}:${sec}` });
    }, 1000) as unknown as number;
  },

  stopTimer() {
    if (this._timerInterval) { clearInterval(this._timerInterval); this._timerInterval = null; }
  },
});
```

- [ ] **Step 2: 更新 WXML 适配新数据结构**

替换 `miniprogram/pages/workout/workout.wxml`：

```xml
<!-- pages/workout/workout.wxml — 训练页（重构后） -->
<view class="container">
  <!-- 未开始训练：引导页 -->
  <view wx:if="{{!isWorkoutActive}}" class="workout-start card text-center">
    <text class="start-icon">🏋️</text>
    <text class="start-title">准备开始训练</text>
    <text class="start-desc">记录你的每一次进步</text>
    <button class="btn-primary" hover-class="btn-primary--hover" bindtap="startWorkout">开始新训练</button>
  </view>

  <!-- 训练进行中 -->
  <view wx:if="{{isWorkoutActive && state}}">
    <!-- 计时器卡片 -->
    <view class="card timer-card flex-between">
      <view>
        <text class="timer-label">训练时长</text>
        <text class="timer-value">{{timerText}}</text>
      </view>
      <text class="timer-badge">进行中</text>
    </view>

    <!-- 已选动作列表 -->
    <exercise-card
      wx:for="{{state.exercises}}"
      wx:key="exercise._id"
      name="{{item.exercise.name}}"
      body-part="{{item.exercise.body_part}}"
      icon="{{item.exercise.icon}}"
      gif-url="{{item.exercise.gif_url}}"
      instructions-zh="{{item.exercise.instructions_zh}}"
      sets="{{item.sets}}"
      exercise-index="{{index}}"
      show-remove="{{true}}"
      bind:addset="onAddSet"
      bind:setupdate="onSetUpdate"
      bind:setremove="onSetRemove"
      bind:removeexercise="onRemoveExercise"
    />

    <!-- 底部操作栏 -->
    <view class="workout-actions">
      <button class="btn-outline" hover-class="btn-outline--hover" bindtap="openExercisePicker">
        + 添加动作
      </button>

      <button class="btn-primary" hover-class="btn-primary--hover" bindtap="finishWorkout" loading="{{saving}}">
        完成训练
      </button>
    </view>
  </view>
</view>
```

- [ ] **Step 3: 精简 WXSS**

`miniprogram/pages/workout/workout.wxss` 保持不变（页面级样式无需大幅调整，组件样式已在 exercise-card 中处理）。

- [ ] **Step 4: 提交**

```bash
git add miniprogram/pages/workout/
git commit -m "refactor: 训练页瘦身，使用 WorkoutService + WorkoutState 管理状态"
```

---

### Task 9: 更新 app.ts 种子导入逻辑

**Files:**
- Modify: `miniprogram/app.ts`

**Interfaces:**
- Consumes: `ExerciseDAL` (from dal/exercise-dal.ts)
- Drops: `import { PRESET_EXERCISES } from './utils/seed'`

- [ ] **Step 1: 替换种子导入逻辑**

将 `miniprogram/app.ts` 中的种子导入代码替换为使用 ExerciseDAL：

找到原来的 `import { PRESET_EXERCISES } from './utils/seed'` 和对应的 seed 逻辑，替换为：

```typescript
import { ExerciseDAL } from './dal/exercise-dal';
// ...
// 在 onLaunch 中：
const exerciseDAL = new ExerciseDAL();
exerciseDAL.seedIfEmpty(); // 异步执行，不阻塞启动
```

- [ ] **Step 2: 提交**

```bash
git add miniprogram/app.ts
git commit -m "refactor: app.ts 使用 ExerciseDAL.seedIfEmpty 替换旧的 seed 导入"
```

---

### Task 10: 验证 + 自检

**Files:**
- 无新建文件

- [ ] **Step 1: 检查 TypeScript 编译**

在微信开发者工具中打开项目，确认 TypeScript 编译无错误。

检查要点：
- `miniprogram/dal/cache.ts` — 无导入依赖，独立编译
- `miniprogram/dal/exercise-dal.ts` — 导入 CacheManager、ALL_EXERCISES，类型正确
- `miniprogram/dal/workout-dal.ts` — 导入 CacheManager、utils/error，类型正确
- `miniprogram/services/workout-service.ts` — 导入两个 DAL、utils/format，类型正确
- `miniprogram/pages/workout/workout.ts` — 导入 WorkoutService、WorkoutState、CacheManager，不再导入旧的 db/workout-helper
- `miniprogram/components/exercise-card/index.ts` — 新增属性类型正确
- `miniprogram/app.ts` — 导入 ExerciseDAL 替换 seed

- [ ] **Step 2: 检查其他页面是否受影响**

确认以下文件的导入未被修改，保持正常工作：
- `pages/index/index.ts` — 仍使用 `utils/db`
- `pages/history/history.ts` — 仍使用 `utils/db`
- `pages/profile/profile.ts` — 仍使用 `utils/db`
- `pages/exercise-pick/index.ts` — 仍使用 `utils/db`
- `pages/workout-detail/index.ts` — 仍使用 `utils/db` + `utils/workout-helper`
- `pages/history-detail/index.ts` — 仍使用 `utils/db` + `utils/workout-helper`

- [ ] **Step 3: 在微信开发者工具中验证功能**

1. 首次启动 → 观察控制台是否有种子导入日志
2. 开始训练 → 添加动作 → 确认 exercise-card 显示 GIF/emoji
3. 添加/删除组 → 确认操作正常
4. 完成训练 → 确认保存成功，跳转首页
5. 再次进入训练 → 确认最近动作列表正常显示

- [ ] **Step 4: 提交**

```bash
git add -A
git commit -m "chore: 第1轮重构验证通过"
```

---

## Completion Checklist

- [ ] 所有新文件创建完毕（dal/*, services/*, data/*）
- [ ] exercise-card 组件支持 GIF 缩略图 + emoji 降级 + 中文说明折叠
- [ ] workout 页面 TS 从 198 行瘦身到 ~80 行
- [ ] 其他页面功能不受影响（仍使用旧 utils）
- [ ] 种子导入逻辑从 seed.ts 迁移到 ExerciseDAL
- [ ] TypeScript 编译无错误
- [ ] 微信开发者工具中手动测试通过
