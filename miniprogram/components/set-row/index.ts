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
    showDelete: { type: Boolean, value: true },
    showMoreMenu: { type: Boolean, value: true },
    minSets: { type: Number, value: 1 },
    currentSetsCount: { type: Number, value: 0 },
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

    onRestChange(e: WechatMiniprogram.BaseEvent) {
      const val = parseInt(e.detail.value) || 0;
      const clamped = Math.max(0, Math.min(300, val));
      this.triggerEvent('restchange', {
        value: clamped,
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
        itemList: ['复制', '删除'],
        success: (res) => {
          if (res.tapIndex === 0) {
            this.triggerEvent('duplicate', {
              setIndex: this.properties.setIndex,
              exIndex: this.properties.exIndex,
            });
          } else if (res.tapIndex === 1) {
            this.triggerEvent('remove', {
              setIndex: this.properties.setIndex,
              exIndex: this.properties.exIndex,
              currentSetsCount: this.properties.currentSetsCount,
            });
          }
        },
      });
    },

    onRemove() {
      this.triggerEvent('remove', {
        setIndex: this.properties.setIndex,
        exIndex: this.properties.exIndex,
        currentSetsCount: this.properties.currentSetsCount,
      });
    },
  },
});
