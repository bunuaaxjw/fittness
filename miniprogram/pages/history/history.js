// pages/history/history.js — 记录页
const { getWorkouts, getSetsByWorkout } = require('../../utils/db');
const { formatDateRelative, formatDuration } = require('../../utils/format');

Page({
  data: {
    groupedWorkouts: [], // [{ date, dateText, workouts: [...] }]
    loading: false,
    hasMore: true,
    pageSize: 20,
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

  async loadWorkouts(refresh) {
    if (refresh) {
      this.setData({ currentPage: 0, groupedWorkouts: [], hasMore: true, isEmpty: false });
    }

    this.setData({ loading: true });

    try {
      const res = await getWorkouts(this.data.currentPage, this.data.pageSize);

      if (!res.success) {
        wx.showToast({ title: '加载失败', icon: 'none' });
        return;
      }

      const workouts = res.data;

      if (workouts.length < this.data.pageSize) {
        this.setData({ hasMore: false });
      }

      if (refresh && workouts.length === 0) {
        this.setData({ isEmpty: true });
      }

      // 按日期分组
      const grouped = this.groupByDate(workouts);
      const groupedWorkouts = refresh
        ? grouped
        : this.mergeGroups(this.data.groupedWorkouts, grouped);

      this.setData({
        groupedWorkouts,
        currentPage: this.data.currentPage + 1,
      });
    } catch (err) {
      console.error('加载训练记录失败:', err);
    } finally {
      this.setData({ loading: false });
    }
  },

  groupByDate(workouts) {
    const groups = new Map();
    for (const w of workouts) {
      const date = w.date;
      if (!groups.has(date)) {
        groups.set(date, {
          date,
          dateText: formatDateRelative(date),
          workouts: [],
        });
      }
      groups.get(date).workouts.push({
        ...w,
        durationText: formatDuration(w.duration_min || 0),
      });
    }
    return Array.from(groups.values());
  },

  mergeGroups(existing, incoming) {
    const map = new Map();
    for (const g of existing) {
      map.set(g.date, g);
    }
    for (const g of incoming) {
      if (map.has(g.date)) {
        map.get(g.date).workouts.push(...g.workouts);
      } else {
        map.set(g.date, g);
      }
    }
    return Array.from(map.values());
  },

  viewDetail(e) {
    const { id } = e.currentTarget.dataset;
    wx.navigateTo({
      url: `/pages/workout-detail/index?id=${id}`,
    });
  },
});
