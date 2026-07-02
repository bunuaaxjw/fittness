// pages/workout/workout.ts — 训练页
import { formatDate } from '../../utils/format';
import { showError, showSuccess } from '../../utils/error';
import { addSet, removeSet, buildSetUpdatePath, buildSaveSets } from '../../utils/workout-helper';
import { query, add } from '../../utils/db';

interface IPageData {
  isWorkoutActive: boolean;
  selectedExercises: ISelectedExercise[];
  elapsedSeconds: number;
  timerText: string;
  saving: boolean;
}

Page<IPageData, {}>({
  data: {
    isWorkoutActive: false,
    selectedExercises: [],
    elapsedSeconds: 0,
    timerText: '00:00',
    saving: false,
  },

  _timerInterval: null as number | null,
  _startTime: null as number | null,

  onUnload() {
    this.stopTimer();
  },

  // ===== 训练流程 =====

  startWorkout() {
    this._startTime = Date.now();
    this.setData({
      isWorkoutActive: true,
      selectedExercises: [],
      elapsedSeconds: 0,
      timerText: '00:00',
    });
    this.startTimer();
  },

  async openExercisePicker() {
    let recentIds: string[] = [];
    try {
      const setsRes = await query('sets', {}, { orderBy: { field: 'sort_order', direction: 'asc' }, limit: 200 });
      if (setsRes.success) {
        const seen = new Set<string>();
        for (const s of setsRes.data.reverse()) {
          if (s.exercise_id && !seen.has(s.exercise_id)) { seen.add(s.exercise_id); recentIds.push(s.exercise_id); }
          if (recentIds.length >= 10) break;
        }
      }
    } catch { /* 不阻塞 */ }

    const recentParam = recentIds.length > 0 ? `&recentIds=${recentIds.join(',')}` : '';
    wx.navigateTo({
      url: `/pages/exercise-pick/index?mode=pick${recentParam}`,
      events: { selectExercise: (data: { exercise: IExercise }) => { this.addExercise(data.exercise); } },
    });
  },

  addExercise(exercise: IExercise) {
    if (!exercise) return;
    const exists = this.data.selectedExercises.some((e) => e.exercise._id === exercise._id);
    if (exists) { wx.showToast({ title: '该动作已添加', icon: 'none' }); return; }
    const selectedExercises = [...this.data.selectedExercises];
    selectedExercises.push({ exercise, sets: [{ weight_kg: '', reps: '', notes: '' }] });
    this.setData({ selectedExercises });
  },

  // ===== 组件事件 =====

  onRemoveExercise(e: any) {
    const { index } = e.detail;
    const name = this.data.selectedExercises[index].exercise.name;
    wx.showModal({
      title: '移除动作', content: `确定要移除 ${name} 吗？`,
      success: (res) => {
        if (res.confirm) {
          const selectedExercises = [...this.data.selectedExercises];
          selectedExercises.splice(index, 1);
          this.setData({ selectedExercises });
        }
      },
    });
  },

  onAddSet(e: any) {
    const { index } = e.detail;
    const selectedExercises = addSet(this.data.selectedExercises, index);
    const sets = selectedExercises[index].sets;
    if (sets.length >= 2) { const prev = sets[sets.length - 2]; const last = sets[sets.length - 1]; last.weight_kg = prev.weight_kg; last.reps = prev.reps; }
    this.setData({ selectedExercises });
  },

  onSetRemove(e: any) {
    const { exIndex, setIndex } = e.detail;
    const result = removeSet(this.data.selectedExercises, exIndex, setIndex);
    if (!result) { wx.showToast({ title: '每个动作至少保留一组', icon: 'none' }); return; }
    this.setData({ selectedExercises: result });
  },

  onSetUpdate(e: any) {
    const { exIndex, setIndex, field, value } = e.detail;
    const { key, value: v } = buildSetUpdatePath('selectedExercises', exIndex, setIndex, field, value);
    this.setData({ [key]: v });
  },

  // ===== 完成训练 =====

  finishWorkout() {
    if (this.data.selectedExercises.length === 0) { wx.showToast({ title: '请至少添加一个动作', icon: 'none' }); return; }
    wx.showModal({
      title: '完成训练', content: '确定要结束本次训练吗？',
      success: (res) => { if (res.confirm) this.saveWorkout(); },
    });
  },

  async saveWorkout() {
    this.setData({ saving: true });
    wx.showLoading({ title: '保存中...' });
    const durationMin = Math.round(this.data.elapsedSeconds / 60);

    const flatExercises = this.data.selectedExercises.map((item) => ({
      exercise_id: item.exercise._id, exercise_name: item.exercise.name, sets: item.sets,
    }));
    const sets = buildSaveSets(flatExercises);

    let success = false;
    try {
      const res: ICloudFunctionResult = await wx.cloud.callFunction({
        name: 'saveWorkout',
        data: { mode: 'create', date: formatDate(), duration_min: durationMin, notes: '', sets },
      });
      success = res.result.success;
      if (!success) showError(res.result.error || '保存失败');
    } catch {
      // 云函数不可用，降级为客户端直接写入
      console.warn('[workout] 云函数不可用，使用客户端保存');
      success = await this.clientSave(durationMin, sets);
    }

    wx.hideLoading();
    if (success) { this.showWorkoutSummary(durationMin); this.resetWorkout(); }
    this.setData({ saving: false });
  },

  async clientSave(durationMin: number, sets: any[]): Promise<boolean> {
    try {
      const workoutRes = await add('workouts', {
        date: formatDate(), duration_min: durationMin, notes: '', created_at: new Date(),
      });
      if (!workoutRes.success || !workoutRes._id) return false;
      let setOrder = 0;
      for (const set of sets) {
        await add('sets', {
          workout_id: workoutRes._id, exercise_id: set.exercise_id,
          exercise_name: set.exercise_name, weight_kg: set.weight_kg,
          reps: set.reps, notes: set.notes, sort_order: setOrder++,
        });
      }
      return true;
    } catch { return false; }
  },

  showWorkoutSummary(durationMin: number) {
    const exerciseCount = this.data.selectedExercises.length;
    const totalSets = this.data.selectedExercises.reduce((sum, ex) => sum + ex.sets.filter((s: any) => s.weight_kg || s.reps).length, 0);
    const names = this.data.selectedExercises.map((ex) => ex.exercise.name).join('、');
    wx.showModal({
      title: '💪 训练完成！',
      content: `${exerciseCount} 个动作 · ${totalSets} 组 · ${durationMin} 分钟\n\n${names}`,
      showCancel: false, confirmText: '好的',
    });
  },

  resetWorkout() {
    this.stopTimer(); this._startTime = null;
    this.setData({ isWorkoutActive: false, selectedExercises: [], elapsedSeconds: 0, timerText: '00:00' });
  },

  // ===== 计时器 =====

  startTimer() {
    this._timerInterval = setInterval(() => {
      if (!this._startTime) return;
      const elapsed = Math.floor((Date.now() - this._startTime) / 1000);
      this.setData({ elapsedSeconds: elapsed, timerText: `${String(Math.floor(elapsed / 60)).padStart(2, '0')}:${String(elapsed % 60).padStart(2, '0')}` });
    }, 1000) as unknown as number;
  },

  stopTimer() {
    if (this._timerInterval) { clearInterval(this._timerInterval); this._timerInterval = null; }
  },
});
