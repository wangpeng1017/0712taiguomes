"use client";

import { useMemo, useState, useTransition } from "react";
import { Button, Descriptions, Drawer, Input, Modal, Select, Space, Table, Tag, message } from "antd";
import type { TableProps } from "antd";
import { PlusOutlined, SearchOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import { ProductionReportForm } from "@/components/production/ProductionReportForm";
import { StatusTag } from "@/components/StatusTag";
import { voidProductionBatch } from "@/lib/actions/production";

type FormProps = Omit<React.ComponentProps<typeof ProductionReportForm>, "onSuccess" | "initialWorkOrderId">;
type Batch = {
  id: string; batchNo: string; status: string; shift: string; operator: string; startTime: string; endTime: string | null;
  goodQty: number; badQty: number; issuedWeight: number | null; returnWeight: number | null; scrapWeight: number | null;
  thisMoldCount: number | null; note: string | null; stockInQty: number;
  workOrder: { no: string }; sku: { name: string; code: string }; equipment: { code: string; name: string };
  mold: { code: string; name: string }; materialLot: { lotNo: string; material: { name: string } };
  defects: { id: string; qty: number; reason: string; action: string | null }[];
};
type WorkOrder = FormProps["workOrders"][number];
type TableRow =
  | { key: `batch:${string}`; kind: "batch"; status: string; batch: Batch }
  | { key: `work-order:${string}`; kind: "workOrder"; status: "已下达"; workOrder: WorkOrder };

export function ProductionBatchView(props: FormProps & { batches: Batch[] }) {
  const { batches, ...formProps } = props;
  const [createOpen, setCreateOpen] = useState(false);
  const [initialWorkOrderId, setInitialWorkOrderId] = useState<string>();
  const [detail, setDetail] = useState<Batch | null>(null);
  const [keyword, setKeyword] = useState("");
  const [status, setStatus] = useState<string>();
  const [pending, startTransition] = useTransition();

  const rows = useMemo<TableRow[]>(() => {
    const combinedRows: TableRow[] = [
      ...batches.map((batch): TableRow => ({ key: `batch:${batch.id}`, kind: "batch", status: batch.status, batch })),
      ...formProps.workOrders
        .filter((workOrder) => workOrder.status === "已下达")
        .map((workOrder): TableRow => ({ key: `work-order:${workOrder.id}`, kind: "workOrder", status: "已下达", workOrder })),
    ].sort((left, right) => {
      const leftTime = left.kind === "batch" ? left.batch.startTime : left.workOrder.updatedAt;
      const rightTime = right.kind === "batch" ? right.batch.startTime : right.workOrder.updatedAt;
      return dayjs(rightTime).valueOf() - dayjs(leftTime).valueOf();
    });

    const normalizedKeyword = keyword.trim().toLowerCase();
    return combinedRows.filter((row) => {
      const text = row.kind === "batch"
        ? `${row.batch.batchNo} ${row.batch.workOrder.no} ${row.batch.sku.name} ${row.batch.sku.code} ${row.batch.operator} ${row.batch.equipment.code} ${row.batch.mold.code}`
        : `${row.workOrder.no} ${row.workOrder.sku.name} ${row.workOrder.sku.code} ${row.workOrder.planEquipment?.code ?? ""} ${row.workOrder.planEquipment?.name ?? ""} ${row.workOrder.planMold?.code ?? ""} ${row.workOrder.planMold?.name ?? ""}`;
      return (!normalizedKeyword || text.toLowerCase().includes(normalizedKeyword)) && (!status || row.status === status);
    });
  }, [batches, formProps.workOrders, keyword, status]);

  const statusOptions = useMemo(
    () => Array.from(new Set(["已下达", ...batches.map((batch) => batch.status)])).map((value) => ({ value, label: value })),
    [batches]
  );

  const columns: TableProps<TableRow>["columns"] = [
    {
      title: "生产批次",
      fixed: "left",
      render: (_, row) => row.kind === "batch"
        ? <a onClick={() => setDetail(row.batch)} style={{ fontFamily: "ui-monospace, monospace" }}>{row.batch.batchNo}</a>
        : <span style={{ color: "#8c98a4" }}>待报工</span>,
    },
    { title: "工单", render: (_, row) => row.kind === "batch" ? row.batch.workOrder.no : row.workOrder.no },
    {
      title: "产品",
      render: (_, row) => {
        const sku = row.kind === "batch" ? row.batch.sku : row.workOrder.sku;
        return <div><div>{sku.name}</div><div style={{ color: "#8c98a4", fontSize: 11 }}>{sku.code}</div></div>;
      },
    },
    {
      title: "设备 / 模具",
      render: (_, row) => row.kind === "batch"
        ? `${row.batch.equipment.code} / ${row.batch.mold.code}`
        : `${row.workOrder.planEquipment?.code ?? "-"} / ${row.workOrder.planMold?.code ?? "-"}`,
    },
    {
      title: "日期 / 班次",
      render: (_, row) => row.kind === "batch"
        ? `${dayjs(row.batch.startTime).format("YYYY-MM-DD")} · ${row.batch.shift}`
        : `${dayjs(row.workOrder.planStart).format("YYYY-MM-DD")} ~ ${dayjs(row.workOrder.planEnd).format("YYYY-MM-DD")}`,
    },
    { title: "良品", className: "tabular-nums", render: (_, row) => row.kind === "batch" ? row.batch.goodQty : "-" },
    { title: "不良", className: "tabular-nums", render: (_, row) => row.kind === "batch" ? row.batch.badQty : "-" },
    { title: "入库", className: "tabular-nums", render: (_, row) => row.kind === "batch" ? row.batch.stockInQty : "-" },
    { title: "操作员", render: (_, row) => row.kind === "batch" ? row.batch.operator : "-" },
    { title: "状态", render: (_, row) => <StatusTag status={row.status} /> },
    {
      title: "操作",
      fixed: "right",
      render: (_, row) => row.kind === "workOrder"
        ? <Button type="link" size="small" onClick={() => { setInitialWorkOrderId(row.workOrder.id); setCreateOpen(true); }}>新增报工</Button>
        : <Space><Button type="link" size="small" onClick={() => setDetail(row.batch)}>详情</Button>{row.batch.status !== "已作废" && <Button className="mes-destructive-action" type="link" size="small" disabled={row.batch.stockInQty > 0 || pending} onClick={() => confirmVoid(row.batch)}>作废</Button>}</Space>,
    },
  ];

  function confirmVoid(batch: Batch) {
    let reason = "";
    Modal.confirm({
      title: `作废生产批次 ${batch.batchNo}`,
      content: <Input.TextArea rows={3} placeholder="请输入作废原因" onChange={(event) => { reason = event.target.value; }} />,
      okText: "确认作废",
      okButtonProps: { className: "mes-destructive-confirm" },
      cancelText: "取消",
      onOk: () => new Promise<void>((resolve, reject) => {
        if (!reason.trim()) {
          message.error("请输入作废原因");
          reject();
          return;
        }
        startTransition(async () => {
          try {
            await voidProductionBatch(batch.id, reason);
            message.success("生产批次已作废，相关库存和模具次数已回滚");
            setDetail(null);
            resolve();
          } catch (error) {
            message.error(error instanceof Error ? error.message : "作废失败");
            reject(error);
          }
        });
      }),
    });
  }

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 16 }}>
        <Space wrap>
          <Input prefix={<SearchOutlined />} allowClear placeholder="搜索批次、工单、产品、设备或操作员" value={keyword} onChange={(e) => setKeyword(e.target.value)} style={{ width: 320 }} />
          <Select allowClear placeholder="全部状态" value={status} onChange={setStatus} style={{ width: 140 }} options={statusOptions} />
        </Space>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => { setInitialWorkOrderId(undefined); setCreateOpen(true); }}>新增报工</Button>
      </div>

      <Table<TableRow>
        rowKey="key"
        dataSource={rows}
        pagination={{ pageSize: 10, showSizeChanger: true }}
        scroll={{ x: 1200 }}
        locale={{ emptyText: "暂无已下达工单或生产批次" }}
        columns={columns}
      />

      <Drawer title={`新增${formProps.type}报工`} open={createOpen} onClose={() => { setCreateOpen(false); setInitialWorkOrderId(undefined); }} width="min(1180px, 96vw)" destroyOnClose>
        <ProductionReportForm {...formProps} initialWorkOrderId={initialWorkOrderId} onSuccess={() => { setCreateOpen(false); setInitialWorkOrderId(undefined); }} />
      </Drawer>

      <Drawer title={detail ? `生产批次详情 · ${detail.batchNo}` : ""} open={!!detail} onClose={() => setDetail(null)} width={620}>
        {detail && <Space direction="vertical" size="middle" style={{ width: "100%" }}>
          <Descriptions bordered size="small" column={2}>
            <Descriptions.Item label="状态" span={2}><StatusTag status={detail.status} /></Descriptions.Item>
            <Descriptions.Item label="工单">{detail.workOrder.no}</Descriptions.Item>
            <Descriptions.Item label="产品">{detail.sku.name}（{detail.sku.code}）</Descriptions.Item>
            <Descriptions.Item label="设备">{detail.equipment.name}（{detail.equipment.code}）</Descriptions.Item>
            <Descriptions.Item label="模具">{detail.mold.name}（{detail.mold.code}）</Descriptions.Item>
            <Descriptions.Item label="原材料批次" span={2}>{detail.materialLot.lotNo} · {detail.materialLot.material.name}</Descriptions.Item>
            <Descriptions.Item label="生产时间" span={2}>{dayjs(detail.startTime).format("YYYY-MM-DD HH:mm")} ~ {detail.endTime ? dayjs(detail.endTime).format("HH:mm") : "-"}</Descriptions.Item>
            <Descriptions.Item label="良品 / 不良">{detail.goodQty} / {detail.badQty}</Descriptions.Item>
            <Descriptions.Item label="入库数量">{detail.stockInQty}</Descriptions.Item>
            <Descriptions.Item label="领用 / 退料">{detail.issuedWeight ?? 0} / {detail.returnWeight ?? 0} kg</Descriptions.Item>
            <Descriptions.Item label="废料重量">{detail.scrapWeight ?? 0} kg</Descriptions.Item>
            <Descriptions.Item label="本次模次 / 冲次">{detail.thisMoldCount ?? 0}</Descriptions.Item>
            <Descriptions.Item label="操作员">{detail.operator}</Descriptions.Item>
            {detail.note && <Descriptions.Item label="备注" span={2}>{detail.note}</Descriptions.Item>}
          </Descriptions>
          <Table size="small" pagination={false} rowKey="id" dataSource={detail.defects} locale={{ emptyText: "无不良记录" }} columns={[{ title: "不良原因", dataIndex: "reason" }, { title: "数量", dataIndex: "qty" }, { title: "处理", dataIndex: "action", render: (value) => value ? <Tag>{value}</Tag> : "-" }]} />
          {detail.status !== "已作废" && <Button className="mes-destructive-action" disabled={detail.stockInQty > 0 || pending} onClick={() => confirmVoid(detail)}>作废该批次</Button>}
        </Space>}
      </Drawer>
    </>
  );
}
