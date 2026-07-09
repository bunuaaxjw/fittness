# 组记录升级：完成标记 + 倒计时 + 复制 — 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 升级训练页组记录交互：每组可标记完成、完成时自动弹倒计时、每组可设置休息秒数、一键复制组。

**Architecture:** set-row 组件新增完成按钮 + 休息时长输入 + `...` 菜单（调用 `wx.showActionSheet`），exercise-card 透传新属性/事件，WorkoutState 新增 `toggleSetComplete`/`updateSetRest`/`duplicateSet`，workout 页面新增倒计时弹窗状态 + `setInterval` 倒计时逻辑 + 弹窗 UI（全屏遮罩 + 最小化条）。

**Tech Stack:** 微信小程序原生框架 + TypeScript

## Global Constraints

- WXSS 不支持 CSS 变量、复杂选择器；使用 `rpx` 响应式单位
- 组件默认项 `rest_seconds: 60`、`completed: false`
- 倒计时弹窗为全屏半透明遮罩 + 居中白色卡片
- 倒计时归零触发 `wx.vibrateShort()`
- 不影响旧数据（`rest_seconds` 选填，`completed` 仅前端用）
- 设计 token：主色 `#e94560`，完成色 `#27ae60`，背景 `#f5f5f5`

---

## File Structure

| 操作 | 文件 | 职责 |
|------|------|------|
| Modify | `typings/index.d.ts:68-72` | ISetFormData 新增 `rest_seconds`、`completed` |
| Modify | `components/set-row/index.ts` | 新增 3 个属性 + 3 个事件处理器 |
| Modify | `components/set-row/index.wxml` | 新行布局：休息输入 + 完成按钮 + ... 菜单 |
| Modify | `components/set-row/index.wxss` | 新元素样式 |
| Modify | `components/exercise-card/index.wxml` | 透传新属性 + 绑定新事件 |
| Modify | `components/exercise-card/index.ts` | 新增事件转发方法 |
| Modify | `services/workout-service.ts` | WorkoutState 新增 3 个方法 + addSet 默认值 |
| Modify | `pages/workout/workout.ts` | 倒计时逻辑 + 新事件处理 |
| Modify | `pages/workout/workout.wxml` | 倒计时弹窗 + 最小化条 UI |
| Modify | `pages/workout/workout.wxss` | 弹窗 + 最小化条样式 |

---

### Task 1: 扩展 ISetFormData 类型

**Files:**
- Modify: `typings/index.d.ts`

**Interfaces:**
- Produces: `ISetFormData` 新增 `rest_seconds: number`、`completed: boolean`

- [ ] **Step 1: 修改 ISetFormData 接口**

在 `typings/index.d.ts` 中找到 `ISetFormData` 接口（在 `ISelectedExercise` 之前），将其替换为：

```typescript
/** 组表单数据（未保存时无 _id）。weight_kg/reps 允许空字符串（表单初始状态），保存时转为 number */
interface ISetFormData {
  weight_kg: number | string;
  reps: number | string;
  notes: string;
  rest_seconds: number;    // 组间休息秒数，默认 60
  completed: boolean;      // 是否已完成，默认 false
}
```

- [ ] **Step 2: 提交**

```bash
git add typings/index.d.ts
git commit -m "feat: ISetFormData 新增 rest_seconds 和 completed 字段"
```

---

### Task 2: 升级 set-row 组件 TS

**Files:**
- Modify: `miniprogram/components/set-row/index.ts`

**Interfaces:**
- Consumes: `ISetFormData` (typings)
- Produces: 新增 `restSeconds`、`completed`、`showMoreMenu` 属性；新增 `togglecomplete`、`restchange`、`duplicate` 事件

- [ ] **Step 1: 重写 set-row/index.ts**

