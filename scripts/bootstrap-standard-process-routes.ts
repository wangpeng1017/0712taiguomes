import { prisma } from "../src/lib/db";

type OperationSeed = {
  code: string;
  name: string;
  type: string;
  appliesTo: string;
  workCenter: string;
  description: string;
};

const OPERATION_SEEDS: OperationSeed[] = [
  { code: "OP-DRY", name: "原料干燥", type: "生产", appliesTo: "注塑", workCenter: "原料准备区", description: "注塑原料按工艺要求进行干燥" },
  { code: "OP-INJ", name: "注塑成型", type: "生产", appliesTo: "注塑", workCenter: "注塑车间", description: "注塑机与模具成型" },
  { code: "OP-TRIM", name: "修边", type: "生产", appliesTo: "注塑", workCenter: "后处理区", description: "去除浇口、飞边并进行外观整理" },
  { code: "OP-FEED", name: "卷料上料", type: "生产", appliesTo: "冲压", workCenter: "冲压备料区", description: "卷材上料与送料准备" },
  { code: "OP-STP", name: "冲压成型", type: "生产", appliesTo: "冲压", workCenter: "冲压车间", description: "冲床与冲压模具成型" },
  { code: "OP-DEBURR", name: "去毛刺", type: "生产", appliesTo: "冲压", workCenter: "后处理区", description: "去除冲压毛刺并清理表面" },
  { code: "OP-QC", name: "过程检验", type: "检验", appliesTo: "通用", workCenter: "质量检验区", description: "尺寸与外观过程检验" },
  { code: "OP-PACK", name: "包装入库", type: "包装", appliesTo: "通用", workCenter: "包装区", description: "最终包装并形成可入库批次" },
];

async function main() {
  const operationByCode = new Map<string, { id: string; code: string; name: string; type: string; workCenter: string | null }>();
  for (const seed of OPERATION_SEEDS) {
    const operation = await prisma.operationMaster.upsert({
      where: { code: seed.code },
      update: {},
      create: { ...seed, status: "启用" },
    });
    operationByCode.set(operation.code, operation);
  }

  const skus = await prisma.productSku.findMany({
    where: { status: "启用", type: { in: ["注塑", "冲压"] } },
    orderBy: { code: "asc" },
  });
  let createdRoutes = 0;
  let createdVersions = 0;
  let createdSteps = 0;

  for (const sku of skus) {
    const routeCode = `RT-${sku.code}`;
    const existingRoute = await prisma.processRoute.findUnique({ where: { code: routeCode } });
    const route = existingRoute ?? await prisma.processRoute.create({
      data: { code: routeCode, name: `${sku.name}标准工艺路线`, skuId: sku.id, status: "启用", note: "系统标准工艺初始化" },
    });
    if (!existingRoute) createdRoutes += 1;

    const existingVersion = await prisma.processRouteVersion.findUnique({
      where: { routeId_version: { routeId: route.id, version: "V1.0" } },
    });
    const version = existingVersion ?? await prisma.processRouteVersion.create({
      data: {
        routeId: route.id,
        version: "V1.0",
        status: "已发布",
        effectiveFrom: new Date("2026-07-01T00:00:00+07:00"),
        releasedAt: new Date(),
        releasedBy: "SYSTEM-BOOTSTRAP",
        changeReason: "标准五工序路线初始化",
      },
    });
    if (!existingVersion) createdVersions += 1;

    const existingStepCount = await prisma.routeOperation.count({ where: { routeVersionId: version.id } });
    if (existingStepCount > 0) continue;

    const stepCodes = sku.type === "注塑"
      ? ["OP-DRY", "OP-INJ", "OP-TRIM", "OP-QC", "OP-PACK"]
      : ["OP-FEED", "OP-STP", "OP-DEBURR", "OP-QC", "OP-PACK"];
    for (const [index, code] of stepCodes.entries()) {
      const operation = operationByCode.get(code)!;
      const sequence = (index + 1) * 10;
      const existingStep = await prisma.routeOperation.findUnique({
        where: { routeVersionId_sequence: { routeVersionId: version.id, sequence } },
      });
      if (existingStep) continue;
      const isForming = code === "OP-INJ" || code === "OP-STP";
      const isQuality = code === "OP-QC";
      const isFinal = code === "OP-PACK";
      await prisma.routeOperation.create({
        data: {
          routeVersionId: version.id,
          operationId: operation.id,
          sequence,
          operationCode: operation.code,
          operationName: operation.name,
          operationType: operation.type,
          workCenter: operation.workCenter,
          standardCycleSeconds: isForming ? (sku.type === "注塑" ? 45 : 12) : null,
          setupMinutes: isForming ? 30 : 10,
          reportMode: "按批次",
          requiresEquipment: isForming,
          requiresMold: isForming,
          qualityRequired: isQuality,
          isFinal,
          status: "启用",
          note: "系统标准工艺初始化",
        },
      });
      createdSteps += 1;
    }
  }

  console.log(`标准工艺初始化完成：新增路线 ${createdRoutes}，版本 ${createdVersions}，路线工序 ${createdSteps}`);
}

main().finally(() => prisma.$disconnect());
