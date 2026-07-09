/**
 * 统一缓存管理器（单例）
 * 所有 DAL 共享同一缓存实例，确保缓存一致性
 */
class CacheManager {
  private static instance: CacheManager;
  private store: Map<string, { data: any; expireAt: number }>;
  private readonly DEFAULT_TTL = 5 * 60 * 1000; // 5 分钟

  private constructor() {
    this.store = new Map();
  }

  static getInstance(): CacheManager {
    if (!CacheManager.instance) {
      CacheManager.instance = new CacheManager();
    }
    return CacheManager.instance;
  }

  /** 获取缓存，过期返回 null */
  get<T>(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expireAt) {
      this.store.delete(key);
      return null;
    }
    return entry.data as T;
  }

  /** 写入缓存，默认 5 分钟 TTL */
  set<T>(key: string, data: T, ttl?: number): void {
    this.store.set(key, {
      data,
      expireAt: Date.now() + (ttl || this.DEFAULT_TTL),
    });
  }

  /** 是否有效缓存 */
  has(key: string): boolean {
    return this.get(key) !== null;
  }

  /**
   * 清除匹配前缀的缓存
   * @param pattern 前缀字符串，如 "exercises" 清除所有动作缓存，"index" 清除首页缓存
   */
  invalidate(pattern?: string): void {
    if (!pattern) {
      this.store.clear();
      return;
    }
    for (const key of this.store.keys()) {
      if (key.startsWith(pattern)) {
        this.store.delete(key);
      }
    }
  }
}

export { CacheManager };
