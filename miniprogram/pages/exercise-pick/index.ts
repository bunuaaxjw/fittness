// pages/exercise-pick/index.ts — 选择动作页
import { getExercises } from '../../utils/db';
import { showError } from '../../utils/error';
import { BODY_PARTS_WITH_ALL, CATEGORIES_WITH_ALL } from '../../utils/constants';

interface IPageData {
  mode: string;
  exercises: IExercise[];
  filteredExercises: IExercise[];
  recentExercises: IExercise[];  // 最近使用的动作（优先显示）
  loading: boolean;
  bodyParts: string[];
  categories: string[];
  activeBodyPart: string;
  activeCategory: string;
  searchKeyword: string;
  selectedIds: string[];
  recentIds: string[];
}

Page<IPageData, {}>({
  data: {
    mode: 'pick',
    exercises: [],
    filteredExercises: [],
    recentExercises: [],
    loading: true,
    bodyParts: BODY_PARTS_WITH_ALL,
    categories: CATEGORIES_WITH_ALL,
    activeBodyPart: '全部',
    activeCategory: '全部',
    searchKeyword: '',
    selectedIds: [],
    recentIds: [],
  },

  onLoad(options: Record<string, string | undefined>) {
    const { mode, recentIds } = options;
    if (mode) {
      this.setData({ mode });
      const titles: Record<string, string> = { manage: '管理动作' };
      wx.setNavigationBarTitle({ title: titles[mode] || '选择动作' });
    }
    // 解析最近使用的动作 ID
    if (recentIds) {
      this.setData({ recentIds: recentIds.split(',').filter(Boolean) });
    }
    this.loadExercises();
  },

  async loadExercises() {
    this.setData({ loading: true });
    const res = await getExercises();
    if (res.success) {
      this.setData({ exercises: res.data, loading: false }, () => this.filterExercises());
    } else {
      this.setData({ loading: false });
      showError('加载失败');
    }
  },

  // ===== 筛选 =====

  onBodyPartTap(e: WechatMiniprogram.BaseEvent) {
    const { part } = e.currentTarget.dataset;
    if (part === this.data.activeBodyPart) return;
    this.setData({ activeBodyPart: part }, () => this.filterExercises());
  },

  onCategoryTap(e: WechatMiniprogram.BaseEvent) {
    const { category } = e.currentTarget.dataset;
    if (category === this.data.activeCategory) return;
    this.setData({ activeCategory: category }, () => this.filterExercises());
  },

  onSearchInput(e: WechatMiniprogram.BaseEvent) {
    this.setData({ searchKeyword: e.detail.value }, () => this.filterExercises());
  },

  filterExercises() {
    const { exercises, activeBodyPart, activeCategory, searchKeyword, recentIds } = this.data;
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

    // 将最近使用的动作排在前面（仅在 pick 模式且未搜索时）
    if (this.data.mode === 'pick' && !searchKeyword && recentIds.length > 0) {
      const recentSet = new Set(recentIds);
      const recentExercises = filtered.filter((e) => recentSet.has(e._id));
      const restExercises = filtered.filter((e) => !recentSet.has(e._id));
      this.setData({ recentExercises, filteredExercises: restExercises });
    } else {
      this.setData({ recentExercises: [], filteredExercises: filtered });
    }
  },

  // ===== 选择动作（pick 模式） =====

  selectExercise(e: WechatMiniprogram.BaseEvent) {
    const { id } = e.currentTarget.dataset;
    const exercise = this.data.exercises.find((ex) => ex._id === id);
    if (!exercise) return;

    const eventChannel = this.getOpenerEventChannel();
    if (eventChannel) {
      eventChannel.emit('selectExercise', { exercise });
    }
    wx.navigateBack();
  },

  // ===== 管理动作（manage 模式） =====

  toggleSelect(e: WechatMiniprogram.BaseEvent) {
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
