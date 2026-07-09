/**
 * 生成 exercises.ts 脚本
 * 从 exercises-dataset 提取精选运动数据，合并 52 个内置动作
 * 运行: cd fitness-miniprogram && node scripts/generate-exercises.ts
 */
const fs = require('fs');
const path = require('path');

// 读取数据集
const dataset = JSON.parse(fs.readFileSync('/tmp/exercises-dataset/data/exercises.json', 'utf-8'));

// 分类映射
const BODY_PART_MAP = {
  chest: '胸', back: '背', 'upper legs': '腿', 'lower legs': '腿',
  shoulders: '肩', 'upper arms': '手臂', 'lower arms': '手臂',
  waist: '核心', cardio: '全身', neck: '全身',
};

const CATEGORY_MAP = {
  barbell: '自由重量', dumbbell: '自由重量', kettlebell: '自由重量',
  'ez barbell': '自由重量', cable: '器械', 'leverage machine': '器械',
  'smith machine': '器械', 'body weight': '自重', band: '器械',
  'stability ball': '器械', weighted: '器械',
};

const CDN_BASE = 'https://cdn.jsdelivr.net/gh/hasaneyldrm/exercises-dataset@main';

// 52 个内置动作 (从 seed.ts 来)
const BUILTIN = [
  // 胸 (8)
  { name: '杠铃卧推', body_part: '胸', category: '自由重量', is_preset: true, icon: '🏋️', name_en: 'Barbell Bench Press' },
  { name: '哑铃卧推', body_part: '胸', category: '自由重量', is_preset: true, icon: '🏋️', name_en: 'Dumbbell Bench Press' },
  { name: '哑铃飞鸟', body_part: '胸', category: '自由重量', is_preset: true, icon: '🕊️', name_en: 'Dumbbell Fly' },
  { name: '上斜杠铃卧推', body_part: '胸', category: '自由重量', is_preset: true, icon: '🏋️', name_en: 'Incline Barbell Bench Press' },
  { name: '龙门架夹胸', body_part: '胸', category: '器械', is_preset: true, icon: '🔧', name_en: 'Cable Crossover' },
  { name: '坐姿推胸', body_part: '胸', category: '器械', is_preset: true, icon: '🔧', name_en: 'Seated Chest Press' },
  { name: '双杠臂屈伸', body_part: '胸', category: '自重', is_preset: true, icon: '🤸', name_en: 'Parallel Bar Dip' },
  { name: '俯卧撑', body_part: '胸', category: '自重', is_preset: true, icon: '🤸', name_en: 'Push-up' },
  // 背 (7)
  { name: '引体向上', body_part: '背', category: '自重', is_preset: true, icon: '🤸', name_en: 'Pull-up' },
  { name: '杠铃划船', body_part: '背', category: '自由重量', is_preset: true, icon: '🏋️', name_en: 'Barbell Row' },
  { name: '哑铃划船', body_part: '背', category: '自由重量', is_preset: true, icon: '🏋️', name_en: 'Dumbbell Row' },
  { name: '高位下拉', body_part: '背', category: '器械', is_preset: true, icon: '🔧', name_en: 'Lat Pulldown' },
  { name: '坐姿划船', body_part: '背', category: '器械', is_preset: true, icon: '🔧', name_en: 'Seated Cable Row' },
  { name: 'T杆划船', body_part: '背', category: '器械', is_preset: true, icon: '🔧', name_en: 'T-Bar Row' },
  { name: '直臂下压', body_part: '背', category: '器械', is_preset: true, icon: '🔧', name_en: 'Straight Arm Pulldown' },
  // 腿 (8)
  { name: '杠铃深蹲', body_part: '腿', category: '自由重量', is_preset: true, icon: '🏋️', name_en: 'Barbell Squat' },
  { name: '硬拉', body_part: '腿', category: '自由重量', is_preset: true, icon: '🏋️', name_en: 'Deadlift' },
  { name: '腿举', body_part: '腿', category: '器械', is_preset: true, icon: '🔧', name_en: 'Leg Press' },
  { name: '腿弯举', body_part: '腿', category: '器械', is_preset: true, icon: '🔧', name_en: 'Leg Curl' },
  { name: '腿屈伸', body_part: '腿', category: '器械', is_preset: true, icon: '🔧', name_en: 'Leg Extension' },
  { name: '杠铃弓步蹲', body_part: '腿', category: '自由重量', is_preset: true, icon: '🏋️', name_en: 'Barbell Lunge' },
  { name: '保加利亚分腿蹲', body_part: '腿', category: '自由重量', is_preset: true, icon: '🏋️', name_en: 'Bulgarian Split Squat' },
  { name: '高脚杯深蹲', body_part: '腿', category: '自由重量', is_preset: true, icon: '🏋️', name_en: 'Goblet Squat' },
  // 肩 (7)
  { name: '哑铃推举', body_part: '肩', category: '自由重量', is_preset: true, icon: '🏋️', name_en: 'Dumbbell Shoulder Press' },
  { name: '杠铃推举', body_part: '肩', category: '自由重量', is_preset: true, icon: '🏋️', name_en: 'Barbell Shoulder Press' },
  { name: '哑铃侧平举', body_part: '肩', category: '自由重量', is_preset: true, icon: '🏋️', name_en: 'Dumbbell Lateral Raise' },
  { name: '哑铃前平举', body_part: '肩', category: '自由重量', is_preset: true, icon: '🏋️', name_en: 'Dumbbell Front Raise' },
  { name: '俯身飞鸟', body_part: '肩', category: '自由重量', is_preset: true, icon: '🕊️', name_en: 'Bent-Over Reverse Fly' },
  { name: '杠铃提拉', body_part: '肩', category: '自由重量', is_preset: true, icon: '🏋️', name_en: 'Barbell Upright Row' },
  { name: '阿诺德推举', body_part: '肩', category: '自由重量', is_preset: true, icon: '🏋️', name_en: 'Arnold Press' },
  // 手臂 (7)
  { name: '杠铃弯举', body_part: '手臂', category: '自由重量', is_preset: true, icon: '💪', name_en: 'Barbell Curl' },
  { name: '哑铃弯举', body_part: '手臂', category: '自由重量', is_preset: true, icon: '💪', name_en: 'Dumbbell Biceps Curl' },
  { name: '锤式弯举', body_part: '手臂', category: '自由重量', is_preset: true, icon: '💪', name_en: 'Hammer Curl' },
  { name: '绳索下压', body_part: '手臂', category: '器械', is_preset: true, icon: '🔧', name_en: 'Cable Pushdown' },
  { name: '窄距卧推', body_part: '手臂', category: '自由重量', is_preset: true, icon: '🏋️', name_en: 'Close-Grip Bench Press' },
  { name: '仰卧臂屈伸', body_part: '手臂', category: '自由重量', is_preset: true, icon: '🏋️', name_en: 'Lying Triceps Extension' },
  { name: '集中弯举', body_part: '手臂', category: '自由重量', is_preset: true, icon: '💪', name_en: 'Concentration Curl' },
  // 核心 (6)
  { name: '平板支撑', body_part: '核心', category: '自重', is_preset: true, icon: '🧘', name_en: 'Plank' },
  { name: '卷腹', body_part: '核心', category: '自重', is_preset: true, icon: '🧘', name_en: 'Crunch' },
  { name: '仰卧起坐', body_part: '核心', category: '自重', is_preset: true, icon: '🧘', name_en: 'Sit-up' },
  { name: '俄罗斯转体', body_part: '核心', category: '自重', is_preset: true, icon: '🧘', name_en: 'Russian Twist' },
  { name: '悬垂举腿', body_part: '核心', category: '自重', is_preset: true, icon: '🤸', name_en: 'Hanging Leg Raise' },
  { name: '瑜伽球卷腹', body_part: '核心', category: '自重', is_preset: true, icon: '🧘', name_en: 'Stability Ball Crunch' },
  // 全身 + 有氧 (9)
  { name: '波比跳', body_part: '全身', category: '自重', is_preset: true, icon: '🔥', name_en: 'Burpee' },
  { name: '壶铃摇摆', body_part: '全身', category: '自由重量', is_preset: true, icon: '🔔', name_en: 'Kettlebell Swing' },
  { name: '战绳', body_part: '全身', category: '有氧', is_preset: true, icon: '〰️', name_en: 'Battle Rope' },
  { name: '哑铃抓举', body_part: '全身', category: '自由重量', is_preset: true, icon: '🏋️', name_en: 'Dumbbell Snatch' },
  { name: '跑步', body_part: '全身', category: '有氧', is_preset: true, icon: '🏃', name_en: 'Running' },
  { name: '骑行', body_part: '全身', category: '有氧', is_preset: true, icon: '🚴', name_en: 'Cycling' },
  { name: '跳绳', body_part: '全身', category: '有氧', is_preset: true, icon: '🪢', name_en: 'Jump Rope' },
  { name: '划船机', body_part: '全身', category: '有氧', is_preset: true, icon: '🚣', name_en: 'Rowing Machine' },
  { name: '椭圆机', body_part: '全身', category: '有氧', is_preset: true, icon: '🔄', name_en: 'Elliptical' },
];

