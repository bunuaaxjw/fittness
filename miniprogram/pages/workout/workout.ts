// pages/workout/workout.ts — 训练页
import { formatDate } from '../../utils/format';
import { showError, showSuccess } from '../../utils/error';

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

  openExercisePicker() {
    wx.navigateTo({
      url: '/pages/exercise-pick/index?mode=pick',
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

  addSet(e: WechatMiniprogram.BaseEvent) {
    const exerciseIndex = e.currentTarget.dataset.index;
    const selectedExercises = [...this.data.selectedExercises];
    selectedExercises[exerciseIndex].sets.push({
      weight_kg: '',
      reps: '',
      notes: '',
    });
    this.setData({ selectedExercises });
  },

  removeSet(e: WechatMiniprogram.BaseEvent) {
    const { exIdx, setIdx } = e.currentTarget.dataset;
    const selectedExercises = [...this.data.selectedExercises];
    if (selectedExercises[exIdx].sets.length <= 1) {
      wx.showToast({ title: '每个动作至少保留一组', icon: 'none' });
      return;
    }
    selectedExercises[exIdx].sets.splice(setIdx, 1);
    this.setData({ selectedExercises });
  },

  updateSetValue(e: WechatMiniprogram.BaseEvent) {
    const { exIdx, setIdx, field } = e.currentTarget.dataset;
    const { value } = e.detail;
    const key = `selectedExercises[${exIdx}].sets[${setIdx}].${field}`;
    this.setData({ [key]: value });
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

    // 构建 sets 数据
    const sets: Array<{
      exercise_id: string;
      exercise_name: string;
      weight_kg: number;
      reps: number;
      notes: string;
      sort_order: number;
    }> = [];
    let setOrder = 0;
    for (const item of this.data.selectedExercises) {
      for (const set of item.sets) {
        if (!set.weight_kg && !set.reps) continue;
        sets.push({
          exercise_id: item.exercise._id,
          exercise_name: item.exercise.name,
          weight_kg: parseFloat(String(set.weight_kg)) || 0,
          reps: parseInt(String(set.reps)) || 0,
          notes: set.notes || '',
          sort_order: setOrder++,
        });
      }
    }

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
        showSuccess('训练已保存！');
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
