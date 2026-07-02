// cloudfunctions/saveWorkout/index.js — 事务性保存训练记录
const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();

exports.main = async (event, context) => {
  const { mode, date, duration_min, notes, sets, workoutId, oldSetIds } = event;
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;

  console.log(`[saveWorkout] mode=${mode}, openid=${openid}, sets=${(sets || []).length}`);

  const transaction = await db.startTransaction();

  try {
    if (mode === 'create') {
      if (!date || duration_min === undefined) {
        await transaction.rollback();
        return { success: false, error: '参数不完整：缺少 date 或 duration_min' };
      }

      const workoutRes = await transaction.collection('workouts').add({
        data: {
          _openid: openid,
          date,
          duration_min,
          notes: notes || '',
          created_at: db.serverDate(),
        },
      });

      const newWorkoutId = workoutRes._id;

      if (sets && sets.length > 0) {
        for (const set of sets) {
          await transaction.collection('sets').add({
            data: {
              _openid: openid,
              workout_id: newWorkoutId,
              exercise_id: set.exercise_id,
              exercise_name: set.exercise_name,
              weight_kg: set.weight_kg,
              reps: set.reps,
              notes: set.notes || '',
              sort_order: set.sort_order,
            },
          });
        }
      }

      await transaction.commit();
      console.log(`[saveWorkout] 创建成功, workoutId=${newWorkoutId}`);
      return { success: true, workoutId: newWorkoutId, message: '训练已保存' };
    } else if (mode === 'update') {
      if (!workoutId) {
        await transaction.rollback();
        return { success: false, error: '参数不完整：缺少 workoutId' };
      }

      const existingWorkout = await transaction.collection('workouts').doc(workoutId).get();
      if (!existingWorkout.data) {
        await transaction.rollback();
        return { success: false, error: '训练记录不存在' };
      }

      await transaction.collection('workouts').doc(workoutId).update({
        data: { notes: notes || '', duration_min },
      });

      if (oldSetIds && oldSetIds.length > 0) {
        for (const setId of oldSetIds) {
          await transaction.collection('sets').doc(setId).remove();
        }
      }

      if (sets && sets.length > 0) {
        for (const set of sets) {
          await transaction.collection('sets').add({
            data: {
              _openid: openid,
              workout_id: workoutId,
              exercise_id: set.exercise_id,
              exercise_name: set.exercise_name,
              weight_kg: set.weight_kg,
              reps: set.reps,
              notes: set.notes || '',
              sort_order: set.sort_order,
            },
          });
        }
      }

      await transaction.commit();
      console.log(`[saveWorkout] 更新成功, workoutId=${workoutId}`);
      return { success: true, workoutId, message: '训练已更新' };
    } else {
      await transaction.rollback();
      return { success: false, error: `未知模式: ${mode}` };
    }
  } catch (err) {
    console.error('[saveWorkout] 事务失败，执行回滚:', err);
    try {
      await transaction.rollback();
    } catch (rollbackErr) {
      console.error('[saveWorkout] 回滚失败:', rollbackErr);
    }
    return { success: false, error: err.message || '保存失败' };
  }
};
