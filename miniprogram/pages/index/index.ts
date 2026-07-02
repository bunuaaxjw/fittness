// pages/index/index.ts — 首页
import { getWorkouts, getWorkoutsByDate, query, _ } from '../../utils/db';
import { formatDateRelative, formatDuration, getWeekRange } from '../../utils/format';
import { showError } from '../../utils/error';
import { MAX_RECENT_WORKOUTS } from '../../utils/constants';

interface IRecentWorkout extends IWorkout {
  dateText: string;
  durationText: string;
}

interface IPageData {
  todayStatus: TodayStatus;
  todayWorkout: IWorkout | null;
  recentWorkouts: IRecentWorkout[];
  weeklyStats: IWeekStats;
  loading: boolean;
}

Page<IPageData, {}>({
  data: {
    todayStatus: 'not_started',
    todayWorkout: null,
    recentWorkouts: [],
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
      const [todayRes, recentRes, weekRes] = await Promise.all([
        getWorkoutsByDate(today),
        getWorkouts(0, MAX_RECENT_WORKOUTS),
        this.queryWeekStats(),
      ]);

      // 处理今日状态
      const todayData: IWorkout[] = todayRes.success ? todayRes.data : [];
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
        const recentWorkouts: IRecentWorkout[] = recentRes.data.map((w: IWorkout) => ({
          ...w,
          dateText: formatDateRelative(w.date),
          durationText: formatDuration(w.duration_min || 0),
        }));
        this.setData({ recentWorkouts });
      }

      // 处理本周统计
      this.setData({ weeklyStats: weekRes });
    } catch (err) {
      showError('首页数据加载失败', err);
    } finally {
      this.setData({ loading: false });
    }
  },

  // 查询本周训练统计（用日期范围过滤，不再拉全表）
  async queryWeekStats(): Promise<IWeekStats> {
    try {
      const { start, end } = getWeekRange();
      const res = await query('workouts', {
        date: _.gte(start).and(_.lte(end)),
      }, {
        limit: 100,
      });
      if (!res.success) return { count: 0, totalMinutes: 0 };

      const workouts: IWorkout[] = res.data;
      const totalMinutes = workouts.reduce(
        (sum: number, w: IWorkout) => sum + (w.duration_min || 0),
        0
      );
      return { count: workouts.length, totalMinutes };
    } catch (err) {
      showError('周统计查询失败', err);
      return { count: 0, totalMinutes: 0 };
    }
  },

  startWorkout() {
    wx.switchTab({ url: '/pages/workout/workout' });
  },
});

// 本地使用的 formatDate（避免循环依赖）
function formatDate(d?: Date | string | number): string {
  const date = d ? new Date(d) : new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
