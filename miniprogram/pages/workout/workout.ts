// pages/workout/workout.ts — 训练页（重构后）
import { WorkoutState, WorkoutService } from '../../services/workout-service';
import { CacheManager } from '../../dal/cache';

interface IPageData {
  isWorkoutActive: boolean;
  state: WorkoutState | null;
  elapsedSeconds: number;
  timerText: string;
  saving: boolean;
  rtVisible: boolean;
  rtMinimized: boolean;
  rtSeconds: number;
  rtTotal: number;
  rtDisplay: string;
  rtExercise: string;
  rtSetIndex: number;
  rtExIndex: number;
}

Page<IPageData, {}>({
  data: {
    isWorkoutActive: false,
    state: null,
    elapsedSeconds: 0,
    timerText: '00:00',
    saving: false,
    rtVisible: false,
    rtMinimized: false,
    rtSeconds: 0,
    rtTotal: 0,
    rtDisplay: '00:00',
    rtExercise: '',
    rtSetIndex: 0,
    rtExIndex: 0,
  },

  _timerInterval: null as number | null,
  _restInterval: null as number | null,
  _rtStartedAt: 0,
  _startTime: null as number | null,
  _service: null as WorkoutService | null,

  onUnload() {
    this.stopTimer();
    this.stopRestTimer();
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
    const recentIds = state ? state.recentExercises.map((e) => e._id).join(',') : '';
    wx.navigateTo({
      url: `/pages/exercise-pick/index?mode=pick${recentIds ? `&recentIds=${recentIds}` : ''}`,
      events: {
        selectExercise: (data: { exercise: IExerciseExtended }) => { this.addExercise(data.exercise); },
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
    const name = this.data.state!.exercises[index].exercise.name;
    wx.showModal({
      title: '移除动作', content: `确定要移除 ${name} 吗？`,
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
    if (!newState) { wx.showToast({ title: '每个动作至少保留一组', icon: 'none' }); return; }
    this.setData({ state: newState });
  },

  onSetUpdate(e: any) {
    const { exIndex, setIndex, field, value } = e.detail;
    const service = this._service || new WorkoutService();
    this.setData({ state: service.updateSet(this.data.state!, exIndex, setIndex, field, value) });
  },

  onSetToggleComplete(e: any) {
    const { exIndex, setIndex } = e.detail;
    const service = this._service || new WorkoutService();
    const newState = service.toggleSetComplete(this.data.state!, exIndex, setIndex);
    this.setData({ state: newState });

    const set = newState.exercises[exIndex].sets[setIndex];
    if (set.completed && set.rest_seconds > 0) {
      this.startRestTimer(exIndex, setIndex, newState.exercises[exIndex].exercise.name, set.rest_seconds);
    }
  },

  onSetRestChange(e: any) {
    const { exIndex, setIndex, value } = e.detail;
    const service = this._service || new WorkoutService();
    this.setData({ state: service.updateSetRest(this.data.state!, exIndex, setIndex, value) });
  },

  onSetDuplicate(e: any) {
    const { exIndex, setIndex } = e.detail;
    const service = this._service || new WorkoutService();
    this.setData({ state: service.duplicateSet(this.data.state!, exIndex, setIndex) });
  },

  // ===== 完成训练 =====

  finishWorkout() {
    if (!this.data.state || this.data.state.isEmpty()) {
      wx.showToast({ title: '请至少添加一个动作', icon: 'none' }); return;
    }
    wx.showModal({
      title: '完成训练', content: '确定要结束本次训练吗？',
      success: (res) => { if (res.confirm) this.saveWorkout(); },
    });
  },

  async saveWorkout() {
    this.setData({ saving: true }); wx.showLoading({ title: '保存中...' });
    const state = this.data.state!;
    const durationMin = Math.round(this.data.elapsedSeconds / 60);
    const service = this._service || new WorkoutService();
    const result = await service.saveWorkout(state, durationMin, '');
    wx.hideLoading();
    if (result.success) { this.showWorkoutSummary(durationMin); this.resetWorkout(); }
    this.setData({ saving: false });
  },

  showWorkoutSummary(durationMin: number) {
    const state = this.data.state!;
    wx.showModal({
      title: '💪 训练完成！',
      content: `${state.exercises.length} 个动作 · ${state.getTotalSets()} 组 · ${durationMin} 分钟\n\n${state.exercises.map((ex) => ex.exercise.name).join('、')}`,
      showCancel: false, confirmText: '好的',
    });
  },

  resetWorkout() {
    this.stopTimer(); this.stopRestTimer();
    this._startTime = null; this._service = null;
    CacheManager.getInstance().invalidate('index');
    wx.removeStorageSync('index_cache');
    this.setData({
      isWorkoutActive: false, state: null, elapsedSeconds: 0, timerText: '00:00',
      rtVisible: false, rtMinimized: false, rtSeconds: 0, rtDisplay: '00:00',
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

  // ===== 组间倒计时（全部扁平字段）=====

  fmtTimer(s: number): string {
    if (s <= 0) return '00:00';
    const m = String(Math.floor(s / 60)).padStart(2, '0');
    const sec = String(s % 60).padStart(2, '0');
    return `${m}:${sec}`;
  },

  startRestTimer(exIndex: number, setIndex: number, exerciseName: string, seconds: number) {
    if (seconds <= 0) return;
    this.stopRestTimer();
    this._rtStartedAt = Date.now();
    this.setData({
      rtVisible: true, rtMinimized: false, rtSeconds: seconds, rtTotal: seconds,
      rtDisplay: this.fmtTimer(seconds), rtExercise: exerciseName,
      rtSetIndex: setIndex, rtExIndex: exIndex,
    });
    this._restInterval = setInterval(() => {
      const remaining = this.data.rtSeconds - 1;
      if (remaining <= 0) {
        this.finishRestTimer(true);
      } else {
        this.setData({ rtSeconds: remaining, rtDisplay: this.fmtTimer(remaining) });
      }
    }, 1000) as unknown as number;
  },

  /** 结束倒计时。full=true 表示倒计时归零 */
  finishRestTimer(full: boolean = false) {
    const elapsed = Math.round((Date.now() - this._rtStartedAt) / 1000);
    const actualRest = full ? this.data.rtTotal : Math.max(elapsed, 1);
    this.stopRestTimer();
    wx.vibrateShort({ type: 'medium' });
    // 更新组的实际休息时长
    const service = this._service || new WorkoutService();
    const newState = service.updateSetRest(this.data.state!, this.data.rtExIndex, this.data.rtSetIndex, actualRest);
    this.setData({ state: newState, rtVisible: false });
  },

  stopRestTimer() {
    if (this._restInterval) { clearInterval(this._restInterval); this._restInterval = null; }
  },

  onRestAdd10() {
    const s = this.data.rtSeconds + 10;
    this.setData({ rtSeconds: s, rtTotal: this.data.rtTotal + 10, rtDisplay: this.fmtTimer(s) });
  },

  onRestSub10() {
    if (this.data.rtSeconds <= 10) return;
    const s = this.data.rtSeconds - 10;
    this.setData({ rtSeconds: s, rtTotal: this.data.rtTotal - 10, rtDisplay: this.fmtTimer(s) });
  },

  onRestSkip() {
    this.finishRestTimer(false);
  },

  onRestMinimize() {
    this.setData({ rtMinimized: true });
  },

  onRestExpand() {
    this.setData({ rtMinimized: false });
  },
});
