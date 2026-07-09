# 组记录升级：完成标记 + 组间倒计时 + 复制组 — 设计文档

> 日期：2026-07-09 | 状态：待审核

## 一、背景与目标

当前训练页的组记录功能较基础：每行只有重量、次数、备注三个输入框和删除按钮。用户希望更接近真实训练流程，增加：

1. **组完成标记** — 每组训练完后可手动标记已完成
2. **组间倒计时** — 完成一组后自动弹出休息倒计时
3. **可配置休息时长** — 每组可设置不同休息秒数
4. **快速复制组** — 一键复制已有组数据，减少重复输入

---

## 二、数据模型变更

### 2.1 ISetFormData 扩展（前端表单数据）

```typescript
interface ISetFormData {
  weight_kg: number | string;
  reps: number | string;
  notes: string;
  rest_seconds: number;    // 新增：组间休息秒数，默认 60
  completed: boolean;      // 新增：是否已完成，默认 false
}
```

`completed` 只在前端使用，不存入云数据库。`rest_seconds` 存入选填字段，旧数据兼容。

### 2.2 sets 集合新增可选字段

```typescript
rest_seconds?: number;  // 可选，旧数据无此字段
```

---

## 三、UI 设计

### 3.1 组行新布局（set-row 组件）

```
┌──────────────────────────────────────────────────────────┐
│ ① │ [80 kg] │ [10 次] │ [备注] │ [60]s │ ☐ │  ⋯  │
│    │  重量   │  次数   │        │ 休息  │完成│ 菜单 │
├──────────────────────────────────────────────────────────┤
│ ② │ [80 kg] │ [10 次] │ [备注] │ [60]s │ ☑ │  ⋯  │ 休息 60s
│    │         │         │        │       │ ✓ │     │ ← 完成后显示
└──────────────────────────────────────────────────────────┘
```

- **行号** 灰色 → 完成后变蓝色
- **休息时长** 新增小输入框（默认 60s，范围 0-300），单位 `s`
- **完成按钮** ☐ 灰色 → 点击变 ☑ 蓝色，同时触发倒计时
- **菜单按钮** `...` → 点击弹出 ActionSheet：复制 / 删除
- **完成后** 行末显示 "休息 XXs"

### 3.2 倒计时弹窗（全屏遮罩）

```
┌──────────────────────────────────┐
│                      [_] 最小化  │
│                                  │
│        杠铃卧推 第 3 组           │
│                                  │
│              0:45               │  ← 大号倒计时
│                                  │
│     [＋10s]  [跳过]  [−10s]     │
│                                  │
│    组间休息，下一组准备...         │
└──────────────────────────────────┘
```

- 半透明深色遮罩 + 白色内容卡片居中
- 倒计时数字大号（80rpx+），红色
- **最小化** → 缩至页面底部固定条 "组间休息 0:38 [展开]"
- **+10s / −10s** → 实时调整
- **跳过** → 立即结束倒计时
- 倒计时归零 → 自动关闭 + `wx.vibrateShort()` 振动

### 3.3 最小化状态

```
┌──────────────────────────────────────────┐
│  [底部固定条]  ⏱ 组间休息 0:38  [展开]   │
└──────────────────────────────────────────┘
```

固定在屏幕底部，不影响页面其他操作。

---

## 四、状态与逻辑变更

### 4.1 WorkoutState 新增方法

```typescript
class WorkoutState {
  /** 切换组的完成状态，返回新 WorkoutState */
  toggleSetComplete(exerciseIndex: number, setIndex: number): WorkoutState

  /** 更新组的休息秒数 */
  updateSetRest(exerciseIndex: number, setIndex: number, seconds: number): WorkoutState

  /** 复制指定组（在它后面插入副本） */
  duplicateSet(exerciseIndex: number, setIndex: number): WorkoutState
}
```

### 4.2 WorkoutService 新增方法

