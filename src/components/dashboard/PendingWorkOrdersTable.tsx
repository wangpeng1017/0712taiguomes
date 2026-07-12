"use client";

import { Table } from "antd";
import { StatusTag } from "@/components/StatusTag";

type Row = {
  id: string;
  no: string;
  type: string;
  planQty: number;
  planStart: string;
  planEnd: string;
  status: string;
  sku: { name: string; code: string };
};

export function PendingWorkOrdersTable({ rows }: { rows: Row[] }) {
  return (
    <Table
      size="small"
      pagination={false}
      rowKey="id"
      dataSource={rows}
      locale={{ emptyText: "暂无待处理工单" }}
      columns={[
        { title: "工单号", dataIndex: "no" },
        { title: "产品", render: (_, r) => `${r.sku.name}（${r.sku.code}）` },
        { title: "类型", dataIndex: "type" },
        { title: "计划数量", dataIndex: "planQty", className: "tabular-nums" },
        { title: "计划区间", render: (_, r) => `${r.planStart.slice(0, 10)} ~ ${r.planEnd.slice(0, 10)}` },
        { title: "状态", render: (_, r) => <StatusTag status={r.status} /> },
      ]}
    />
  );
}
