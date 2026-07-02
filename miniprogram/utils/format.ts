/**
 * 工具函数 — 日期/时间格式化
 */

/**
 * 格式化日期为 'YYYY-MM-DD'
 */
function formatDate(date?: Date | string | number): string {
  const d = date ? new Date(date) : new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * 格式化日期为 'MM月DD日'
 */
function formatDateShort(date: Date | string | number): string {
  const d = new Date(date);
  const month = d.getMonth() + 1;
  const day = d.getDate();
  return `${month}月${day}日`;
}

/**
 * 格式化日期为相对时间描述（今天 / 昨天 / 前天 / MM月DD日）
 */
function formatDateRelative(dateStr: string): string {
  const today = formatDate();
  const yesterday = formatDate(Date.now() - 86400000);
  const twoDaysAgo = formatDate(Date.now() - 172800000);

  if (dateStr === today) return '今天';
  if (dateStr === yesterday) return '昨天';
  if (dateStr === twoDaysAgo) return '前天';
  return formatDateShort(dateStr);
}

/**
 * 格式化分钟数为可读时长
 * @returns '1小时30分钟' | '45分钟'
 */
function formatDuration(minutes: number | null | undefined): string {
  if (!minutes || minutes <= 0) return '0 分钟';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0 && m > 0) return `${h}小时${m}分钟`;
  if (h > 0) return `${h}小时`;
  return `${m}分钟`;
}

/**
 * 格式化秒数为 mm:ss
 */
function formatTimer(seconds: number): string {
  const min = String(Math.floor(seconds / 60)).padStart(2, '0');
  const sec = String(seconds % 60).padStart(2, '0');
  return `${min}:${sec}`;
}

/**
 * 获取本周的日期范围 [周一, 周日]
 */
function getWeekRange(): { start: string; end: string } {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;

  const monday = new Date(now);
  monday.setDate(now.getDate() + mondayOffset);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  return {
    start: formatDate(monday),
    end: formatDate(sunday),
  };
}

export {
  formatDate,
  formatDateShort,
  formatDateRelative,
  formatDuration,
  formatTimer,
  getWeekRange,
};
