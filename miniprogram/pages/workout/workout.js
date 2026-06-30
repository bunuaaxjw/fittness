// pages/workout/workout.js — 训练页
const app = getApp();
const { add } = require('../../utils/db');
const { formatDate } = require('../../utils/format');

Page({
  data: {
    // 当前训练
    isWorkoutActive: false,
    selectedExercises: [], // [{ exercise_id, name, body_part, sets: [{ weight_kg, reps, notes }] }]

    // 计时器
    elapsedSeconds: 0,
    timerText: '00:00',

    saving: false,
  },

  _timerInterval: null,
  _startTime: null,

  onLoad() {
    // 页面加载时不做数据库查询，点击"开始训练"后才会用到
  },

  onUnload() {
    this.stopTimer();
  },

  // ===== 训练流程 =====
  startWorkout() {
    this._startTime = Date.now();
    this.setData({
      isWorkoutActive: true,
      selectedExercises: [],
      elapsedSeconds: 0,
      timerText: '00:00',
    });
    this.startTimer();
  },

  // 打开动作选择页
  openExercisePicker() {
    wx.navigateTo({
      url: '/pages/exercise-pick/index?mode=pick',
      events: {
        selectExercise: (data) => {
          this.addExercise(data.exercise);
        },
      },
    });
  },

  addExercise(exercise) {
    if (!exercise) return;

    // 避免重复添加同一个动作
    const exists = this.data.selectedExercises.some(
      (e) => e.exercise_id === exercise._id
    );
    if (exists) {
      wx.showToast({ title: '该动作已添加', icon: 'none' });
      return;
    }

    const selectedExercises = [...this.data.selectedExercises];
    selectedExercises.push({
      exercise_id: exercise._id,
      name: exercise.name,
      body_part: exercise.body_part,
      sets: [{ weight_kg: '', reps: '', notes: '' }],
    });

    this.setData({ selectedExercises });
  },

  removeExercise(e) {
    const { index } = e.currentTarget.dataset;
    wx.showModal({
      title: '移除动作',
      content: `确定要移除 ${this.data.selectedExercises[index].name} 吗？`,
      success: (res) => {
        if (res.confirm) {
          const selectedExercises = [...this.data.selectedExercises];
          selectedExercises.splice(index, 1);
          this.setData({ selectedExercises });
        }
      },
    });
  },

  // ===== 组管理 =====
  addSet(e) {
    const exerciseIndex = e.currentTarget.dataset.index;
    const selectedExercises = [...this.data.selectedExercises];
    selectedExercises[exerciseIndex].sets.push({
      weight_kg: '',
      reps: '',
      notes: '',
    });
    this.setData({ selectedExercises });
  },

  removeSet(e) {
    const { exIdx, setIdx } = e.currentTarget.dataset;
    const selectedExercises = [...this.data.selectedExercises];
    if (selectedExercises[exIdx].sets.length <= 1) {
      wx.showToast({ title: '每个动作至少保留一组', icon: 'none' });
      return;
    }
    selectedExercises[exIdx].sets.splice(setIdx, 1);
    this.setData({ selectedExercises });
  },

  updateSetValue(e) {
    const { exIdx, setIdx, field } = e.currentTarget.dataset;
    const { value } = e.detail;
    const key = `selectedExercises[${exIdx}].sets[${setIdx}].${field}`;
    this.setData({ [key]: value });
  },

  // ===== 完成训练 =====
  finishWorkout() {
    if (this.data.selectedExercises.length === 0) {
      wx.showToast({ title: '请至少添加一个动作', icon: 'none' });
      return;
    }

    wx.showModal({
      title: '完成训练',
      content: '确定要结束本次训练吗？',
      success: (res) => {
        if (res.confirm) {
          this.saveWorkout();
        }
      },
    });
  },

  async saveWorkout() {
    this.setData({ saving: true });
    wx.showLoading({ title: '保存中...' });

    const durationMin = Math.round(this.data.elapsedSeconds / 60);

    try {
      // 1. 创建训练记录
      const workoutRes = await add('workouts', {
        date: formatDate(),
        duration_min: durationMin,
        notes: '',
        created_at: new Date(),
      });

      if (!workoutRes.success) {
        throw new Error('创建训练记录失败');
      }

      const workoutId = workoutRes._id;

      // 2. 批量添加组记录
      let setOrder = 0;
      for (const exercise of this.data.selectedExercises) {
        for (const set of exercise.sets) {
          // 跳过空组（重量和次数都为空）
          if (!set.weight_kg && !set.reps) continue;

          const setRes = await add('sets', {
            workout_id: workoutId,
            exercise_id: exercise.exercise_id,
            exercise_name: exercise.name,
            weight_kg: set.weight_kg ? parseFloat(set.weight_kg) : 0,
            reps: set.reps ? parseInt(set.reps) : 0,
            notes: set.notes || '',
            sort_order: setOrder,
          });

          if (!setRes.success) {
            console.warn('组记录保存失败，继续...');
          }
          setOrder++;
        }
      }

      wx.hideLoading();
      wx.showToast({ title: '训练已保存！', icon: 'success' });
      this.resetWorkout();
    } catch (err) {
      wx.hideLoading();
      console.error('保存训练失败:', err);
      wx.showToast({ title: '保存失败，请重试', icon: 'none' });
    } finally {
      this.setData({ saving: false });
    }
  },

  resetWorkout() {
    this.stopTimer();
    this._startTime = null;
    this.setData({
      isWorkoutActive: false,
      selectedExercises: [],
      elapsedSeconds: 0,
      timerText: '00:00',
    });
  },

  // ===== 计时器 =====
  startTimer() {
    this._timerInterval = setInterval(() => {
      if (!this._startTime) return;
      const elapsed = Math.floor((Date.now() - this._startTime) / 1000);
      const min = String(Math.floor(elapsed / 60)).padStart(2, '0');
      const sec = String(elapsed % 60).padStart(2, '0');
      this.setData({
        elapsedSeconds: elapsed,
        timerText: `${min}:${sec}`,
      });
    }, 1000);
  },

  stopTimer() {
    if (this._timerInterval) {
      clearInterval(this._timerInterval);
      this._timerInterval = null;
    }
  },
});
