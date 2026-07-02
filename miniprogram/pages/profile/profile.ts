// pages/profile/profile.ts — 个人中心
import { showError } from '../../utils/error';
import { query } from '../../utils/db';

interface ITotalStats {
  workoutCount: number;
  totalMinutes: number;
  totalSets: number;
  trainingDays: number;
}

interface ICommonExercise {
  name: string;
  count: number;
}

interface IPageData {
  userInfo: IUserInfo | null;
  totalStats: ITotalStats;
  statItems: Array<{ value: number; label: string }>;
  commonExercises: ICommonExercise[];
  loading: boolean;
}

const app = getApp<IAppOption>();

Page<IPageData, {}>({
  data: {
    userInfo: null,
    totalStats: { workoutCount: 0, totalMinutes: 0, totalSets: 0, trainingDays: 0 },
    commonExercises: [],
    statItems: [],
    loading: true,
  },

  onShow() {
    this.setData({ userInfo: app.globalData.userInfo });
    this.loadAll();
  },

  async loadAll() {
    this.setData({ loading: true });
    try {
      const res: ICloudFunctionResult = await wx.cloud.callFunction({
        name: 'getProfileStats',
      });

      if (res.result.success) {
        this.setCloudStats(res.result.data);
        return;
      }
    } catch {
      // 云函数未部署，降级为客户端查询
      console.warn('[profile] 云函数不可用，使用客户端查询');
    }

    await this.loadLocalStats();
  },

  /** 云函数返回的统计 */
  setCloudStats(d: any) {
    this.setData({
      totalStats: {
        workoutCount: d.workoutCount,
        totalMinutes: d.totalMinutes,
        totalSets: d.totalSets,
        trainingDays: d.trainingDays,
      },
      statItems: [
        { value: d.workoutCount, label: '次训练' },
        { value: d.totalMinutes, label: '分钟' },
        { value: d.totalSets, label: '组' },
        { value: d.trainingDays, label: '天' },
      ],
      commonExercises: d.commonExercises,
    });
  },

  /** 降级：客户端查询统计 */
  async loadLocalStats() {
    try {
      const [workoutRes, setsRes] = await Promise.all([
        query('workouts', {}, {
          orderBy: { field: 'created_at', direction: 'desc' },
          limit: 100,
        }),
        query('sets', {}, { limit: 1000 }),
      ]);

      if (workoutRes.success) {
        const workouts: IWorkout[] = workoutRes.data;
        const totalMinutes = workouts.reduce((sum, w) => sum + (w.duration_min || 0), 0);
        const totalSets = setsRes.success ? setsRes.data.length : 0;
        const uniqueDates = new Set(workouts.map((w) => w.date));

        this.setData({
          totalStats: { workoutCount: workouts.length, totalMinutes, totalSets, trainingDays: uniqueDates.size },
          statItems: [
            { value: workouts.length, label: '次训练' },
            { value: totalMinutes, label: '分钟' },
            { value: totalSets, label: '组' },
            { value: uniqueDates.size, label: '天' },
          ],
        });
      }

      // 常用动作
      if (setsRes.success) {
        const countMap: Record<string, number> = {};
        for (const set of setsRes.data) {
          const name = set.exercise_name;
          if (name) countMap[name] = (countMap[name] || 0) + 1;
        }
        const commonExercises = Object.entries(countMap)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 8)
          .map(([name, count]) => ({ name, count }));
        this.setData({ commonExercises });
      }
    } catch (err) {
      showError('加载个人数据失败', err);
    } finally {
      this.setData({ loading: false });
    }
  },

  getUserProfile() {
    wx.showModal({
      title: '个人信息',
      content: '请在微信「我」页面设置头像和昵称',
      showCancel: false,
      confirmText: '知道了',
    });
    const cached = wx.getStorageSync('userInfo');
    if (cached) {
      app.globalData.userInfo = cached;
      this.setData({ userInfo: cached });
    }
  },

  manageExercises() {
    wx.navigateTo({ url: '/pages/exercise-pick/index?mode=manage' });
  },

  viewExerciseHistory(e: WechatMiniprogram.BaseEvent) {
    const { name } = e.currentTarget.dataset;
    if (!name) return;
    app.globalData._historyFilter = name;
    wx.switchTab({ url: '/pages/history/history' });
  },
});
