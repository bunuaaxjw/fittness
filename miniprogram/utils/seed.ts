/**
 * 52 个预设健身动作数据
 * 客户端首次启动时自动导入（无需云函数）
 */
const PRESET_EXERCISES = [
  // 胸 (8)
  { name: '杠铃卧推', body_part: '胸', category: '自由重量', is_preset: true, icon: '🏋️' },
  { name: '哑铃卧推', body_part: '胸', category: '自由重量', is_preset: true, icon: '🏋️' },
  { name: '哑铃飞鸟', body_part: '胸', category: '自由重量', is_preset: true, icon: '🕊️' },
  { name: '上斜杠铃卧推', body_part: '胸', category: '自由重量', is_preset: true, icon: '🏋️' },
  { name: '龙门架夹胸', body_part: '胸', category: '器械', is_preset: true, icon: '🔧' },
  { name: '坐姿推胸', body_part: '胸', category: '器械', is_preset: true, icon: '🔧' },
  { name: '双杠臂屈伸', body_part: '胸', category: '自重', is_preset: true, icon: '🤸' },
  { name: '俯卧撑', body_part: '胸', category: '自重', is_preset: true, icon: '🤸' },
  // 背 (7)
  { name: '引体向上', body_part: '背', category: '自重', is_preset: true, icon: '🤸' },
  { name: '杠铃划船', body_part: '背', category: '自由重量', is_preset: true, icon: '🏋️' },
  { name: '哑铃划船', body_part: '背', category: '自由重量', is_preset: true, icon: '🏋️' },
  { name: '高位下拉', body_part: '背', category: '器械', is_preset: true, icon: '🔧' },
  { name: '坐姿划船', body_part: '背', category: '器械', is_preset: true, icon: '🔧' },
  { name: 'T杆划船', body_part: '背', category: '器械', is_preset: true, icon: '🔧' },
  { name: '直臂下压', body_part: '背', category: '器械', is_preset: true, icon: '🔧' },
  // 腿 (8)
  { name: '杠铃深蹲', body_part: '腿', category: '自由重量', is_preset: true, icon: '🏋️' },
  { name: '硬拉', body_part: '腿', category: '自由重量', is_preset: true, icon: '🏋️' },
  { name: '腿举', body_part: '腿', category: '器械', is_preset: true, icon: '🔧' },
  { name: '腿弯举', body_part: '腿', category: '器械', is_preset: true, icon: '🔧' },
  { name: '腿屈伸', body_part: '腿', category: '器械', is_preset: true, icon: '🔧' },
  { name: '杠铃弓步蹲', body_part: '腿', category: '自由重量', is_preset: true, icon: '🏋️' },
  { name: '保加利亚分腿蹲', body_part: '腿', category: '自由重量', is_preset: true, icon: '🏋️' },
  { name: '高脚杯深蹲', body_part: '腿', category: '自由重量', is_preset: true, icon: '🏋️' },
  // 肩 (7)
  { name: '哑铃推举', body_part: '肩', category: '自由重量', is_preset: true, icon: '🏋️' },
  { name: '杠铃推举', body_part: '肩', category: '自由重量', is_preset: true, icon: '🏋️' },
  { name: '哑铃侧平举', body_part: '肩', category: '自由重量', is_preset: true, icon: '🏋️' },
  { name: '哑铃前平举', body_part: '肩', category: '自由重量', is_preset: true, icon: '🏋️' },
  { name: '俯身飞鸟', body_part: '肩', category: '自由重量', is_preset: true, icon: '🕊️' },
  { name: '杠铃提拉', body_part: '肩', category: '自由重量', is_preset: true, icon: '🏋️' },
  { name: '阿诺德推举', body_part: '肩', category: '自由重量', is_preset: true, icon: '🏋️' },
  // 手臂 (7)
  { name: '杠铃弯举', body_part: '手臂', category: '自由重量', is_preset: true, icon: '💪' },
  { name: '哑铃弯举', body_part: '手臂', category: '自由重量', is_preset: true, icon: '💪' },
  { name: '锤式弯举', body_part: '手臂', category: '自由重量', is_preset: true, icon: '💪' },
  { name: '绳索下压', body_part: '手臂', category: '器械', is_preset: true, icon: '🔧' },
  { name: '窄距卧推', body_part: '手臂', category: '自由重量', is_preset: true, icon: '🏋️' },
  { name: '仰卧臂屈伸', body_part: '手臂', category: '自由重量', is_preset: true, icon: '🏋️' },
  { name: '集中弯举', body_part: '手臂', category: '自由重量', is_preset: true, icon: '💪' },
  // 核心 (6)
  { name: '平板支撑', body_part: '核心', category: '自重', is_preset: true, icon: '🧘' },
  { name: '卷腹', body_part: '核心', category: '自重', is_preset: true, icon: '🧘' },
  { name: '仰卧起坐', body_part: '核心', category: '自重', is_preset: true, icon: '🧘' },
  { name: '俄罗斯转体', body_part: '核心', category: '自重', is_preset: true, icon: '🧘' },
  { name: '悬垂举腿', body_part: '核心', category: '自重', is_preset: true, icon: '🤸' },
  { name: '瑜伽球卷腹', body_part: '核心', category: '自重', is_preset: true, icon: '🧘' },
  // 全身 + 有氧 (9)
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

export { PRESET_EXERCISES };