```typescript
// components/set-row/index.ts
Component({
  properties: {
    weight: { type: String, value: '' },
    reps: { type: String, value: '' },
    notes: { type: String, value: '' },
    restSeconds: { type: Number, value: 60 },
    completed: { type: Boolean, value: false },
    setIndex: { type: Number, value: 0 },
    exIndex: { type: Number, value: 0 },
    showDelete: { type: Boolean, value: true },
    showMoreMenu: { type: Boolean, value: true },
    minSets: { type: Number, value: 1 },
    currentSetsCount: { type: Number, value: 0 },
  },

  methods: {
    onInput(e: WechatMiniprogram.BaseEvent) {
      const { field } = e.currentTarget.dataset;
      this.triggerEvent('update', {
        field,
        value: e.detail.value,
        setIndex: this.properties.setIndex,
        exIndex: this.properties.exIndex,
      });
    },

    onRestChange(e: WechatMiniprogram.BaseEvent) {
      const val = parseInt(e.detail.value) || 0;
      const clamped = Math.max(0, Math.min(300, val));
      this.triggerEvent('restchange', {
        value: clamped,
        setIndex: this.properties.setIndex,
        exIndex: this.properties.exIndex,
      });
    },

    onToggleComplete() {
      this.triggerEvent('togglecomplete', {
        setIndex: this.properties.setIndex,
        exIndex: this.properties.exIndex,
      });
    },

    onMore() {
      wx.showActionSheet({
        itemList: ['复制', '删除'],
        success: (res) => {
          if (res.tapIndex === 0) {
            this.triggerEvent('duplicate', {
              setIndex: this.properties.setIndex,
              exIndex: this.properties.exIndex,
            });
          } else if (res.tapIndex === 1) {
            this.triggerEvent('remove', {
              setIndex: this.properties.setIndex,
              exIndex: this.properties.exIndex,
              currentSetsCount: this.properties.currentSetsCount,
            });
          }
        },
      });
    },

    onRemove() {
      this.triggerEvent('remove', {
        setIndex: this.properties.setIndex,
        exIndex: this.properties.exIndex,
        currentSetsCount: this.properties.currentSetsCount,
      });
    },
  },
});
```

- [ ] **Step 2: 提交**

```bash
git add miniprogram/components/set-row/index.ts
git commit -m "feat: set-row 新增完成按钮、休息时长、...菜单事件"
```

---

### Task 3: 升级 set-row 组件 WXML + WXSS

**Files:**
- Modify: `miniprogram/components/set-row/index.wxml`
- Modify: `miniprogram/components/set-row/index.wxss`

- [ ] **Step 1: 重写 set-row/index.wxml**

```xml
<!-- components/set-row/index.wxml -->
<view class="set-row {{completed ? 'set-row--done' : ''}}">
  <text class="set-col set-col--num">{{setIndex + 1}}</text>

  <input
    class="set-input"
    type="digit"
    placeholder="0"
    value="{{weight}}"
    data-field="weight_kg"
    bindinput="onInput"
  />
  <input
    class="set-input"
    type="number"
    placeholder="0"
    value="{{reps}}"
    data-field="reps"
    bindinput="onInput"
  />
  <input
    class="set-input set-input--notes"
    type="text"
    placeholder="备注"
    value="{{notes}}"
    data-field="notes"
    bindinput="onInput"
  />

  <!-- 休息时长 -->
  <input
    class="set-input set-input--rest"
    type="number"
    placeholder="60"
    value="{{restSeconds}}"
    maxlength="3"
    bindinput="onRestChange"
  />
  <text class="set-col--rest-unit">s</text>

  <!-- 完成按钮 -->
  <text class="set-col--toggle {{completed ? 'set-col--done' : ''}}" bindtap="onToggleComplete">
    {{completed ? '☑' : '☐'}}
  </text>

  <!-- 菜单按钮 -->
  <text wx:if="{{showMoreMenu}}" class="set-col--more" bindtap="onMore">⋯</text>

  <!-- 完成后的休息时长标记 -->
  <text wx:if="{{completed && restSeconds > 0}}" class="set-col--rest-tag">休息 {{restSeconds}}s</text>
</view>
```

- [ ] **Step 2: 重写 set-row/index.wxss**

