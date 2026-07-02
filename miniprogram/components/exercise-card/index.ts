// components/exercise-card/index.ts
Component({
  properties: {
    name: { type: String, value: '' },
    bodyPart: { type: String, value: '' },
    sets: { type: Array, value: [] },
    exerciseIndex: { type: Number, value: 0 },
    showRemove: { type: Boolean, value: false },
  },

  methods: {
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
  },
});
