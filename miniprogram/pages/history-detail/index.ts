// pages/history-detail/index.ts — 历史训练详情页（只读）
import { getById, getSetsByWorkout } from '../../utils/db';
import { formatDuration } from '../../utils/format';
import { showError } from '../../utils/error';
import { groupSetsByExercise } from '../../utils/workout-helper';

interface IPageData {
  workoutId: string | null;
  workout: IWorkout | null;
  exercises: IExerciseWithSets[];
  durationText: string;
  loading: boolean;
}

Page<IPageData, {}>({
  data: {
    workoutId: null,
    workout: null,
    exercises: [],
    durationText: '',
    loading: true,
  },

  onLoad(options: Record<string, string | undefined>) {
    const { id } = options;
    if (!id) {
      showError('参数错误');
      setTimeout(() => wx.navigateBack(), 1500);
      return;
    }
    this.setData({ workoutId: id });
    this.loadWorkout(id);
  },

  async loadWorkout(id: string) {
    this.setData({ loading: true });
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
        durationText: formatDuration(workout.duration_min || 0),
        loading: false,
      });
    } catch (err) {
      showError('加载历史详情失败', err);
    } finally {
      wx.hideLoading();
      this.setData({ loading: false });
    }
  },

  // 再来一次：跳转到训练页
  startAgain() {
    wx.switchTab({ url: '/pages/workout/workout' });
  },
});
