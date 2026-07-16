"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { validateBomItems } from "@/lib/bom-workflow";

function required(value: string, label: string) {
  if (!value?.trim()) throw new Error(`${label}不能为空`);
  return value.trim();
}

function optional(value?: string | null) {
  return value?.trim() || null;
}

function optionalDate(value?: string | null, label = "日期") {
  if (!value) return null;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) throw new Error(`${label}格式不正确`);
  return date;
}

function refreshBoms() {
  for (const path of ["/process/boms", "/work-orders", "/master-data/products", "/master-data/materials"]) {
    revalidatePath(path);
  }
}

export async function saveBomMaster(input: {
  id?: string;
  code: string;
  name: string;
  skuId: string;
  status: string;
  note?: string;
}) {
  const skuId = required(input.skuId, "适用产品");
  await prisma.productSku.findUniqueOrThrow({ where: { id: skuId } });
  const data = {
    code: required(input.code, "BOM 编码"),
    name: required(input.name, "BOM 名称"),
    skuId,
    status: input.status === "停用" ? "停用" : "启用",
    note: optional(input.note),
  };

  if (input.id) {
    const current = await prisma.bomMaster.findUniqueOrThrow({
      where: { id: input.id },
      include: { _count: { select: { versions: true } } },
    });
    if (current.skuId !== skuId && current._count.versions > 0) {
      throw new Error("已有版本的 BOM 不可更换适用产品，请新建 BOM");
    }
    await prisma.bomMaster.update({ where: { id: input.id }, data });
  } else await prisma.bomMaster.create({ data });
  refreshBoms();
}

export async function deleteBomMaster(id: string) {
  const bom = await prisma.bomMaster.findUniqueOrThrow({
    where: { id },
    include: { _count: { select: { versions: true } } },
  });
  if (bom._count.versions > 0) throw new Error("该 BOM 已有版本，不可删除，请改为停用");
  await prisma.bomMaster.delete({ where: { id } });
  refreshBoms();
}

export async function saveBomVersion(input: {
  id?: string;
  bomId: string;
  version: string;
  effectiveFrom?: string | null;
  effectiveTo?: string | null;
  changeReason?: string;
}) {
  const effectiveFrom = optionalDate(input.effectiveFrom, "生效日期");
  const effectiveTo = optionalDate(input.effectiveTo, "失效日期");
  if (effectiveFrom && effectiveTo && effectiveTo < effectiveFrom) throw new Error("失效日期不可早于生效日期");
  const data = {
    bomId: required(input.bomId, "BOM"),
    version: required(input.version, "版本号"),
    effectiveFrom,
    effectiveTo,
    changeReason: optional(input.changeReason),
  };

  if (input.id) {
    const current = await prisma.bomVersion.findUniqueOrThrow({ where: { id: input.id } });
    if (current.status !== "草稿") throw new Error("仅草稿版本可以编辑");
    if (current.bomId !== data.bomId) throw new Error("BOM 版本不可转移到其他 BOM");
    await prisma.bomVersion.update({ where: { id: input.id }, data });
  } else {
    await prisma.bomMaster.findUniqueOrThrow({ where: { id: data.bomId } });
    await prisma.bomVersion.create({ data: { ...data, status: "草稿" } });
  }
  refreshBoms();
}

function nextVersionNumber(versions: string[]) {
  const numbers = versions
    .map((value) => Number(value.replace(/^V/i, "")))
    .filter((value) => Number.isFinite(value));
  const next = (numbers.length ? Math.max(...numbers) : 0) + 0.1;
  return `V${next.toFixed(1)}`;
}

