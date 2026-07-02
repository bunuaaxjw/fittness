/**
 * 训练组管理工具 — workout.ts 和 workout-detail 共享
 * 消除两个页面中的重复 addSet/removeSet/updateSetValue/分组逻辑
 */

/**
 * 添加一个空组到指定动作
 * @returns 新的 exercises 数组（不修改原数组）
 */
function addSet<T extends { sets: any[] }>(exercises: T[], exerciseIndex: number): T[] {
  const result = [...exercises];
  const sets = [...result[exerciseIndex].sets, { weight_kg: '', reps: '', notes: '' }];
  result[exerciseIndex] = { ...result[exerciseIndex], sets };
  return result;
}

/**
 * 删除指定位置的一组
 * @returns 新的 exercises 数组；如果该动作只剩一组则返回 null
 */
function removeSet<T extends { sets: any[] }>(exercises: T[], exerciseIndex: number, setIndex: number): T[] | null {
  if (exercises[exerciseIndex].sets.length <= 1) return null;
  const result = [...exercises];
  const sets = [...result[exerciseIndex].sets];
  sets.splice(setIndex, 1);
  result[exerciseIndex] = { ...result[exerciseIndex], sets };
  return result;
}

/**
 * 更新指定组指定字段的值
 * @returns 用于 setData 的 dataKey 和 value
 */
function buildSetUpdatePath<T extends { sets: any[] }>(
  dataPrefix: string,
  exerciseIndex: number,
  setIndex: number,
  field: string,
  value: any
): { key: string; value: any } {
  return {
    key: `${dataPrefix}[${exerciseIndex}].sets[${setIndex}].${field}`,
    value,
  };
}

/**
 * 按 exercise_id 将组记录分组
 * 用于 workout-detail 和 history-detail 加载训练数据时
 */
function groupSetsByExercise(sets: ISetRecord[]): IExerciseWithSets[] {
  const map = new Map<string, IExerciseWithSets>();
  for (const set of sets) {
    const key = set.exercise_id || set.exercise_name;
    if (!map.has(key)) {
      map.set(key, {
        exercise_id: set.exercise_id,
        exercise_name: set.exercise_name,
        icon: '',
        sets: [],
      });
    }
    map.get(key)!.sets.push(set);
  }
  return Array.from(map.values());
}

/**
 * 构建保存用的 sets 数据（过滤空组，转数字类型）
 */
function buildSaveSets(
  exercises: Array<{
    exercise_id: string;
    exercise_name: string;
    sets: Array<{ weight_kg: number | string; reps: number | string; notes: string }>;
  }>
): Array<{
  exercise_id: string;
  exercise_name: string;
  weight_kg: number;
  reps: number;
  notes: string;
  sort_order: number;
}> {
  const sets: Array<{
    exercise_id: string;
    exercise_name: string;
    weight_kg: number;
    reps: number;
    notes: string;
    sort_order: number;
  }> = [];
  let setOrder = 0;

  for (const exercise of exercises) {
    for (const set of exercise.sets) {
      if (!set.weight_kg && !set.reps) continue;
      sets.push({
        exercise_id: exercise.exercise_id,
        exercise_name: exercise.exercise_name,
        weight_kg: parseFloat(String(set.weight_kg)) || 0,
        reps: parseInt(String(set.reps)) || 0,
        notes: set.notes || '',
        sort_order: setOrder++,
      });
    }
  }
  return sets;
}

export { addSet, removeSet, buildSetUpdatePath, groupSetsByExercise, buildSaveSets };
