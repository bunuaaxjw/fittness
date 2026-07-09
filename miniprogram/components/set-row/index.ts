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
    restTimerText: '01:00',
  },

  observers: {
    'restSeconds': function (sec: number) {
      const m = String(Math.floor(sec / 60)).padStart(2, '0');
      const s = String(sec % 60).padStart(2, '0');
      this.setData({ restTimerText: `${m}:${s}` });
    },
  },

  lifetimes: {
    attached() {
      const sec = this.properties.restSeconds || 60;
      const m = String(Math.floor(sec / 60)).padStart(2, '0');
      const s = String(sec % 60).padStart(2, '0');
      this.setData({ restTimerText: `${m}:${s}` });
    },
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
            this.setData({ showNotesModal: true, editingNotes: this.properties.notes });
          } else if (res.tapIndex === 1) {
            this.setData({ showRestModal: true });
          } else if (res.tapIndex === 2) {
            this.triggerEvent('duplicate', {
              setIndex: this.properties.setIndex,
              exIndex: this.properties.exIndex,
            });
          } else if (res.tapIndex === 3) {
            this.triggerEvent('remove', {
              setIndex: this.properties.setIndex,
              exIndex: this.properties.exIndex,
              currentSetsCount: this.properties.currentSetsCount,
            });
          }
        },
      });
    },

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
  },
});
