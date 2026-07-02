// pages/workout/workout.ts — 训练页
import { formatDate } from '../../utils/format';
import { showError, showSuccess } from '../../utils/error';
import { addSet, removeSet, buildSetUpdatePath, buildSaveSets } from '../../utils/workout-helper';
import { query } from '../../utils/db';

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

  /**
   * 打开动作选择页，传递最近使用的动作 ID 用于排序
   */
  async openExercisePicker() {
    // 查询最近使用的动作 ID（最近 5 次训练）
    let recentIds: string[] = [];
    try {
      const setsRes = await query('sets', {}, {
        orderBy: { field: 'sort_order', direction: 'asc' },
        limit: 200,
      });
      if (setsRes.success) {
        // 按出现顺序去重，取最近的 10 个不同动作
        const seen = new Set<string>();
        for (const s of setsRes.data.reverse()) {
          if (s.exercise_id && !seen.has(s.exercise_id)) {
            seen.add(s.exercise_id);
            recentIds.push(s.exercise_id);
          }
          if (recentIds.length >= 10) break;
        }
      }
    } catch {
      // 获取失败不阻塞
    }

    const recentParam = recentIds.length > 0 ? `&recentIds=${recentIds.join(',')}` : '';
    wx.navigateTo({
      url: `/pages/exercise-pick/index?mode=pick${recentParam}`,
      events: {
        selectExercise: (data: { exercise: IExercise }) => {
          this.addExercise(data.exercise);
        },
      },
    });
  },

  addExercise(exercise: IExercise) {
    if (!exercise) return;

    const exists = this.data.selectedExercises.some(
      (e) => e.exercise._id === exercise._id
    );
    if (exists) {
      wx.showToast({ title: '该动作已添加', icon: 'none' });
      return;
    }

    const selectedExercises = [...this.data.selectedExercises];
    selectedExercises.push({
      exercise,
      sets: [{ weight_kg: '', reps: '', notes: '' }],
    });
    this.setData({ selectedExercises });
  },

  removeExercise(e: WechatMiniprogram.BaseEvent) {
    const { index } = e.currentTarget.dataset;
    const name = this.data.selectedExercises[index].exercise.name;
    wx.showModal({
      title: '移除动作',
      content: `确定要移除 ${name} 吗？`,
      success: (res) => {
        if (res.confirm) {
          const selectedExercises = [...this.data.selectedExercises];
          selectedExercises.splice(index, 1);
          this.setData({ selectedExercises });
        }
      },
    });
  },

  // ===== 组管理 =====

  /**
   * 添加组 — 自动填充上一组的重量和次数
   */
  addSet(e: WechatMiniprogram.BaseEvent) {
    const { index } = e.currentTarget.dataset;
    const selectedExercises = addSet(this.data.selectedExercises, index);

    // 自动填充：复制上一组的 weight_kg 和 reps
    const sets = selectedExercises[index].sets;
    if (sets.length >= 2) {
      const prev = sets[sets.length - 2];
      const last = sets[sets.length - 1];
      last.weight_kg = prev.weight_kg;
      last.reps = prev.reps;
    }

    this.setData({ selectedExercises });
  },

  removeSet(e: WechatMiniprogram.BaseEvent) {
    const { exIdx, setIdx } = e.currentTarget.dataset;
    const result = removeSet(this.data.selectedExercises, exIdx, setIdx);
    if (!result) {
      wx.showToast({ title: '每个动作至少保留一组', icon: 'none' });
      return;
    }
    this.setData({ selectedExercises: result });
  },

  updateSetValue(e: WechatMiniprogram.BaseEvent) {
    const { exIdx, setIdx, field } = e.currentTarget.dataset;
    const { value } = e.detail;
    const { key, value: v } = buildSetUpdatePath('selectedExercises', exIdx, setIdx, field, value);
    this.setData({ [key]: v });
  },

  // ===== 完成训练 =====

  finishWorkout() {
    if (this.data.selectedExercises.length === 0) {
      wx.showToast({ title: '请至少添加一个动作', icon: 'none' });
      return;
    }

    wx.showModal({
      title: '完成训练',
      content: '确定要结束本次训练吗？',
      success: (res) => {
        if (res.confirm) this.saveWorkout();
      },
    });
  },

  async saveWorkout() {
    this.setData({ saving: true });
    wx.showLoading({ title: '保存中...' });

    const durationMin = Math.round(this.data.elapsedSeconds / 60);

    const flatExercises = this.data.selectedExercises.map((item) => ({
      exercise_id: item.exercise._id,
      exercise_name: item.exercise.name,
      sets: item.sets,
    }));
    const sets = buildSaveSets(flatExercises);

    try {
      const res: ICloudFunctionResult = await wx.cloud.callFunction({
        name: 'saveWorkout',
        data: {
          mode: 'create',
          date: formatDate(),
          duration_min: durationMin,
          notes: '',
          sets,
        },
      });

      wx.hideLoading();
      if (res.result.success) {
        // 显示训练完成摘要
        this.showWorkoutSummary(durationMin);
        this.resetWorkout();
      } else {
        showError(res.result.error || '保存失败，请重试');
      }
    } catch (err) {
      wx.hideLoading();
      showError('保存失败，请重试', err);
    } finally {
      this.setData({ saving: false });
    }
  },

  /**
   * 训练完成摘要弹窗
   */
  showWorkoutSummary(durationMin: number) {
    const exerciseCount = this.data.selectedExercises.length;
    const totalSets = this.data.selectedExercises.reduce(
      (sum, ex) => sum + ex.sets.filter((s) => s.weight_kg || s.reps).length, 0
    );
    const exerciseNames = this.data.selectedExercises
      .map((ex) => ex.exercise.name)
      .join('、');

    wx.showModal({
      title: '💪 训练完成！',
      content: `${exerciseCount} 个动作 · ${totalSets} 组 · ${durationMin} 分钟\n\n${exerciseNames}`,
      showCancel: false,
      confirmText: '好的',
    });
  },

  resetWorkout() {
    this.stopTimer();
    this._startTime = null;
    this.setData({
      isWorkoutActive: false,
      selectedExercises: [],
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
      this.setData({
        elapsedSeconds: elapsed,
        timerText: `${min}:${sec}`,
      });
    }, 1000) as unknown as number;
  },

  stopTimer() {
    if (this._timerInterval) {
      clearInterval(this._timerInterval);
      this._timerInterval = null;
    }
  },
});
