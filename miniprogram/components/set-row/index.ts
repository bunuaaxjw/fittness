// components/set-row/index.ts
Component({
  properties: {
    weight: { type: String, value: '' },
    reps: { type: String, value: '' },
    notes: { type: String, value: '' },
    restSeconds: { type: Number, value: 60 },
    completed: { type: Boolean, value: false },
    setIndex: { type: Number, value: 0 },
    exIndex: { type: Number, value: 0 },
    showMoreMenu: { type: Boolean, value: true },
    currentSetsCount: { type: Number, value: 0 },
  },

  data: {
    showNotesModal: false,
    editingNotes: '',
    showRestModal: false,
  },

  methods: {
    onInput(e: WechatMiniprogram.BaseEvent) {
      const { field } = e.currentTarget.dataset;
      this.triggerEvent('update', {
        field,
        value: e.detail.value,
        setIndex: this.properties.setIndex,
        exIndex: this.properties.exIndex,
      });
    },

    onToggleComplete() {
      this.triggerEvent('togglecomplete', {
        setIndex: this.properties.setIndex,
        exIndex: this.properties.exIndex,
      });
    },

    onMore() {
      wx.showActionSheet({
        itemList: ['备注', '休息', '复制', '删除'],
        success: (res) => {
          if (res.tapIndex === 0) {
            // 备注
            this.setData({ showNotesModal: true, editingNotes: this.properties.notes });
          } else if (res.tapIndex === 1) {
            // 休息
            this.setData({ showRestModal: true });
          } else if (res.tapIndex === 2) {
            // 复制
            this.triggerEvent('duplicate', {
              setIndex: this.properties.setIndex,
              exIndex: this.properties.exIndex,
            });
          } else if (res.tapIndex === 3) {
            // 删除
            this.triggerEvent('remove', {
              setIndex: this.properties.setIndex,
              exIndex: this.properties.exIndex,
              currentSetsCount: this.properties.currentSetsCount,
            });
          }
        },
      });
    },

    // ---- 备注弹窗 ----
    onNotesInput(e: WechatMiniprogram.BaseEvent) {
      this.setData({ editingNotes: e.detail.value });
    },

    onNotesConfirm() {
      this.triggerEvent('update', {
        field: 'notes',
        value: this.data.editingNotes,
        setIndex: this.properties.setIndex,
        exIndex: this.properties.exIndex,
      });
      this.setData({ showNotesModal: false });
    },

    onNotesCancel() {
      this.setData({ showNotesModal: false });
    },

    // ---- 休息时间弹窗 ----
    onRestSelect(e: WechatMiniprogram.BaseEvent) {
      const sec = parseInt(e.currentTarget.dataset.seconds);
      this.triggerEvent('restchange', {
        value: sec,
        setIndex: this.properties.setIndex,
        exIndex: this.properties.exIndex,
      });
      this.setData({ showRestModal: false });
    },

    onRestCancel() {
      this.setData({ showRestModal: false });
    },

    /** 格式化秒数为 mm:ss */
    formatRestTime(seconds: number): string {
      const m = String(Math.floor(seconds / 60)).padStart(2, '0');
      const s = String(seconds % 60).padStart(2, '0');
      return `${m}:${s}`;
    },
  },
});
