/**
 * 动作数据访问层
 * 封装 exercises 集合的所有 CRUD 操作 + 缓存 + 种子导入
 */
import { CacheManager } from './cache';
import { ALL_EXERCISES } from '../data/exercises';

/** 懒加载 db 实例（避免模块加载时 wx.cloud 未初始化） */
function db() { return wx.cloud.database(); }
const COLLECTION = 'exercises';
const RECENT_KEY = 'recent_exercise_ids';
const MAX_RECENT = 20;

class ExerciseDAL {
  private cache: CacheManager;

  constructor() {
    this.cache = CacheManager.getInstance();
  }

  /** 获取全部动作（缓存优先） */
  async getAll(): Promise<IDbResult<IExerciseExtended[]>> {
    const cacheKey = 'exercises:all';
    const cached = this.cache.get<IExerciseExtended[]>(cacheKey);
    if (cached) return { success: true, data: cached };

    try {
      const res = await db().collection(COLLECTION)
        .orderBy('name', 'asc')
        .limit(1000)
        .get();
      this.cache.set(cacheKey, res.data);
      return { success: true, data: res.data as IExerciseExtended[] };
    } catch (err) {
      return { success: false, error: err };
    }
  }

  /** 按身体部位筛选 */
  async getByBodyPart(part: string): Promise<IDbResult<IExerciseExtended[]>> {
    const cacheKey = `exercises:body_part:${part}`;
    const cached = this.cache.get<IExerciseExtended[]>(cacheKey);
    if (cached) return { success: true, data: cached };

    try {
      const res = await db().collection(COLLECTION)
        .where({ body_part: part })
        .orderBy('name', 'asc')
        .get();
      this.cache.set(cacheKey, res.data);
      return { success: true, data: res.data as IExerciseExtended[] };
    } catch (err) {
      return { success: false, error: err };
    }
  }

  /** 搜索动作（名称模糊匹配，中英文均可） */
  async search(keyword: string): Promise<IDbResult<IExerciseExtended[]>> {
    const cacheKey = `exercises:search:${keyword}`;
    const cached = this.cache.get<IExerciseExtended[]>(cacheKey);
    if (cached) return { success: true, data: cached };

    try {
      const _ = db().command;
      const regex = db().RegExp({ regexp: keyword, options: 'i' });
      const res = await db().collection(COLLECTION)
        .where(_.or([{ name: regex }, { name_en: regex }]))
        .orderBy('name', 'asc')
        .limit(50)
        .get();
      this.cache.set(cacheKey, res.data);
      return { success: true, data: res.data as IExerciseExtended[] };
    } catch (err) {
      return { success: false, error: err };
    }
  }

  /** 按 ID 列表批量获取 */
  async getByIds(ids: string[]): Promise<IDbResult<IExerciseExtended[]>> {
    if (ids.length === 0) return { success: true, data: [] };
    const cacheKey = `exercises:ids:${ids.sort().join(',')}`;
    const cached = this.cache.get<IExerciseExtended[]>(cacheKey);
    if (cached) return { success: true, data: cached };

    try {
      const _ = db().command;
      const res = await db().collection(COLLECTION)
        .where({ _id: _.in(ids) })
        .get();
      this.cache.set(cacheKey, res.data);
      return { success: true, data: res.data as IExerciseExtended[] };
    } catch (err) {
      return { success: false, error: err };
    }
  }

  /** 获取最近使用的动作（本地存储 + 云数据库查具体数据） */
  async getRecent(limit: number = 10): Promise<IExerciseExtended[]> {
    try {
      const recentIds: string[] = wx.getStorageSync(RECENT_KEY) || [];
      if (recentIds.length === 0) return [];
      const result = await this.getByIds(recentIds.slice(0, limit));
      if (!result.success || !result.data) return [];
      // 按最近使用顺序排序
      const idOrder = new Map(recentIds.map((id, i) => [id, i]));
      return result.data.sort((a, b) => (idOrder.get(a._id) || 99) - (idOrder.get(b._id) || 99));
    } catch {
      return [];
    }
  }

  /** 记录动作使用（更新最近使用列表） */
  recordUsage(exerciseIds: string[]): void {
    try {
      const recentIds: string[] = wx.getStorageSync(RECENT_KEY) || [];
      const newIds = [...exerciseIds, ...recentIds.filter((id) => !exerciseIds.includes(id))];
      wx.setStorageSync(RECENT_KEY, newIds.slice(0, MAX_RECENT));
    } catch { /* 非关键路径 */ }
  }

  /**
   * 首次启动种子导入
   * 检测 exercises 集合是否为空，空则分批写入 ALL_EXERCISES
   */
  async seedIfEmpty(): Promise<void> {
    try {
      const countRes = await db().collection(COLLECTION).count();
      if (countRes.total > 0) return; // 已有数据，跳过
    } catch {
      // 集合可能不存在，继续导入
    }

    const BATCH_SIZE = 50;
    for (let i = 0; i < ALL_EXERCISES.length; i += BATCH_SIZE) {
      const batch = ALL_EXERCISES.slice(i, i + BATCH_SIZE);
      try {
        await Promise.all(
          batch.map((ex) => db().collection(COLLECTION).add({ data: ex })),
        );
      } catch (err) {
        console.warn(`[ExerciseDAL] 种子导入第 ${Math.floor(i / BATCH_SIZE) + 1} 批失败`, err);
      }
    }
    console.log(`[ExerciseDAL] 种子导入完成，共 ${ALL_EXERCISES.length} 个动作`);
  }
}

export { ExerciseDAL };
