// app.js — 健身小程序入口
App({
  onLaunch() {
    // 初始化云开发
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力');
      return;
    }

    wx.cloud.init({
      env: 'cloud1-d4gn8zrwfeef1e9d8',
      traceUser: true,
    });

    // 获取用户信息（可选，用于个人中心展示）
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
    // 预设的身体部位和训练类别
    bodyParts: ['胸', '背', '腿', '肩', '手臂', '核心', '全身'],
    categories: ['自由重量', '器械', '自重', '有氧'],
  },
});
