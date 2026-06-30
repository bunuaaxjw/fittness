// pages/history-detail/index.js — 历史训练详情页（只读）
const { getById, getSetsByWorkout } = require('../../utils/db');
const { formatDuration } = require('../../utils/format');

Page({
  data: {
    workoutId: null,
    workout: null,
    exercises: [],       // 按动作分组的 set 数据
    durationText: '',
    loading: true,
  },

  onLoad(options) {
    const { id } = options;
    if (id) {
      this.setData({ workoutId: id });
      this.loadWorkout(id);
    }
  },

  async loadWorkout(id) {
    this.setData({ loading: true });
    wx.showLoading({ title: '加载中...' });

    try {
      const [workoutRes, setsRes] = await Promise.all([
        getById('workouts', id),
        getSetsByWorkout(id),
      ]);

      if (!workoutRes.success || !workoutRes.data) {
        wx.hideLoading();
        wx.showToast({ title: '训练记录不存在', icon: 'none' });
        setTimeout(() => wx.navigateBack(), 1500);
        return;
      }

      const workout = workoutRes.data;
      const sets = setsRes.success ? setsRes.data : [];

      // 按 exercise_id 分组
      const exerciseMap = new Map();
      for (const set of sets) {
        const key = set.exercise_id || set.exercise_name;
        if (!exerciseMap.has(key)) {
          exerciseMap.set(key, {
            exercise_id: set.exercise_id,
            name: set.exercise_name,
            body_part: set.body_part || '',
            sets: [],
          });
        }
        exerciseMap.get(key).sets.push({
          weight_kg: set.weight_kg,
          reps: set.reps,
          notes: set.notes || '',
        });
      }

      this.setData({
        workout,
        exercises: Array.from(exerciseMap.values()),
        durationText: formatDuration(workout.duration_min || 0),
      });
    } catch (err) {
      console.error('加载历史详情失败:', err);
      wx.showToast({ title: '加载失败', icon: 'none' });
    } finally {
      wx.hideLoading();
      this.setData({ loading: false });
    }
  },

  // 再来一次：跳转到训练页
  startAgain() {
    wx.switchTab({
      url: '/pages/workout/workout',
    });
  },
});
