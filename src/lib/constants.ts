// 状态字段取值范围唯一权威（替代 Prisma enum，见 CLAUDE.md「状态字段用 String 不用 Prisma enum」）。

export const TODAY = "2026-07-12"; // demo 演示锚点日期，与 prisma/seed.ts 保持一致，不要用 new Date()

export const PRODUCT_TYPES = ["注塑", "冲压", "线束预留"] as const;
export const MATERIAL_TYPES = ["塑料颗粒", "金属卷材", "辅料", "其他"] as const;
export const EQUIPMENT_TYPES = ["注塑机", "冲床", "其他"] as const;
export const MOLD_TYPES = ["注塑模", "冲压模"] as const;

export const SHIFTS = ["白班", "夜班"] as const;
export const shiftCode = (shift: string): "D" | "N" => (shift === "白班" ? "D" : "N");

export const WORK_ORDER_STATUS = ["未下达", "已下达", "生产中", "暂停", "已完工", "已关闭"] as const;
export const WORK_ORDER_TRANSITIONS: Record<string, readonly string[]> = {
  未下达: ["已下达", "已关闭"],
  已下达: ["已关闭"],
  生产中: ["暂停", "已完工", "已关闭"],
  暂停: ["生产中", "已完工", "已关闭"],
  已完工: ["已关闭"],
  已关闭: [],
};
export const EQUIPMENT_STATUS = ["可用", "维修中", "停用"] as const;
export const MOLD_STATUS = ["可用", "生产中", "待保养", "维修中", "停用", "报废"] as const;
export const MOLD_BLOCKED_STATUS: readonly string[] = ["维修中", "停用", "报废"];

export const INSPECT_STATUS = ["待检", "合格", "不合格", "让步接收"] as const;
export const STOCK_STATUS = ["可用", "冻结", "隔离", "已消耗"] as const;

export const BATCH_STATUS = ["进行中", "待检", "质量冻结", "已完工", "已作废"] as const;

export const OPERATION_TYPES = ["生产", "检验", "包装", "通用"] as const;
export const OPERATION_APPLIES_TO = ["注塑", "冲压", "通用"] as const;
export const ROUTE_STATUS = ["启用", "停用"] as const;
export const ROUTE_VERSION_STATUS = ["草稿", "审核中", "已发布", "已停用"] as const;
export const WORK_ORDER_OPERATION_STATUS = ["等待前序", "可开工", "生产中", "暂停", "待检", "质量冻结", "已完成", "已跳过", "已关闭"] as const;
export const OPERATION_QUALITY_STATUS = ["待检", "合格", "不合格", "让步接收", "不适用"] as const;
export const OPERATION_REPORT_MODES = ["按批次", "按班次", "按件"] as const;
export const BATCH_CONSUMPTION_TYPES = ["主料", "辅料", "半成品", "返工料"] as const;
export const BATCH_GENEALOGY_TYPES = ["转序", "合批", "拆批", "返工"] as const;
export const REWORK_STATUS = ["待处理", "处理中", "已完成", "已关闭"] as const;

export const DEFECT_RESPONSIBLE = ["原材料", "设备", "模具", "工艺", "操作", "其他"] as const;
export const DEFECT_ACTION = ["返工", "报废", "隔离", "让步接收"] as const;

export const STOCK_IN_TYPES = ["半成品", "成品", "不良品隔离"] as const;

export const MAINT_TYPES = ["周期保养", "异常维修", "换模保养", "下模保养"] as const;

export const INJECTION_DEFECT_REASONS = [
  "缺料",
  "飞边",
  "缩水",
  "变形",
  "色差",
  "黑点",
  "尺寸异常",
  "烧焦",
  "气纹",
  "其他",
];

export const STAMPING_DEFECT_REASONS = [
  "毛刺",
  "裂纹",
  "变形",
  "尺寸超差",
  "压伤",
  "划伤",
  "孔位偏差",
  "材料异常",
  "其他",
];

// 语义状态色（good/warn/critical/info），与主题橙色区分开，见 src/app/theme.ts
export const STATUS_TONE: Record<string, "good" | "warn" | "critical" | "info" | "default"> = {
  可用: "good",
  已下达: "info",
  可开工: "info",
  生产中: "info",
  已完工: "good",
  已完成: "good",
  合格: "good",
  启用: "good",
  待保养: "warn",
  暂停: "warn",
  待检: "warn",
  冻结: "warn",
  让步接收: "warn",
  维修中: "critical",
  质量冻结: "critical",
  停用: "critical",
  报废: "critical",
  已关闭: "critical",
  不合格: "critical",
  隔离: "critical",
  未下达: "default",
  等待前序: "default",
  已跳过: "default",
  进行中: "info",
  已作废: "critical",
  已消耗: "default",
};
