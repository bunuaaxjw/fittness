// pages/history/history.ts — 记录页
import { getWorkouts } from '../../utils/db';
import { formatDateRelative, formatDuration } from '../../utils/format';
import { showError } from '../../utils/error';
import { PAGE_SIZE } from '../../utils/constants';

interface IPageData {
  groupedWorkouts: IGroupedWorkout[];
  loading: boolean;
  hasMore: boolean;
  pageSize: number;
  currentPage: number;
  isEmpty: boolean;
}

Page<IPageData, {}>({
  data: {
    groupedWorkouts: [],
    loading: false,
    hasMore: true,
    pageSize: PAGE_SIZE,
    currentPage: 0,
    isEmpty: false,
  },

  onShow() {
    this.loadWorkouts(true);
  },

  onReachBottom() {
    if (this.data.hasMore && !this.data.loading) {
      this.loadWorkouts(false);
    }
  },

  async loadWorkouts(refresh: boolean) {
    if (refresh) {
      this.setData({ currentPage: 0, groupedWorkouts: [], hasMore: true, isEmpty: false });
    }

    this.setData({ loading: true });

    try {
      const res = await getWorkouts(this.data.currentPage, this.data.pageSize);

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

      const grouped = this.groupByDate(workouts);
      const groupedWorkouts = refresh
        ? grouped
        : this.mergeGroups(this.data.groupedWorkouts, grouped);

      this.setData({
        groupedWorkouts,
        currentPage: this.data.currentPage + 1,
      });
    } catch (err) {
      showError('加载训练记录失败', err);
    } finally {
      this.setData({ loading: false });
    }
  },

  groupByDate(workouts: IWorkout[]): IGroupedWorkout[] {
    const groups = new Map<string, IGroupedWorkout>();
    for (const w of workouts) {
      const date = w.date;
      if (!groups.has(date)) {
        groups.set(date, { date, dateLabel: formatDateRelative(date), workouts: [] });
      }
      const group = groups.get(date)!;
      group.workouts.push({
        ...w,
        durationText: formatDuration(w.duration_min || 0),
      } as IWorkout & { durationText: string });
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
});
