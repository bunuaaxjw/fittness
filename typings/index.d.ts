// ===== 数据模型 =====

/** 动作库 */
interface IExercise {
  _id: string;
  name: string;
  body_part: BodyPart;
  category: ExerciseCategory;
  is_preset: boolean;
  icon: string;
  created_at: Date;
}

/** 训练记录 */
interface IWorkout {
  _id: string;
  _openid: string;
  date: string; // YYYY-MM-DD
  duration_min: number;
  notes: string;
  created_at: Date;
}

/** 组记录 */
interface ISetRecord {
  _id?: string;
  workout_id: string;
  exercise_id: string;
  exercise_name: string;
  weight_kg: number;
  reps: number;
  notes: string;
  sort_order: number;
}

// ===== 枚举 =====

type BodyPart = '胸' | '背' | '腿' | '肩' | '手臂' | '核心' | '全身';
type ExerciseCategory = '自由重量' | '器械' | '自重' | '有氧';

// ===== DB 操作结果 =====

interface IDbResult<T = any> {
  success: boolean;
  data?: T;
  error?: any;
  _id?: string;
}

interface IDbQueryOptions {
  orderBy?: {
    field: string;
    direction: 'asc' | 'desc';
  };
  limit?: number;
  skip?: number;
}

// ===== 页面数据类型 =====

/** 训练页 — 一个动作及其组 */
interface ISelectedExercise {
  exercise: IExercise;
  sets: ISetFormData[];
}

/** 组表单数据（未保存时无 _id）。weight_kg/reps 允许空字符串（表单初始状态），保存时转为 number */
interface ISetFormData {
  weight_kg: number | string;
  reps: number | string;
  notes: string;
  rest_seconds: number;    // 组间休息秒数，默认 60
  completed: boolean;      // 是否已完成，默认 false
}

/** 训练详情/历史详情 — 带分组的动作 */
interface IExerciseWithSets {
  exercise_id: string;
  exercise_name: string;
  icon: string;
  body_part?: string;
  sets: ISetRecord[];
}

/** 首页 — 今日训练状态 */
type TodayStatus = 'not_started' | 'completed';

/** 首页 — 周统计 */
interface IWeekStats {
  count: number;
  totalMinutes: number;
}

/** 记录页 — 按日期分组的训练 */
interface IGroupedWorkout {
  date: string;
  dateLabel: string;
  workouts: IWorkout[];
}

// ===== 云函数结果 =====

interface ICloudFunctionResult<T = any> {
  result: T;
  requestID: string;
}

// ===== 微信小程序全局类型扩展 =====

/** 全局 App 实例类型（用于 getApp<IAppOption>()） */
interface IAppOption {
  globalData: {
    userInfo: IUserInfo | null;
    bodyParts: BodyPart[];
    categories: ExerciseCategory[];
    _historyFilter?: string;  // 记录页筛选关键词（跨页面传递）
  };
  loadUserInfo(): void;
}

/** 用户信息（缓存用） */
interface IUserInfo {
  nickName: string;
  avatarUrl: string;
  gender: number;
  country: string;
  province: string;
  city: string;
  language: string;
}

// ===== v0.3.0 重构新增类型 =====

/** 扩展后的动作类型（兼容旧字段，新增可选字段） */
interface IExerciseExtended extends IExercise {
  name_en?: string;          // 英文名，便于搜索
  equipment?: string;        // 器械类型（中文），如"杠铃"
  target_muscle?: string;    // 目标肌肉，如"胸大肌"
  instructions_zh?: string;  // 中文动作说明
  gif_url?: string;          // CDN GIF 链接
  source?: 'builtin' | 'extended';  // 内置 vs 扩展
}

/** 训练保存数据格式 */
interface IWorkoutData {
  _id?: string;
  date: string;
  duration_min: number;
  notes: string;
  created_at?: Date;
  sets: Array<{
    exercise_id: string;
    exercise_name: string;
    weight_kg: number;
    reps: number;
    notes: string;
    sort_order: number;
  }>;
}

/** 动作 + 组数据（训练页状态用） */
interface ExerciseWithSets {
  exercise: IExerciseExtended;
  sets: Array<{ weight_kg: number | string; reps: number | string; notes: string }>;
}

/** 训练页状态数据 */
interface WorkoutStateData {
  exercises: ExerciseWithSets[];
  recentExercises: IExerciseExtended[];
  suggestions: IExerciseExtended[];
  startedAt: number;
}
