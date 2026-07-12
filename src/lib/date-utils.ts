// 泰国工厂本地时区固定 +07:00（demo 不做时区配置，见 SPEC §14 时间格式建议）。
// 所有"按天分组"一律走这里的函数，禁止直接用 Date#toISOString().slice(0,10)（会因 UTC 换算错位）。

const LOCAL_OFFSET_MS = 7 * 60 * 60 * 1000;

export function addDaysToDateStr(dateStr: string, delta: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + delta);
  return dt.toISOString().slice(0, 10);
}

export function lastNDays(endDateStr: string, n: number): string[] {
  return Array.from({ length: n }, (_, i) => addDaysToDateStr(endDateStr, i - (n - 1)));
}

// 给定一个真实时间点，返回它所属的曼谷本地日期（YYYY-MM-DD）
export function localDateLabel(date: Date): string {
  return new Date(date.getTime() + LOCAL_OFFSET_MS).toISOString().slice(0, 10);
}

// 给定本地日期字符串，返回该日在曼谷时区的 [00:00, 23:59:59.999] 真实时间范围
export function localDayRange(dateStr: string): { start: Date; end: Date } {
  return {
    start: new Date(`${dateStr}T00:00:00+07:00`),
    end: new Date(`${dateStr}T23:59:59.999+07:00`),
  };
}

export function formatMonthDay(dateStr: string): string {
  const [, m, d] = dateStr.split("-");
  return `${m}/${d}`;
}