export async function copyBomVersion(id: string) {
  await prisma.$transaction(async (tx) => {
    const source = await tx.bomVersion.findUniqueOrThrow({
      where: { id },
      include: {
        bom: { include: { versions: { select: { version: true } } } },
        items: { include: { substitutes: true }, orderBy: [{ operationSequence: "asc" }, { createdAt: "asc" }] },
      },
    });
    const version = nextVersionNumber(source.bom.versions.map((item) => item.version));
    await tx.bomVersion.create({
      data: {
        bomId: source.bomId,
        version,
        status: "草稿",
        changeReason: `复制自 ${source.version}`,
        items: {
          create: source.items.map((item) => ({
            materialId: item.materialId,
            operationSequence: item.operationSequence,
            operationCode: item.operationCode,
            qtyPerBasis: item.qtyPerBasis,
            basisQty: item.basisQty,
            unit: item.unit,
            lossRate: item.lossRate,
            itemType: item.itemType,
            status: item.status,
            note: item.note,
            substitutes: {
              create: item.substitutes.map((substitute) => ({
                materialId: substitute.materialId,
                priority: substitute.priority,
                conversionRate: substitute.conversionRate,
                status: substitute.status,
                effectiveFrom: substitute.effectiveFrom,
                effectiveTo: substitute.effectiveTo,
                reason: substitute.reason,
                note: substitute.note,
              })),
            },
          })),
        },
      },
    });
  });
  refreshBoms();
}

export async function publishBomVersion(id: string, releasedBy: string) {
  await prisma.$transaction(async (tx) => {
    const version = await tx.bomVersion.findUniqueOrThrow({
      where: { id },
      include: { items: true },
    });
    if (version.status !== "草稿") throw new Error("仅草稿版本可以发布");
    if (version.items.length === 0) throw new Error("BOM 版本至少需要配置一条物料明细");
    if (version.items.some((item) => item.status !== "启用")) throw new Error("BOM 包含停用明细，不能发布");
    validateBomItems(version.items);
    const now = new Date();
    await tx.bomVersion.updateMany({
      where: { bomId: version.bomId, status: "已发布", id: { not: version.id } },
      data: { status: "已停用", effectiveTo: now },
    });
    await tx.bomVersion.update({
      where: { id },
      data: {
        status: "已发布",
        effectiveFrom: version.effectiveFrom ?? now,
        effectiveTo: null,
        releasedAt: now,
        releasedBy: required(releasedBy, "发布人"),
      },
    });
    await tx.bomMaster.update({ where: { id: version.bomId }, data: { status: "启用" } });
  });
  refreshBoms();
}

export async function disableBomVersion(id: string) {
  const version = await prisma.bomVersion.findUniqueOrThrow({ where: { id } });
  if (version.status !== "已发布") throw new Error("仅已发布版本可以停用");
  await prisma.bomVersion.update({ where: { id }, data: { status: "已停用", effectiveTo: new Date() } });
  refreshBoms();
}

export async function deleteBomVersion(id: string) {
  const version = await prisma.bomVersion.findUniqueOrThrow({ where: { id } });
  if (version.status !== "草稿") throw new Error("仅草稿版本可以删除");
  try {
    await prisma.$transaction(async (tx) => {
      const items = await tx.bomItem.findMany({ where: { bomVersionId: id }, select: { id: true } });
      await tx.bomSubstitute.deleteMany({ where: { bomItemId: { in: items.map((item) => item.id) } } });
      await tx.bomItem.deleteMany({ where: { bomVersionId: id } });
      await tx.bomVersion.delete({ where: { id } });
    });
  } catch {
    throw new Error("该 BOM 版本已被生产单据引用，不可删除");
  }
  refreshBoms();
}

