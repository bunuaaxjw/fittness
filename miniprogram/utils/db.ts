/**
 * 云数据库操作封装
 * 统一返回 { success, data?, error? } 格式
 * 内置指数退避重试（最多 2 次）
 */
import { showError } from './error';

const db = wx.cloud.database();
const _ = db.command;

// ===== 集合名称 =====

const COLLECTIONS = {
  EXERCISES: 'exercises',
  WORKOUTS: 'workouts',
  SETS: 'sets',
} as const;

// ===== 重试配置 =====

const RETRY_CONFIG = {
  maxRetries: 1,   // 最多重试 1 次
  baseDelay: 500,  // 基础延迟 500ms
};

/**
 * 指数退避重试包装（跳过超时类错误，重试无意义）
 */
async function withRetry<T>(fn: () => Promise<T>, retries = RETRY_CONFIG.maxRetries): Promise<T> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      // 超时错误不重试——重试只会等更久
      if (err?.errMsg && /timeout|超过|超时/i.test(err.errMsg)) {
        throw err;
      }
      if (attempt === retries) throw err;
      const delay = RETRY_CONFIG.baseDelay * Math.pow(2, attempt);
      console.warn(`[db] 第 ${attempt + 1} 次重试，等待 ${delay}ms...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw new Error('unreachable');
}

// ===== 通用查询 =====

async function query(
  collection: string,
  where: Record<string, any> = {},
  options: IDbQueryOptions = {}
): Promise<IDbResult> {
  try {
    const result = await withRetry(async () => {
      let cmd = db.collection(collection).where(where);
      if (options.orderBy) {
        cmd = cmd.orderBy(options.orderBy.field, options.orderBy.direction || 'desc');
      }
      if (options.limit) {
        cmd = cmd.limit(options.limit);
      }
      if (options.skip) {
        cmd = cmd.skip(options.skip);
      }
      return cmd.get();
    });
    return { success: true, data: result.data };
  } catch (err) {
    showError('数据加载失败，请重试', err);
    return { success: false, error: err };
  }
}

async function getById(collection: string, id: string): Promise<IDbResult> {
  try {
    const result = await withRetry(() => db.collection(collection).doc(id).get());
    return { success: true, data: result.data };
  } catch (err) {
    showError('数据加载失败', err);
    return { success: false, error: err };
  }
}

async function add(collection: string, data: Record<string, any>): Promise<IDbResult> {
  try {
    const result = await withRetry(() => db.collection(collection).add({ data }));
    return { success: true, _id: result._id, data };
  } catch (err) {
    showError('保存失败，请重试', err);
    return { success: false, error: err };
  }
}

async function update(collection: string, id: string, data: Record<string, any>): Promise<IDbResult> {
  try {
    await withRetry(() => db.collection(collection).doc(id).update({ data }));
    return { success: true };
  } catch (err) {
    showError('更新失败，请重试', err);
    return { success: false, error: err };
  }
}

async function remove(collection: string, id: string): Promise<IDbResult> {
  try {
    await withRetry(() => db.collection(collection).doc(id).remove());
    return { success: true };
  } catch (err) {
    showError('删除失败，请重试', err);
    return { success: false, error: err };
  }
}

// ===== 业务查询 =====

async function getExercises(where: Record<string, any> = {}): Promise<IDbResult> {
  return query(COLLECTIONS.EXERCISES, where, {
    orderBy: { field: 'name', direction: 'asc' },
  });
}

async function getWorkouts(page = 0, pageSize = 20): Promise<IDbResult> {
  return query(COLLECTIONS.WORKOUTS, {}, {
    orderBy: { field: 'created_at', direction: 'desc' },
    limit: pageSize,
    skip: page * pageSize,
  });
}

async function getWorkoutsByDate(date: string): Promise<IDbResult> {
  return query(COLLECTIONS.WORKOUTS, { date });
}

async function getSetsByWorkout(workoutId: string): Promise<IDbResult> {
  return query(COLLECTIONS.SETS, { workout_id: workoutId }, {
    orderBy: { field: 'sort_order', direction: 'asc' },
  });
}

export {
  COLLECTIONS,
  _,
  query,
  getById,
  add,
  update,
  remove,
  getExercises,
  getWorkouts,
  getWorkoutsByDate,
  getSetsByWorkout,
};