```css
/* components/set-row/index.wxss */
.set-row {
  display: flex;
  flex-direction: row;
  align-items: center;
  padding: 10rpx 0;
}

.set-row--done {
  background: #f0faf4;
  border-radius: 8rpx;
}

.set-col--num {
  width: 40rpx;
  font-size: 24rpx;
  color: #999;
  text-align: center;
  flex-shrink: 0;
}

.set-row--done .set-col--num {
  color: #27ae60;
  font-weight: 600;
}

.set-input {
  flex: 1;
  background: #f5f5f5;
  border-radius: 8rpx;
  padding: 8rpx 4rpx;
  font-size: 24rpx;
  text-align: center;
  min-width: 0;
  margin: 0 3rpx;
}

.set-input--notes { flex: 1.2; }

.set-input--rest {
  background: #f0f4ff;
  max-width: 64rpx;
  flex: none;
}

.set-col--rest-unit {
  font-size: 20rpx;
  color: #999;
  margin-right: 4rpx;
  flex-shrink: 0;
}

.set-col--toggle {
  width: 44rpx;
  font-size: 32rpx;
  text-align: center;
  color: #ccc;
  flex-shrink: 0;
}

.set-col--done {
  color: #27ae60;
}

.set-col--more {
  width: 36rpx;
  font-size: 28rpx;
  color: #999;
  text-align: center;
  flex-shrink: 0;
}

.set-col--rest-tag {
  font-size: 20rpx;
  color: #27ae60;
  margin-left: 6rpx;
  flex-shrink: 0;
}
```

- [ ] **Step 3: 提交**

```bash
git add miniprogram/components/set-row/index.wxml miniprogram/components/set-row/index.wxss
git commit -m "feat: set-row 新布局 — 休息时长 + 完成按钮 + 菜单 + 完成标记"
```

---

### Task 4: 更新 exercise-card 透传

**Files:**
- Modify: `miniprogram/components/exercise-card/index.ts`
- Modify: `miniprogram/components/exercise-card/index.wxml`

- [ ] **Step 1: 在 exercise-card/index.ts 新增事件转发方法**

在 methods 对象末尾（`onSetRemove` 之后）添加：

```typescript
onSetToggleComplete(e: any) {
  this.triggerEvent('settogglecomplete', e.detail);
},
onSetRestChange(e: any) {
  this.triggerEvent('setrestchange', e.detail);
},
onSetDuplicate(e: any) {
  this.triggerEvent('setduplicate', e.detail);
},
```

- [ ] **Step 2: 在 exercise-card/index.wxml 更新 set-row 标签**

将 `<set-row>` 标签的属性替换为：

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

同时更新组列表头，在备注之后增加"休息"列：

```xml
<view class="set-header flex-row">
  <text class="set-col set-col--num">组</text>
  <text class="set-col set-col--weight">重量(kg)</text>
  <text class="set-col set-col--reps">次数</text>
  <text class="set-col set-col--notes">备注</text>
  <text class="set-col set-col--rest-header">休息</text>
  <text class="set-col set-col--toggle-header">完成</text>
  <text class="set-col set-col--more-header"></text>
</view>
```

- [ ] **Step 3: 在 exercise-card/index.wxss 新增表头样式**

在 `.set-col--action` 之后添加：

```css
.set-col--rest-header {
  flex: none;
  width: 88rpx;
  text-align: center;
  font-size: 22rpx;
  color: #999;
}

.set-col--toggle-header {
  width: 44rpx;
  text-align: center;
  font-size: 22rpx;
  color: #999;
}

.set-col--more-header {
  width: 36rpx;
}
```

- [ ] **Step 4: 提交**

```bash
git add miniprogram/components/exercise-card/
git commit -m "feat: exercise-card 透传 set-row 新属性和事件"
```

---

### Task 5: 扩展 WorkoutState + WorkoutService

**Files:**
- Modify: `miniprogram/services/workout-service.ts`

- [ ] **Step 1: 在 WorkoutState 类中添加 3 个方法**

在 `updateSet` 方法之后、`cloneExercises` 之前添加：

```typescript
/** 切换组的完成状态 */
toggleSetComplete(exerciseIndex: number, setIndex: number): WorkoutState {
  const exercises = this.cloneExercises();
  const set = exercises[exerciseIndex].sets[setIndex];
  set.completed = !set.completed;
  return new WorkoutState(exercises, this.recentExercises, this.suggestions, this.startedAt);
}

/** 更新组的休息秒数 */
updateSetRest(exerciseIndex: number, setIndex: number, seconds: number): WorkoutState {
  const exercises = this.cloneExercises();
  exercises[exerciseIndex].sets[setIndex].rest_seconds = seconds;
  return new WorkoutState(exercises, this.recentExercises, this.suggestions, this.startedAt);
}

/** 复制指定组（在它后面插入副本） */
duplicateSet(exerciseIndex: number, setIndex: number): WorkoutState {
  const exercises = this.cloneExercises();
  const sets = exercises[exerciseIndex].sets;
  const source = sets[setIndex];
  const copy = { weight_kg: source.weight_kg, reps: source.reps, notes: source.notes, rest_seconds: source.rest_seconds, completed: false };
  sets.splice(setIndex + 1, 0, copy);
  return new WorkoutState(exercises, this.recentExercises, this.suggestions, this.startedAt);
}
```