```typescript
class WorkoutService {
  /** 代理调用 WorkoutState 方法（保持页面薄） */
  toggleSetComplete(state: WorkoutState, exIdx: number, setIdx: number): WorkoutState
  updateSetRest(state: WorkoutState, exIdx: number, setIdx: number, seconds: number): WorkoutState
  duplicateSet(state: WorkoutState, exIdx: number, setIdx: number): WorkoutState
}
```

### 4.3 页面倒计时状态（workout.ts data 新增）

```typescript
restTimer: {
  visible: boolean;        // 弹窗是否显示
  minimized: boolean;      // 是否最小化
  seconds: number;         // 当前倒计时秒数
  total: number;           // 初始总秒数
  exerciseName: string;    // 动作名
  setIndex: number;        // 第几组
} | null
```

倒计时逻辑保留在页面层（`setInterval`），不入 WorkoutState 持久化。

### 4.4 倒计时流程

```
点击 ☐ → 切换 completed=true
       → 读取该组 rest_seconds
       → 打开全屏倒计时弹窗
       → 开始 setInterval(1s)
       → 倒计时归零 → 自动关闭 + 振动
       → 或用户点"跳过" → 立即关闭
       → 或用户点"最小化" → 缩至底部固定条
```

---

## 五、组件变更

### 5.1 set-row 组件新增属性

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| restSeconds | Number | 60 | 组间休息秒数 |
| completed | Boolean | false | 是否已完成 |
| showMoreMenu | Boolean | true | 是否显示 ... 菜单 |

### 5.2 set-row 新增事件

| 事件 | detail | 说明 |
|------|--------|------|
| togglecomplete | { exIndex, setIndex } | 点击完成按钮 |
| restchange | { exIndex, setIndex, value } | 修改休息秒数 |
| duplicate | { exIndex, setIndex } | 复制该组 |
| remove | 不变 | 删除该组 |

### 5.3 exercise-card 组件

无需修改。新增的 set-row 属性通过 exercise-card 透传。

---

## 六、exercise-card WXML 透传变更

```xml
<set-row
  wx:for="{{sets}}"
  wx:key="index"
  weight="{{item.weight_kg}}"
  reps="{{item.reps}}"
  notes="{{item.notes}}"
  rest-seconds="{{item.rest_seconds}}"
  completed="{{item.completed}}"
  set-index="{{index}}"
  ex-index="{{exerciseIndex}}"
  current-sets-count="{{sets.length}}"
  show-delete="{{showRemove}}"
  show-more-menu="{{showRemove}}"
  bind:update="onSetUpdate"
  bind:remove="onSetRemove"
  bind:togglecomplete="onSetToggleComplete"
  bind:restchange="onSetRestChange"
  bind:duplicate="onSetDuplicate"
/>
```

---

## 七、不做的

- ❌ 倒计时后台运行（小程序切后台自动暂停，无需处理）
- ❌ 倒计时音效（保持安静，用振动）
- ❌ 自动完成（必须手动点击 ☐）
- ❌ 多组同时倒计时（一次只一组）

---

## 八、影响评估

| 影响的文件 | 变更程度 |
|-----------|---------|
| `components/set-row/index.ts` | 中 — 新增属性和事件 |
| `components/set-row/index.wxml` | 大 — 新布局 |
| `components/set-row/index.wxss` | 中 — 新样式 |
| `components/exercise-card/index.wxml` | 小 — 透传新属性 |
| `components/exercise-card/index.ts` | 小 — 新增事件转发 |
| `services/workout-service.ts` | 小 — 3 个新方法 |
| `pages/workout/workout.ts` | 中 — 倒计时逻辑 + 新事件处理 |
| `pages/workout/workout.wxml` | 中 — 倒计时弹窗 + 最小化条 |
| `pages/workout/workout.wxss` | 中 — 弹窗 + 最小化条样式 |
| `typings/index.d.ts` | 小 — ISetFormData 扩展 |
