// pages/profile/profile.ts — 个人中心
import { query } from '../../utils/db';
import { showError } from '../../utils/error';

interface ITotalStats {
  workoutCount: number;
  totalMinutes: number;
  totalSets: number;
}

interface ICommonExercise {
  name: string;
  count: number;
}

interface IPageData {
  userInfo: IUserInfo | null;
  totalStats: ITotalStats;
  commonExercises: ICommonExercise[];
  loading: boolean;
}

const app = getApp<IAppOption>();

Page<IPageData, {}>({
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
      const workoutRes = await query('workouts', {}, {
        orderBy: { field: 'created_at', direction: 'desc' },
        limit: 100,
      });

      if (workoutRes.success) {
        const workouts: IWorkout[] = workoutRes.data;
        const totalMinutes = workouts.reduce(
          (sum, w) => sum + (w.duration_min || 0), 0
        );

        const setsRes = await query('sets', {}, { limit: 1000 });
        const totalSets = setsRes.success ? setsRes.data.length : 0;

        this.setData({
          totalStats: { workoutCount: workouts.length, totalMinutes, totalSets },
        });
      }
    } catch (err) {
      showError('加载个人统计失败', err);
    }
  },

  async loadCommonExercises() {
    try {
      const res = await query('sets', {}, { limit: 500 });
      if (!res.success) return;

      const countMap: Record<string, number> = {};
      for (const set of res.data) {
        const name = set.exercise_name;
        if (name) {
          countMap[name] = (countMap[name] || 0) + 1;
        }
      }

      const sorted: ICommonExercise[] = Object.entries(countMap)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([name, count]) => ({ name, count }));

      this.setData({ commonExercises: sorted });
    } catch (err) {
      showError('加载常用动作失败', err);
    }
  },

  // 使用缓存方式获取用户信息（wx.getUserProfile 已废弃）
  getUserProfile() {
    wx.showModal({
      title: '个人信息',
      content: '请在微信「我」页面设置头像和昵称',
      showCancel: false,
      confirmText: '知道了',
    });
    // 尝试从缓存加载
    const cached = wx.getStorageSync('userInfo');
    if (cached) {
      app.globalData.userInfo = cached;
      this.setData({ userInfo: cached });
    }
  },

  manageExercises() {
    wx.navigateTo({ url: '/pages/exercise-pick/index?mode=manage' });
  },
});
