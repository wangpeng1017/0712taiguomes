import { prisma } from "@/lib/db";
import { TODAY, MOLD_BLOCKED_STATUS } from "@/lib/constants";
import { evaluateMoldAlert } from "@/lib/production-calc";
import { lastNDays, localDateLabel, localDayRange, formatMonthDay } from "@/lib/date-utils";

export async function getDashboardData() {
  const days = lastNDays(TODAY, 7);
  const rangeStart = localDayRange(days[0]).start;
  const rangeEnd = localDayRange(days[days.length - 1]).end;

  const [batches, molds, pendingWorkOrders] = await Promise.all([
    prisma.productionBatch.findMany({
      where: { startTime: { gte: rangeStart, lte: rangeEnd } },
      include: { defects: { include: { reason: true } }, sku: true, workOrder: true },
      orderBy: { startTime: "asc" },
    }),
    prisma.moldMaster.findMany(),
    prisma.workOrder.findMany({
      where: { status: { in: ["未下达", "已下达"] } },
      include: { sku: true },
      orderBy: { planStart: "asc" },
    }),
  ]);

  const byDay = new Map<string, { good: number; bad: number }>();
  for (const day of days) byDay.set(day, { good: 0, bad: 0 });
  for (const b of batches) {
    const key = localDateLabel(b.startTime);
    const entry = byDay.get(key);
    if (entry) {
      entry.good += b.goodQty;
      entry.bad += b.badQty;
    }
  }

  const volumeTrend = days.map((day) => ({
    label: formatMonthDay(day),
    value: (byDay.get(day)?.good ?? 0) + (byDay.get(day)?.bad ?? 0),
  }));
  const yieldTrend = days.map((day) => {
    const e = byDay.get(day)!;
    const total = e.good + e.bad;
    return { label: formatMonthDay(day), value: total > 0 ? Math.round((e.good / total) * 1000) / 10 : 0 };
  });

  const todayEntry = byDay.get(TODAY) ?? { good: 0, bad: 0 };
  const todayTotal = todayEntry.good + todayEntry.bad;
  const todayYield = todayTotal > 0 ? todayEntry.good / todayTotal : 0;

  const defectByReason = new Map<string, number>();
  for (const b of batches) {
    for (const d of b.defects) {
      defectByReason.set(d.reason.reason, (defectByReason.get(d.reason.reason) ?? 0) + d.qty);
    }
  }
  const defectTop5 = [...defectByReason.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([label, value]) => ({ label, value }));

  const moldAlerts = molds
    .map((m) => ({ mold: m, alert: evaluateMoldAlert(m) }))
    .filter(
      ({ mold, alert }) =>
        alert.dueForMaintenance || alert.overLife || MOLD_BLOCKED_STATUS.includes(mold.status)
    )
    .sort((a, b) => b.alert.lifeRate - a.alert.lifeRate);

  const inProgressWorkOrderCount = await prisma.workOrder.count({ where: { status: "生产中" } });

  return {
    days,
    volumeTrend,
    yieldTrend,
    todayTotal,
    todayYield,
    inProgressWorkOrderCount,
    moldAlertCount: moldAlerts.length,
    defectTop5,
    moldAlerts,
    pendingWorkOrders,
  };
}
