// pages/profile/profile.js — 个人中心
const app = getApp();
const { query } = require('../../utils/db');

Page({
  data: {
    userInfo: null,
    totalStats: {
      workoutCount: 0,
      totalMinutes: 0,
      totalSets: 0,
    },
    commonExercises: [],
    loading: true,
  },

  onShow() {
    this.setData({ userInfo: app.globalData.userInfo });
    this.loadAll();
  },

  async loadAll() {
    this.setData({ loading: true });
    try {
      await Promise.all([
        this.loadStats(),
        this.loadCommonExercises(),
      ]);
    } finally {
      this.setData({ loading: false });
    }
  },

  async loadStats() {
    try {
      // 查询总训练次数和时长
      const workoutRes = await query('workouts', {}, {
        orderBy: { field: 'created_at', direction: 'desc' },
        limit: 100, // 最多统计最近 100 条
      });

      if (workoutRes.success) {
        const workouts = workoutRes.data;
        const totalMinutes = workouts.reduce(
          (sum, w) => sum + (w.duration_min || 0), 0
        );

        // 查询总组数
        const setsRes = await query('sets', {}, { limit: 1000 });
        const totalSets = setsRes.success ? setsRes.data.length : 0;

        this.setData({
          totalStats: {
            workoutCount: workouts.length,
            totalMinutes,
            totalSets,
          },
        });
      }
    } catch (err) {
      console.error('加载个人统计失败:', err);
    }
  },

  async loadCommonExercises() {
    try {
      const res = await query('sets', {}, { limit: 500 });
      if (!res.success) return;

      // 统计每个动作的出现次数
      const countMap = {};
      for (const set of res.data) {
        const name = set.exercise_name;
        if (name) {
          countMap[name] = (countMap[name] || 0) + 1;
        }
      }

      // 取前 8 个最常用的动作
      const sorted = Object.entries(countMap)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([name, count]) => ({ name, count }));

      this.setData({ commonExercises: sorted });
    } catch (err) {
      console.error('加载常用动作失败:', err);
    }
  },

  getUserProfile() {
    wx.getUserProfile({
      desc: '用于展示个人头像和昵称',
      success: (res) => {
        app.globalData.userInfo = res.userInfo;
        wx.setStorageSync('userInfo', res.userInfo);
        this.setData({ userInfo: res.userInfo });
      },
      fail: () => {
        wx.showToast({ title: '获取用户信息失败', icon: 'none' });
      },
    });
  },

  manageExercises() {
    wx.navigateTo({
      url: '/pages/exercise-pick/index?mode=manage',
    });
  },
});
