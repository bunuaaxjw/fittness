// components/set-row/index.ts
Component({
  properties: {
    weight: { type: String, value: '' },
    reps: { type: String, value: '' },
    notes: { type: String, value: '' },
    setIndex: { type: Number, value: 0 },
    exIndex: { type: Number, value: 0 },
    showDelete: { type: Boolean, value: true },
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

    onRemove() {
      this.triggerEvent('remove', {
        setIndex: this.properties.setIndex,
        exIndex: this.properties.exIndex,
        currentSetsCount: this.properties.currentSetsCount,
      });
    },
  },
});
