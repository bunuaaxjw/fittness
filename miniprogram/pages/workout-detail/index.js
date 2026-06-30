// pages/workout-detail/index.js — 训练详情/编辑页
const { getById, getSetsByWorkout, update, remove, add } = require('../../utils/db');
const { formatDate, formatDuration } = require('../../utils/format');

Page({
  data: {
    workoutId: null,
    workout: null,               // 训练记录
    exercises: [],               // 按动作分组的 set 数据
    durationText: '',
    notes: '',
    isEdit: false,
    saving: false,
  },

  onLoad(options) {
    const { id } = options;
    if (id) {
      this.setData({ workoutId: id });
      this.loadWorkout(id);
    } else {
      // 没有 id 无法查看详情
      wx.showToast({ title: '参数错误', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 1500);
    }
  },

  async loadWorkout(id) {
    wx.showLoading({ title: '加载中...' });

    try {
      // 并行加载训练记录和组记录
      const [workoutRes, setsRes] = await Promise.all([
        getById('workouts', id),
        getSetsByWorkout(id),
      ]);

      if (!workoutRes.success || !workoutRes.data) {
        wx.hideLoading();
        wx.showToast({ title: '训练记录不存在', icon: 'none' });
        setTimeout(() => wx.navigateBack(), 1500);
        return;
      }

      const workout = workoutRes.data;
      const sets = setsRes.success ? setsRes.data : [];

      // 按 exercise_id 分组
      const exerciseMap = {};
      for (const set of sets) {
        const key = set.exercise_id || set.exercise_name;
        if (!exerciseMap[key]) {
          exerciseMap[key] = {
            exercise_id: set.exercise_id,
            name: set.exercise_name,
            sets: [],
          };
        }
        exerciseMap[key].sets.push({
          weight_kg: set.weight_kg,
          reps: set.reps,
          notes: set.notes || '',
        });
      }

      this.setData({
        workout,
        exercises: Object.values(exerciseMap),
        durationText: formatDuration(workout.duration_min),
        notes: workout.notes || '',
      });
    } catch (err) {
      console.error('加载训练详情失败:', err);
      wx.showToast({ title: '加载失败', icon: 'none' });
    } finally {
      wx.hideLoading();
    }
  },

  // ===== 编辑模式切换 =====
  toggleEdit() {
    const isEdit = !this.data.isEdit;
    this.setData({ isEdit });
    if (isEdit) {
      wx.setNavigationBarTitle({ title: '编辑训练' });
    } else {
      wx.setNavigationBarTitle({ title: '训练详情' });
      // 取消编辑时恢复数据
      this.loadWorkout(this.data.workoutId);
    }
  },

  onNotesInput(e) {
    this.setData({ notes: e.detail.value });
  },

  // ===== 组管理（编辑模式） =====
  addSet(e) {
    const exerciseIndex = e.currentTarget.dataset.index;
    const exercises = [...this.data.exercises];
    exercises[exerciseIndex].sets.push({
      weight_kg: '',
      reps: '',
      notes: '',
    });
    this.setData({ exercises });
  },

  removeSet(e) {
    const { exIdx, setIdx } = e.currentTarget.dataset;
    const exercises = [...this.data.exercises];
    if (exercises[exIdx].sets.length <= 1) {
      wx.showToast({ title: '每个动作至少保留一组', icon: 'none' });
      return;
    }
    exercises[exIdx].sets.splice(setIdx, 1);
    this.setData({ exercises });
  },

  updateSetValue(e) {
    const { exIdx, setIdx, field } = e.currentTarget.dataset;
    const { value } = e.detail;
    const key = `exercises[${exIdx}].sets[${setIdx}].${field}`;
    this.setData({ [key]: value });
  },

  // ===== 保存 =====
  async saveWorkout() {
    this.setData({ saving: true });
    wx.showLoading({ title: '保存中...' });

    try {
      // 更新训练记录
      await update('workouts', this.data.workoutId, {
        notes: this.data.notes,
      });

      // 删除旧组记录
      const oldSets = await getSetsByWorkout(this.data.workoutId);
      if (oldSets.success) {
        for (const set of oldSets.data) {
          await remove('sets', set._id);
        }
      }

      // 重新插入组记录
      let setOrder = 0;
      for (const exercise of this.data.exercises) {
        for (const set of exercise.sets) {
          if (!set.weight_kg && !set.reps) continue;
          await add('sets', {
            workout_id: this.data.workoutId,
            exercise_id: exercise.exercise_id,
            exercise_name: exercise.name,
            weight_kg: set.weight_kg ? parseFloat(set.weight_kg) : 0,
            reps: set.reps ? parseInt(set.reps) : 0,
            notes: set.notes || '',
            sort_order: setOrder,
          });
          setOrder++;
        }
      }

      wx.hideLoading();
      wx.showToast({ title: '已保存', icon: 'success' });
      this.setData({ isEdit: false, saving: false });
      wx.setNavigationBarTitle({ title: '训练详情' });
    } catch (err) {
      wx.hideLoading();
      console.error('保存失败:', err);
      wx.showToast({ title: '保存失败', icon: 'none' });
      this.setData({ saving: false });
    }
  },
});
