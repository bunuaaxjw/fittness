// app.ts — 健身小程序入口
import { BODY_PARTS, CATEGORIES } from './utils/constants';

App<IAppOption>({
  onLaunch() {
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力');
      return;
    }

    wx.cloud.init({
      env: 'cloud1-d4gn8zrwfeef1e9d8',
      traceUser: true,
    });

    this.loadUserInfo();
  },

  loadUserInfo() {
    const userInfo = wx.getStorageSync('userInfo');
    if (userInfo) {
      this.globalData.userInfo = userInfo;
    }
  },

  globalData: {
    userInfo: null,
    bodyParts: BODY_PARTS,
    categories: CATEGORIES,
  },
});