- [ ] **Step 2: 修改 addSet 方法**，默认值增加 `rest_seconds` 和 `completed`

将 `addSet` 中 `new Set` 的创建改为：

```typescript
const newSet = { weight_kg: '', reps: '', notes: '', rest_seconds: 60, completed: false };
```

自动填充行中，保留 `weight_kg` 和 `reps` 的填充逻辑，同时复制 `rest_seconds`：

```typescript
if (sets.length >= 1) {
  const prev = sets[sets.length - 1];
  newSet.weight_kg = prev.weight_kg;
  newSet.reps = prev.reps;
  newSet.rest_seconds = prev.rest_seconds;  // 新增：继承上一组休息秒数
}
```

- [ ] **Step 3: 在 WorkoutService 类中添加 3 个代理方法**

在 `saveWorkout` 方法之前添加：

```typescript
toggleSetComplete(state: WorkoutState, exIdx: number, setIdx: number): WorkoutState {
  return state.toggleSetComplete(exIdx, setIdx);
}

updateSetRest(state: WorkoutState, exIdx: number, setIdx: number, seconds: number): WorkoutState {
  return state.updateSetRest(exIdx, setIdx, seconds);
}

duplicateSet(state: WorkoutState, exIdx: number, setIdx: number): WorkoutState {
  return state.duplicateSet(exIdx, setIdx);
}
```

- [ ] **Step 4: 提交**

```bash
git add miniprogram/services/workout-service.ts
git commit -m "feat: WorkoutState 新增 toggleSetComplete/updateSetRest/duplicateSet"
```

---

### Task 6: workout 页面 TS — 倒计时逻辑 + 新事件

**Files:**
- Modify: `miniprogram/pages/workout/workout.ts`

- [ ] **Step 1: 添加 IPageData 扩展 + 倒计时相关方法**

在 `IPageData` 接口中新增：

```typescript
restTimer: {
  visible: boolean;
  minimized: boolean;
  seconds: number;
  total: number;
  exerciseName: string;
  setIndex: number;
} | null;
```

在 `data` 中初始化：

```typescript
restTimer: null,
```

- [ ] **Step 2: 添加倒计时方法**

在 `Page` 的 methods 区域（`stopTimer` 之后）添加：

```typescript
// ===== 组间倒计时 =====

/** 启动组间休息倒计时 */
startRestTimer(exerciseName: string, setIndex: number, seconds: number) {
  if (seconds <= 0) return;
  // 先清除已有倒计时
  this.stopRestTimer();
  this.setData({
    restTimer: {
      visible: true,
      minimized: false,
      seconds,
      total: seconds,
      exerciseName,
      setIndex,
    },
  });
  this._restInterval = setInterval(() => {
    const rt = this.data.restTimer;
    if (!rt || rt.seconds <= 0) return;
    const newSeconds = rt.seconds - 1;
    if (newSeconds <= 0) {
      this.finishRestTimer();
    } else {
      this.setData({ 'restTimer.seconds': newSeconds });
    }
  }, 1000) as unknown as number;
},

/** 结束倒计时 */
finishRestTimer() {
  this.stopRestTimer();
  wx.vibrateShort({ type: 'medium' });
  this.setData({ restTimer: null });
},

/** 清除倒计时定时器 */
stopRestTimer() {
  if (this._restInterval) { clearInterval(this._restInterval); this._restInterval = null; }
},

/** +10s */
onRestAdd10() {
  const rt = this.data.restTimer;
  if (!rt) return;
  this.setData({ 'restTimer.seconds': rt.seconds + 10, 'restTimer.total': rt.total + 10 });
},

/** -10s */
onRestSub10() {
  const rt = this.data.restTimer;
  if (!rt || rt.seconds <= 10) return;
  this.setData({ 'restTimer.seconds': rt.seconds - 10, 'restTimer.total': rt.total - 10 });
},

/** 跳过倒计时 */
onRestSkip() {
  this.finishRestTimer();
},

/** 最小化倒计时 */
onRestMinimize() {
  this.setData({ 'restTimer.minimized': true });
},

/** 展开倒计时 */
onRestExpand() {
  this.setData({ 'restTimer.minimized': false });
},
```

