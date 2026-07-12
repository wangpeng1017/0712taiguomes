import { prisma } from "@/lib/db";
import { shiftCode } from "@/lib/constants";

function dateStamp(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}

// 批次号规则：{INJ|STP}-{YYYYMMDD}-{D|N}-{设备编号}-{当日流水号3位}，见 SPEC §4.2。
// 实现只此一处，禁止在其他地方重复拼接（见根 CLAUDE.md）。
export async function generateBatchNo(
  type: "注塑" | "冲压",
  date: Date,
  shift: string,
  equipmentCode: string
): Promise<string> {
  const prefix = type === "注塑" ? "INJ" : "STP";
  const stamp = dateStamp(date);
  const prefixWithoutSeq = `${prefix}-${stamp}-${shiftCode(shift)}-${equipmentCode}-`;

  const existing = await prisma.productionBatch.count({
    where: { batchNo: { startsWith: prefixWithoutSeq } },
  });
  const seq = String(existing + 1).padStart(3, "0");
  return `${prefixWithoutSeq}${seq}`;
}
