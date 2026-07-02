// pages/workout-detail/index.ts — 训练详情/编辑页
import { getById, getSetsByWorkout, update, remove, add } from '../../utils/db';
import { formatDuration } from '../../utils/format';
import { showError, showSuccess } from '../../utils/error';
import {
  addSet, removeSet, buildSetUpdatePath,
  groupSetsByExercise, buildSaveSets,
} from '../../utils/workout-helper';

interface IPageData {
  workoutId: string | null;
  workout: IWorkout | null;
  exercises: IExerciseWithSets[];
  durationText: string;
  notes: string;
  isEdit: boolean;
  saving: boolean;
  loading: boolean;
}

Page<IPageData, {}>({
  data: {
    workoutId: null,
    workout: null,
    exercises: [],
    durationText: '',
    notes: '',
    isEdit: false,
    saving: false,
    loading: true,
  },

  onLoad(options: Record<string, string | undefined>) {
    const { id } = options;
    if (id) {
      this.setData({ workoutId: id });
      this.loadWorkout(id);
    } else {
      showError('参数错误');
      setTimeout(() => wx.navigateBack(), 1500);
    }
  },

  async loadWorkout(id: string) {
    wx.showLoading({ title: '加载中...' });

    try {
      const [workoutRes, setsRes] = await Promise.all([
        getById('workouts', id),
        getSetsByWorkout(id),
      ]);

      if (!workoutRes.success || !workoutRes.data) {
        wx.hideLoading();
        showError('训练记录不存在');
        setTimeout(() => wx.navigateBack(), 1500);
        return;
      }

      const workout: IWorkout = workoutRes.data;
      const sets: ISetRecord[] = setsRes.success ? setsRes.data : [];

      this.setData({
        workout,
        exercises: groupSetsByExercise(sets),
        durationText: formatDuration(workout.duration_min),
        notes: workout.notes || '',
        loading: false,
      });
    } catch (err) {
      showError('加载训练详情失败', err);
    } finally {
      wx.hideLoading();
    }
  },

  // ===== 编辑模式切换 =====

  toggleEdit() {
    const isEdit = !this.data.isEdit;
    this.setData({ isEdit });
    if (isEdit) {
      wx.setNavigationBarTitle({ title: '编辑训练' });
    } else {
      wx.setNavigationBarTitle({ title: '训练详情' });
      if (this.data.workoutId) {
        this.loadWorkout(this.data.workoutId);
      }
    }
  },

  onNotesInput(e: WechatMiniprogram.BaseEvent) {
    this.setData({ notes: e.detail.value });
  },

  // ===== 组管理（共享工具函数） =====

  addSet(e: WechatMiniprogram.BaseEvent) {
    const { index } = e.currentTarget.dataset;
    const exercises = addSet(this.data.exercises, index);
    this.setData({ exercises });
  },

  removeSet(e: WechatMiniprogram.BaseEvent) {
    const { exIdx, setIdx } = e.currentTarget.dataset;
    const result = removeSet(this.data.exercises, exIdx, setIdx);
    if (!result) {
      wx.showToast({ title: '每个动作至少保留一组', icon: 'none' });
      return;
    }
    this.setData({ exercises: result });
  },

  updateSetValue(e: WechatMiniprogram.BaseEvent) {
    const { exIdx, setIdx, field } = e.currentTarget.dataset;
    const { value } = e.detail;
    const { key, value: v } = buildSetUpdatePath('exercises', exIdx, setIdx, field, value);
    this.setData({ [key]: v });
  },

  // ===== 保存 =====

  async saveWorkout() {
    if (!this.data.workoutId) return;
    this.setData({ saving: true });
    wx.showLoading({ title: '保存中...' });

    let oldSetIds: string[] = [];
    try {
      const oldSets = await getSetsByWorkout(this.data.workoutId);
      if (oldSets.success) { oldSetIds = oldSets.data.map((s: ISetRecord) => s._id).filter(Boolean); }
    } catch { /* 不阻塞 */ }

    const sets = buildSaveSets(this.data.exercises);
    let success = false;

    try {
      const res: ICloudFunctionResult = await wx.cloud.callFunction({
        name: 'saveWorkout',
        data: { mode: 'update', workoutId: this.data.workoutId, notes: this.data.notes, sets, oldSetIds },
      });
      success = res.result.success;
      if (!success) showError(res.result.error || '保存失败');
    } catch {
      console.warn('[workout-detail] 云函数不可用，使用客户端保存');
      success = await this.clientUpdate(oldSetIds, sets);
    }

    wx.hideLoading();
    if (success) {
      showSuccess('已保存');
      wx.removeStorageSync('index_cache');
      this.setData({ isEdit: false, saving: false });
      wx.setNavigationBarTitle({ title: '训练详情' });
    } else {
      this.setData({ saving: false });
    }
  },

  async clientUpdate(oldSetIds: string[], sets: any[]): Promise<boolean> {
    try {
      await update('workouts', this.data.workoutId!, { notes: this.data.notes });
      for (const setId of oldSetIds) { await remove('sets', setId); }
      let setOrder = 0;
      for (const set of sets) {
        await add('sets', {
          workout_id: this.data.workoutId, exercise_id: set.exercise_id,
          exercise_name: set.exercise_name, weight_kg: set.weight_kg,
          reps: set.reps, notes: set.notes, sort_order: setOrder++,
        });
      }
      return true;
    } catch { return false; }
  },
});
