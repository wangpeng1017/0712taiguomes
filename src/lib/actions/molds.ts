"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { MAINT_TYPES, MOLD_STATUS, MOLD_TYPES } from "@/lib/constants";

export async function registerMoldMaintenance(input: {
  moldId: string;
  maintType: string;
  startTime: string;
  endTime: string;
  person: string;
  content?: string;
  replacedParts?: string;
  result?: string;
  canContinue: boolean;
}) {
  const mold = await prisma.moldMaster.findUniqueOrThrow({ where: { id: input.moldId } });
  if (!(MAINT_TYPES as readonly string[]).includes(input.maintType)) throw new Error("无效的保养类型");
  if (!input.person.trim()) throw new Error("保养人员不能为空");
  const startTime = new Date(input.startTime);
  const endTime = new Date(input.endTime);
  if (!Number.isFinite(startTime.getTime()) || !Number.isFinite(endTime.getTime()) || endTime < startTime) throw new Error("保养结束时间不可早于开始时间");

  await prisma.$transaction([
    prisma.moldMaintenanceRecord.create({
      data: {
        moldId: input.moldId,
        maintType: input.maintType,
        startTime,
        endTime,
        person: input.person.trim(),
        content: input.content,
        replacedParts: input.replacedParts,
        result: input.result,
        canContinue: input.canContinue,
      },
    }),
    prisma.moldMaster.update({
      where: { id: input.moldId },
      data: input.canContinue
        ? { status: "可用", lastMaintDate: endTime, lastMaintCount: mold.currentCount }
        : { status: "维修中" },
    }),
  ]);

  revalidatePath("/molds");
  revalidatePath("/injection");
  revalidatePath("/stamping");
  revalidatePath("/dashboard");
  revalidatePath("/work-orders");
}

export async function saveMold(input: {
  id?: string; code: string; name: string; type: string; applicableSkuId?: string; applicableEquipmentId?: string;
  designLife: number; currentCount?: number; maintCycle: number; warnThreshold: number; status: string; cavityCount?: number | null; note?: string;
}) {
  if (!(MOLD_TYPES as readonly string[]).includes(input.type)) throw new Error("无效的模具类型");
  if (!(MOLD_STATUS as readonly string[]).includes(input.status)) throw new Error("无效的模具状态");
  if (!input.code.trim() || !input.name.trim()) throw new Error("模具编号和名称不能为空");
  if (!Number.isInteger(input.designLife) || input.designLife <= 0) throw new Error("设计寿命必须是正整数");
  if (!Number.isInteger(input.maintCycle) || input.maintCycle <= 0) throw new Error("保养周期必须是正整数");
  if (input.warnThreshold <= 0 || input.warnThreshold > 1) throw new Error("预警阈值必须在 0 到 1 之间");
  const [sku, equipment] = await Promise.all([
    input.applicableSkuId ? prisma.productSku.findUniqueOrThrow({ where: { id: input.applicableSkuId } }) : null,
    input.applicableEquipmentId ? prisma.equipmentMaster.findUniqueOrThrow({ where: { id: input.applicableEquipmentId } }) : null,
  ]);
  const productType = input.type === "注塑模" ? "注塑" : "冲压";
  const equipmentType = input.type === "注塑模" ? "注塑机" : "冲床";
  if (sku && sku.type !== productType) throw new Error("适用产品类型与模具类型不匹配");
  if (equipment && equipment.type !== equipmentType) throw new Error("适用设备类型与模具类型不匹配");
  const data = {
    code: input.code.trim(), name: input.name.trim(), type: input.type,
    applicableSkuId: input.applicableSkuId || null, applicableEquipmentId: input.applicableEquipmentId || null,
    designLife: input.designLife, maintCycle: input.maintCycle, warnThreshold: input.warnThreshold,
    status: input.status, cavityCount: input.cavityCount ?? null, note: input.note?.trim() || null,
    ...(input.id ? {} : { currentCount: input.currentCount ?? 0 }),
  };
  if (input.id) await prisma.moldMaster.update({ where: { id: input.id }, data });
  else await prisma.moldMaster.create({ data });
  for (const path of ["/molds", "/master-data", "/work-orders", "/injection", "/stamping", "/dashboard"]) revalidatePath(path);
}

export async function deleteMold(id: string) {
  const mold = await prisma.moldMaster.findUniqueOrThrow({
    where: { id }, include: { _count: { select: { workOrders: true, batches: true, maintenance: true } } },
  });
  if (Object.values(mold._count).some((count) => count > 0)) throw new Error("该模具已有工单、生产或保养记录，不可删除，请改为停用或报废");
  await prisma.moldMaster.delete({ where: { id } });
  revalidatePath("/molds");
  revalidatePath("/work-orders");
}

export async function deleteMoldMaintenance(id: string) {
  const record = await prisma.moldMaintenanceRecord.findUniqueOrThrow({ where: { id } });
  await prisma.moldMaintenanceRecord.delete({ where: { id } });
  const latest = await prisma.moldMaintenanceRecord.findFirst({ where: { moldId: record.moldId }, orderBy: { endTime: "desc" } });
  await prisma.moldMaster.update({
    where: { id: record.moldId },
    data: { lastMaintDate: latest?.endTime ?? null, lastMaintCount: latest ? undefined : 0 },
  });
  revalidatePath("/molds");
  revalidatePath("/trace");
}

export async function updateMoldMaintenance(id: string, input: {
  maintType: string; person: string; content?: string; replacedParts?: string; result?: string; canContinue: boolean;
}) {
  if (!(MAINT_TYPES as readonly string[]).includes(input.maintType)) throw new Error("无效的保养类型");
  if (!input.person.trim()) throw new Error("保养人员不能为空");
  const record = await prisma.moldMaintenanceRecord.update({
    where: { id },
    data: {
      maintType: input.maintType, person: input.person.trim(), content: input.content?.trim() || null,
      replacedParts: input.replacedParts?.trim() || null, result: input.result?.trim() || null, canContinue: input.canContinue,
    },
  });
  await prisma.moldMaster.update({ where: { id: record.moldId }, data: { status: input.canContinue ? "可用" : "维修中" } });
  for (const path of ["/molds", "/injection", "/stamping", "/trace", "/dashboard"]) revalidatePath(path);
}