// 精选扩展动作: 取高频知名动作 + body weight + 其他
// P1: 高频健身房动作 (约 80 个)
const HIGH_FREQ_KEYWORDS = [
  // 胸
  'bench press', 'chest press', 'chest fly', 'pec deck', 'cable crossover', 'push-up',
  'dip', 'incline press', 'decline press', 'chest',
  // 背
  'pull-up', 'chin-up', 'lat pulldown', 'row', 'deadlift', 'pullover',
  'shrug', 'back extension', 'good morning',
  // 腿
  'squat', 'leg press', 'leg curl', 'leg extension', 'lunge', 'step-up',
  'calf raise', 'hip thrust', 'glute bridge', 'romanian deadlift', 'stiff leg',
  // 肩
  'shoulder press', 'lateral raise', 'front raise', 'reverse fly', 'upright row',
  'face pull', 'overhead press', 'arnold press',
  // 手臂
  'curl', 'triceps extension', 'pushdown', 'kickback', 'skull crusher', 'preacher curl',
  'hammer curl', 'concentration curl', 'wrist curl', 'reverse curl',
  // 核心
  'crunch', 'sit-up', 'plank', 'leg raise', 'russian twist', 'ab', 'core', 'oblique',
  // 全身
  'burpee', 'kettlebell swing', 'snatch', 'clean', 'thruster', 'slam', 'sled',
  'tire', 'battle rope', 'mountain climber', 'jumping jack',
];

