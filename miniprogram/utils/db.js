// utils/db.js — 云数据库操作封装
const db = wx.cloud.database();
const _ = db.command;

// ===== 集合名称 =====
const COLLECTIONS = {
  EXERCISES: 'exercises',
  WORKOUTS: 'workouts',
  SETS: 'sets',
};

// ===== 通用查询 =====

/**
 * 查询指定集合
 * @param {string} collection - 集合名
 * @param {object} where - 查询条件
 * @param {object} options - { orderBy, limit, skip }
 */
async function query(collection, where = {}, options = {}) {
  try {
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
    const res = await cmd.get();
    return { success: true, data: res.data };
  } catch (err) {
    console.error(`[db.query] ${collection}:`, err);
    return { success: false, error: err };
  }
}

/**
 * 根据 ID 获取单条记录
 */
async function getById(collection, id) {
  try {
    const res = await db.collection(collection).doc(id).get();
    return { success: true, data: res.data };
  } catch (err) {
    console.error(`[db.getById] ${collection}:`, err);
    return { success: false, error: err };
  }
}

/**
 * 添加记录
 * @returns {{ success: boolean, data?: object, _id?: string, error?: object }}
 */
async function add(collection, data) {
  try {
    const res = await db.collection(collection).add({ data });
    return { success: true, _id: res._id, data };
  } catch (err) {
    console.error(`[db.add] ${collection}:`, err);
    return { success: false, error: err };
  }
}

/**
 * 更新记录
 */
async function update(collection, id, data) {
  try {
    await db.collection(collection).doc(id).update({ data });
    return { success: true };
  } catch (err) {
    console.error(`[db.update] ${collection}:`, err);
    return { success: false, error: err };
  }
}

/**
 * 删除记录
 */
async function remove(collection, id) {
  try {
    await db.collection(collection).doc(id).remove();
    return { success: true };
  } catch (err) {
    console.error(`[db.remove] ${collection}:`, err);
    return { success: false, error: err };
  }
}

// ===== 业务查询 =====

/**
 * 获取动作库
 */
async function getExercises(where = {}) {
  return query(COLLECTIONS.EXERCISES, where, {
    orderBy: { field: 'name', direction: 'asc' },
  });
}

/**
 * 获取训练记录（按日期倒序，分页）
 */
async function getWorkouts(page = 0, pageSize = 20) {
  return query(COLLECTIONS.WORKOUTS, {}, {
    orderBy: { field: 'created_at', direction: 'desc' },
    limit: pageSize,
    skip: page * pageSize,
  });
}

/**
 * 获取某天的训练记录
 */
async function getWorkoutsByDate(date) {
  return query(COLLECTIONS.WORKOUTS, { date });
}

/**
 * 获取指定训练的组记录
 */
async function getSetsByWorkout(workoutId) {
  return query(COLLECTIONS.SETS, { workout_id: workoutId }, {
    orderBy: { field: 'sort_order', direction: 'asc' },
  });
}

module.exports = {
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
