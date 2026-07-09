/**
 * 训练页业务逻辑
 * WorkoutState: 不可变状态对象
 * WorkoutService: 业务操作 + 数据协调
 */
import { ExerciseDAL } from '../dal/exercise-dal';
import { WorkoutDAL } from '../dal/workout-dal';
import { formatDate } from '../utils/format';

// ===== WorkoutState =====

class WorkoutState {
  exercises: ExerciseWithSets[];
  recentExercises: IExerciseExtended[];
  suggestions: IExerciseExtended[];
  startedAt: number;

  private constructor(
    exercises: ExerciseWithSets[],
    recent: IExerciseExtended[],
    suggestions: IExerciseExtended[],
    startedAt: number,
  ) {
    this.exercises = exercises;
    this.recentExercises = recent;
    this.suggestions = suggestions;
    this.startedAt = startedAt;
  }

  static create(recent: IExerciseExtended[], suggestions: IExerciseExtended[]): WorkoutState {
    return new WorkoutState([], recent, suggestions, Date.now());
  }

  getExercise(index: number): ExerciseWithSets {
    return this.exercises[index];
  }

  getTotalSets(): number {
    return this.exercises.reduce((sum, ex) =>
      sum + ex.sets.filter((s) => s.weight_kg || s.reps).length, 0,
    );
  }

  isEmpty(): boolean {
    return this.exercises.length === 0;
  }

  /** 切换组的完成状态 */
  toggleSetComplete(exerciseIndex: number, setIndex: number): WorkoutState {
    const exercises = this.cloneExercises();
    const set = exercises[exerciseIndex].sets[setIndex];
    set.completed = !set.completed;
    return new WorkoutState(exercises, this.recentExercises, this.suggestions, this.startedAt);
  }

  /** 更新组的休息秒数 */
  updateSetRest(exerciseIndex: number, setIndex: number, seconds: number): WorkoutState {
    const exercises = this.cloneExercises();
    exercises[exerciseIndex].sets[setIndex].rest_seconds = seconds;
    return new WorkoutState(exercises, this.recentExercises, this.suggestions, this.startedAt);
  }

  /** 复制指定组（在它后面插入副本） */
  duplicateSet(exerciseIndex: number, setIndex: number): WorkoutState {
    const exercises = this.cloneExercises();
    const sets = exercises[exerciseIndex].sets;
    const source = sets[setIndex];
    const copy = { weight_kg: source.weight_kg, reps: source.reps, notes: source.notes, rest_seconds: source.rest_seconds, completed: false };
    sets.splice(setIndex + 1, 0, copy);
    return new WorkoutState(exercises, this.recentExercises, this.suggestions, this.startedAt);
  }

  /** 深拷贝 exercises 数组用于不可变更新 */
  private cloneExercises(): ExerciseWithSets[] {
    return this.exercises.map((ex) => ({
      ...ex,
      sets: ex.sets.map((s) => ({ ...s })),
    }));
  }
}

// ===== WorkoutService =====

class WorkoutService {
  private exerciseDAL: ExerciseDAL;
  private workoutDAL: WorkoutDAL;

  constructor() {
    this.exerciseDAL = new ExerciseDAL();
    this.workoutDAL = new WorkoutDAL();
  }

  /** 初始化训练页：获取最近动作 + 推荐 */
  async initWorkout(recentIds?: string[]): Promise<{
    recentExercises: IExerciseExtended[];
    suggestions: IExerciseExtended[];
  }> {
    // 确保动作库已初始化
    await this.exerciseDAL.seedIfEmpty();

    let recentExercises: IExerciseExtended[] = [];
    if (recentIds && recentIds.length > 0) {
      const res = await this.exerciseDAL.getByIds(recentIds);
      if (res.success && res.data) recentExercises = res.data;
    } else {
      recentExercises = await this.exerciseDAL.getRecent(10);
    }

    // 推荐动作：获取全部后取前 10 个（非最近使用过的）
    const allRes = await this.exerciseDAL.getAll();
    const recentIdSet = new Set(recentExercises.map((e) => e._id));
    const suggestions = (allRes.success && allRes.data)
      ? allRes.data.filter((e) => !recentIdSet.has(e._id)).slice(0, 10)
      : [];

    return { recentExercises, suggestions };
  }

