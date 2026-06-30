// pages/index/index.js — 首页
const { getWorkouts, getWorkoutsByDate, query } = require('../../utils/db');
const { formatDate, formatDateRelative, formatDuration, getWeekRange } = require('../../utils/format');

Page({
  data: {
    todayStatus: 'not_started', // not_started | completed
    todayWorkout: null,         // 今日训练记录
    recentWorkouts: [],         // 最近训练（最多 3 条）
    weeklyStats: {
      count: 0,
      totalMinutes: 0,
    },
    loading: true,
  },

  onShow() {
    this.loadAll();
  },

  async loadAll() {
    this.setData({ loading: true });
    const today = formatDate();

    try {
      // 并行加载：今日记录 + 最近记录 + 本周统计
      const [todayRes, recentRes, weekRes] = await Promise.all([
        getWorkoutsByDate(today),
        getWorkouts(0, 3),
        this.queryWeekStats(),
      ]);

      // 处理今日状态
      const todayData = todayRes.success ? todayRes.data : [];
      if (todayData.length > 0) {
        this.setData({
          todayStatus: 'completed',
          todayWorkout: todayData[0],
        });
      } else {
        this.setData({
          todayStatus: 'not_started',
          todayWorkout: null,
        });
      }

      // 处理最近训练
      if (recentRes.success) {
        this.setData({
          recentWorkouts: recentRes.data.map((w) => ({
            ...w,
            dateText: formatDateRelative(w.date),
            durationText: formatDuration(w.duration_min || 0),
          })),
        });
      }

      // 处理本周统计
      this.setData({ weeklyStats: weekRes });
    } catch (err) {
      console.error('首页数据加载失败:', err);
    } finally {
      this.setData({ loading: false });
    }
  },

  // 查询本周训练统计
  async queryWeekStats() {
    try {
      const { start, end } = getWeekRange();
      const res = await query('workouts', {}, {});
      if (!res.success) return { count: 0, totalMinutes: 0 };

      const weekWorkouts = res.data.filter(
        (w) => w.date >= start && w.date <= end
      );
      const totalMinutes = weekWorkouts.reduce(
        (sum, w) => sum + (w.duration_min || 0),
        0
      );
      return {
        count: weekWorkouts.length,
        totalMinutes,
      };
    } catch (err) {
      console.error('周统计查询失败:', err);
      return { count: 0, totalMinutes: 0 };
    }
  },

  startWorkout() {
    wx.switchTab({
      url: '/pages/workout/workout',
    });
  },
});
