"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { EQUIPMENT_STATUS, EQUIPMENT_TYPES, MATERIAL_TYPES, PRODUCT_TYPES } from "@/lib/constants";

function required(value: string, label: string) {
  if (!value?.trim()) throw new Error(`${label}不能为空`);
  return value.trim();
}

function refreshMasterData() {
  for (const path of ["/master-data", "/work-orders", "/injection", "/stamping", "/materials", "/dashboard"]) revalidatePath(path);
}

export async function saveProductSku(input: {
  id?: string; code: string; name: string; type: string; customerCode?: string; internalCode?: string;
  spec?: string; unit: string; stdWeight?: number | null; isSemiFinished: boolean; isFinished: boolean; status: string;
}) {
  if (!(PRODUCT_TYPES as readonly string[]).includes(input.type)) throw new Error("无效的产品类型");
  if (!input.isFinished && !input.isSemiFinished) throw new Error("至少选择半成品或成品中的一种");
  const data = {
    code: required(input.code, "SKU 编码"), name: required(input.name, "SKU 名称"), type: input.type,
    customerCode: input.customerCode?.trim() || null, internalCode: input.internalCode?.trim() || null,
    spec: input.spec?.trim() || null, unit: required(input.unit, "单位"),
    stdWeight: input.stdWeight ?? null, isSemiFinished: input.isSemiFinished, isFinished: input.isFinished,
    status: input.status === "停用" ? "停用" : "启用",
  };
  if (input.id) await prisma.productSku.update({ where: { id: input.id }, data });
  else await prisma.productSku.create({ data });
  refreshMasterData();
}

export async function saveMaterialMaster(input: {
  id?: string; code: string; name: string; type: string; spec?: string; materialGrade?: string; supplier?: string;
  unit: string; shelfLife?: string; status: string; thickness?: number | null; width?: number | null;
  coilWeight?: number | null; surfaceTreatment?: string; color?: string; dryingRequirement?: string;
}) {
  if (!(MATERIAL_TYPES as readonly string[]).includes(input.type)) throw new Error("无效的物料类型");
  const data = {
    code: required(input.code, "物料编码"), name: required(input.name, "物料名称"), type: input.type,
    spec: input.spec?.trim() || null, materialGrade: input.materialGrade?.trim() || null,
    supplier: input.supplier?.trim() || null, unit: required(input.unit, "单位"), shelfLife: input.shelfLife?.trim() || null,
    status: input.status === "停用" ? "停用" : "启用", thickness: input.thickness ?? null, width: input.width ?? null,
    coilWeight: input.coilWeight ?? null, surfaceTreatment: input.surfaceTreatment?.trim() || null,
    color: input.color?.trim() || null, dryingRequirement: input.dryingRequirement?.trim() || null,
  };
  if (input.id) await prisma.materialMaster.update({ where: { id: input.id }, data });
  else await prisma.materialMaster.create({ data });
  refreshMasterData();
}

export async function saveEquipmentMaster(input: {
  id?: string; code: string; name: string; type: string; line?: string; status: string; capacity?: string; note?: string;
}) {
  if (!(EQUIPMENT_TYPES as readonly string[]).includes(input.type)) throw new Error("无效的设备类型");
  if (!(EQUIPMENT_STATUS as readonly string[]).includes(input.status)) throw new Error("无效的设备状态");
  const data = {
    code: required(input.code, "设备编号"), name: required(input.name, "设备名称"), type: input.type,
    line: input.line?.trim() || null, status: input.status, capacity: input.capacity?.trim() || null, note: input.note?.trim() || null,
  };
  if (input.id) await prisma.equipmentMaster.update({ where: { id: input.id }, data });
  else await prisma.equipmentMaster.create({ data });
  refreshMasterData();
}

export async function saveDefectReason(input: { id?: string; reason: string; appliesTo: string; status: string }) {
  if (!["注塑", "冲压", "通用"].includes(input.appliesTo)) throw new Error("无效的适用工艺");
  const data = { reason: required(input.reason, "不良原因"), appliesTo: input.appliesTo, status: input.status === "停用" ? "停用" : "启用" };
  if (input.id) await prisma.defectReason.update({ where: { id: input.id }, data });
  else await prisma.defectReason.create({ data });
  refreshMasterData();
}

export async function deleteMasterData(kind: "sku" | "material" | "equipment" | "defect", id: string) {
  if (kind === "sku") {
    const row = await prisma.productSku.findUniqueOrThrow({ where: { id }, include: { _count: { select: { workOrders: true, batches: true, molds: true } } } });
    if (row._count.workOrders + row._count.batches + row._count.molds > 0) throw new Error("该 SKU 已被工单、批次或模具引用，请改为停用");
    await prisma.productSku.delete({ where: { id } });
  } else if (kind === "material") {
    const row = await prisma.materialMaster.findUniqueOrThrow({ where: { id }, include: { _count: { select: { lots: true } } } });
    if (row._count.lots > 0) throw new Error("该物料已有批次记录，请改为停用");
    await prisma.materialMaster.delete({ where: { id } });
  } else if (kind === "equipment") {
    const row = await prisma.equipmentMaster.findUniqueOrThrow({ where: { id }, include: { _count: { select: { workOrders: true, batches: true, molds: true, materialIssues: true } } } });
    if (Object.values(row._count).some((count) => count > 0)) throw new Error("该设备已有业务引用，请改为停用");
    await prisma.equipmentMaster.delete({ where: { id } });
  } else {
    const row = await prisma.defectReason.findUniqueOrThrow({ where: { id }, include: { _count: { select: { defects: true } } } });
    if (row._count.defects > 0) throw new Error("该原因已有不良记录引用，请改为停用");
    await prisma.defectReason.delete({ where: { id } });
  }
  refreshMasterData();
}
