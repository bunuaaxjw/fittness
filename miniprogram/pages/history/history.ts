// pages/history/history.ts — 记录页
import { getWorkouts, getWorkoutsCursor, query, remove, _ } from '../../utils/db';
import { formatDateRelative, formatDuration } from '../../utils/format';
import { showError, showSuccess } from '../../utils/error';
import { PAGE_SIZE } from '../../utils/constants';

interface IWorkoutWithMeta extends IWorkout {
  durationText: string;
  setCount: number;
  exerciseNames: string;
}

interface IPageData {
  groupedWorkouts: IGroupedWorkout[];
  loading: boolean;
  hasMore: boolean;
  pageSize: number;
  lastId: string;  // 游标分页
  isEmpty: boolean;
  searchKeyword: string;
}

Page<IPageData, {}>({
  data: {
    groupedWorkouts: [],
    loading: false,
    hasMore: true,
    pageSize: PAGE_SIZE,
    lastId: '',
    isEmpty: false,
    searchKeyword: '',
  },

  onShow() {
    // 检查是否有来自个人页的筛选参数
    const app = getApp<IAppOption>();
    if (app.globalData._historyFilter) {
      this.setData({ searchKeyword: app.globalData._historyFilter });
      delete app.globalData._historyFilter;
    }
    this.loadWorkouts(true);
  },

  onReachBottom() {
    if (this.data.hasMore && !this.data.loading) {
      this.loadWorkouts(false);
    }
  },

  onSearchInput(e: WechatMiniprogram.BaseEvent) {
    this.setData({ searchKeyword: e.detail.value });
    // 重置分页，重新加载
    this.loadWorkouts(true);
  },

  async loadWorkouts(refresh: boolean) {
    if (refresh) {
      this.setData({ lastId: '', groupedWorkouts: [], hasMore: true, isEmpty: false });
    }

    this.setData({ loading: true });

    try {
      const lastId = refresh ? undefined : this.data.lastId || undefined;
      const res = await getWorkoutsCursor(lastId, this.data.pageSize);

      if (!res.success) {
        showError('加载失败');
        return;
      }

      const workouts: IWorkout[] = res.data;

      if (workouts.length < this.data.pageSize) {
        this.setData({ hasMore: false });
      }

      if (refresh && workouts.length === 0) {
        this.setData({ isEmpty: true });
      }

      // 批量查询每条训练的组数和动作名
      const workoutIds = workouts.map((w) => w._id);
      const metaMap = await this.fetchWorkoutMeta(workoutIds);

      const workoutsWithMeta: IWorkoutWithMeta[] = workouts.map((w) => ({
        ...w,
        durationText: formatDuration(w.duration_min || 0),
        setCount: metaMap.get(w._id)?.count || 0,
        exerciseNames: metaMap.get(w._id)?.names || '',
      }));

      const grouped = this.groupByDate(workoutsWithMeta);
      const groupedWorkouts = refresh
        ? grouped
        : this.mergeGroups(this.data.groupedWorkouts, grouped);

      const newLastId = workouts.length > 0 ? workouts[workouts.length - 1]._id : '';

      this.setData({
        groupedWorkouts,
        lastId: newLastId,
      });
    } catch (err) {
      showError('加载训练记录失败', err);
    } finally {
      this.setData({ loading: false });
    }
  },

  /**
   * 批量查询 workout 的组数和动作名
   */
  async fetchWorkoutMeta(ids: string[]): Promise<Map<string, { count: number; names: string }>> {
    const map = new Map<string, { count: number; names: string }>();
    if (ids.length === 0) return map;
    try {
      const res = await query('sets', { workout_id: _.in(ids) }, { limit: 200 });
      if (res.success) {
        // 按 workout_id 分组统计
        const groups = new Map<string, { count: number; names: Set<string> }>();
        for (const s of res.data) {
          if (!groups.has(s.workout_id)) {
            groups.set(s.workout_id, { count: 0, names: new Set() });
          }
          const g = groups.get(s.workout_id)!;
          g.count++;
          g.names.add(s.exercise_name);
        }
        for (const [wid, g] of groups) {
          map.set(wid, { count: g.count, names: Array.from(g.names).join('、') });
        }
      }
    } catch {
      // 失败不阻塞
    }
    return map;
  },

  /**
   * 按搜索关键词过滤（客户端过滤已加载的数据）
   */
  groupByDate(workouts: IWorkoutWithMeta[]): IGroupedWorkout[] {
    const { searchKeyword } = this.data;
    const groups = new Map<string, IGroupedWorkout>();
    for (const w of workouts) {
      // 关键词过滤
      if (searchKeyword) {
        const kw = searchKeyword.toLowerCase();
        if (!w.exerciseNames.toLowerCase().includes(kw)) continue;
      }

      const date = w.date;
      if (!groups.has(date)) {
        groups.set(date, { date, dateLabel: formatDateRelative(date), workouts: [] });
      }
      groups.get(date)!.workouts.push(w);
    }
    return Array.from(groups.values());
  },

  mergeGroups(existing: IGroupedWorkout[], incoming: IGroupedWorkout[]): IGroupedWorkout[] {
    const map = new Map<string, IGroupedWorkout>();
    for (const g of existing) map.set(g.date, g);
    for (const g of incoming) {
      if (map.has(g.date)) {
        map.get(g.date)!.workouts.push(...g.workouts);
      } else {
        map.set(g.date, g);
      }
    }
    return Array.from(map.values());
  },

  viewDetail(e: WechatMiniprogram.BaseEvent) {
    const { id } = e.currentTarget.dataset;
    if (!id) {
      showError('参数错误');
      return;
    }
    wx.navigateTo({ url: `/pages/workout-detail/index?id=${id}` });
  },

  /**
   * 删除训练记录及其所有组
   */
  deleteWorkout(e: WechatMiniprogram.BaseEvent) {
    const { id } = e.currentTarget.dataset;
    if (!id) return;

    wx.showModal({
      title: '确认删除',
      content: '删除后无法恢复，确定要删除这条训练记录吗？',
      confirmColor: '#e94560',
      success: async (res) => {
        if (!res.confirm) return;

        wx.showLoading({ title: '删除中...' });
        try {
          // 先删除关联的 sets
          const setsRes = await query('sets', { workout_id: id }, {});
          if (setsRes.success) {
            for (const set of setsRes.data) {
              if (set._id) await remove('sets', set._id);
            }
          }
          // 再删除 workout
          await remove('workouts', id);

          wx.hideLoading();
          showSuccess('已删除');
          // 重新加载列表
          this.loadWorkouts(true);
        } catch (err) {
          wx.hideLoading();
          showError('删除失败', err);
        }
      },
    });
  },
});
