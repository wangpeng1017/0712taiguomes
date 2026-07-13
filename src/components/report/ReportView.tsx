"use client";

import { useMemo, useState } from "react";
import { Button, Card, DatePicker, Select, Space, Table, Tag } from "antd";
import { DownloadOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import { localDateLabel } from "@/lib/date-utils";
import { defectRate, totalQty } from "@/lib/production-calc";
import { TODAY } from "@/lib/constants";

type Defect = { qty: number; reason: { reason: string } };
type StockIn = { qty: number; type: string };
type Batch = {
  id: string; batchNo: string; shift: string; startTime: string; goodQty: number; badQty: number;
  issuedWeight: number | null; returnWeight: number | null; thisMoldCount: number | null;
  workOrder: { no: string; planQty: number };
  sku: { code: string; name: string };
  equipment: { code: string };
  mold: { code: string; status: string; currentCount: number };
  materialLot: { lotNo: string };
  defects: Defect[];
  stockIns: StockIn[];
};

const DIMENSIONS = [
  { key: "date", label: "按日期汇总" },
  { key: "shift", label: "按班次汇总" },
  { key: "workOrder", label: "按工单汇总" },
  { key: "sku", label: "按产品SKU汇总" },
  { key: "equipment", label: "按设备汇总" },
  { key: "mold", label: "按模具汇总" },
  { key: "materialLot", label: "按原材料批次汇总" },
  { key: "defectReason", label: "按不良原因汇总" },
] as const;

function toCsv(headers: string[], rows: (string | number)[][]): string {
  const escape = (v: string | number) => {
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers, ...rows].map((r) => r.map(escape).join(",")).join("\n");
}

function downloadCsv(filename: string, csv: string) {
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function ReportView({ batches }: { batches: Batch[] }) {
  const [date, setDate] = useState(TODAY);
  const [dim, setDim] = useState<(typeof DIMENSIONS)[number]["key"]>("date");

  const workOrderProgress = useMemo(() => {
    const m = new Map<string, { produced: number; planQty: number }>();
    for (const b of batches) {
      const cur = m.get(b.workOrder.no) ?? { produced: 0, planQty: b.workOrder.planQty };
      cur.produced += b.goodQty;
      m.set(b.workOrder.no, cur);
    }
    return m;
  }, [batches]);

  const moldDailyUsage = useMemo(() => {
    const m = new Map<string, number>();
    for (const b of batches) {
      const key = `${b.mold.code}_${localDateLabel(new Date(b.startTime))}`;
      m.set(key, (m.get(key) ?? 0) + (b.thisMoldCount ?? 0));
    }
    return m;
  }, [batches]);

  const moldCumulative = useMemo(() => {
    const m = new Map<string, number>();
    for (const b of batches) m.set(b.mold.code, b.mold.currentCount);
    return m;
  }, [batches]);

  const detailRows = useMemo(
    () => batches.filter((b) => localDateLabel(new Date(b.startTime)) === date),
    [batches, date]
  );

  const summaryRows = useMemo(() => {
    const scopedBatches = batches.filter((batch) => localDateLabel(new Date(batch.startTime)) === date);
    if (dim === "defectReason") {
      const m = new Map<string, { qty: number; batchSet: Set<string> }>();
      for (const b of scopedBatches) {
        for (const d of b.defects) {
          const e = m.get(d.reason.reason) ?? { qty: 0, batchSet: new Set<string>() };
          e.qty += d.qty;
          e.batchSet.add(b.id);
          m.set(d.reason.reason, e);
        }
      }
      return [...m.entries()]
        .sort((a, b) => b[1].qty - a[1].qty)
        .map(([label, v]) => ({ label, qty: v.qty, batches: v.batchSet.size }));
    }

    const keyOf: Record<string, (b: Batch) => string> = {
      date: (b) => localDateLabel(new Date(b.startTime)),
      shift: (b) => b.shift,
      workOrder: (b) => b.workOrder.no,
      sku: (b) => `${b.sku.name}（${b.sku.code}）`,
      equipment: (b) => b.equipment.code,
      mold: (b) => b.mold.code,
      materialLot: (b) => b.materialLot.lotNo,
    };
    const fn = keyOf[dim];
    const m = new Map<string, { good: number; bad: number; batches: number }>();
    for (const b of scopedBatches) {
      const key = fn(b);
      const e = m.get(key) ?? { good: 0, bad: 0, batches: 0 };
      e.good += b.goodQty;
      e.bad += b.badQty;
      e.batches += 1;
      m.set(key, e);
    }
    return [...m.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([label, v]) => ({
        label,
        good: v.good,
        bad: v.bad,
        total: v.good + v.bad,
        yieldPct: Math.round((1 - defectRate(v.bad, v.good + v.bad)) * 1000) / 10,
        batches: v.batches,
      }));
  }, [batches, date, dim]);

  function exportDetailCsv() {
    const headers = [
      "日期", "班次", "工单号", "产品SKU", "产品名称", "计划数量", "良品数量", "不良品数量", "总生产数量",
      "工单完成率%", "良率%", "设备编号", "模具编号", "原材料批次", "原材料领用数量", "原材料退料数量",
      "原材料实际消耗", "入库数量", "不良原因", "模具本日使用次数", "模具累计使用次数(当前)", "模具保养状态",
    ];
    const rows = detailRows.map((b) => {
      const total = totalQty(b.goodQty, b.badQty);
      const progress = workOrderProgress.get(b.workOrder.no);
      const consumption = (b.issuedWeight ?? 0) - (b.returnWeight ?? 0);
      const stockInQty = b.stockIns.filter((record) => record.type !== "不良品隔离").reduce((s, si) => s + si.qty, 0);
      const reasons = [...new Set(b.defects.map((d) => d.reason.reason))].join("/");
      return [
        localDateLabel(new Date(b.startTime)), b.shift, b.workOrder.no, b.sku.code, b.sku.name, b.workOrder.planQty,
        b.goodQty, b.badQty, total,
        progress ? Math.round((progress.produced / progress.planQty) * 1000) / 10 : 0,
        total > 0 ? Math.round((b.goodQty / total) * 1000) / 10 : 0,
        b.equipment.code, b.mold.code, b.materialLot.lotNo, b.issuedWeight ?? 0, b.returnWeight ?? 0,
        Math.round(consumption * 100) / 100, stockInQty, reasons || "-",
        moldDailyUsage.get(`${b.mold.code}_${date}`) ?? 0, moldCumulative.get(b.mold.code) ?? 0, b.mold.status,
      ];
    });
    downloadCsv(`daily-report-${date}.csv`, toCsv(headers, rows));
  }

  function exportSummaryCsv() {
    if (dim === "defectReason") {
      const rows = (summaryRows as { label: string; qty: number; batches: number }[]).map((r) => [r.label, r.qty, r.batches]);
      downloadCsv(`summary-${date}-defect-reason.csv`, toCsv(["不良原因", "数量合计", "涉及批次数"], rows));
      return;
    }
    const rows = (summaryRows as { label: string; good: number; bad: number; total: number; yieldPct: number; batches: number }[]).map((r) => [
      r.label, r.good, r.bad, r.total, r.yieldPct, r.batches,
    ]);
    downloadCsv(`summary-${date}-${dim}.csv`, toCsv(["维度", "良品合计", "不良合计", "总产合计", "良率%", "批次数"], rows));
  }

  return (
    <Space direction="vertical" size="large" style={{ width: "100%" }}>
      <Card
        size="small"
        title="每日生产日报（明细）"
        extra={
          <Space>
            <DatePicker value={dayjs(date)} onChange={(v) => v && setDate(v.format("YYYY-MM-DD"))} allowClear={false} />
            <Button icon={<DownloadOutlined />} onClick={exportDetailCsv}>
              导出 CSV
            </Button>
          </Space>
        }
      >
        <Table
          size="small"
          rowKey="id"
          dataSource={detailRows}
          scroll={{ x: 1400 }}
          locale={{ emptyText: "当日暂无生产记录" }}
          columns={[
            { title: "班次", dataIndex: "shift", width: 64 },
            { title: "工单号", render: (_, r) => r.workOrder.no },
            { title: "产品", render: (_, r) => `${r.sku.name}（${r.sku.code}）` },
            { title: "良品", dataIndex: "goodQty", className: "tabular-nums" },
            { title: "不良", dataIndex: "badQty", className: "tabular-nums" },
            { title: "良率", render: (_, r) => {
                const t = totalQty(r.goodQty, r.badQty);
                return <span className="tabular-nums">{t > 0 ? Math.round((r.goodQty / t) * 1000) / 10 : 0}%</span>;
              } },
            { title: "设备/模具", render: (_, r) => `${r.equipment.code} / ${r.mold.code}` },
            { title: "原材料批次", render: (_, r) => r.materialLot.lotNo },
            { title: "领用/退料(kg)", render: (_, r) => `${r.issuedWeight ?? 0} / ${r.returnWeight ?? 0}` },
            { title: "入库数量", render: (_, r) => r.stockIns.filter((record) => record.type !== "不良品隔离").reduce((s, si) => s + si.qty, 0) },
            { title: "不良原因", render: (_, r) => {
                const reasons = [...new Set(r.defects.map((d) => d.reason.reason))];
                return reasons.length ? reasons.map((x) => <Tag key={x}>{x}</Tag>) : "-";
              } },
            { title: "模具当日次数", render: (_, r) => moldDailyUsage.get(`${r.mold.code}_${date}`) ?? 0 },
            { title: "模具保养状态", render: (_, r) => r.mold.status },
          ]}
        />
      </Card>

      <Card
        size="small"
        title={`汇总报表（${date}）`}
        extra={
          <Space>
            <Select value={dim} onChange={setDim} style={{ width: 180 }} options={DIMENSIONS.map((d) => ({ value: d.key, label: d.label }))} />
            <Button icon={<DownloadOutlined />} onClick={exportSummaryCsv}>
              导出 CSV
            </Button>
          </Space>
        }
      >
        {dim === "defectReason" ? (
          <Table
            size="small"
            rowKey="label"
            dataSource={summaryRows as { label: string; qty: number; batches: number }[]}
            columns={[
              { title: "不良原因", dataIndex: "label" },
              { title: "数量合计", dataIndex: "qty", className: "tabular-nums" },
              { title: "涉及批次数", dataIndex: "batches", className: "tabular-nums" },
            ]}
          />
        ) : (
          <Table
            size="small"
            rowKey="label"
            dataSource={summaryRows as { label: string; good: number; bad: number; total: number; yieldPct: number; batches: number }[]}
            columns={[
              { title: DIMENSIONS.find((d) => d.key === dim)?.label.replace("按", "").replace("汇总", "") ?? "维度", dataIndex: "label" },
              { title: "良品合计", dataIndex: "good", className: "tabular-nums" },
              { title: "不良合计", dataIndex: "bad", className: "tabular-nums" },
              { title: "总产合计", dataIndex: "total", className: "tabular-nums" },
              { title: "良率%", dataIndex: "yieldPct", className: "tabular-nums" },
              { title: "批次数", dataIndex: "batches", className: "tabular-nums" },
            ]}
          />
        )}
      </Card>
    </Space>
  );
}