// 常见器械名称映射
const EQUIPMENT_NAME_MAP: Record<string, string> = {
  barbell: '杠铃', dumbbell: '哑铃', kettlebell: '壶铃', 'ez barbell': '曲杠',
  cable: '龙门架', 'leverage machine': '器械', 'smith machine': '史密斯机',
  'body weight': '自重', band: '弹力带', 'stability ball': '健身球', weighted: '负重',
};

// 身体部位 → 图标映射
const BODY_PART_ICON: Record<string, string> = {
  '胸': '🏋️', '背': '🏋️', '腿': '🏋️', '肩': '🏋️', '手臂': '💪', '核心': '🧘', '全身': '🔥',
};

// 已有动作名集合（避免重复）
const builtinNames = new Set(BUILTIN.map(e => e.name_en?.toLowerCase()));

// 筛选扩展动作
const extended: any[] = [];
const seenNames = new Set<string>();

for (const ex of dataset) {
  const nameEn = ex.name;
  const nameLower = nameEn.toLowerCase();
  const bodyPart = BODY_PART_MAP[ex.category] || '全身';
  const category = CATEGORY_MAP[ex.equipment] || '器械';
  const equipment = EQUIPMENT_NAME_MAP[ex.equipment] || ex.equipment;

  // 跳过已在内置列表中的
  if (builtinNames.has(nameLower)) continue;

  // 检查是否匹配高频关键词
  const isHighFreq = HIGH_FREQ_KEYWORDS.some(kw => nameLower.includes(kw));
  const isBodyWeight = ex.equipment === 'body weight';

  if (!isHighFreq && !isBodyWeight) continue;

  // 避免重复中文名
  if (seenNames.has(nameLower)) continue;
  seenNames.add(nameLower);

  // 去重同名不同变体（取第一个）
  const dupCheck = nameLower.replace(/[\/\-\(\)]/g, '').trim();
  if (seenNames.has(dupCheck + '_dup')) continue;
  seenNames.add(dupCheck + '_dup');

  // 目标肌肉中文翻译
  const targetMap: Record<string, string> = {
    abs: '腹肌', biceps: '肱二头肌', triceps: '肱三头肌', delts: '三角肌',
    glutes: '臀肌', hamstrings: '腘绳肌', quads: '股四头肌', calves: '腓肠肌',
    lats: '背阔肌', traps: '斜方肌', 'pectoralis major': '胸大肌',
    'lower back': '下背', forearms: '前臂', obliques: '腹斜肌',
    adductors: '内收肌', abductors: '外展肌',
  };
  const targetMuscle = targetMap[ex.target] || ex.target;

  extended.push({
    name: nameEn,
    name_en: nameEn,
    body_part: bodyPart,
    category: category,
    equipment: equipment,
    target_muscle: targetMuscle,
    instructions_zh: (ex.instructions?.zh || '') + '\n\n© Gym visual — https://gymvisual.com/',
    gif_url: `${CDN_BASE}/${ex.gif_url}`,
    icon: BODY_PART_ICON[bodyPart] || '🏋️',
    is_preset: true,
    source: 'extended',
  });

  if (extended.length >= 150) break;
}