- [ ] **Step 3: 添加页面实例字段**（在 `_timerInterval` 之后）

```typescript
_restInterval: null as number | null,
```

- [ ] **Step 4: 添加新事件处理器**

在 `onSetUpdate` 之后添加：

```typescript
/** 切换完成状态 → 触发倒计时 */
onSetToggleComplete(e: any) {
  const { exIndex, setIndex } = e.detail;
  const service = this._service || new WorkoutService();
  const newState = service.toggleSetComplete(this.data.state!, exIndex, setIndex);
  this.setData({ state: newState });

  // 如果是标记为已完成，启动倒计时
  const set = newState.exercises[exIndex].sets[setIndex];
  if (set.completed && set.rest_seconds > 0) {
    const name = newState.exercises[exIndex].exercise.name;
    this.startRestTimer(name, setIndex, set.rest_seconds);
  }
},

/** 修改休息秒数 */
onSetRestChange(e: any) {
  const { exIndex, setIndex, value } = e.detail;
  const service = this._service || new WorkoutService();
  this.setData({ state: service.updateSetRest(this.data.state!, exIndex, setIndex, value) });
},

/** 复制组 */
onSetDuplicate(e: any) {
  const { exIndex, setIndex } = e.detail;
  const service = this._service || new WorkoutService();
  this.setData({ state: service.duplicateSet(this.data.state!, exIndex, setIndex) });
},
```

- [ ] **Step 5: 在 onUnload 中清除倒计时**

在 `onUnload` 方法中添加：

```typescript
this.stopRestTimer();
```

- [ ] **Step 6: 提交**

```bash
git add miniprogram/pages/workout/workout.ts
git commit -m "feat: workout 页面新增倒计时逻辑 + 新事件处理（完成/休息/复制）"
```

---

### Task 7: workout 页面 WXML + WXSS — 倒计时弹窗 UI

**Files:**
- Modify: `miniprogram/pages/workout/workout.wxml`
- Modify: `miniprogram/pages/workout/workout.wxss`

- [ ] **Step 1: 在 workout.wxml 底部（`</view>` 结束前）添加倒计时弹窗**

在 workout.wxml 最后的 `</view>`（container 关闭标签）之前添加：

```xml
<!-- 组间倒计时弹窗 -->
<view wx:if="{{restTimer && restTimer.visible && !restTimer.minimized}}" class="rest-overlay">
  <view class="rest-modal">
    <view class="rest-modal-header">
      <text></text>
      <text class="rest-minimize-btn" bindtap="onRestMinimize">— 最小化</text>
    </view>
    <text class="rest-exercise-label">{{restTimer.exerciseName}} 第 {{restTimer.setIndex + 1}} 组</text>
    <text class="rest-countdown">{{restTimer.seconds < 60 ? '0:' + (restTimer.seconds < 10 ? '0' : '') + restTimer.seconds : Math.floor(restTimer.seconds / 60) + ':' + (restTimer.seconds % 60 < 10 ? '0' : '') + (restTimer.seconds % 60)}}</text>
    <view class="rest-actions">
      <button class="rest-btn rest-btn--add" bindtap="onRestAdd10">＋10s</button>
      <button class="rest-btn rest-btn--skip" bindtap="onRestSkip">跳过</button>
      <button class="rest-btn rest-btn--sub" bindtap="onRestSub10">−10s</button>
    </view>
    <text class="rest-hint">组间休息，下一组准备...</text>
  </view>
</view>

<!-- 最小化倒计时条 -->
<view wx:if="{{restTimer && restTimer.visible && restTimer.minimized}}" class="rest-minibar">
  <text class="rest-minibar-text">⏱ 组间休息 {{restTimer.seconds < 60 ? '0:' + (restTimer.seconds < 10 ? '0' : '') + restTimer.seconds : Math.floor(restTimer.seconds / 60) + ':' + (restTimer.seconds % 60 < 10 ? '0' : '') + (restTimer.seconds % 60)}}</text>
  <text class="rest-minibar-expand" bindtap="onRestExpand">展开</text>
</view>
```

- [ ] **Step 2: 在 workout.wxml 中绑定新事件**

更新 `<exercise-card>` 标签，新增三个事件绑定：