export async function saveBomItem(input: {
  id?: string;
  bomVersionId: string;
  materialId: string;
  operationSequence?: number | null;
  operationCode?: string;
  qtyPerBasis: number;
  basisQty: number;
  unit: string;
  lossRate: number;
  itemType: string;
  status: string;
  note?: string;
}) {
  if (input.operationSequence != null && (!Number.isInteger(input.operationSequence) || input.operationSequence <= 0)) {
    throw new Error("工序顺序必须是正整数");
  }
  if (!Number.isFinite(input.qtyPerBasis) || input.qtyPerBasis <= 0) throw new Error("基准用量必须大于 0");
  if (!Number.isFinite(input.basisQty) || input.basisQty <= 0) throw new Error("基准产量必须大于 0");
  if (!Number.isFinite(input.lossRate) || input.lossRate < 0 || input.lossRate > 1) throw new Error("损耗率必须在 0% 到 100% 之间");
  const [version, material] = await Promise.all([
    prisma.bomVersion.findUniqueOrThrow({ where: { id: required(input.bomVersionId, "BOM 版本") } }),
    prisma.materialMaster.findUniqueOrThrow({ where: { id: required(input.materialId, "物料") } }),
  ]);
  if (version.status !== "草稿") throw new Error("仅草稿版本可以调整 BOM 明细");
  if (material.status !== "启用") throw new Error("停用物料不可加入 BOM");
  const data = {
    bomVersionId: version.id,
    materialId: material.id,
    operationSequence: input.operationSequence ?? null,
    operationCode: optional(input.operationCode),
    qtyPerBasis: input.qtyPerBasis,
    basisQty: input.basisQty,
    unit: required(input.unit, "单位"),
    lossRate: input.lossRate,
    itemType: required(input.itemType, "明细类型"),
    status: input.status === "停用" ? "停用" : "启用",
    note: optional(input.note),
  };
  if (input.id) await prisma.bomItem.update({ where: { id: input.id }, data });
  else await prisma.bomItem.create({ data });
  refreshBoms();
}

export async function deleteBomItem(id: string) {
  const item = await prisma.bomItem.findUniqueOrThrow({ where: { id }, include: { bomVersion: true } });
  if (item.bomVersion.status !== "草稿") throw new Error("仅草稿版本可以删除 BOM 明细");
  await prisma.$transaction(async (tx) => {
    await tx.bomSubstitute.deleteMany({ where: { bomItemId: id } });
    await tx.bomItem.delete({ where: { id } });
  });
  refreshBoms();
}

export async function saveBomSubstitute(input: {
  id?: string;
  bomItemId: string;
  materialId: string;
  priority: number;
  conversionRate: number;
  status: string;
  effectiveFrom?: string | null;
  effectiveTo?: string | null;
  reason?: string;
  note?: string;
}) {
  if (!Number.isInteger(input.priority) || input.priority <= 0) throw new Error("替代优先级必须是正整数");
  if (!Number.isFinite(input.conversionRate) || input.conversionRate <= 0) throw new Error("换算率必须大于 0");
  const effectiveFrom = optionalDate(input.effectiveFrom, "生效日期");
  const effectiveTo = optionalDate(input.effectiveTo, "失效日期");
  if (effectiveFrom && effectiveTo && effectiveTo < effectiveFrom) throw new Error("失效日期不可早于生效日期");
  const [item, material] = await Promise.all([
    prisma.bomItem.findUniqueOrThrow({ where: { id: required(input.bomItemId, "BOM 明细") }, include: { bomVersion: true } }),
    prisma.materialMaster.findUniqueOrThrow({ where: { id: required(input.materialId, "替代物料") } }),
  ]);
  if (item.bomVersion.status !== "草稿") throw new Error("仅草稿版本可以配置替代料");
  if (item.materialId === material.id) throw new Error("替代物料不能与主物料相同");
  if (material.status !== "启用") throw new Error("停用物料不可设为替代料");
  const data = {
    bomItemId: item.id,
    materialId: material.id,
    priority: input.priority,
    conversionRate: input.conversionRate,
    status: input.status === "停用" ? "停用" : "启用",
    effectiveFrom,
    effectiveTo,
    reason: optional(input.reason),
    note: optional(input.note),
  };
  if (input.id) await prisma.bomSubstitute.update({ where: { id: input.id }, data });
  else await prisma.bomSubstitute.create({ data });
  refreshBoms();
}

export async function deleteBomSubstitute(id: string) {
  const substitute = await prisma.bomSubstitute.findUniqueOrThrow({
    where: { id },
    include: { bomItem: { include: { bomVersion: true } } },
  });
  if (substitute.bomItem.bomVersion.status !== "草稿") throw new Error("仅草稿版本可以删除替代料");
  await prisma.bomSubstitute.delete({ where: { id } });
  refreshBoms();
}
