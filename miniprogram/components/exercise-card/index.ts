// components/exercise-card/index.ts
Component({
  properties: {
    name: { type: String, value: '' },
    bodyPart: { type: String, value: '' },
    icon: { type: String, value: '🏋️' },            // 新增：emoji 兜底
    gifUrl: { type: String, value: '' },             // 新增：GIF CDN 链接
    instructionsZh: { type: String, value: '' },     // 新增：中文说明
    sets: { type: Array, value: [] },
    exerciseIndex: { type: Number, value: 0 },
    showRemove: { type: Boolean, value: false },
  },

  data: {
    gifError: false,   // GIF 加载失败时切回 emoji
    showInstructions: false,  // 展开/收起说明
  },

  methods: {
    onGifError() {
      this.setData({ gifError: true });
    },
    onToggleInstructions() {
      this.setData({ showInstructions: !this.data.showInstructions });
    },
    onAddSet() {
      this.triggerEvent('addset', { index: this.properties.exerciseIndex });
    },
    onRemoveExercise() {
      this.triggerEvent('removeexercise', { index: this.properties.exerciseIndex });
    },
    onSetUpdate(e: any) {
      this.triggerEvent('setupdate', e.detail);
    },
    onSetRemove(e: any) {
      this.triggerEvent('setremove', e.detail);
    },
    onSetToggleComplete(e: any) {
      this.triggerEvent('settogglecomplete', e.detail);
    },
    onSetRestChange(e: any) {
      this.triggerEvent('setrestchange', e.detail);
    },
    onSetDuplicate(e: any) {
      this.triggerEvent('setduplicate', e.detail);
    },
  },
});