  /** 添加动作 */
  addExercise(state: WorkoutState, exercise: IExerciseExtended): WorkoutState {
    const exists = state.exercises.some((e) => e.exercise._id === exercise._id);
    if (exists) return state;
    const exercises = [
      ...state.cloneExercises(),
      { exercise, sets: [{ weight_kg: '', reps: '', notes: '', rest_seconds: 60, completed: false }] },
    ];
    return new WorkoutState(exercises, state.recentExercises, state.suggestions, state.startedAt);
  }

  /** 移除动作 */
  removeExercise(state: WorkoutState, index: number): WorkoutState {
    const exercises = state.cloneExercises();
    exercises.splice(index, 1);
    return new WorkoutState(exercises, state.recentExercises, state.suggestions, state.startedAt);
  }

  /** 添加组（自动填充上一组数据） */
  addSet(state: WorkoutState, exerciseIndex: number): WorkoutState {
    const exercises = state.cloneExercises();
    const sets = exercises[exerciseIndex].sets;
    const newSet = { weight_kg: '', reps: '', notes: '', rest_seconds: 60, completed: false };
    if (sets.length >= 1) {
      const prev = sets[sets.length - 1];
      newSet.weight_kg = prev.weight_kg;
      newSet.reps = prev.reps;
      newSet.rest_seconds = prev.rest_seconds;
    }
    sets.push(newSet);
    return new WorkoutState(exercises, state.recentExercises, state.suggestions, state.startedAt);
  }

  /** 移除组（至少保留一组，返回 null 表示不可删除） */
  removeSet(state: WorkoutState, exerciseIndex: number, setIndex: number): WorkoutState | null {
    if (state.exercises[exerciseIndex].sets.length <= 1) return null;
    const exercises = state.cloneExercises();
    exercises[exerciseIndex].sets.splice(setIndex, 1);
    return new WorkoutState(exercises, state.recentExercises, state.suggestions, state.startedAt);
  }

  /** 更新组字段 */
  updateSet(state: WorkoutState, exIdx: number, setIdx: number, field: string, value: any): WorkoutState {
    const exercises = state.cloneExercises();
    (exercises[exIdx].sets[setIdx] as any)[field] = value;
    return new WorkoutState(exercises, state.recentExercises, state.suggestions, state.startedAt);
  }

  toggleSetComplete(state: WorkoutState, exIdx: number, setIdx: number): WorkoutState {
    return state.toggleSetComplete(exIdx, setIdx);
  }

  updateSetRest(state: WorkoutState, exIdx: number, setIdx: number, seconds: number): WorkoutState {
    return state.updateSetRest(exIdx, setIdx, seconds);
  }

  duplicateSet(state: WorkoutState, exIdx: number, setIdx: number): WorkoutState {
    return state.duplicateSet(exIdx, setIdx);
  }

  /** 构建保存数据 */
  private buildSaveData(state: WorkoutState, durationMin: number, notes: string): IWorkoutData {
    const sets: IWorkoutData['sets'] = [];
    let sortOrder = 0;
    for (const ex of state.exercises) {
      for (const set of ex.sets) {
        if (!set.weight_kg && !set.reps) continue; // 跳过空组
        sets.push({
          exercise_id: ex.exercise._id,
          exercise_name: ex.exercise.name,
          weight_kg: parseFloat(String(set.weight_kg)) || 0,
          reps: parseInt(String(set.reps)) || 0,
          notes: set.notes || '',
          sort_order: sortOrder++,
        });
      }
    }
    return { date: formatDate(), duration_min: durationMin, notes, sets };
  }

  /** 保存训练 */
  async saveWorkout(state: WorkoutState, durationMin: number, notes: string): Promise<IDbResult> {
    const data = this.buildSaveData(state, durationMin, notes);
    const result = await this.workoutDAL.save(data);
    if (result.success) {
      // 记录动作使用
      const ids = state.exercises.map((ex) => ex.exercise._id);
      this.exerciseDAL.recordUsage(ids);
    }
    return result;
  }
}

export { WorkoutState, WorkoutService };
