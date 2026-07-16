import { PrismaClient } from "@prisma/client";
import {
  totalQty,
  thisMoldCount as calcThisMoldCount,
} from "../src/lib/production-calc";
import { INJECTION_DEFECT_REASONS, STAMPING_DEFECT_REASONS } from "../src/lib/constants";
import { generateBatchNo } from "../src/lib/batch-no";

const prisma = new PrismaClient();

// 演示锚点日期，须与 src/lib/constants.ts 的 TODAY 保持一致。
const D10 = new Date("2026-07-10T00:00:00+07:00");
const D11 = new Date("2026-07-11T00:00:00+07:00");
const D12 = new Date("2026-07-12T00:00:00+07:00");
const D13 = new Date("2026-07-13T00:00:00+07:00");
const D14 = new Date("2026-07-14T00:00:00+07:00");
const D15 = new Date("2026-07-15T00:00:00+07:00");
const D16 = new Date("2026-07-16T00:00:00+07:00");

function at(day: Date, hh: number, mm: number): Date {
  const d = new Date(day);
  d.setHours(hh, mm, 0, 0);
  return d;
}

async function main() {
  // 依赖顺序倒序清空，保证可重复执行 `npx tsx prisma/seed.ts`
  await prisma.operationQualityResult.deleteMany();
  await prisma.batchGenealogy.deleteMany();
  await prisma.batchMaterialConsumption.deleteMany();
  await prisma.reworkOrder.deleteMany();
  await prisma.stockInRecord.deleteMany();
  await prisma.defectRecord.deleteMany();
  await prisma.materialReturn.deleteMany();
  await prisma.materialIssue.deleteMany();
  await prisma.productionBatch.deleteMany();
  await prisma.moldMaintenanceRecord.deleteMany();
  await prisma.workOrderOperation.deleteMany();
  await prisma.workOrder.deleteMany();
  await prisma.routeOperation.deleteMany();
  await prisma.processRouteVersion.deleteMany();
  await prisma.processRoute.deleteMany();
  await prisma.operationMaster.deleteMany();
  await prisma.materialLot.deleteMany();
  await prisma.moldMaster.deleteMany();
  await prisma.defectReason.deleteMany();
  await prisma.equipmentMaster.deleteMany();
  await prisma.materialMaster.deleteMany();
  await prisma.productSku.deleteMany();

  // ---------- 产品 SKU ----------
  const skuInj1 = await prisma.productSku.create({
    data: {
      code: "INJ-CN-001", name: "ECU外壳上盖", type: "注塑",
      customerCode: "ABC-2201-U", internalCode: "NJ-1001",
      spec: "PA66+GF30 / 黑色", unit: "PCS", stdWeight: 42.5,
      isSemiFinished: true, isFinished: false,
    },
  });
  const skuInj2 = await prisma.productSku.create({
    data: {
      code: "INJ-CN-002", name: "传感器支架", type: "注塑",
      customerCode: "ABC-3305-S", internalCode: "NJ-1002",
      spec: "PBT / 本色", unit: "PCS", stdWeight: 18.2,
      isSemiFinished: false, isFinished: true,
    },
  });
  const skuInj3 = await prisma.productSku.create({
    data: {
      code: "INJ-CN-003", name: "连接器护套", type: "注塑",
      customerCode: "ABC-4410-C", internalCode: "NJ-1003",
      spec: "PA6 / 黑色 / 4穴模", unit: "PCS", stdWeight: 8.7,
      isSemiFinished: false, isFinished: true,
    },
  });
  const skuStp1 = await prisma.productSku.create({
    data: {
      code: "STP-CN-001", name: "结构支架-A", type: "冲压",
      customerCode: "ABC-5501-A", internalCode: "CY-2001",
      spec: "SPCC 1.2mm", unit: "PCS", stdWeight: 65,
      isSemiFinished: true, isFinished: false,
    },
  });
  const skuStp2 = await prisma.productSku.create({
    data: {
      code: "STP-CN-002", name: "屏蔽罩", type: "冲压",
      customerCode: "ABC-6602-S", internalCode: "CY-2002",
      spec: "SUS304 0.3mm", unit: "PCS", stdWeight: 12,
      isSemiFinished: false, isFinished: true,
    },
  });
  const skuStp3 = await prisma.productSku.create({
    data: {
      code: "STP-CN-003", name: "安装板", type: "冲压",
      customerCode: "ABC-7703-M", internalCode: "CY-2003",
      spec: "铝合金5052 1.0mm", unit: "PCS", stdWeight: 28,
      isSemiFinished: false, isFinished: true,
    },
  });

  // ---------- 物料主数据 ----------
  const matPA66 = await prisma.materialMaster.create({
    data: {
      code: "MAT-PA66GF30", name: "PA66+GF30(黑色) 颗粒", type: "塑料颗粒",
      materialGrade: "PA66-GF30-BK", supplier: "Thai Poly Compound", unit: "KG",
      shelfLife: "开封后6个月", color: "黑色", dryingRequirement: "80℃ / 3小时",
    },
  });
  const matPBT = await prisma.materialMaster.create({
    data: {
      code: "MAT-PBT-NAT", name: "PBT(本色) 颗粒", type: "塑料颗粒",
      materialGrade: "PBT-NAT", supplier: "Siam Resin", unit: "KG",
      shelfLife: "开封后6个月", color: "本色", dryingRequirement: "100℃ / 4小时",
    },
  });
  await prisma.materialMaster.create({
    data: {
      code: "MAT-PA6-BLK", name: "PA6(黑色) 颗粒", type: "塑料颗粒",
      materialGrade: "PA6-BK", supplier: "Thai Poly Compound", unit: "KG",
      color: "黑色", dryingRequirement: "80℃ / 2小时",
    },
  });
  const matSPCC = await prisma.materialMaster.create({
    data: {
      code: "MAT-SPCC12", name: "SPCC冷轧卷材 1.2mm", type: "金属卷材",
      materialGrade: "SPCC", supplier: "Siam Steel Works", unit: "KG",
      thickness: 1.2, width: 250, coilWeight: 3000, surfaceTreatment: "无镀层",
    },
  });
  const matSUS = await prisma.materialMaster.create({
    data: {
      code: "MAT-SUS30403", name: "SUS304不锈钢卷材 0.3mm", type: "金属卷材",
      materialGrade: "SUS304", supplier: "Siam Steel Works", unit: "KG",
      thickness: 0.3, width: 150, coilWeight: 1200, surfaceTreatment: "2B",
    },
  });
  await prisma.materialMaster.create({
    data: {
      code: "MAT-AL505210", name: "铝合金5052卷材 1.0mm", type: "金属卷材",
      materialGrade: "AL5052", supplier: "Thai Aluminum Co.", unit: "KG",
      thickness: 1.0, width: 200, coilWeight: 900, surfaceTreatment: "无镀层",
    },
  });

  // ---------- 设备 ----------
  const eqInj01 = await prisma.equipmentMaster.create({
    data: { code: "INJ01", name: "注塑机1号(150T)", type: "注塑机", line: "A线", capacity: "150T/次" },
  });
  const eqInj02 = await prisma.equipmentMaster.create({
    data: { code: "INJ02", name: "注塑机2号(280T)", type: "注塑机", line: "A线", capacity: "280T/次" },
  });
  const eqStp01 = await prisma.equipmentMaster.create({
    data: { code: "STP01", name: "冲床1号(63T)", type: "冲床", line: "B线", capacity: "63T" },
  });
  const eqStp02 = await prisma.equipmentMaster.create({
    data: { code: "STP02", name: "冲床2号(110T)", type: "冲床", line: "B线", capacity: "110T" },
  });

  // ---------- 不良原因字典 ----------
  const injReasons = await Promise.all(
    INJECTION_DEFECT_REASONS.map((reason) =>
      prisma.defectReason.create({ data: { reason, appliesTo: "注塑" } })
    )
  );
  const stpReasons = await Promise.all(
    STAMPING_DEFECT_REASONS.map((reason) =>
      prisma.defectReason.create({ data: { reason, appliesTo: "冲压" } })
    )
  );
  const reasonByName = (name: string) =>
    [...injReasons, ...stpReasons].find((r) => r.reason === name)!;

  // ---------- 工序与工艺路线 ----------
  const operationSpecs = [
    { code: "OP-DRY", name: "原料干燥", type: "生产", appliesTo: "注塑", workCenter: "注塑前处理" },
    { code: "OP-INJ", name: "注塑成型", type: "生产", appliesTo: "注塑", workCenter: "注塑车间" },
    { code: "OP-TRIM", name: "修边", type: "生产", appliesTo: "注塑", workCenter: "后处理区" },
    { code: "OP-FEED", name: "卷料上料", type: "生产", appliesTo: "冲压", workCenter: "冲压备料区" },
    { code: "OP-STP", name: "冲压成型", type: "生产", appliesTo: "冲压", workCenter: "冲压车间" },
    { code: "OP-DEBURR", name: "去毛刺", type: "生产", appliesTo: "冲压", workCenter: "后处理区" },
    { code: "OP-IPQC", name: "过程检验", type: "检验", appliesTo: "通用", workCenter: "质量检验区" },
    { code: "OP-PACK", name: "包装入库", type: "包装", appliesTo: "通用", workCenter: "包装区" },
  ];
  const operations = new Map<string, Awaited<ReturnType<typeof prisma.operationMaster.create>>>();
  for (const spec of operationSpecs) {
    const operation = await prisma.operationMaster.create({ data: spec });
    operations.set(operation.code, operation);
  }

  type RouteStepSeed = {
    code: string;
    sequence: number;
    standardCycleSeconds?: number;
    setupMinutes?: number;
    requiresEquipment?: boolean;
    requiresMold?: boolean;
    qualityRequired?: boolean;
    isFinal?: boolean;
  };
  async function createRouteVersion(input: {
    routeCode: string;
    routeName: string;
    skuId: string;
    version: string;
    versionStatus: string;
    steps: RouteStepSeed[];
    existingRouteId?: string;
    changeReason?: string;
  }) {
    const route = input.existingRouteId
      ? await prisma.processRoute.findUniqueOrThrow({ where: { id: input.existingRouteId } })
      : await prisma.processRoute.create({ data: { code: input.routeCode, name: input.routeName, skuId: input.skuId } });
    const routeVersion = await prisma.processRouteVersion.create({
      data: {
        routeId: route.id,
        version: input.version,
        status: input.versionStatus,
        effectiveFrom: input.versionStatus === "已发布" ? D10 : null,
        releasedAt: input.versionStatus === "已发布" ? at(D10, 8, 0) : null,
        releasedBy: input.versionStatus === "已发布" ? "工艺主管" : null,
        changeReason: input.changeReason,
      },
    });
    for (const step of input.steps) {
      const operation = operations.get(step.code)!;
      await prisma.routeOperation.create({
        data: {
          routeVersionId: routeVersion.id,
          operationId: operation.id,
          sequence: step.sequence,
          operationCode: operation.code,
          operationName: operation.name,
          operationType: operation.type,
          workCenter: operation.workCenter,
          standardCycleSeconds: step.standardCycleSeconds,
          setupMinutes: step.setupMinutes,
          requiresEquipment: step.requiresEquipment ?? false,
          requiresMold: step.requiresMold ?? false,
          qualityRequired: step.qualityRequired ?? false,
          isFinal: step.isFinal ?? false,
        },
      });
    }
    return { route, routeVersion };
  }

  const injRoute = await createRouteVersion({
    routeCode: "RT-INJ-CN-001", routeName: "ECU外壳上盖标准注塑路线", skuId: skuInj1.id,
    version: "V0.9", versionStatus: "已停用", changeReason: "历史单工序路线归档",
    steps: [{ code: "OP-INJ", sequence: 10, requiresEquipment: true, requiresMold: true, isFinal: true }],
  });
  const injRouteV1 = await createRouteVersion({
    routeCode: "RT-INJ-CN-001", routeName: "ECU外壳上盖标准注塑路线", skuId: skuInj1.id,
    existingRouteId: injRoute.route.id, version: "V1.0", versionStatus: "已发布", changeReason: "补齐前处理、检验和包装工序",
    steps: [
      { code: "OP-DRY", sequence: 10, standardCycleSeconds: 10800, setupMinutes: 10 },
      { code: "OP-INJ", sequence: 20, standardCycleSeconds: 45, setupMinutes: 30, requiresEquipment: true, requiresMold: true },
      { code: "OP-TRIM", sequence: 30, standardCycleSeconds: 8 },
      { code: "OP-IPQC", sequence: 40, standardCycleSeconds: 3, qualityRequired: true },
      { code: "OP-PACK", sequence: 50, standardCycleSeconds: 5, isFinal: true },
    ],
  });
  const stpRoute = await createRouteVersion({
    routeCode: "RT-STP-CN-001", routeName: "结构支架标准冲压路线", skuId: skuStp1.id,
    version: "V0.9", versionStatus: "已停用", changeReason: "历史单工序路线归档",
    steps: [{ code: "OP-STP", sequence: 10, requiresEquipment: true, requiresMold: true, isFinal: true }],
  });
  const stpRouteV1 = await createRouteVersion({
    routeCode: "RT-STP-CN-001", routeName: "结构支架标准冲压路线", skuId: skuStp1.id,
    existingRouteId: stpRoute.route.id, version: "V1.0", versionStatus: "已发布", changeReason: "补齐上料、后处理、检验和包装工序",
    steps: [
      { code: "OP-FEED", sequence: 10, standardCycleSeconds: 1800, setupMinutes: 15 },
      { code: "OP-STP", sequence: 20, standardCycleSeconds: 2, setupMinutes: 25, requiresEquipment: true, requiresMold: true },
      { code: "OP-DEBURR", sequence: 30, standardCycleSeconds: 6 },
      { code: "OP-IPQC", sequence: 40, standardCycleSeconds: 3, qualityRequired: true },
      { code: "OP-PACK", sequence: 50, standardCycleSeconds: 5, isFinal: true },
    ],
  });
  const defaultRouteVersions = new Map<string, string>();
  for (const sku of [skuInj2, skuInj3, skuStp2, skuStp3]) {
    const operationCode = sku.type === "注塑" ? "OP-INJ" : "OP-STP";
    const created = await createRouteVersion({
      routeCode: `RT-${sku.code}`, routeName: `${sku.name}默认工艺路线`, skuId: sku.id,
      version: "V1.0", versionStatus: "已发布", changeReason: "兼容一期历史单工序报工",
      steps: [{ code: operationCode, sequence: 10, requiresEquipment: true, requiresMold: true, isFinal: true }],
    });
    defaultRouteVersions.set(sku.id, created.routeVersion.id);
  }

  // ---------- 物料批次入库 ----------
  const lotPA66 = await prisma.materialLot.create({
    data: {
      lotNo: "LOT-PA66GF30-260705-01", supplierLot: "TPC260705A", materialId: matPA66.id,
      qty: 2000, remainingQty: 2000, unit: "KG", inDate: new Date("2026-07-05T09:00:00+07:00"),
      supplier: "Thai Poly Compound", inspectStatus: "合格", stockStatus: "可用", warehouse: "原料仓-A",
    },
  });
  const lotSPCC = await prisma.materialLot.create({
    data: {
      lotNo: "LOT-SPCC12-260706-01", supplierLot: "SSW-F260706", materialId: matSPCC.id,
      qty: 12000, remainingQty: 12000, unit: "KG", inDate: new Date("2026-07-06T09:00:00+07:00"),
      supplier: "Siam Steel Works", inspectStatus: "合格", stockStatus: "可用", warehouse: "原料仓-B",
    },
  });
  await prisma.materialLot.create({
    data: {
      lotNo: "LOT-PBT-260709-01", supplierLot: "SR260709B", materialId: matPBT.id,
      qty: 800, remainingQty: 800, unit: "KG", inDate: new Date("2026-07-09T09:00:00+07:00"),
      supplier: "Siam Resin", inspectStatus: "合格", stockStatus: "可用", warehouse: "原料仓-A",
    },
  });
  const lotSUS = await prisma.materialLot.create({
    data: {
      lotNo: "LOT-SUS30403-260707-01", supplierLot: "SSW-F260707", materialId: matSUS.id,
      qty: 5000, remainingQty: 5000, unit: "KG", inDate: new Date("2026-07-07T09:00:00+07:00"),
      supplier: "Siam Steel Works", inspectStatus: "合格", stockStatus: "可用", warehouse: "原料仓-B",
    },
  });

  // ---------- 模具台账（先建，currentCount 稍后按历史批次回填） ----------
  const mldInj1 = await prisma.moldMaster.create({
    data: {
      code: "MLD-INJ-001", name: "ECU外壳上盖模", type: "注塑模",
      applicableSkuId: skuInj1.id, applicableEquipmentId: eqInj01.id,
      designLife: 500000, currentCount: 0, maintCycle: 50000, warnThreshold: 0.8,
      lastMaintCount: 412000, lastMaintDate: new Date("2026-06-20T10:00:00+07:00"),
      status: "可用", cavityCount: 1,
    },
  });
  const mldInj2 = await prisma.moldMaster.create({
    data: {
      code: "MLD-INJ-002", name: "传感器支架模", type: "注塑模",
      applicableSkuId: skuInj2.id, applicableEquipmentId: eqInj02.id,
      designLife: 300000, currentCount: 118000, maintCycle: 30000, warnThreshold: 0.8,
      lastMaintCount: 100000, lastMaintDate: new Date("2026-07-01T10:00:00+07:00"),
      status: "可用", cavityCount: 2,
    },
  });
  const mldInj3 = await prisma.moldMaster.create({
    data: {
      code: "MLD-INJ-003", name: "连接器护套模(4穴)", type: "注塑模",
      applicableSkuId: skuInj3.id, applicableEquipmentId: eqInj01.id,
      designLife: 400000, currentCount: 40500, maintCycle: 40000, warnThreshold: 0.8,
      lastMaintCount: 0, lastMaintDate: new Date("2026-05-10T10:00:00+07:00"),
      status: "可用", cavityCount: 4,
    },
  });
  const mldStp1 = await prisma.moldMaster.create({
    data: {
      code: "MLD-STP-001", name: "结构支架-A级进模", type: "冲压模",
      applicableSkuId: skuStp1.id, applicableEquipmentId: eqStp02.id,
      designLife: 1000000, currentCount: 0, maintCycle: 100000, warnThreshold: 0.8,
      lastMaintCount: 900000, lastMaintDate: new Date("2026-06-15T10:00:00+07:00"),
      status: "待保养", cavityCount: 1,
    },
  });
  const mldStp2 = await prisma.moldMaster.create({
    data: {
      code: "MLD-STP-002", name: "屏蔽罩连续模", type: "冲压模",
      applicableSkuId: skuStp2.id, applicableEquipmentId: eqStp01.id,
      designLife: 800000, currentCount: 0, maintCycle: 80000, warnThreshold: 0.8,
      lastMaintCount: 160000, lastMaintDate: new Date("2026-06-25T10:00:00+07:00"),
      status: "可用", cavityCount: 2,
    },
  });
  await prisma.moldMaster.create({
    data: {
      code: "MLD-STP-003", name: "安装板落料模", type: "冲压模",
      applicableSkuId: skuStp3.id, applicableEquipmentId: eqStp02.id,
      designLife: 600000, currentCount: 0, maintCycle: 60000, warnThreshold: 0.8,
      lastMaintCount: 0, lastMaintDate: null,
      status: "维修中", cavityCount: 1,
    },
  });

  // ---------- 工单 ----------
  const wo1 = await prisma.workOrder.create({
    data: {
      no: "WO-20260712-001", skuId: skuInj1.id, type: "注塑", planQty: 5000,
      planStart: D10, planEnd: D14, planEquipmentId: eqInj01.id, planMoldId: mldInj1.id,
      bomVersion: "V1.0", route: "标准注塑工艺", routeVersionId: injRouteV1.routeVersion.id, status: "生产中",
    },
  });
  const wo2 = await prisma.workOrder.create({
    data: {
      no: "WO-20260712-002", skuId: skuStp1.id, type: "冲压", planQty: 8000,
      planStart: D10, planEnd: D15, planEquipmentId: eqStp02.id, planMoldId: mldStp1.id,
      bomVersion: "V1.0", route: "标准冲压工艺", routeVersionId: stpRouteV1.routeVersion.id, status: "生产中",
    },
  });
  const wo3 = await prisma.workOrder.create({
    data: {
      no: "WO-20260712-003", skuId: skuInj2.id, type: "注塑", planQty: 3000,
      planStart: D11, planEnd: D13, planEquipmentId: eqInj02.id, planMoldId: mldInj2.id,
      bomVersion: "V1.0", route: "标准注塑工艺", routeVersionId: defaultRouteVersions.get(skuInj2.id), status: "已下达",
    },
  });
  const wo4 = await prisma.workOrder.create({
    data: {
      no: "WO-20260712-004", skuId: skuStp2.id, type: "冲压", planQty: 6000,
      planStart: D11, planEnd: D14, planEquipmentId: eqStp01.id, planMoldId: mldStp2.id,
      bomVersion: "V1.0", route: "标准冲压工艺", routeVersionId: defaultRouteVersions.get(skuStp2.id), status: "生产中",
    },
  });
  const wo5 = await prisma.workOrder.create({
    data: {
      no: "WO-20260712-005", skuId: skuInj3.id, type: "注塑", planQty: 2000,
      planStart: D13, planEnd: D15, planEquipmentId: eqInj01.id, planMoldId: mldInj3.id,
      bomVersion: "V1.0", route: "标准注塑工艺", routeVersionId: defaultRouteVersions.get(skuInj3.id), status: "未下达",
    },
  });
  const wo6 = await prisma.workOrder.create({
    data: {
      no: "WO-20260712-006", skuId: skuStp3.id, type: "冲压", planQty: 1500,
      planStart: D14, planEnd: D16, planEquipmentId: eqStp02.id, routeVersionId: defaultRouteVersions.get(skuStp3.id), status: "已下达",
      note: "计划模具 MLD-STP-003 当前维修中，下达时需知晓",
    },
  });

  const productionOperationByWorkOrder = new Map<string, string>();
  for (const workOrder of [wo1, wo2, wo3, wo4, wo5, wo6]) {
    // 工序任务只在工单下达时生成；未下达工单仅保留已选路线版本。
    if (workOrder.status === "未下达") continue;
    const routeOperations = await prisma.routeOperation.findMany({
      where: { routeVersionId: workOrder.routeVersionId! },
      orderBy: { sequence: "asc" },
    });
    const productionIndex = routeOperations.findIndex((step) => step.requiresEquipment || step.requiresMold);
    for (let index = 0; index < routeOperations.length; index += 1) {
      const step = routeOperations[index];
      const isProductionStep = step.requiresEquipment || step.requiresMold;
      const operationStatus = workOrder.status === "生产中"
          ? index < productionIndex ? "已完成" : index === productionIndex ? "生产中" : "等待前序"
          : index === 0 ? "可开工" : "等待前序";
      const workOrderOperation = await prisma.workOrderOperation.create({
        data: {
          workOrderId: workOrder.id,
          routeOperationId: step.id,
          operationId: step.operationId,
          operationCode: step.operationCode,
          operationName: step.operationName,
          operationType: step.operationType,
          sequence: step.sequence,
          status: operationStatus,
          plannedQty: workOrder.planQty,
          qualityStatus: step.qualityRequired ? "待检" : "不适用",
          isFinal: step.isFinal,
          requiresEquipment: step.requiresEquipment,
          requiresMold: step.requiresMold,
          qualityRequired: step.qualityRequired,
          reportMode: step.reportMode,
          standardCycleSeconds: step.standardCycleSeconds,
          workCenter: step.workCenter,
          planEquipmentId: step.requiresEquipment ? workOrder.planEquipmentId : null,
          planMoldId: step.requiresMold ? workOrder.planMoldId : null,
        },
      });
      if (isProductionStep) productionOperationByWorkOrder.set(workOrder.id, workOrderOperation.id);
    }
  }

  // ---------- 历史生产批次（含领退料/不良/入库），用于演示追溯与日报 ----------
  type BatchSeed = {
    workOrderId: string; skuId: string; type: "注塑" | "冲压";
    equipmentId: string; moldId: string; materialLotId: string;
    shift: "白班" | "夜班"; operator: string; day: Date;
    startH: number; endH: number; issuedWeight: number;
    goodQty: number; badQty: number; scrapWeight: number; returnWeight: number;
    cavityCount: number | null;
    defects: { reason: string; qty: number; responsible: string; action: string }[];
    stockIn: boolean; // 是否已完成入库（今天的批次留作"待入库"演示）
  };

  const seeds: BatchSeed[] = [
    // WO1 注塑 INJ-CN-001 @ INJ01 / MLD-INJ-001 / LOT-PA66GF30
    { workOrderId: wo1.id, skuId: skuInj1.id, type: "注塑", equipmentId: eqInj01.id, moldId: mldInj1.id, materialLotId: lotPA66.id,
      shift: "白班", operator: "Somchai", day: D10, startH: 8, endH: 19, issuedWeight: 50, goodQty: 1050, badQty: 18, scrapWeight: 3.2, returnWeight: 0.5, cavityCount: 1,
      defects: [{ reason: "缩水", qty: 12, responsible: "工艺", action: "返工" }, { reason: "飞边", qty: 6, responsible: "模具", action: "报废" }], stockIn: true },
    { workOrderId: wo1.id, skuId: skuInj1.id, type: "注塑", equipmentId: eqInj01.id, moldId: mldInj1.id, materialLotId: lotPA66.id,
      shift: "白班", operator: "Somchai", day: D11, startH: 8, endH: 19, issuedWeight: 50, goodQty: 1080, badQty: 22, scrapWeight: 3.0, returnWeight: 0.3, cavityCount: 1,
      defects: [{ reason: "缩水", qty: 15, responsible: "工艺", action: "返工" }, { reason: "色差", qty: 7, responsible: "原材料", action: "让步接收" }], stockIn: true },
    { workOrderId: wo1.id, skuId: skuInj1.id, type: "注塑", equipmentId: eqInj01.id, moldId: mldInj1.id, materialLotId: lotPA66.id,
      shift: "夜班", operator: "Niran", day: D11, startH: 20, endH: 23, issuedWeight: 48, goodQty: 990, badQty: 45, scrapWeight: 4.5, returnWeight: 0.2, cavityCount: 1,
      defects: [{ reason: "烧焦", qty: 20, responsible: "设备", action: "报废" }, { reason: "缩水", qty: 15, responsible: "工艺", action: "返工" }, { reason: "气纹", qty: 10, responsible: "工艺", action: "隔离" }], stockIn: true },
    { workOrderId: wo1.id, skuId: skuInj1.id, type: "注塑", equipmentId: eqInj01.id, moldId: mldInj1.id, materialLotId: lotPA66.id,
      shift: "白班", operator: "Somchai", day: D12, startH: 8, endH: 12, issuedWeight: 26, goodQty: 520, badQty: 14, scrapWeight: 1.6, returnWeight: 0.2, cavityCount: 1,
      defects: [{ reason: "缩水", qty: 9, responsible: "工艺", action: "返工" }, { reason: "飞边", qty: 5, responsible: "模具", action: "报废" }], stockIn: false },

    // WO2 冲压 STP-CN-001 @ STP02 / MLD-STP-001 / LOT-SPCC12
    { workOrderId: wo2.id, skuId: skuStp1.id, type: "冲压", equipmentId: eqStp02.id, moldId: mldStp1.id, materialLotId: lotSPCC.id,
      shift: "白班", operator: "Anong", day: D10, startH: 8, endH: 19, issuedWeight: 800, goodQty: 2100, badQty: 25, scrapWeight: 64, returnWeight: 40, cavityCount: 1,
      defects: [{ reason: "毛刺", qty: 15, responsible: "模具", action: "返工" }, { reason: "尺寸超差", qty: 10, responsible: "设备", action: "报废" }], stockIn: true },
    { workOrderId: wo2.id, skuId: skuStp1.id, type: "冲压", equipmentId: eqStp02.id, moldId: mldStp1.id, materialLotId: lotSPCC.id,
      shift: "白班", operator: "Anong", day: D11, startH: 8, endH: 19, issuedWeight: 780, goodQty: 2050, badQty: 15, scrapWeight: 60, returnWeight: 35, cavityCount: 1,
      defects: [{ reason: "毛刺", qty: 10, responsible: "模具", action: "返工" }, { reason: "压伤", qty: 5, responsible: "操作", action: "报废" }], stockIn: true },
    { workOrderId: wo2.id, skuId: skuStp1.id, type: "冲压", equipmentId: eqStp02.id, moldId: mldStp1.id, materialLotId: lotSPCC.id,
      shift: "夜班", operator: "Pranee", day: D11, startH: 20, endH: 23, issuedWeight: 420, goodQty: 1080, badQty: 22, scrapWeight: 32, returnWeight: 18, cavityCount: 1,
      defects: [{ reason: "毛刺", qty: 12, responsible: "模具", action: "返工" }, { reason: "裂纹", qty: 10, responsible: "原材料", action: "报废" }], stockIn: true },

    // WO4 冲压 STP-CN-002 @ STP01 / MLD-STP-002 / LOT-SUS30403
    { workOrderId: wo4.id, skuId: skuStp2.id, type: "冲压", equipmentId: eqStp01.id, moldId: mldStp2.id, materialLotId: lotSUS.id,
      shift: "白班", operator: "Chalermchai", day: D10, startH: 8, endH: 19, issuedWeight: 130, goodQty: 2050, badQty: 20, scrapWeight: 9, returnWeight: 6, cavityCount: 2,
      defects: [{ reason: "划伤", qty: 12, responsible: "操作", action: "返工" }, { reason: "尺寸超差", qty: 8, responsible: "设备", action: "报废" }], stockIn: true },
    { workOrderId: wo4.id, skuId: skuStp2.id, type: "冲压", equipmentId: eqStp01.id, moldId: mldStp2.id, materialLotId: lotSUS.id,
      shift: "白班", operator: "Chalermchai", day: D11, startH: 8, endH: 19, issuedWeight: 128, goodQty: 2050, badQty: 28, scrapWeight: 8.5, returnWeight: 5, cavityCount: 2,
      defects: [{ reason: "划伤", qty: 18, responsible: "操作", action: "返工" }, { reason: "毛刺", qty: 10, responsible: "模具", action: "返工" }], stockIn: true },
    { workOrderId: wo4.id, skuId: skuStp2.id, type: "冲压", equipmentId: eqStp01.id, moldId: mldStp2.id, materialLotId: lotSUS.id,
      shift: "白班", operator: "Chalermchai", day: D12, startH: 8, endH: 12, issuedWeight: 65, goodQty: 1020, badQty: 11, scrapWeight: 4.5, returnWeight: 3, cavityCount: 2,
      defects: [{ reason: "毛刺", qty: 11, responsible: "模具", action: "返工" }], stockIn: false },
  ];

  const moldCountAccum: Record<string, number> = {};
  let stockInSeq = 1;

  for (const s of seeds) {
    const total = totalQty(s.goodQty, s.badQty);
    const equipment = await prisma.equipmentMaster.findUniqueOrThrow({ where: { id: s.equipmentId } });
    const batchNo = await generateBatchNo(s.type, s.day, s.shift, equipment.code);

    const batch = await prisma.productionBatch.create({
      data: {
        batchNo, workOrderId: s.workOrderId, skuId: s.skuId, type: s.type,
        workOrderOperationId: productionOperationByWorkOrder.get(s.workOrderId),
        equipmentId: s.equipmentId, moldId: s.moldId, materialLotId: s.materialLotId,
        shift: s.shift, operator: s.operator,
        startTime: at(s.day, s.startH, 0), endTime: at(s.day, s.endH, 0),
        issuedWeight: s.issuedWeight, goodQty: s.goodQty, badQty: s.badQty,
        scrapWeight: s.scrapWeight, returnWeight: s.returnWeight,
        thisMoldCount: calcThisMoldCount(total, s.cavityCount),
        status: "已完工", confirmedByLeader: true,
      },
    });

    moldCountAccum[s.moldId] = (moldCountAccum[s.moldId] ?? 0) + (batch.thisMoldCount ?? 0);

    await prisma.materialIssue.create({
      data: {
        workOrderId: s.workOrderId, materialLotId: s.materialLotId, qty: s.issuedWeight,
        issuedBy: s.operator, issuedAt: at(s.day, s.startH, 0), equipmentId: s.equipmentId,
      },
    });
    await prisma.batchMaterialConsumption.create({
      data: {
        batchId: batch.id,
        materialLotId: s.materialLotId,
        qty: s.issuedWeight - s.returnWeight,
        unit: "KG",
        consumptionType: "主料",
      },
    });
    const workOrderOperationId = productionOperationByWorkOrder.get(s.workOrderId);
    if (workOrderOperationId) {
      await prisma.workOrderOperation.update({
        where: { id: workOrderOperationId },
        data: {
          inputQty: { increment: total },
          goodQty: { increment: s.goodQty },
          badQty: { increment: s.badQty },
          scrapQty: { increment: s.badQty },
          transferredQty: { increment: s.goodQty },
          startedAt: at(s.day, s.startH, 0),
        },
      });
    }
    if (s.returnWeight > 0) {
      await prisma.materialReturn.create({
        data: {
          workOrderId: s.workOrderId, materialLotId: s.materialLotId, qty: s.returnWeight,
          reason: s.type === "注塑" ? "批次结束剩余退料" : "批次结束剩余卷材",
          returnedAt: at(s.day, s.endH, 0), returnedBy: s.operator,
        },
      });
    }
    await prisma.materialLot.update({
      where: { id: s.materialLotId },
      data: { remainingQty: { decrement: s.issuedWeight - s.returnWeight } },
    });

    for (const d of s.defects) {
      await prisma.defectRecord.create({
        data: {
          batchId: batch.id, qty: d.qty, reasonId: reasonByName(d.reason).id,
          responsible: d.responsible, action: d.action,
          recordedBy: s.operator, recordedAt: at(s.day, s.endH, 0),
        },
      });
    }

    if (s.stockIn) {
      const sku = await prisma.productSku.findUniqueOrThrow({ where: { id: s.skuId } });
      await prisma.stockInRecord.create({
        data: {
          no: `SI-${s.day.toISOString().slice(0, 10).replace(/-/g, "")}-${String(stockInSeq++).padStart(3, "0")}`,
          batchId: batch.id, type: sku.isFinished ? "成品" : "半成品",
          qty: s.goodQty, warehouse: sku.isFinished ? "成品仓" : "半成品中转仓",
          inBy: "Thanawat", inAt: at(s.day, s.endH, 30),
        },
      });
    }
  }

  // 回填模具累计次数：种子批次累计 + 一个更早的历史存量，凑出目标寿命使用率，用于演示预警/超期场景
  await prisma.moldMaster.update({ where: { id: mldInj1.id }, data: { currentCount: 462000 } });
  await prisma.moldMaster.update({ where: { id: mldStp1.id }, data: { currentCount: 1005000 } });
  await prisma.moldMaster.update({ where: { id: mldStp2.id }, data: { currentCount: 210000 } });

  console.log("Seed 完成：");
  console.log(`  - SKU 6 / 物料 6 / 设备 4 / 模具 6 / 不良原因 ${injReasons.length + stpReasons.length}`);
  console.log(`  - 工单 6 / 物料批次 4 / 生产批次 ${seeds.length}`);
  console.log("  模具累计模次（种子批次贡献部分）:", moldCountAccum);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
