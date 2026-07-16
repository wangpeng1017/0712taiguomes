"use client";

import { useMemo, useState } from "react";
import { Alert, Button, Card, Col, DatePicker, Progress, Row, Select, Space, Statistic, Table, Tag } from "antd";
import { DownloadOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import { localDateLabel } from "@/lib/date-utils";
import { TODAY } from "@/lib/constants";
import type { TraceMaterialConsumption, TraceOperation } from "@/lib/queries/trace";

type Defect = { qty: number; reason: { reason: string } };
type Batch = {
  id: string;
  batchNo: string;
  shift: string;
  startTime: string;
  goodQty: number;
  badQty: number;
  stockInQty: number;
  transferredQty: number;
  wipQty: number;
  fpyPct: number;
  issuedWeight: number;
  returnWeight: number;
  workOrder: { no: string; planQty: number };
  sku: { code: string; name: string };
  equipment: { code: string; name: string } | null;
  mold: { code: string; name: string } | null;
  materialLot: { lotNo: string; material: { name: string } } | null;
  routeVersion: { id: string | null; label: string } | null;
  operation: TraceOperation | null;
  consumptions: TraceMaterialConsumption[];
  defects: Defect[];
};
type Capabilities = { routes: boolean; operations: boolean; genealogy: boolean; quality: boolean; rework: boolean };

const DIMENSIONS = [
  { key: "date", label: "按日期汇总" },
  { key: "shift", label: "按班次汇总" },
  { key: "workOrder", label: "按工单汇总" },
  { key: "sku", label: "按产品 SKU 汇总" },
  { key: "route", label: "按路线版本汇总" },
  { key: "operation", label: "按工序汇总" },
  { key: "workCenter", label: "按工作中心汇总" },
  { key: "equipment", label: "按设备汇总" },
  { key: "mold", label: "按模具汇总" },
  { key: "materialLot", label: "按投入批次汇总" },
  { key: "defectReason", label: "按不良原因汇总" },
] as const;

type DimensionKey = (typeof DIMENSIONS)[number]["key"];
type SummaryRow = { label: string; good: number; bad: number; total: number; fpyPct: number; wipQty: number; transferredQty: number; stockInQty: number; batches: number };

function toCsv(headers: string[], rows: (string | number)[][]): string {
  const escape = (value: string | number) => {
    const text = String(value);
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  return [headers, ...rows].map((row) => row.map(escape).join(",")).join("\n");
}

function downloadCsv(filename: string, csv: string) {
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function inputLotLabel(batch: Batch): string {
  const labels = batch.consumptions.map((item) => item.lotNo ?? item.sourceBatchNo).filter((label): label is string => !!label);
  return [...new Set(labels)].join(" / ") || batch.materialLot?.lotNo || "-";
}

function fpy(good: number, bad: number): number {
  const total = good + bad;
  return total > 0 ? Math.round((good / total) * 1000) / 10 : 0;
}

export function ReportView({ batches, capabilities }: { batches: Batch[]; capabilities: Capabilities }) {
  const [date, setDate] = useState(TODAY);
  const [dimension, setDimension] = useState<DimensionKey>("operation");

  const detailRows = useMemo(() => batches.filter((batch) => localDateLabel(new Date(batch.startTime)) === date), [batches, date]);
  const dailyTotals = useMemo(() => detailRows.reduce((totals, batch) => ({
    good: totals.good + batch.goodQty,
    bad: totals.bad + batch.badQty,
    wip: totals.wip + batch.wipQty,
    transferred: totals.transferred + batch.transferredQty,
    stockIn: totals.stockIn + batch.stockInQty,
  }), { good: 0, bad: 0, wip: 0, transferred: 0, stockIn: 0 }), [detailRows]);
  const dailyFpy = fpy(dailyTotals.good, dailyTotals.bad);

  const finalOperationProgress = useMemo(() => {
    const progress = new Map<string, { produced: number; planQty: number }>();
    for (const batch of batches.filter((item) => item.operation?.isFinal ?? true)) {
      const current = progress.get(batch.workOrder.no) ?? { produced: 0, planQty: batch.workOrder.planQty };
      current.produced += batch.goodQty;
      progress.set(batch.workOrder.no, current);
    }
    return progress;
  }, [batches]);

  const summaryRows = useMemo(() => {
    if (dimension === "defectReason") {
      const reasons = new Map<string, { qty: number; batchIds: Set<string>; wip: number }>();
      for (const batch of detailRows) {
        for (const defect of batch.defects) {
          const current = reasons.get(defect.reason.reason) ?? { qty: 0, batchIds: new Set<string>(), wip: 0 };
          current.qty += defect.qty;
          current.batchIds.add(batch.id);
          current.wip += batch.wipQty;
          reasons.set(defect.reason.reason, current);
        }
      }
      return [...reasons.entries()].map(([label, value]) => ({ label, qty: value.qty, batches: value.batchIds.size, wipQty: value.wip }));
    }

    const keyOf: Record<Exclude<DimensionKey, "defectReason">, (batch: Batch) => string> = {
      date: (batch) => localDateLabel(new Date(batch.startTime)),
      shift: (batch) => batch.shift,
      workOrder: (batch) => batch.workOrder.no,
      sku: (batch) => `${batch.sku.name}（${batch.sku.code}）`,
      route: (batch) => batch.routeVersion?.label ?? "历史单工序路线",
      operation: (batch) => batch.operation ? `${batch.operation.sequence}. ${batch.operation.name}（${batch.operation.code}）` : "历史单工序",
      workCenter: (batch) => batch.operation?.workCenter ?? "未配置",
      equipment: (batch) => batch.equipment?.code ?? "未配置",
      mold: (batch) => batch.mold?.code ?? "不适用",
      materialLot: inputLotLabel,
    };
    const grouped = new Map<string, Omit<SummaryRow, "label" | "fpyPct">>();
    for (const batch of detailRows) {
      const key = keyOf[dimension](batch);
      const current = grouped.get(key) ?? { good: 0, bad: 0, total: 0, wipQty: 0, transferredQty: 0, stockInQty: 0, batches: 0 };
      current.good += batch.goodQty;
      current.bad += batch.badQty;
      current.total += batch.goodQty + batch.badQty;
      current.wipQty += batch.wipQty;
      current.transferredQty += batch.transferredQty;
      current.stockInQty += batch.stockInQty;
      current.batches += 1;
      grouped.set(key, current);
    }
    return [...grouped.entries()].sort((left, right) => left[0].localeCompare(right[0])).map(([label, value]): SummaryRow => ({ ...value, label, fpyPct: fpy(value.good, value.bad) }));
  }, [detailRows, dimension]);

  function exportDetailCsv() {
    const headers = [
      "日期", "班次", "工单号", "路线版本", "工序顺序", "工序编码", "工序名称", "工作中心", "生产批次", "产品SKU", "产品名称",
      "良品数量", "不良数量", "FPY%", "工序转出数量", "在制品数量", "入库数量", "设备编号", "模具编号", "投入原料/上游批次",
      "工单末工序完成率%", "不良原因",
    ];
    const rows = detailRows.map((batch) => {
      const progress = finalOperationProgress.get(batch.workOrder.no);
      return [
        localDateLabel(new Date(batch.startTime)), batch.shift, batch.workOrder.no, batch.routeVersion?.label ?? "历史单工序路线",
        batch.operation?.sequence ?? 1, batch.operation?.code ?? "LEGACY", batch.operation?.name ?? "历史单工序", batch.operation?.workCenter ?? "未配置",
        batch.batchNo, batch.sku.code, batch.sku.name, batch.goodQty, batch.badQty, batch.fpyPct, batch.transferredQty, batch.wipQty, batch.stockInQty,
        batch.equipment?.code ?? "-", batch.mold?.code ?? "-", inputLotLabel(batch),
        progress ? Math.round((progress.produced / progress.planQty) * 1000) / 10 : 0,
        [...new Set(batch.defects.map((defect) => defect.reason.reason))].join("/") || "-",
      ];
    });
    downloadCsv(`operation-daily-report-${date}.csv`, toCsv(headers, rows));
  }

  function exportSummaryCsv() {
    if (dimension === "defectReason") {
      const rows = summaryRows as { label: string; qty: number; batches: number; wipQty: number }[];
      downloadCsv(`summary-${date}-defect-reason.csv`, toCsv(["不良原因", "数量合计", "涉及批次数", "关联在制品"], rows.map((row) => [row.label, row.qty, row.batches, row.wipQty])));
      return;
    }
    const rows = summaryRows as SummaryRow[];
    downloadCsv(`summary-${date}-${dimension}.csv`, toCsv(
      ["维度", "良品合计", "不良合计", "总产合计", "FPY%", "转出数量", "在制品", "入库数量", "批次数"],
      rows.map((row) => [row.label, row.good, row.bad, row.total, row.fpyPct, row.transferredQty, row.wipQty, row.stockInQty, row.batches]),
    ));
  }

  return (
    <Space direction="vertical" size="large" style={{ width: "100%" }}>
      {!capabilities.operations && <Alert type="warning" showIcon message="历史批次尚未绑定工序任务，报表以单工序兼容口径展示；路线驱动的新报工将自动进入工序、工作中心和在制品统计。" />}

      <div className="table-toolbar" style={{ marginBottom: 0 }}>
        <DatePicker value={dayjs(date)} onChange={(value) => value && setDate(value.format("YYYY-MM-DD"))} allowClear={false} />
        <Select value={dimension} onChange={setDimension} style={{ width: 210 }} options={DIMENSIONS.map((item) => ({ value: item.key, label: item.label }))} />
        <Button icon={<DownloadOutlined />} onClick={exportDetailCsv}>导出工序明细</Button>
      </div>

      <Row gutter={16}>
        <Col span={6}><Card size="small"><Statistic title="当日工序良品" value={dailyTotals.good} suffix="件" /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title="一次通过率 FPY" value={dailyFpy} precision={1} suffix="%" /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title="工序转出" value={dailyTotals.transferred} suffix="件" /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title="当前在制品 WIP" value={dailyTotals.wip} suffix="件" /></Card></Col>
      </Row>

      <Card size="small" title="每日生产日报（工序执行明细）" extra={<Button icon={<DownloadOutlined />} onClick={exportDetailCsv}>导出 CSV</Button>}>
        <Table
          size="small"
          rowKey="id"
          dataSource={detailRows}
          scroll={{ x: 1750 }}
          locale={{ emptyText: "当日暂无工序报工记录" }}
          columns={[
            { title: "工序批次", dataIndex: "batchNo", fixed: "left", width: 190, render: (value) => <span className="mes-code">{value}</span> },
            { title: "工单", width: 150, render: (_, row) => <span className="mes-code">{row.workOrder.no}</span> },
            { title: "路线版本", width: 180, render: (_, row) => row.routeVersion?.label ?? "历史单工序路线" },
            { title: "工序", width: 180, render: (_, row) => row.operation ? `${row.operation.sequence}. ${row.operation.name}` : "历史单工序" },
            { title: "工作中心", width: 120, render: (_, row) => row.operation?.workCenter ?? "未配置" },
            { title: "产品", width: 190, render: (_, row) => `${row.sku.name}（${row.sku.code}）` },
            { title: "良品", dataIndex: "goodQty", width: 80, className: "tabular-nums" },
            { title: "不良", dataIndex: "badQty", width: 80, className: "tabular-nums" },
            { title: "FPY", dataIndex: "fpyPct", width: 115, render: (value) => <Progress percent={value} size="small" strokeColor={value >= 95 ? "#22a35a" : "#d97706"} /> },
            { title: "已转出", dataIndex: "transferredQty", width: 90, className: "tabular-nums" },
            { title: "在制品", dataIndex: "wipQty", width: 90, className: "tabular-nums" },
            { title: "入库", dataIndex: "stockInQty", width: 80, className: "tabular-nums" },
            { title: "设备 / 模具", width: 150, render: (_, row) => `${row.equipment?.code ?? "-"} / ${row.mold?.code ?? "-"}` },
            { title: "投入批次", width: 220, render: (_, row) => inputLotLabel(row) },
            { title: "班次", dataIndex: "shift", width: 70 },
            { title: "不良原因", width: 160, render: (_, row) => {
              const reasons = [...new Set(row.defects.map((defect) => defect.reason.reason))];
              return reasons.length ? reasons.map((reason) => <Tag key={reason}>{reason}</Tag>) : "-";
            } },
          ]}
        />
      </Card>

      <Card
        size="small"
        title={`工序生产汇总（${date}）`}
        extra={<Space><Select value={dimension} onChange={setDimension} style={{ width: 210 }} options={DIMENSIONS.map((item) => ({ value: item.key, label: item.label }))} /><Button icon={<DownloadOutlined />} onClick={exportSummaryCsv}>导出汇总</Button></Space>}
      >
        {dimension === "defectReason" ? (
          <Table size="small" rowKey="label" dataSource={summaryRows as { label: string; qty: number; batches: number; wipQty: number }[]} columns={[
            { title: "不良原因", dataIndex: "label" }, { title: "数量合计", dataIndex: "qty", className: "tabular-nums" },
            { title: "涉及批次数", dataIndex: "batches", className: "tabular-nums" }, { title: "关联在制品", dataIndex: "wipQty", className: "tabular-nums" },
          ]} />
        ) : (
          <Table size="small" rowKey="label" dataSource={summaryRows as SummaryRow[]} columns={[
            { title: DIMENSIONS.find((item) => item.key === dimension)?.label.replace("按", "").replace("汇总", "") ?? "维度", dataIndex: "label" },
            { title: "良品", dataIndex: "good", className: "tabular-nums" }, { title: "不良", dataIndex: "bad", className: "tabular-nums" },
            { title: "FPY%", dataIndex: "fpyPct", className: "tabular-nums" }, { title: "转出", dataIndex: "transferredQty", className: "tabular-nums" },
            { title: "在制品", dataIndex: "wipQty", className: "tabular-nums" }, { title: "入库", dataIndex: "stockInQty", className: "tabular-nums" },
            { title: "批次数", dataIndex: "batches", className: "tabular-nums" },
          ]} />
        )}
      </Card>
    </Space>
  );
}
