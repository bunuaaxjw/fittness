// pages/exercise-pick/index.ts — 选择动作页
import { getExercises } from '../../utils/db';
import { showError } from '../../utils/error';
import { BODY_PARTS_WITH_ALL, CATEGORIES_WITH_ALL } from '../../utils/constants';

interface IPageData {
  mode: string;
  exercises: IExercise[];
  filteredExercises: IExercise[];
  loading: boolean;
  bodyParts: string[];
  categories: string[];
  activeBodyPart: string;
  activeCategory: string;
  searchKeyword: string;
  selectedIds: string[];
}

Page<IPageData, {}>({
  data: {
    mode: 'pick',
    exercises: [],
    filteredExercises: [],
    loading: true,
    bodyParts: BODY_PARTS_WITH_ALL,
    categories: CATEGORIES_WITH_ALL,
    activeBodyPart: '全部',
    activeCategory: '全部',
    searchKeyword: '',
    selectedIds: [],
  },

  onLoad(options: Record<string, string | undefined>) {
    const { mode } = options;
    if (mode) {
      this.setData({ mode });
      const titles: Record<string, string> = { manage: '管理动作' };
      wx.setNavigationBarTitle({ title: titles[mode] || '选择动作' });
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
