/**
 * 全局常量 — 集中管理所有魔法字符串和配置值
 */

// 身体部位枚举
const BODY_PARTS: BodyPart[] = ['胸', '背', '腿', '肩', '手臂', '核心', '全身'];
const BODY_PARTS_WITH_ALL = ['全部', ...BODY_PARTS];

// 训练类别枚举
const CATEGORIES: ExerciseCategory[] = ['自由重量', '器械', '自重', '有氧'];
const CATEGORIES_WITH_ALL = ['全部', ...CATEGORIES];

// 集合名称
const COLLECTIONS = {
  EXERCISES: 'exercises',
  WORKOUTS: 'workouts',
  SETS: 'sets',
} as const;

// 分页配置
const PAGE_SIZE = 20;
const MAX_RECENT_WORKOUTS = 3;

// 首页状态
const TODAY_STATUS = {
  NOT_STARTED: 'not_started' as TodayStatus,
  COMPLETED: 'completed' as TodayStatus,
};

// 模式枚举
const MODE_PICK = 'pick';
const MODE_MANAGE = 'manage';

export {
  BODY_PARTS,
  BODY_PARTS_WITH_ALL,
  CATEGORIES,
  CATEGORIES_WITH_ALL,
  COLLECTIONS,
  PAGE_SIZE,
  MAX_RECENT_WORKOUTS,
  TODAY_STATUS,
  MODE_PICK,
  MODE_MANAGE,
};
