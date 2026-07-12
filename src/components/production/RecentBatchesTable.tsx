"use client";

import { Card, Table } from "antd";
import dayjs from "dayjs";

type Batch = {
  id: string;
  batchNo: string;
  shift: string;
  operator: string;
  startTime: Date;
  goodQty: number;
  badQty: number;
  workOrder: { no: string };
  sku: { name: string };
  equipment: { code: string };
  mold: { code: string };
};

export function RecentBatchesTable({ batches }: { batches: Batch[] }) {
  return (
    <Card title="最近生产批次" size="small" style={{ marginTop: 16 }}>
      <Table
        size="small"
        rowKey="id"
        pagination={false}
        dataSource={batches}
        locale={{ emptyText: "暂无批次记录" }}
        columns={[
          { title: "批次号", dataIndex: "batchNo", render: (v) => <span style={{ fontFamily: "ui-monospace, monospace" }}>{v}</span> },
          { title: "工单", render: (_, r) => r.workOrder.no },
          { title: "产品", render: (_, r) => r.sku.name },
          { title: "设备/模具", render: (_, r) => `${r.equipment.code} / ${r.mold.code}` },
          { title: "班次", dataIndex: "shift", width: 64 },
          { title: "操作员", dataIndex: "operator", width: 90 },
          { title: "时间", render: (_, r) => dayjs(r.startTime).format("MM-DD HH:mm") },
          { title: "良品", dataIndex: "goodQty", className: "tabular-nums" },
          { title: "不良", dataIndex: "badQty", className: "tabular-nums" },
        ]}
      />
    </Card>
  );
}
