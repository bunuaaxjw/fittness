// cloudfunctions/initDB/index.ts — 初始化动作库（创建集合并导入预设数据）
const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();

interface IPresetExercise {
  name: string;
  body_part: BodyPart;
  category: ExerciseCategory;
  is_preset: boolean;
  icon: string;
}

// 预设健身动作（52 个）
const PRESET_EXERCISES: IPresetExercise[] = [
  // 胸
  { name: '杠铃卧推', body_part: '胸', category: '自由重量', is_preset: true, icon: '🏋️' },
  { name: '哑铃卧推', body_part: '胸', category: '自由重量', is_preset: true, icon: '🏋️' },
  { name: '哑铃飞鸟', body_part: '胸', category: '自由重量', is_preset: true, icon: '🕊️' },
  { name: '上斜杠铃卧推', body_part: '胸', category: '自由重量', is_preset: true, icon: '🏋️' },
  { name: '龙门架夹胸', body_part: '胸', category: '器械', is_preset: true, icon: '🔧' },
  { name: '坐姿推胸', body_part: '胸', category: '器械', is_preset: true, icon: '🔧' },
  { name: '双杠臂屈伸', body_part: '胸', category: '自重', is_preset: true, icon: '🤸' },
  { name: '俯卧撑', body_part: '胸', category: '自重', is_preset: true, icon: '🤸' },

  // 背
  { name: '引体向上', body_part: '背', category: '自重', is_preset: true, icon: '🤸' },
  { name: '杠铃划船', body_part: '背', category: '自由重量', is_preset: true, icon: '🏋️' },
  { name: '哑铃划船', body_part: '背', category: '自由重量', is_preset: true, icon: '🏋️' },
  { name: '高位下拉', body_part: '背', category: '器械', is_preset: true, icon: '🔧' },
  { name: '坐姿划船', body_part: '背', category: '器械', is_preset: true, icon: '🔧' },
  { name: 'T杆划船', body_part: '背', category: '器械', is_preset: true, icon: '🔧' },
  { name: '直臂下压', body_part: '背', category: '器械', is_preset: true, icon: '🔧' },

  // 腿
  { name: '杠铃深蹲', body_part: '腿', category: '自由重量', is_preset: true, icon: '🏋️' },
  { name: '硬拉', body_part: '腿', category: '自由重量', is_preset: true, icon: '🏋️' },
  { name: '腿举', body_part: '腿', category: '器械', is_preset: true, icon: '🔧' },
  { name: '腿弯举', body_part: '腿', category: '器械', is_preset: true, icon: '🔧' },
  { name: '腿屈伸', body_part: '腿', category: '器械', is_preset: true, icon: '🔧' },
  { name: '杠铃弓步蹲', body_part: '腿', category: '自由重量', is_preset: true, icon: '🏋️' },
  { name: '保加利亚分腿蹲', body_part: '腿', category: '自由重量', is_preset: true, icon: '🏋️' },
  { name: '高脚杯深蹲', body_part: '腿', category: '自由重量', is_preset: true, icon: '🏋️' },

  // 肩
  { name: '哑铃推举', body_part: '肩', category: '自由重量', is_preset: true, icon: '🏋️' },
  { name: '杠铃推举', body_part: '肩', category: '自由重量', is_preset: true, icon: '🏋️' },
  { name: '哑铃侧平举', body_part: '肩', category: '自由重量', is_preset: true, icon: '🏋️' },
  { name: '哑铃前平举', body_part: '肩', category: '自由重量', is_preset: true, icon: '🏋️' },
  { name: '俯身飞鸟', body_part: '肩', category: '自由重量', is_preset: true, icon: '🕊️' },
  { name: '杠铃提拉', body_part: '肩', category: '自由重量', is_preset: true, icon: '🏋️' },
  { name: '阿诺德推举', body_part: '肩', category: '自由重量', is_preset: true, icon: '🏋️' },

  // 手臂
  { name: '杠铃弯举', body_part: '手臂', category: '自由重量', is_preset: true, icon: '💪' },
  { name: '哑铃弯举', body_part: '手臂', category: '自由重量', is_preset: true, icon: '💪' },
  { name: '锤式弯举', body_part: '手臂', category: '自由重量', is_preset: true, icon: '💪' },
  { name: '绳索下压', body_part: '手臂', category: '器械', is_preset: true, icon: '🔧' },
  { name: '窄距卧推', body_part: '手臂', category: '自由重量', is_preset: true, icon: '🏋️' },
  { name: '仰卧臂屈伸', body_part: '手臂', category: '自由重量', is_preset: true, icon: '🏋️' },
  { name: '集中弯举', body_part: '手臂', category: '自由重量', is_preset: true, icon: '💪' },

  // 核心
  { name: '平板支撑', body_part: '核心', category: '自重', is_preset: true, icon: '🧘' },
  { name: '卷腹', body_part: '核心', category: '自重', is_preset: true, icon: '🧘' },
  { name: '仰卧起坐', body_part: '核心', category: '自重', is_preset: true, icon: '🧘' },
  { name: '俄罗斯转体', body_part: '核心', category: '自重', is_preset: true, icon: '🧘' },
  { name: '悬垂举腿', body_part: '核心', category: '自重', is_preset: true, icon: '🤸' },
  { name: '瑜伽球卷腹', body_part: '核心', category: '自重', is_preset: true, icon: '🧘' },

  // 全身 + 有氧
  { name: '波比跳', body_part: '全身', category: '自重', is_preset: true, icon: '🔥' },
  { name: '壶铃摇摆', body_part: '全身', category: '自由重量', is_preset: true, icon: '🔔' },
  { name: '战绳', body_part: '全身', category: '有氧', is_preset: true, icon: '〰️' },
  { name: '哑铃抓举', body_part: '全身', category: '自由重量', is_preset: true, icon: '🏋️' },
  { name: '跑步', body_part: '全身', category: '有氧', is_preset: true, icon: '🏃' },
  { name: '骑行', body_part: '全身', category: '有氧', is_preset: true, icon: '🚴' },
  { name: '跳绳', body_part: '全身', category: '有氧', is_preset: true, icon: '🪢' },
  { name: '划船机', body_part: '全身', category: '有氧', is_preset: true, icon: '🚣' },
  { name: '椭圆机', body_part: '全身', category: '有氧', is_preset: true, icon: '🔄' },
];

