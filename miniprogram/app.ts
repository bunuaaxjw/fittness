// app.ts — 健身小程序入口
import { BODY_PARTS, CATEGORIES } from './utils/constants';
import { PRESET_EXERCISES } from './utils/seed';

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
    this.seedExercises();
  },

  loadUserInfo() {
    const userInfo = wx.getStorageSync('userInfo');
    if (userInfo) {
      this.globalData.userInfo = userInfo;
    }
  },

  /**
   * 首次启动时自动导入 52 个预设动作（无需云函数）
   * 检查是否已有数据，有则跳过
   */
  async seedExercises() {
    const SEED_KEY = 'seed_done_v2';
    if (wx.getStorageSync(SEED_KEY)) return;

    try {
      const db = wx.cloud.database();
      // 检查是否已有预设动作
      const countRes = await db.collection('exercises')
        .where({ is_preset: true })
        .count();
      if (countRes.total > 0) {
        wx.setStorageSync(SEED_KEY, true);
        return;
      }

      console.log('[seed] 开始导入 52 个预设动作...');
      let inserted = 0;
      for (const ex of PRESET_EXERCISES) {
        try {
          await db.collection('exercises').add({ data: ex });
          inserted++;
        } catch (err: any) {
          console.warn(`[seed] 导入失败: ${ex.name}`, err.message);
        }
      }
      wx.setStorageSync(SEED_KEY, true);
      console.log(`[seed] 导入完成: ${inserted}/${PRESET_EXERCISES.length}`);
    } catch (err) {
      console.warn('[seed] 检查/导入失败（集合可能还未创建）:', err);
    }
  },

  globalData: {
    userInfo: null,
    bodyParts: BODY_PARTS,
    categories: CATEGORIES,
  },
});
