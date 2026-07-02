// pages/profile/profile.ts — 个人中心
import { showError } from '../../utils/error';

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
        const d = res.result.data;
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
      } else {
        showError(res.result.error || '加载失败');
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
