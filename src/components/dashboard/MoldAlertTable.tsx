"use client";

import { Table } from "antd";
import { StatusTag } from "@/components/StatusTag";
import { MoldLifeMeter } from "@/components/MoldLifeMeter";

type MoldAlertRow = {
  mold: { id: string; code: string; name: string; status: string; warnThreshold: number };
  alert: { lifeRate: number };
};

export function MoldAlertTable({ rows }: { rows: MoldAlertRow[] }) {
  return (
    <Table
      size="small"
      pagination={false}
      rowKey={(r) => r.mold.id}
      dataSource={rows}
      locale={{ emptyText: "暂无预警" }}
      columns={[
        {
          title: "模具",
          render: (_, r) => (
            <div>
              <div>{r.mold.name}</div>
              <div style={{ fontSize: 11, color: "#8c98a4" }}>{r.mold.code}</div>
            </div>
          ),
        },
        { title: "状态", render: (_, r) => <StatusTag status={r.mold.status} /> },
        {
          title: "寿命使用率",
          render: (_, r) => <MoldLifeMeter rate={r.alert.lifeRate} warnThreshold={r.mold.warnThreshold} />,
        },
      ]}
    />
  );
}
