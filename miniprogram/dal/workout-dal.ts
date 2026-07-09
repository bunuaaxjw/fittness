/**
 * 训练记录数据访问层
 * 封装 workouts + sets 集合的 CRUD 操作
 */
import { CacheManager } from './cache';
import { showError } from '../utils/error';

/** 懒加载 db 实例（避免模块加载时 wx.cloud 未初始化） */
function db() { return wx.cloud.database(); }
const COLL_WORKOUTS = 'workouts';
const COLL_SETS = 'sets';

class WorkoutDAL {
  private cache: CacheManager;

  constructor() {
    this.cache = CacheManager.getInstance();
  }

  /** 保存训练（workout + sets 事务性写入） */
  async save(data: IWorkoutData): Promise<IDbResult> {
    try {
      // 优先使用云函数事务写入
      const res: ICloudFunctionResult = await wx.cloud.callFunction({
        name: 'saveWorkout',
        data: { mode: 'create', date: data.date, duration_min: data.duration_min, notes: data.notes, sets: data.sets },
      });
      if (res.result.success) {
        this.cache.invalidate('workouts');
        return { success: true };
      }
      return { success: false, error: res.result.error };
    } catch {
      // 云函数不可用，降级为客户端直接写入
      return this.clientSave(data);
    }
  }

  /** 客户端降级保存 */
  private async clientSave(data: IWorkoutData): Promise<IDbResult> {
    try {
      const workoutRes = await db().collection(COLL_WORKOUTS).add({
        data: {
          date: data.date,
          duration_min: data.duration_min,
          notes: data.notes,
          created_at: new Date(),
        },
      });
      const workoutId = workoutRes._id;
      let sortOrder = 0;
      for (const set of data.sets) {
        await db().collection(COLL_SETS).add({
          data: {
            workout_id: workoutId,
            exercise_id: set.exercise_id,
            exercise_name: set.exercise_name,
            weight_kg: set.weight_kg,
            reps: set.reps,
            notes: set.notes,
            sort_order: sortOrder++,
          },
        });
      }
      this.cache.invalidate('workouts');
      return { success: true };
    } catch (err) {
      showError('保存失败，请重试', err);
      return { success: false, error: err };
    }
  }

  /** 更新训练（云函数 update 模式） */
  async update(id: string, data: Partial<IWorkoutData>): Promise<IDbResult> {
    try {
      const res: ICloudFunctionResult = await wx.cloud.callFunction({
        name: 'saveWorkout',
        data: { mode: 'update', workout_id: id, ...data },
      });
      if (res.result.success) {
        this.cache.invalidate('workouts');
        return { success: true };
      }
      return { success: false, error: res.result.error };
    } catch (err) {
      showError('更新失败', err);
      return { success: false, error: err };
    }
  }

  /** 删除训练记录 */
  async delete(id: string): Promise<IDbResult> {
    try {
      await db().collection(COLL_SETS).where({ workout_id: id }).remove();
      await db().collection(COLL_WORKOUTS).doc(id).remove();
      this.cache.invalidate('workouts');
      return { success: true };
    } catch (err) {
      showError('删除失败', err);
      return { success: false, error: err };
    }
  }

  /** 按 ID 获取单条训练（含组数据） */
  async getById(id: string): Promise<IDbResult<IWorkoutData>> {
    try {
      const workout = await db().collection(COLL_WORKOUTS).doc(id).get();
      const sets = await db().collection(COLL_SETS)
        .where({ workout_id: id })
        .orderBy('sort_order', 'asc')
        .get();
      return {
        success: true,
        data: { ...workout.data, sets: sets.data } as IWorkoutData,
      };
    } catch (err) {
      showError('数据加载失败', err);
      return { success: false, error: err };
    }
  }

  /** 游标分页查询训练列表 */
  async list(cursor?: string, pageSize: number = 20): Promise<IDbResult<IWorkoutData[]>> {
    const cacheKey = `workouts:list:${cursor || 'head'}`;
    const cached = this.cache.get<IWorkoutData[]>(cacheKey);
    if (cached) return { success: true, data: cached };

    try {
      const _ = db().command;
      let query = db().collection(COLL_WORKOUTS).orderBy('_id', 'desc').limit(pageSize);
      if (cursor) {
        query = query.where({ _id: _.lt(cursor) });
      }
      const res = await query.get();
      this.cache.set(cacheKey, res.data);
      return { success: true, data: res.data as IWorkoutData[] };
    } catch (err) {
      showError('数据加载失败', err);
      return { success: false, error: err };
    }
  }

  /** 按日期查询训练 */
  async getByDate(date: string): Promise<IDbResult<IWorkoutData[]>> {
    const cacheKey = `workouts:date:${date}`;
    const cached = this.cache.get<IWorkoutData[]>(cacheKey);
    if (cached) return { success: true, data: cached };

    try {
      const res = await db().collection(COLL_WORKOUTS).where({ date }).get();
      this.cache.set(cacheKey, res.data);
      return { success: true, data: res.data as IWorkoutData[] };
    } catch (err) {
      return { success: false, error: err };
    }
  }
}

export { WorkoutDAL };
