"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { OPERATION_APPLIES_TO, OPERATION_REPORT_MODES, OPERATION_TYPES } from "@/lib/constants";


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

function refreshProcess() {
  for (const path of ["/process", "/process/operations", "/process/routes", "/process/versions", "/work-orders"]) {
    revalidatePath(path);
  }
}

export async function saveOperationMaster(input: {
  id?: string;
  code: string;
  name: string;
  type: string;
  appliesTo: string;
  workCenter?: string;
  description?: string;
  status: string;
}) {
  if (!(OPERATION_TYPES as readonly string[]).includes(input.type)) throw new Error("无效的工序类型");
  if (!(OPERATION_APPLIES_TO as readonly string[]).includes(input.appliesTo)) throw new Error("无效的适用工艺");
  const data = {
    code: required(input.code, "工序编码"),
    name: required(input.name, "工序名称"),
    type: input.type,
    appliesTo: input.appliesTo,
    workCenter: optional(input.workCenter),
    description: optional(input.description),
    status: input.status === "停用" ? "停用" : "启用",
  };
  if (input.id) await prisma.operationMaster.update({ where: { id: input.id }, data });
  else await prisma.operationMaster.create({ data });
  refreshProcess();
}

export async function deleteOperationMaster(id: string) {
  const operation = await prisma.operationMaster.findUniqueOrThrow({
    where: { id },
    include: { _count: { select: { routeOperations: true, workOrderOperations: true } } },
  });
  if (operation._count.routeOperations + operation._count.workOrderOperations > 0) {
    throw new Error("该工序已被工艺路线或生产工单引用，请改为停用");
  }
  await prisma.operationMaster.delete({ where: { id } });
  refreshProcess();
}

export async function saveProcessRoute(input: {
  id?: string;
  code: string;
  name: string;
  skuId: string;
  status: string;
  note?: string;
}) {
  await prisma.productSku.findUniqueOrThrow({ where: { id: required(input.skuId, "适用产品") } });
  const data = {
    code: required(input.code, "路线编码"),
    name: required(input.name, "路线名称"),
    skuId: input.skuId,
    status: input.status === "停用" ? "停用" : "启用",
    note: optional(input.note),
  };
  if (input.id) await prisma.processRoute.update({ where: { id: input.id }, data });
  else await prisma.processRoute.create({ data });
  refreshProcess();
}

export async function deleteProcessRoute(id: string) {
  const route = await prisma.processRoute.findUniqueOrThrow({
    where: { id },
    include: { _count: { select: { versions: true } } },
  });
  if (route._count.versions > 0) throw new Error("该路线已有版本，不可删除，请改为停用");
  await prisma.processRoute.delete({ where: { id } });
  refreshProcess();
}

export async function saveProcessRouteVersion(input: {
  id?: string;
  routeId: string;
  version: string;
  effectiveFrom?: string | null;
  effectiveTo?: string | null;
  changeReason?: string;
}) {
  const effectiveFrom = optionalDate(input.effectiveFrom, "生效日期");
  const effectiveTo = optionalDate(input.effectiveTo, "失效日期");
  if (effectiveFrom && effectiveTo && effectiveTo < effectiveFrom) throw new Error("失效日期不可早于生效日期");
  const data = {
    routeId: required(input.routeId, "工艺路线"),
    version: required(input.version, "版本号"),
    effectiveFrom,
    effectiveTo,
    changeReason: optional(input.changeReason),
  };
  if (input.id) {
    const current = await prisma.processRouteVersion.findUniqueOrThrow({ where: { id: input.id } });
    if (current.status !== "草稿") throw new Error("仅草稿版本可以编辑");
    await prisma.processRouteVersion.update({ where: { id: input.id }, data });
  } else {
    await prisma.processRoute.findUniqueOrThrow({ where: { id: data.routeId } });
    await prisma.processRouteVersion.create({ data: { ...data, status: "草稿" } });
  }
  refreshProcess();
}

function nextVersionNumber(versions: string[]) {
  const numbers = versions
    .map((value) => Number(value.replace(/^V/i, "")))
    .filter((value) => Number.isFinite(value));
  const next = (numbers.length ? Math.max(...numbers) : 0) + 0.1;
  return `V${next.toFixed(1)}`;
}

export async function copyProcessRouteVersion(id: string) {
  await prisma.$transaction(async (tx) => {
    const source = await tx.processRouteVersion.findUniqueOrThrow({
      where: { id },
      include: { route: { include: { versions: { select: { version: true } } } }, operations: { orderBy: { sequence: "asc" } } },
    });
    const version = nextVersionNumber(source.route.versions.map((item) => item.version));
    await tx.processRouteVersion.create({
      data: {
        routeId: source.routeId,
        version,
        status: "草稿",
        changeReason: `复制自 ${source.version}`,
        operations: {
          create: source.operations.map((operation) => ({
            operationId: operation.operationId,
            sequence: operation.sequence,
            operationCode: operation.operationCode,
            operationName: operation.operationName,
            operationType: operation.operationType,
            workCenter: operation.workCenter,
            standardCycleSeconds: operation.standardCycleSeconds,
            setupMinutes: operation.setupMinutes,
            reportMode: operation.reportMode,
            requiresEquipment: operation.requiresEquipment,
            requiresMold: operation.requiresMold,
            qualityRequired: operation.qualityRequired,
            isFinal: operation.isFinal,
            status: operation.status,
            note: operation.note,
          })),
        },
      },
    });
  });
  refreshProcess();
}

