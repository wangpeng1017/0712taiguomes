"use client";

import { useMemo, useState, useTransition } from "react";
import { Button, Descriptions, Drawer, Input, Modal, Select, Space, Table, Tag, message } from "antd";
import { PlusOutlined, SearchOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import { ProductionReportForm } from "@/components/production/ProductionReportForm";
import { StatusTag } from "@/components/StatusTag";
import { voidProductionBatch } from "@/lib/actions/production";

type FormProps = Omit<React.ComponentProps<typeof ProductionReportForm>, "onSuccess">;
type Batch = {
  id: string; batchNo: string; status: string; shift: string; operator: string; startTime: string; endTime: string | null;
  goodQty: number; badQty: number; issuedWeight: number | null; returnWeight: number | null; scrapWeight: number | null;
  thisMoldCount: number | null; note: string | null; stockInQty: number;
  workOrder: { no: string }; sku: { name: string; code: string }; equipment: { code: string; name: string };
  mold: { code: string; name: string }; materialLot: { lotNo: string; material: { name: string } };
  defects: { id: string; qty: number; reason: string; action: string | null }[];
};

export function ProductionBatchView(props: FormProps & { batches: Batch[] }) {
  const { batches, ...formProps } = props;
  const [createOpen, setCreateOpen] = useState(false);
  const [detail, setDetail] = useState<Batch | null>(null);
  const [keyword, setKeyword] = useState("");
  const [status, setStatus] = useState<string>();
  const [pending, startTransition] = useTransition();

  const rows = useMemo(() => batches.filter((batch) => {
    const text = `${batch.batchNo} ${batch.workOrder.no} ${batch.sku.name} ${batch.sku.code} ${batch.operator}`.toLowerCase();
    return (!keyword || text.includes(keyword.toLowerCase())) && (!status || batch.status === status);
  }), [batches, keyword, status]);

  function confirmVoid(batch: Batch) {
    let reason = "";
    Modal.confirm({
      title: `作废生产批次 ${batch.batchNo}`,
      content: <Input.TextArea rows={3} placeholder="请输入作废原因" onChange={(event) => { reason = event.target.value; }} />,
      okText: "确认作废",
      okButtonProps: { danger: true },
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
          <Input prefix={<SearchOutlined />} allowClear placeholder="搜索批次号、工单、产品或操作员" value={keyword} onChange={(e) => setKeyword(e.target.value)} style={{ width: 320 }} />
          <Select allowClear placeholder="全部状态" value={status} onChange={setStatus} style={{ width: 140 }} options={["已完工", "已作废"].map((value) => ({ value, label: value }))} />
        </Space>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>新增报工</Button>
      </div>

      <Table
        rowKey="id"
        dataSource={rows}
        pagination={{ pageSize: 10, showSizeChanger: true }}
        scroll={{ x: 1200 }}
        locale={{ emptyText: "暂无生产批次" }}
        columns={[
          { title: "生产批次", dataIndex: "batchNo", fixed: "left", render: (value, row) => <a onClick={() => setDetail(row)} style={{ fontFamily: "ui-monospace, monospace" }}>{value}</a> },
          { title: "工单", render: (_, row) => row.workOrder.no },
          { title: "产品", render: (_, row) => <div><div>{row.sku.name}</div><div style={{ color: "#8c98a4", fontSize: 11 }}>{row.sku.code}</div></div> },
          { title: "设备 / 模具", render: (_, row) => `${row.equipment.code} / ${row.mold.code}` },
          { title: "日期 / 班次", render: (_, row) => `${dayjs(row.startTime).format("YYYY-MM-DD")} · ${row.shift}` },
          { title: "良品", dataIndex: "goodQty", className: "tabular-nums" },
          { title: "不良", dataIndex: "badQty", className: "tabular-nums" },
          { title: "入库", dataIndex: "stockInQty", className: "tabular-nums" },
          { title: "操作员", dataIndex: "operator" },
          { title: "状态", dataIndex: "status", render: (value) => <StatusTag status={value} /> },
          { title: "操作", fixed: "right", render: (_, row) => <Space><Button type="link" size="small" onClick={() => setDetail(row)}>详情</Button>{row.status !== "已作废" && <Button danger type="link" size="small" disabled={row.stockInQty > 0 || pending} onClick={() => confirmVoid(row)}>作废</Button>}</Space> },
        ]}
      />

      <Drawer title={`新增${formProps.type}报工`} open={createOpen} onClose={() => setCreateOpen(false)} width="min(1180px, 96vw)" destroyOnClose>
        <ProductionReportForm {...formProps} onSuccess={() => setCreateOpen(false)} />
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
          {detail.status !== "已作废" && <Button danger disabled={detail.stockInQty > 0 || pending} onClick={() => confirmVoid(detail)}>作废该批次</Button>}
        </Space>}
      </Drawer>
    </>
  );
}