```xml
<exercise-card
  wx:for="{{state.exercises}}"
  wx:key="exercise._id"
  ...
  bind:settogglecomplete="onSetToggleComplete"
  bind:setrestchange="onSetRestChange"
  bind:setduplicate="onSetDuplicate"
/>
```

- [ ] **Step 3: 在 workout.wxss 末尾添加弹窗和最小化条样式**

```css
/* ===== 倒计时弹窗 ===== */
.rest-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.65);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 999;
}

.rest-modal {
  width: 580rpx;
  background: #fff;
  border-radius: 24rpx;
  padding: 40rpx 48rpx;
  text-align: center;
}

.rest-modal-header {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 16rpx;
}

.rest-minimize-btn {
  font-size: 24rpx;
  color: #999;
}

.rest-exercise-label {
  display: block;
  font-size: 28rpx;
  color: #666;
  margin-bottom: 32rpx;
}

.rest-countdown {
  display: block;
  font-size: 96rpx;
  font-weight: 700;
  color: #e94560;
  font-family: 'SF Mono', 'Menlo', monospace;
  margin-bottom: 40rpx;
}

.rest-actions {
  display: flex;
  justify-content: center;
  gap: 20rpx;
  margin-bottom: 24rpx;
}

.rest-btn {
  width: 140rpx;
  height: 64rpx;
  line-height: 64rpx;
  text-align: center;
  border-radius: 32rpx;
  font-size: 26rpx;
  padding: 0;
  border: none;
}

.rest-btn::after { border: none; }

.rest-btn--add {
  background: #fce4e8;
  color: #e94560;
}

.rest-btn--skip {
  background: #e94560;
  color: #fff;
}

.rest-btn--sub {
  background: #f0f0f0;
  color: #666;
}

.rest-hint {
  display: block;
  font-size: 22rpx;
  color: #999;
}

/* ===== 最小化条 ===== */
.rest-minibar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: 80rpx;
  background: #1a1a2e;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 32rpx;
  z-index: 999;
}

.rest-minibar-text {
  font-size: 28rpx;
  color: #fff;
}

.rest-minibar-expand {
  font-size: 26rpx;
  color: #e94560;
  padding: 8rpx 24rpx;
}
```

- [ ] **Step 4: 提交**

```bash
git add miniprogram/pages/workout/workout.wxml miniprogram/pages/workout/workout.wxss
git commit -m "feat: workout 页面倒计时弹窗 UI（全屏遮罩 + 最小化条）"
```

---

### Task 8: 验证 + 适配 ISetFormData 默认值

**Files:**
- 无新建，检查关键位置

- [ ] **Step 1: 确保 WorkoutState.create 初始组有默认值**

在 `services/workout-service.ts` 中，`addExercise` 方法创建的初始组应包含 `rest_seconds` 和 `completed`：

```typescript
{ exercise, sets: [{ weight_kg: '', reps: '', notes: '', rest_seconds: 60, completed: false }] },
```

（此步骤为修改确认，如 Task 5 已覆盖则跳过）

- [ ] **Step 2: 检查旧页面兼容性**

确认 `workout-detail/index.ts` 和 `history-detail/index.ts` 不受影响 — 它们不依赖 `rest_seconds`/`completed` 字段（旧数据无这些字段）。

- [ ] **Step 3: 在微信开发者工具中验证功能**

1. 开始训练 → 添加动作 → 添加组
2. 确认初始 `rest_seconds: 60`、`completed: false`
3. 修改休息秒数 → 确认输入正常
4. 点击 ☐ → 确认变 ☑ → 确认倒计时弹窗弹出
5. 点击 +10s/−10s/跳过/最小化 → 确认各操作正常
6. 点击 `...` → 复制 → 确认新组插入、`completed: false`
7. 点击 `...` → 删除 → 确认组被删除

- [ ] **Step 4: 提交**

```bash
git add -A
git commit -m "chore: 组记录升级验证通过"
```

---

## Completion Checklist

- [ ] ISetFormData 扩展完成
- [ ] set-row 组件支持完成按钮 + 休息时长 + `...` 菜单（复制/删除）
- [ ] exercise-card 透传新属性/事件
- [ ] WorkoutState/WorkoutService 新增 3 个方法
- [ ] workout 页面倒计时弹窗完整功能（全屏 + 最小化 + +10s/−10s/跳过 + 振动）
- [ ] 旧页面不受影响
- [ ] 微信开发者工具中手动验证通过
