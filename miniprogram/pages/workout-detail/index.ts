// pages/workout-detail/index.ts — 训练详情/编辑页
import { getById, getSetsByWorkout } from '../../utils/db';
import { formatDuration } from '../../utils/format';
import { showError, showSuccess } from '../../utils/error';

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

      // 按 exercise_id 分组
      const exerciseMap: Record<string, IExerciseWithSets> = {};
      for (const set of sets) {
        const key = set.exercise_id || set.exercise_name;
        if (!exerciseMap[key]) {
          exerciseMap[key] = {
            exercise_id: set.exercise_id,
            exercise_name: set.exercise_name,
            icon: '',
            sets: [],
          };
        }
        exerciseMap[key].sets.push(set);
      }

      this.setData({
        workout,
        exercises: Object.values(exerciseMap),
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
      // 取消编辑时恢复数据
      if (this.data.workoutId) {
        this.loadWorkout(this.data.workoutId);
      }
    }
  },

  onNotesInput(e: WechatMiniprogram.BaseEvent) {
    this.setData({ notes: e.detail.value });
  },

  // ===== 组管理（编辑模式） =====

  addSet(e: WechatMiniprogram.BaseEvent) {
    const exerciseIndex = e.currentTarget.dataset.index;
    const exercises = [...this.data.exercises];
    exercises[exerciseIndex].sets.push({
      workout_id: this.data.workoutId || '',
      exercise_id: exercises[exerciseIndex].exercise_id,
      exercise_name: exercises[exerciseIndex].exercise_name,
      weight_kg: '' as any,
      reps: '' as any,
      notes: '',
      sort_order: exercises[exerciseIndex].sets.length,
    } as ISetRecord);
    this.setData({ exercises });
  },

  removeSet(e: WechatMiniprogram.BaseEvent) {
    const { exIdx, setIdx } = e.currentTarget.dataset;
    const exercises = [...this.data.exercises];
    if (exercises[exIdx].sets.length <= 1) {
      wx.showToast({ title: '每个动作至少保留一组', icon: 'none' });
      return;
    }
    exercises[exIdx].sets.splice(setIdx, 1);
    this.setData({ exercises });
  },

  updateSetValue(e: WechatMiniprogram.BaseEvent) {
    const { exIdx, setIdx, field } = e.currentTarget.dataset;
    const { value } = e.detail;
    const key = `exercises[${exIdx}].sets[${setIdx}].${field}`;
    this.setData({ [key]: value });
  },

  // ===== 保存 =====

  async saveWorkout() {
    if (!this.data.workoutId) return;

    this.setData({ saving: true });
    wx.showLoading({ title: '保存中...' });

    // 先获取旧的 set IDs
    let oldSetIds: string[] = [];
    try {
      const oldSets = await getSetsByWorkout(this.data.workoutId);
      if (oldSets.success) {
        oldSetIds = oldSets.data.map((s: ISetRecord) => s._id).filter(Boolean);
      }
    } catch {
      // 获取旧组失败继续，新旧都会在云函数中处理
    }

    // 构建新 sets 数据
    const sets: Array<{
      exercise_id: string;
      exercise_name: string;
      weight_kg: number;
      reps: number;
      notes: string;
      sort_order: number;
    }> = [];
    let setOrder = 0;
    for (const exercise of this.data.exercises) {
      for (const set of exercise.sets) {
        if (!set.weight_kg && !set.reps) continue;
        sets.push({
          exercise_id: exercise.exercise_id,
          exercise_name: exercise.exercise_name,
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
          mode: 'update',
          workoutId: this.data.workoutId,
          notes: this.data.notes,
          sets,
          oldSetIds,
        },
      });

      wx.hideLoading();
      if (res.result.success) {
        showSuccess('已保存');
        this.setData({ isEdit: false, saving: false });
        wx.setNavigationBarTitle({ title: '训练详情' });
      } else {
        showError(res.result.error || '保存失败');
        this.setData({ saving: false });
      }
    } catch (err) {
      wx.hideLoading();
      showError('保存失败', err);
      this.setData({ saving: false });
    }
  },
});