export async function publishProcessRouteVersion(id: string, releasedBy: string) {
  await prisma.$transaction(async (tx) => {
    const version = await tx.processRouteVersion.findUniqueOrThrow({
      where: { id },
      include: { operations: { orderBy: { sequence: "asc" } } },
    });
    if (version.status !== "草稿" && version.status !== "审核中") throw new Error("仅草稿或审核中版本可以发布");
    if (version.operations.length === 0) throw new Error("路线版本至少需要配置一道工序");
    if (version.operations.filter((item) => item.isFinal).length !== 1) throw new Error("路线版本必须且只能有一道末工序");
    if (version.operations.some((item) => item.status !== "启用")) throw new Error("路线版本包含停用工序，不能发布");
    const finalOperation = version.operations.find((item) => item.isFinal)!;
    if (finalOperation.sequence !== Math.max(...version.operations.map((item) => item.sequence))) throw new Error("末工序必须是路线中顺序号最大的工序");
    const now = new Date();
    await tx.processRouteVersion.updateMany({
      where: { routeId: version.routeId, status: "已发布", id: { not: version.id } },
      data: { status: "已停用", effectiveTo: now },
    });
    await tx.processRouteVersion.update({
      where: { id: version.id },
      data: {
        status: "已发布",
        effectiveFrom: version.effectiveFrom ?? now,
        effectiveTo: null,
        releasedAt: now,
        releasedBy: required(releasedBy, "发布人"),
      },
    });
    await tx.processRoute.update({ where: { id: version.routeId }, data: { status: "启用" } });
  });
  refreshProcess();
}

export async function disableProcessRouteVersion(id: string) {
  const version = await prisma.processRouteVersion.findUniqueOrThrow({ where: { id } });
  if (version.status !== "已发布") throw new Error("仅已发布版本可以停用");
  await prisma.processRouteVersion.update({
    where: { id },
    data: { status: "已停用", effectiveTo: new Date() },
  });
  refreshProcess();
}

export async function deleteProcessRouteVersion(id: string) {
  const version = await prisma.processRouteVersion.findUniqueOrThrow({
    where: { id },
    include: { _count: { select: { workOrders: true, reworkOrders: true } } },
  });
  if (version.status !== "草稿") throw new Error("仅草稿版本可以删除");
  if (version._count.workOrders + version._count.reworkOrders > 0) throw new Error("该版本已被生产单据引用，不可删除");
  await prisma.processRouteVersion.delete({ where: { id } });
  refreshProcess();
}

export async function saveRouteOperation(input: {
  id?: string;
  routeVersionId: string;
  operationId: string;
  sequence: number;
  workCenter?: string;
  standardCycleSeconds?: number | null;
  setupMinutes?: number | null;
  reportMode: string;
  requiresEquipment: boolean;
  requiresMold: boolean;
  qualityRequired: boolean;
  isFinal: boolean;
  status: string;
  note?: string;
}) {
  if (!Number.isInteger(input.sequence) || input.sequence <= 0) throw new Error("工序顺序必须是正整数");
  if (!(OPERATION_REPORT_MODES as readonly string[]).includes(input.reportMode)) throw new Error("无效的报工模式");
  if (input.standardCycleSeconds != null && input.standardCycleSeconds <= 0) throw new Error("标准周期必须大于 0");
  if (input.setupMinutes != null && input.setupMinutes < 0) throw new Error("准备工时不可小于 0");
  const [version, operation] = await Promise.all([
    prisma.processRouteVersion.findUniqueOrThrow({ where: { id: required(input.routeVersionId, "路线版本") } }),
    prisma.operationMaster.findUniqueOrThrow({ where: { id: required(input.operationId, "标准工序") } }),
  ]);
  if (version.status !== "草稿") throw new Error("仅草稿版本可以调整工序配置");
  if (operation.status !== "启用") throw new Error("停用工序不可加入路线");
  const data = {
    routeVersionId: version.id,
    operationId: operation.id,
    sequence: input.sequence,
    operationCode: operation.code,
    operationName: operation.name,
    operationType: operation.type,
    workCenter: optional(input.workCenter) ?? operation.workCenter,
    standardCycleSeconds: input.standardCycleSeconds ?? null,
    setupMinutes: input.setupMinutes ?? null,
    reportMode: input.reportMode,
    requiresEquipment: input.requiresEquipment,
    requiresMold: input.requiresMold,
    qualityRequired: input.qualityRequired,
    isFinal: input.isFinal,
    status: input.status === "停用" ? "停用" : "启用",
    note: optional(input.note),
  };
  if (input.id) await prisma.routeOperation.update({ where: { id: input.id }, data });
  else await prisma.routeOperation.create({ data });
  refreshProcess();
}

export async function deleteRouteOperation(id: string) {
  const item = await prisma.routeOperation.findUniqueOrThrow({
    where: { id },
    include: { routeVersion: true, _count: { select: { workOrderOperations: true } } },
  });
  if (item.routeVersion.status !== "草稿") throw new Error("仅草稿版本可以删除工序配置");
  if (item._count.workOrderOperations > 0) throw new Error("该工序配置已被工单引用，不可删除");
  await prisma.routeOperation.delete({ where: { id } });
  refreshProcess();
}
