// cloudfunctions/getProfileStats/index.ts — 聚合查询个人统计
const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const MAX_LIMIT = 100; // CloudBase 单次查询上限

/**
 * 递归获取超过 100 条限制的全部数据
 */
async function fetchAll(collection: string, where: Record<string, any> = {}): Promise<any[]> {
  const countRes = await db.collection(collection).where(where).count();
  const total = countRes.total;
  const results: any[] = [];

  for (let skip = 0; skip < total; skip += MAX_LIMIT) {
    const res = await db.collection(collection)
      .where(where)
      .skip(skip)
      .limit(MAX_LIMIT)
      .get();
    results.push(...res.data);
  }
  return results;
}

exports.main = async () => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;

  try {
    // 并行获取 workouts 和 sets
    const [workouts, sets] = await Promise.all([
      fetchAll('workouts', { _openid: openid }),
      fetchAll('sets', { _openid: openid }),
    ]);

    // 训练统计
    const workoutCount = workouts.length;
    const totalMinutes = workouts.reduce((sum: number, w: any) => sum + (w.duration_min || 0), 0);

    // 训练天数（日期去重）
    const uniqueDates = new Set(workouts.map((w: any) => w.date));
    const trainingDays = uniqueDates.size;

    // 总组数
    const totalSets = sets.length;

    // 常用动作（按 exercise_name 统计频率，取前 8）
    const countMap: Record<string, number> = {};
    for (const s of sets) {
      const name = s.exercise_name;
      if (name) countMap[name] = (countMap[name] || 0) + 1;
    }
    const commonExercises = Object.entries(countMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name, count]) => ({ name, count }));

    return {
      success: true,
      data: {
        workoutCount,
        totalMinutes,
        trainingDays,
        totalSets,
        commonExercises,
      },
    };
  } catch (err: any) {
    console.error('[getProfileStats] 查询失败:', err);
    return { success: false, error: err.message };
  }
};
