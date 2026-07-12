"use client";

import { Card, Table, Tabs, Tag } from "antd";
import { StatusTag } from "@/components/StatusTag";
import { SHIFTS } from "@/lib/constants";

type Sku = {
  id: string; code: string; name: string; type: string; customerCode: string | null; internalCode: string | null;
  spec: string | null; unit: string; stdWeight: number | null; isSemiFinished: boolean; isFinished: boolean; status: string;
};
type Material = {
  id: string; code: string; name: string; type: string; materialGrade: string | null; supplier: string | null;
  unit: string; shelfLife: string | null; status: string; thickness: number | null; width: number | null;
  coilWeight: number | null; color: string | null; dryingRequirement: string | null;
};
type Equipment = { id: string; code: string; name: string; type: string; line: string | null; status: string; capacity: string | null };
type DefectReason = { id: string; reason: string; appliesTo: string; status: string };

export function MasterDataView({
  skus, materials, equipments, defectReasons,
}: {
  skus: Sku[]; materials: Material[]; equipments: Equipment[]; defectReasons: DefectReason[];
}) {
  const skuTab = (
    <Table
      size="small"
      rowKey="id"
      dataSource={skus}
      columns={[
        { title: "SKU编码", dataIndex: "code", render: (v) => <span style={{ fontFamily: "ui-monospace, monospace" }}>{v}</span> },
        { title: "名称", dataIndex: "name" },
        { title: "类型", dataIndex: "type" },
        { title: "客户料号", dataIndex: "customerCode", render: (v) => v ?? "-" },
        { title: "内部料号", dataIndex: "internalCode", render: (v) => v ?? "-" },
        { title: "规格", dataIndex: "spec", render: (v) => v ?? "-" },
        { title: "标准重量(g)", dataIndex: "stdWeight", render: (v) => v ?? "-" },
        { title: "半成品/成品", render: (_, r) => (
            <>
              {r.isSemiFinished && <Tag>半成品</Tag>}
              {r.isFinished && <Tag color="green">成品</Tag>}
            </>
          ) },
        { title: "状态", dataIndex: "status", render: (v) => <StatusTag status={v} /> },
      ]}
    />
  );

  const materialTab = (
    <Table
      size="small"
      rowKey="id"
      dataSource={materials}
      columns={[
        { title: "物料编码", dataIndex: "code", render: (v) => <span style={{ fontFamily: "ui-monospace, monospace" }}>{v}</span> },
        { title: "名称", dataIndex: "name" },
        { title: "类型", dataIndex: "type" },
        { title: "材质/牌号", dataIndex: "materialGrade", render: (v) => v ?? "-" },
        { title: "供应商", dataIndex: "supplier", render: (v) => v ?? "-" },
        { title: "单位", dataIndex: "unit" },
        { title: "卷材规格", render: (_, r) => (r.thickness ? `${r.thickness}mm × ${r.width}mm，卷重${r.coilWeight}kg` : "-") },
        { title: "颗粒信息", render: (_, r) => (r.color ? `${r.color}，${r.dryingRequirement ?? "-"}` : "-") },
        { title: "状态", dataIndex: "status", render: (v) => <StatusTag status={v} /> },
      ]}
    />
  );

  const equipmentTab = (
    <Table
      size="small"
      rowKey="id"
      dataSource={equipments}
      columns={[
        { title: "设备编号", dataIndex: "code", render: (v) => <span style={{ fontFamily: "ui-monospace, monospace" }}>{v}</span> },
        { title: "设备名称", dataIndex: "name" },
        { title: "类型", dataIndex: "type" },
        { title: "所属产线", dataIndex: "line", render: (v) => v ?? "-" },
        { title: "产能参数", dataIndex: "capacity", render: (v) => v ?? "-" },
        { title: "状态", dataIndex: "status", render: (v) => <StatusTag status={v} /> },
      ]}
    />
  );

  const dictTab = (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Card size="small" title="班次字典">
        {SHIFTS.map((s) => (
          <Tag key={s}>{s}</Tag>
        ))}
      </Card>
      <Card size="small" title="不良原因字典">
        <Table
          size="small"
          rowKey="id"
          dataSource={defectReasons}
          pagination={false}
          columns={[
            { title: "适用工艺", dataIndex: "appliesTo", width: 100 },
            { title: "不良原因", dataIndex: "reason" },
            { title: "状态", dataIndex: "status", render: (v) => <StatusTag status={v} /> },
          ]}
        />
      </Card>
    </div>
  );

  return (
    <Tabs
      defaultActiveKey="sku"
      items={[
        { key: "sku", label: "产品SKU", children: skuTab },
        { key: "material", label: "物料主数据", children: materialTab },
        { key: "equipment", label: "设备台账", children: equipmentTab },
        { key: "dict", label: "班次 / 不良原因字典", children: dictTab },
      ]}
    />
  );
}
