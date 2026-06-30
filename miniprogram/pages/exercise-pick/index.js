// pages/exercise-pick/index.js — 选择动作页
const app = getApp();
const { getExercises } = require('../../utils/db');

Page({
  data: {
    mode: 'pick',           // pick = 选择动作 | manage = 管理动作
    exercises: [],          // 全部动作（缓存）
    filteredExercises: [],  // 筛选后的动作
    loading: true,

    bodyParts: ['全部', ...app.globalData.bodyParts],
    categories: ['全部', ...app.globalData.categories],

    // 筛选条件
    activeBodyPart: '全部',
    activeCategory: '全部',
    searchKeyword: '',

    // 管理模式
    selectedIds: [],
  },

  onLoad(options) {
    const { mode } = options;
    if (mode) {
      this.setData({ mode });
      const titles = { manage: '管理动作' };
      wx.setNavigationBarTitle({ title: titles[mode] || '选择动作' });
    }
    this.loadExercises();
  },

  async loadExercises() {
    this.setData({ loading: true });
    const res = await getExercises();
    if (res.success) {
      this.setData({
        exercises: res.data,
        loading: false,
      }, () => this.filterExercises());
    } else {
      this.setData({ loading: false });
      wx.showToast({ title: '加载失败', icon: 'none' });
    }
  },

  // ===== 筛选 =====
  onBodyPartTap(e) {
    const { part } = e.currentTarget.dataset;
    if (part === this.data.activeBodyPart) return;
    this.setData({ activeBodyPart: part }, () => this.filterExercises());
  },

  onCategoryTap(e) {
    const { category } = e.currentTarget.dataset;
    if (category === this.data.activeCategory) return;
    this.setData({ activeCategory: category }, () => this.filterExercises());
  },

  onSearchInput(e) {
    this.setData({ searchKeyword: e.detail.value }, () => this.filterExercises());
  },

  filterExercises() {
    const { exercises, activeBodyPart, activeCategory, searchKeyword } = this.data;
    let filtered = [...exercises];

    if (activeBodyPart !== '全部') {
      filtered = filtered.filter((e) => e.body_part === activeBodyPart);
    }
    if (activeCategory !== '全部') {
      filtered = filtered.filter((e) => e.category === activeCategory);
    }
    if (searchKeyword) {
      const kw = searchKeyword.toLowerCase();
      filtered = filtered.filter((e) => e.name.toLowerCase().includes(kw));
    }

    this.setData({ filteredExercises: filtered });
  },

  // ===== 选择动作（pick 模式） =====
  selectExercise(e) {
    const { id } = e.currentTarget.dataset;
    const exercise = this.data.exercises.find((ex) => ex._id === id);
    if (!exercise) return;

    // 传递结果给上一个页面
    const eventChannel = this.getOpenerEventChannel();
    if (eventChannel) {
      eventChannel.emit('selectExercise', { exercise });
    }
    wx.navigateBack();
  },

  // ===== 管理动作（manage 模式） =====
  toggleSelect(e) {
    const { id } = e.currentTarget.dataset;
    const selectedIds = [...this.data.selectedIds];
    const idx = selectedIds.indexOf(id);
    if (idx > -1) {
      selectedIds.splice(idx, 1);
    } else {
      selectedIds.push(id);
    }
    this.setData({ selectedIds });
  },
});