exports.main = async () => {
  // 步骤1：创建三个集合
  const COLLECTIONS = ['exercises', 'workouts', 'sets'];
  const createdCollections: string[] = [];
  const existedCollections: string[] = [];

  for (const name of COLLECTIONS) {
    try {
      await db.createCollection(name);
      createdCollections.push(name);
      console.log(`✅ 创建集合: ${name}`);
    } catch (err: any) {
      if (err.errCode === -502003) {
        existedCollections.push(name);
        console.log(`⏭️ 集合已存在: ${name}`);
      } else {
        console.error(`❌ 创建集合失败 [${name}]:`, err.message);
      }
    }
  }

  // 步骤2：检查并导入预设动作
  let existingCount = 0;
  try {
    const countRes = await db.collection('exercises')
      .where({ is_preset: true })
      .count();
    existingCount = countRes.total;
  } catch (err: any) {
    console.log('检查预设数据失败（集合可能刚创建）:', err.message);
  }

  if (existingCount > 0) {
    return {
      success: true,
      collections: { created: createdCollections, existed: existedCollections },
      exercises: { existed: existingCount, inserted: 0 },
      message: `集合已就绪，动作库已有 ${existingCount} 个预设动作`,
    };
  }

  // 步骤3：逐个插入预设动作
  let inserted = 0;
  const errors: string[] = [];

  for (const ex of PRESET_EXERCISES) {
    try {
      await db.collection('exercises').add({
        data: { ...ex, created_at: db.serverDate() },
      });
      inserted++;
    } catch (err: any) {
      errors.push(`${ex.name}: ${err.message}`);
    }
  }

  return {
    success: true,
    collections: { created: createdCollections, existed: existedCollections },
    exercises: {
      total: PRESET_EXERCISES.length,
      inserted,
      failed: PRESET_EXERCISES.length - inserted,
    },
    errors: errors.length > 0 ? errors : undefined,
    message: `插入 ${inserted}/${PRESET_EXERCISES.length} 个预设动作`,
  };
};
