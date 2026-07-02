// pages/index/index.ts — 首页
import { getWorkouts, getWorkoutsByDate, query, _ } from '../../utils/db';
import { formatDateRelative, formatDuration, getWeekRange } from '../../utils/format';
import { showError } from '../../utils/error';
import { MAX_RECENT_WORKOUTS } from '../../utils/constants';

interface IRecentWorkout extends IWorkout {
  dateText: string;
  durationText: string;
  exerciseNames: string;  // 用顿号分隔的动作名
}

interface IPageData {
  todayStatus: TodayStatus;
  todayWorkout: IWorkout | null;
  todayExercises: string;  // 今日训练的动作名
  recentWorkouts: IRecentWorkout[];
  weeklyStats: IWeekStats;
  loading: boolean;
}

Page<IPageData, {}>({
  data: {
    todayStatus: 'not_started',
    todayWorkout: null,
    todayExercises: '',
    recentWorkouts: [],
    weeklyStats: { count: 0, totalMinutes: 0 },
    loading: true,
  },

  onShow() {
    this.loadAll();
  },

  onPullDownRefresh() {
    this.loadAll().then(() => wx.stopPullDownRefresh());
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

      // 收集需要查询 sets 的 workout IDs
      const needSetsIds: string[] = [];
      const todayData: IWorkout[] = todayRes.success ? todayRes.data : [];
      if (todayData.length > 0) needSetsIds.push(todayData[0]._id);

      const recentData: IWorkout[] = recentRes.success ? recentRes.data : [];
      recentData.forEach((w) => needSetsIds.push(w._id));

      // 批量查询动作名
      const exerciseMap = await this.fetchExerciseNames(needSetsIds);

      // 处理今日状态
      if (todayData.length > 0) {
        this.setData({
          todayStatus: 'completed',
          todayWorkout: todayData[0],
          todayExercises: exerciseMap.get(todayData[0]._id) || '',
        });
      } else {
        this.setData({
          todayStatus: 'not_started',
          todayWorkout: null,
          todayExercises: '',
        });
      }

      // 处理最近训练
      if (recentRes.success) {
        const recentWorkouts: IRecentWorkout[] = recentData.map((w) => ({
          ...w,
          dateText: formatDateRelative(w.date),
          durationText: formatDuration(w.duration_min || 0),
          exerciseNames: exerciseMap.get(w._id) || '',
        }));
        this.setData({ recentWorkouts });
      }

      this.setData({ weeklyStats: weekRes });
    } catch (err) {
      showError('首页数据加载失败', err);
    } finally {
      this.setData({ loading: false });
    }
  },

  /**
   * 批量查询 workout IDs 对应的动作名
   */
  async fetchExerciseNames(ids: string[]): Promise<Map<string, string>> {
    const map = new Map<string, string>();
    if (ids.length === 0) return map;
    try {
      const res = await query('sets', {
        workout_id: _.in(ids),
      }, { limit: 100 });
      if (res.success) {
        // 按 workout_id 分组去重
        const groupMap = new Map<string, Set<string>>();
        for (const s of res.data) {
          if (!groupMap.has(s.workout_id)) {
            groupMap.set(s.workout_id, new Set());
          }
          groupMap.get(s.workout_id)!.add(s.exercise_name);
        }
        for (const [wid, names] of groupMap) {
          map.set(wid, Array.from(names).join('、'));
        }
      }
    } catch {
      // 获取失败不阻塞
    }
    return map;
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

  viewWorkout(e: WechatMiniprogram.BaseEvent) {
    const { id } = e.currentTarget.dataset;
    if (id) {
      wx.navigateTo({ url: `/pages/workout-detail/index?id=${id}` });
    }
  },
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