console.log(`扩展动作数量: ${extended.length}`);

// 生成 TypeScript 文件
function formatExerciseObj(obj: any, indent: string): string {
  const lines: string[] = [];
  lines.push(`${indent}{`);
  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined || value === null) continue;
    if (key === '_id') continue;
    const val = typeof value === 'string' ? JSON.stringify(value) : JSON.stringify(value);
    lines.push(`${indent}  ${key}: ${val},`);
  }
  lines.push(`${indent}}`);
  return lines.join('\n');
}

const tsContent = `/**
 * 健身动作数据
 * - BUILTIN: 52 个原内置动作（source: 'builtin'）
 * - EXTENDED: ${extended.length} 个精选扩展动作（source: 'extended'，来自 exercises-dataset）
 *
 * 数据来源：https://github.com/hasaneyldrm/exercises-dataset
 * GIF 版权：© Gym visual — https://gymvisual.com/
 */

const CDN_BASE = '${CDN_BASE}';

// 分类映射（供 ExerciseDAL 使用）
const BODY_PART_MAP: Record<string, string> = {
  chest: '胸', back: '背', 'upper legs': '腿', 'lower legs': '腿',
  shoulders: '肩', 'upper arms': '手臂', 'lower arms': '手臂',
  waist: '核心', cardio: '全身', neck: '全身',
};

const CATEGORY_MAP: Record<string, string> = {
  barbell: '自由重量', dumbbell: '自由重量', kettlebell: '自由重量',
  'ez barbell': '自由重量', cable: '器械', 'leverage machine': '器械',
  'smith machine': '器械', 'body weight': '自重', band: '器械',
  'stability ball': '器械', weighted: '器械',
};

// 种子数据类型（不含 _id / created_at，这些由数据库生成）
type SeedExercise = Omit<IExerciseExtended, '_id' | 'created_at'>;

const BUILTIN_EXERCISES: SeedExercise[] = [
${BUILTIN.map((e) => formatExerciseObj({ ...e, source: 'builtin' }, '  ')).join(',\n')}
];

const EXTENDED_EXERCISES: SeedExercise[] = [
${extended.map((e) => formatExerciseObj(e, '  ')).join(',\n')}
];

const ALL_EXERCISES: SeedExercise[] = [...BUILTIN_EXERCISES, ...EXTENDED_EXERCISES];

export { BUILTIN_EXERCISES, EXTENDED_EXERCISES, ALL_EXERCISES, CDN_BASE, BODY_PART_MAP, CATEGORY_MAP };
`;

const outputPath = path.join(__dirname, '..', 'miniprogram', 'data', 'exercises.ts');
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, tsContent, 'utf-8');
console.log(`写入 ${outputPath}`);
console.log(`已生成 ${BUILTIN.length} 个内置 + ${extended.length} 个扩展 = ${BUILTIN.length + extended.length} 个动作`);
