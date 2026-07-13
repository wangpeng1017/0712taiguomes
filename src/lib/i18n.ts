export type AppLocale = "zh" | "en";

const EN: Record<string, string> = {
  "仪表盘": "Dashboard", "生产工单": "Work Orders", "注塑报工": "Injection Reporting", "冲压报工": "Stamping Reporting",
  "物料批次": "Material Lots", "模具台账": "Molds", "批次追溯": "Traceability", "生产日报": "Production Report", "基础数据": "Master Data",
  "新增报工": "New Report", "生产批次": "Production Batch", "生产批次号": "Batch No.", "生产批次全链路": "Production Batch Trace",
  "新建生产工单": "New Work Order", "新增模具": "New Mold", "新增产品 SKU": "New Product SKU", "新增物料": "New Material",
  "新增设备": "New Equipment", "新增不良原因": "New Defect Reason", "编辑生产工单": "Edit Work Order", "编辑模具": "Edit Mold",
  "编辑保养记录": "Edit Maintenance Record", "登记保养": "Record Maintenance", "新增": "Add", "编辑": "Edit", "删除": "Delete",
  "详情": "Details", "操作": "Actions", "撤销": "Undo", "保存": "Save", "刷新": "Refresh", "关闭": "Close", "取消": "Cancel",
  "查看": "View", "查看模具台账": "View Molds", "查看全部工单": "View All Work Orders",
  "上一页": "Previous Page", "下一页": "Next Page", "页码": "Page", "条/页": "items/page", "跳至": "Go to", "页": "Page",
  "确认删除": "Confirm Delete", "确认作废": "Confirm Void", "作废": "Void", "恢复": "Resume", "暂停": "Pause", "下达": "Release", "完工": "Complete",
  "搜索批次号、工单、产品或操作员": "Search batch, work order, product, or operator", "全部状态": "All Statuses",
  "产品 SKU": "Product SKU", "产品SKU": "Product SKU", "SKU编码": "SKU Code", "SKU 编码": "SKU Code", "SKU 名称": "SKU Name",
  "产品": "Product", "产品名称": "Product Name", "名称": "Name", "类型": "Type", "产品属性": "Product Type",
  "客户料号": "Customer Part No.", "内部料号": "Internal Part No.", "规格": "Specification", "单位": "Unit", "标准重量(g)": "Standard Weight (g)",
  "半成品": "Semi-finished", "成品": "Finished", "启用": "Enabled", "停用": "Disabled", "状态": "Status",
  "物料": "Material", "物料主数据": "Material Master", "物料编码": "Material Code", "物料名称": "Material Name",
  "物料批次号": "Material Lot No.", "原材料批次": "Raw Material Lot", "供应商": "Supplier", "供应商批次": "Supplier Lot",
  "供应商批次号": "Supplier Lot No.", "材质/牌号": "Material Grade", "保质期": "Shelf Life", "卷材规格": "Coil Specification",
  "颗粒信息": "Pellet Information", "厚度(mm)": "Thickness (mm)", "宽度(mm)": "Width (mm)", "卷重(kg)": "Coil Weight (kg)",
  "颜色": "Color", "干燥要求": "Drying Requirement", "设备": "Equipment", "设备编号": "Equipment No.", "设备名称": "Equipment Name",
  "所属产线": "Production Line", "产能参数": "Capacity", "注塑机": "Injection Machine", "冲床": "Press", "其他": "Other",
  "模具": "Mold", "模具编号": "Mold No.", "模具名称": "Mold Name", "注塑模": "Injection Mold", "冲压模": "Stamping Die",
  "适用产品": "Applicable Product", "适用设备": "Applicable Equipment", "设计寿命": "Design Life", "初始累计次数": "Initial Count",
  "累计次数": "Current Count", "保养周期": "Maintenance Cycle", "预警阈值(%)": "Warning Threshold (%)", "模穴数/单次出件数": "Cavities / Output per Cycle",
  "上次保养": "Last Maintenance", "寿命使用率": "Life Usage", "累计/设计寿命": "Current / Design Life", "累计 / 设计寿命": "Current / Design Life",
  "模具寿命预警": "Mold Life Alerts", "当前状态": "Current Status", "待保养": "Maintenance Due", "维修中": "Under Repair", "报废": "Scrapped",
  "可用": "Available", "生产中": "In Production", "历史生产批次": "Production History", "保养 / 维修记录": "Maintenance / Repair Records",
  "保养类型": "Maintenance Type", "保养人员": "Technician", "保养内容": "Maintenance Details", "更换部件": "Replaced Parts",
  "保养结果": "Result", "可继续生产": "Production Allowed", "人员": "Person", "内容": "Details",
  "工单": "Work Order", "工单号": "Work Order No.", "计划数量": "Planned Quantity", "计划区间": "Planned Period",
  "计划开始 ~ 结束日期": "Planned Start - End", "计划设备": "Planned Equipment", "计划模具": "Planned Mold", "BOM 版本": "BOM Version",
  "工艺路线": "Process Route", "备注": "Notes", "进度": "Progress", "未下达": "Draft", "已下达": "Released", "已完工": "Completed", "已关闭": "Closed",
  "批次号": "Batch No.", "班次": "Shift", "白班": "Day Shift", "夜班": "Night Shift", "操作员": "Operator", "日期 / 班次": "Date / Shift",
  "注塑": "Injection", "冲压": "Stamping",
  "日期/班次": "Date / Shift", "生产时间": "Production Time", "开工 ~ 结束时间": "Start - End Time", "报工时间": "Report Time",
  "良品": "Good", "不良": "Defects", "良品数量": "Good Quantity", "不良数量": "Defect Quantity", "不良品数量": "Defect Quantity",
  "总生产数量": "Total Output", "不良率": "Defect Rate", "良率": "Yield", "材料利用率": "Material Utilization", "实际消耗重量": "Actual Consumption",
  "本批领用重量 (kg)": "Issued Weight (kg)", "退料重量 (kg)": "Returned Weight (kg)", "剩余卷材重量 (kg)": "Remaining Coil Weight (kg)",
  "水口料 / 报废重量 (kg)": "Runner / Scrap Weight (kg)", "边角料重量 (kg)": "Scrap Weight (kg)", "领用 / 退料": "Issued / Returned",
  "废料重量": "Scrap Weight", "本次模次 / 冲次": "Cycles / Strokes", "入库": "Stock-in", "入库数量": "Stock-in Quantity",
  "实时计算预览": "Calculation Preview", "最近一次提交结果": "Latest Submission", "生成批次号": "Generated Batch No.", "提交报工，生成生产批次": "Submit and Generate Batch",
  "不良原因": "Defect Reason", "不良原因字典": "Defect Reasons", "不良明细": "Defect Details", "责任环节": "Responsible Area", "处理方式": "Disposition",
  "处理": "Disposition", "数量": "Quantity", "原材料": "Raw Material", "工艺": "Process", "返工": "Rework", "隔离": "Quarantine", "让步接收": "Concession Accept",
  "原材料入库": "Raw Material Receipt", "原材料批次入库": "Receive Material Lot", "入库日期": "Receipt Date", "入库时间": "Stock-in Time",
  "入库单号": "Stock-in No.", "入库人": "Stock-in By", "登记人": "Recorded By", "仓库": "Warehouse", "仓库/库位": "Warehouse / Location",
  "剩余可用": "Available Quantity", "检验状态": "Inspection Status", "库存状态": "Stock Status", "待检": "Pending Inspection", "合格": "Passed",
  "不合格": "Failed", "冻结": "Frozen", "已消耗": "Consumed", "工单领料": "Material Issues", "退料": "Material Returns",
  "领料数量": "Issued Quantity", "领料人": "Issued By", "领料时间": "Issue Time", "退料数量": "Returned Quantity", "退料原因": "Return Reason",
  "退料人": "Returned By", "退料时间": "Return Time", "成品/半成品入库": "Finished / Semi-finished Stock-in", "待入库良品": "Good Qty Pending",
  "待隔离不良": "Defects Pending Quarantine", "不良品隔离": "Defect Quarantine", "不良品隔离区": "Defect Quarantine Area",
  "已入库记录": "Stock-in Records", "待入库批次（良品尚未登记入库）": "Pending Batches", "登记入库": "Record Stock-in", "良品入库": "Good Stock-in", "不良隔离": "Quarantine Defects",
  "正向追溯（原材料→生产批次）": "Forward Trace (Material to Batch)", "反向追溯（生产批次→全链路）": "Reverse Trace (Batch to Full Chain)",
  "模具追溯": "Mold Trace", "累计使用情况": "Cumulative Usage", "不良记录": "Defect Records", "入库记录": "Stock-in Records",
  "每日生产日报（明细）": "Daily Production Report (Details)", "汇总报表": "Summary Report", "导出 CSV": "Export CSV",
  "按日期汇总": "By Date", "按班次汇总": "By Shift", "按工单汇总": "By Work Order", "按产品SKU汇总": "By Product SKU",
  "按设备汇总": "By Equipment", "按模具汇总": "By Mold", "按原材料批次汇总": "By Material Lot", "按不良原因汇总": "By Defect Reason",
  "日期": "Date", "维度": "Dimension", "良品合计": "Good Total", "不良合计": "Defect Total", "总产合计": "Output Total", "批次数": "Batch Count",
  "今日总产量": "Today's Output", "今日良率": "Today's Yield", "进行中工单": "Active Work Orders", "待处理工单（未下达 / 已下达未开工）": "Pending Work Orders",
  "不良原因 TOP5（近7日）": "Top 5 Defects (7 Days)", "近7日产量趋势": "7-day Output Trend", "近7日良率趋势": "7-day Yield Trend",
  "近7日总产量": "7-day Total Output",
  "设备台账": "Equipment", "班次 / 不良原因": "Shifts / Defect Reasons", "班次字典": "Shift Dictionary",
  "全部": "All", "暂无生产批次": "No production batches", "暂无生产记录": "No production records", "暂无记录": "No records", "暂无预警": "No alerts",
  "暂无保养记录": "No maintenance records", "暂无待入库批次": "No pending batches", "暂无待处理工单": "No pending work orders",
  "当日暂无生产记录": "No production records for this date", "无不良记录": "No defect records", "尚未入库": "Not stocked in",
  "请选择一个原材料批次号": "Select a material lot", "请选择一个生产批次号": "Select a production batch", "请选择一套模具": "Select a mold",
  "选择原材料批次号进行正向追溯": "Select a material lot for forward trace", "选择生产批次号进行反向追溯": "Select a batch for reverse trace",
  "选择模具编号进行模具追溯": "Select a mold for trace", "选择已下达/生产中的工单": "Select a released or active work order",
  "选择产品 SKU": "Select a product SKU", "选择计划设备": "Select planned equipment", "选择计划模具": "Select planned mold", "请先选择产品 SKU": "Select a product SKU first",
  "暂无可开工工单（需先下达）": "No available work orders (release one first)", "选择或输入操作员": "Select or enter operator", "输入主管姓名": "Enter supervisor name",
  "原料仓-A": "Raw Material Warehouse A", "成品仓": "Finished Goods Warehouse", "半成品中转仓": "Semi-finished Warehouse",
  "保存失败": "Save failed", "更新失败": "Update failed", "删除失败": "Delete failed", "撤销失败": "Undo failed", "提交失败": "Submission failed",
  "工单创建失败": "Failed to create work order", "工单状态更新失败": "Failed to update work order", "入库失败": "Stock-in failed", "保养登记失败": "Maintenance failed",
  "模具已保存": "Mold saved", "模具已删除": "Mold deleted", "工单已删除": "Work order deleted", "工单已更新": "Work order updated",
  "物料批次已删除": "Material lot deleted", "物料批次已更新": "Material lot updated", "保养记录已删除": "Maintenance record deleted", "保养记录已更新": "Maintenance record updated",
  "入库登记成功": "Stock-in recorded", "原材料入库登记成功": "Material receipt recorded", "不良品隔离登记成功": "Defect quarantine recorded",
  "入库/隔离登记已撤销": "Stock-in / quarantine record undone", "入库/隔离记录已更新": "Stock-in / quarantine record updated",
  "保养登记完成，模具已恢复可用": "Maintenance completed; mold is available", "保养/维修记录已登记": "Maintenance / repair recorded",
  "生产批次已作废，相关库存和模具次数已回滚": "Batch voided; inventory and mold count rolled back",
  "模具已超过设计寿命": "Mold Design Life Exceeded", "主管已确认，继续": "Supervisor Confirmed, Continue", "已超设计寿命，提交时需主管二次确认": "Design life exceeded; supervisor confirmation required",
  "接近/超过保养预警阈值": "Maintenance warning threshold reached", "确认继续开工？": "Continue production?",
  "存在不良数量，请录入不良明细（合计不可超过不良数量）": "Enter defect details for the reported defect quantity",
  "小批次追溯：追溯粒度为「工单+日期+班次+SKU+设备+模具+原材料批次」组成的生产批次，不追溯到单件产品（见 SPEC §4）": "Lot-level traceability uses work order, date, shift, SKU, equipment, mold, and material lot. Individual units are not traced (SPEC §4).",
  "缺料": "Short Shot", "飞边": "Flash", "缩水": "Sink Mark", "变形": "Deformation", "色差": "Color Variation", "黑点": "Black Speck",
  "尺寸异常": "Dimension Out of Spec", "烧焦": "Burn Mark", "气纹": "Gas Mark", "毛刺": "Burr", "裂纹": "Crack",
  "尺寸超差": "Dimensional Deviation", "压伤": "Dent", "划伤": "Scratch", "孔位偏差": "Hole Misalignment", "材料异常": "Material Issue",
};

const PHRASES = Object.entries(EN).sort((a, b) => b[0].length - a[0].length);

export function translateText(value: string): string {
  const trimmed = value.trim();
  if (!trimmed || !/[\u3400-\u9fff]/.test(trimmed)) return value;
  const leading = value.slice(0, value.indexOf(trimmed));
  const trailing = value.slice(value.indexOf(trimmed) + trimmed.length);
  let translated = EN[trimmed] ?? trimmed;
  if (!EN[trimmed]) {
    for (const [zh, en] of PHRASES) translated = translated.split(zh).join(en);
    translated = translated
      .replace(/新增/g, "Add ").replace(/编辑/g, "Edit ").replace(/删除/g, "Delete ")
      .replace(/（/g, " (").replace(/）/g, ")").replace(/，/g, ", ").replace(/：/g, ": ").replace(/。/g, ".");
  }
  return `${leading}${translated}${trailing}`;
}
