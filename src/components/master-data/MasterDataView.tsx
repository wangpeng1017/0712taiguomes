"use client";

import { useState, useTransition } from "react";
import { Button, Checkbox, Form, Input, InputNumber, Modal, Popconfirm, Select, Space, Table, Tabs, Tag, message } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { StatusTag } from "@/components/StatusTag";
import { EQUIPMENT_STATUS, EQUIPMENT_TYPES, MATERIAL_TYPES, PRODUCT_TYPES, SHIFTS } from "@/lib/constants";
import { deleteMasterData, saveDefectReason, saveEquipmentMaster, saveMaterialMaster, saveProductSku } from "@/lib/actions/master-data";

type Sku = {
  id: string; code: string; name: string; type: string; customerCode: string | null; internalCode: string | null;
  spec: string | null; unit: string; stdWeight: number | null; isSemiFinished: boolean; isFinished: boolean; status: string;
};
type Material = {
  id: string; code: string; name: string; type: string; spec: string | null; materialGrade: string | null; supplier: string | null;
  unit: string; shelfLife: string | null; status: string; thickness: number | null; width: number | null;
  coilWeight: number | null; surfaceTreatment: string | null; color: string | null; dryingRequirement: string | null;
};
type Equipment = { id: string; code: string; name: string; type: string; line: string | null; status: string; capacity: string | null; note: string | null };
type DefectReason = { id: string; reason: string; appliesTo: string; status: string };
type Kind = "sku" | "material" | "equipment" | "defect";

const TITLE: Record<Kind, string> = { sku: "产品 SKU", material: "物料", equipment: "设备", defect: "不良原因" };

export function MasterDataView({ skus, materials, equipments, defectReasons }: {
  skus: Sku[]; materials: Material[]; equipments: Equipment[]; defectReasons: DefectReason[];
}) {
  const [form] = Form.useForm();
  const [editor, setEditor] = useState<{ kind: Kind; row?: Record<string, unknown> } | null>(null);
  const [pending, startTransition] = useTransition();

  function openEditor(kind: Kind, row?: Record<string, unknown>) {
    form.resetFields();
    setEditor({ kind, row });
    queueMicrotask(() => form.setFieldsValue(row ?? defaultValues(kind)));
  }

  function defaultValues(kind: Kind) {
    if (kind === "sku") return { type: "注塑", unit: "PCS", isFinished: true, isSemiFinished: false, status: "启用" };
    if (kind === "material") return { type: "塑料颗粒", unit: "KG", status: "启用" };
    if (kind === "equipment") return { type: "注塑机", status: "可用" };
    return { appliesTo: "通用", status: "启用" };
  }

  function save(values: Record<string, unknown>) {
    if (!editor) return;
    startTransition(async () => {
      try {
        const input = { ...values, id: editor.row?.id as string | undefined };
        if (editor.kind === "sku") await saveProductSku(input as Parameters<typeof saveProductSku>[0]);
        if (editor.kind === "material") await saveMaterialMaster(input as Parameters<typeof saveMaterialMaster>[0]);
        if (editor.kind === "equipment") await saveEquipmentMaster(input as Parameters<typeof saveEquipmentMaster>[0]);
        if (editor.kind === "defect") await saveDefectReason(input as Parameters<typeof saveDefectReason>[0]);
        message.success(`${TITLE[editor.kind]}已保存`);
        setEditor(null);
      } catch (error) {
        message.error(error instanceof Error ? error.message : "保存失败");
      }
    });
  }

  function remove(kind: Kind, id: string) {
    startTransition(async () => {
      try {
        await deleteMasterData(kind, id);
        message.success(`${TITLE[kind]}已删除`);
      } catch (error) {
        message.error(error instanceof Error ? error.message : "删除失败");
      }
    });
  }

  const actions = (kind: Kind, row: Record<string, unknown>) => (
    <Space size="small">
      <Button type="link" size="small" onClick={() => openEditor(kind, row)}>编辑</Button>
      <Popconfirm title={`确认删除该${TITLE[kind]}？`} description="已被业务数据引用时将拒绝删除。" onConfirm={() => remove(kind, row.id as string)}>
        <Button type="link" size="small" danger disabled={pending}>删除</Button>
      </Popconfirm>
    </Space>
  );

  const createButton = (kind: Kind) => <Button type="primary" icon={<PlusOutlined />} onClick={() => openEditor(kind)}>新增{TITLE[kind]}</Button>;
  const tableProps = { size: "small" as const, pagination: { pageSize: 10, showSizeChanger: true } };

  return (
    <>
      <Tabs
        defaultActiveKey="sku"
        items={[
          { key: "sku", label: "产品SKU", children: <><div className="table-toolbar">{createButton("sku")}</div><Table {...tableProps} rowKey="id" dataSource={skus} scroll={{ x: 1100 }} columns={[
            { title: "SKU编码", dataIndex: "code", render: (v) => <span style={{ fontFamily: "ui-monospace, monospace" }}>{v}</span> },
            { title: "名称", dataIndex: "name" }, { title: "类型", dataIndex: "type" },
            { title: "客户料号", dataIndex: "customerCode", render: (v) => v ?? "-" },
            { title: "内部料号", dataIndex: "internalCode", render: (v) => v ?? "-" },
            { title: "规格", dataIndex: "spec", render: (v) => v ?? "-" },
            { title: "标准重量(g)", dataIndex: "stdWeight", render: (v) => v ?? "-" },
            { title: "产品属性", render: (_, r) => <>{r.isSemiFinished && <Tag>半成品</Tag>}{r.isFinished && <Tag color="green">成品</Tag>}</> },
            { title: "状态", dataIndex: "status", render: (v) => <StatusTag status={v} /> },
            { title: "操作", fixed: "right", render: (_, r) => actions("sku", r as unknown as Record<string, unknown>) },
          ]} /></> },
          { key: "material", label: "物料主数据", children: <><div className="table-toolbar">{createButton("material")}</div><Table {...tableProps} rowKey="id" dataSource={materials} scroll={{ x: 1100 }} columns={[
            { title: "物料编码", dataIndex: "code", render: (v) => <span style={{ fontFamily: "ui-monospace, monospace" }}>{v}</span> },
            { title: "名称", dataIndex: "name" }, { title: "类型", dataIndex: "type" },
            { title: "材质/牌号", dataIndex: "materialGrade", render: (v) => v ?? "-" },
            { title: "供应商", dataIndex: "supplier", render: (v) => v ?? "-" }, { title: "单位", dataIndex: "unit" },
            { title: "卷材规格", render: (_, r) => r.thickness ? `${r.thickness}mm × ${r.width ?? "-"}mm，卷重${r.coilWeight ?? "-"}kg` : "-" },
            { title: "颗粒信息", render: (_, r) => r.color ? `${r.color}，${r.dryingRequirement ?? "-"}` : "-" },
            { title: "状态", dataIndex: "status", render: (v) => <StatusTag status={v} /> },
            { title: "操作", fixed: "right", render: (_, r) => actions("material", r as unknown as Record<string, unknown>) },
          ]} /></> },
          { key: "equipment", label: "设备台账", children: <><div className="table-toolbar">{createButton("equipment")}</div><Table {...tableProps} rowKey="id" dataSource={equipments} columns={[
            { title: "设备编号", dataIndex: "code", render: (v) => <span style={{ fontFamily: "ui-monospace, monospace" }}>{v}</span> },
            { title: "设备名称", dataIndex: "name" }, { title: "类型", dataIndex: "type" },
            { title: "所属产线", dataIndex: "line", render: (v) => v ?? "-" }, { title: "产能参数", dataIndex: "capacity", render: (v) => v ?? "-" },
            { title: "状态", dataIndex: "status", render: (v) => <StatusTag status={v} /> },
            { title: "操作", render: (_, r) => actions("equipment", r as unknown as Record<string, unknown>) },
          ]} /></> },
          { key: "dict", label: "班次 / 不良原因", children: <Space direction="vertical" size="large" style={{ width: "100%" }}>
            <div><div style={{ marginBottom: 8, fontWeight: 600 }}>班次字典</div>{SHIFTS.map((shift) => <Tag key={shift}>{shift}</Tag>)}</div>
            <div><div className="table-toolbar"><strong>不良原因字典</strong>{createButton("defect")}</div><Table {...tableProps} rowKey="id" dataSource={defectReasons} columns={[
              { title: "适用工艺", dataIndex: "appliesTo", width: 120 }, { title: "不良原因", dataIndex: "reason" },
              { title: "状态", dataIndex: "status", render: (v) => <StatusTag status={v} /> },
              { title: "操作", render: (_, r) => actions("defect", r as unknown as Record<string, unknown>) },
            ]} /></div>
          </Space> },
        ]}
      />

      <Modal title={`${editor?.row ? "编辑" : "新增"}${editor ? TITLE[editor.kind] : ""}`} open={!!editor} onCancel={() => setEditor(null)} onOk={() => form.submit()} confirmLoading={pending} width={680} destroyOnClose>
        <Form form={form} layout="vertical" onFinish={save} preserve={false}>
          {editor?.kind === "sku" && <>
            <Form.Item name="code" label="SKU 编码" rules={[{ required: true }]}><Input /></Form.Item>
            <Form.Item name="name" label="名称" rules={[{ required: true }]}><Input /></Form.Item>
            <Space style={{ width: "100%" }} align="start"><Form.Item name="type" label="类型" rules={[{ required: true }]}><Select style={{ width: 180 }} options={PRODUCT_TYPES.map((v) => ({ value: v, label: v }))} /></Form.Item><Form.Item name="unit" label="单位" rules={[{ required: true }]}><Input style={{ width: 140 }} /></Form.Item><Form.Item name="stdWeight" label="标准重量(g)"><InputNumber min={0} style={{ width: 160 }} /></Form.Item></Space>
            <Space style={{ width: "100%" }} align="start"><Form.Item name="customerCode" label="客户料号"><Input /></Form.Item><Form.Item name="internalCode" label="内部料号"><Input /></Form.Item><Form.Item name="spec" label="规格"><Input /></Form.Item></Space>
            <Space><Form.Item name="isSemiFinished" valuePropName="checked"><Checkbox>半成品</Checkbox></Form.Item><Form.Item name="isFinished" valuePropName="checked"><Checkbox>成品</Checkbox></Form.Item></Space>
            <Form.Item name="status" label="状态"><Select options={["启用", "停用"].map((v) => ({ value: v, label: v }))} /></Form.Item>
          </>}
          {editor?.kind === "material" && <>
            <Form.Item name="code" label="物料编码" rules={[{ required: true }]}><Input /></Form.Item><Form.Item name="name" label="名称" rules={[{ required: true }]}><Input /></Form.Item>
            <Space align="start"><Form.Item name="type" label="类型" rules={[{ required: true }]}><Select style={{ width: 180 }} options={MATERIAL_TYPES.map((v) => ({ value: v, label: v }))} /></Form.Item><Form.Item name="unit" label="单位" rules={[{ required: true }]}><Input style={{ width: 130 }} /></Form.Item><Form.Item name="status" label="状态"><Select style={{ width: 130 }} options={["启用", "停用"].map((v) => ({ value: v, label: v }))} /></Form.Item></Space>
            <Space align="start"><Form.Item name="spec" label="规格"><Input /></Form.Item><Form.Item name="materialGrade" label="材质/牌号"><Input /></Form.Item><Form.Item name="supplier" label="供应商"><Input /></Form.Item></Space>
            <Space align="start"><Form.Item name="thickness" label="厚度(mm)"><InputNumber min={0} /></Form.Item><Form.Item name="width" label="宽度(mm)"><InputNumber min={0} /></Form.Item><Form.Item name="coilWeight" label="卷重(kg)"><InputNumber min={0} /></Form.Item></Space>
            <Space align="start"><Form.Item name="color" label="颜色"><Input /></Form.Item><Form.Item name="dryingRequirement" label="干燥要求"><Input /></Form.Item><Form.Item name="shelfLife" label="保质期"><Input /></Form.Item></Space>
          </>}
          {editor?.kind === "equipment" && <>
            <Form.Item name="code" label="设备编号" rules={[{ required: true }]}><Input /></Form.Item><Form.Item name="name" label="设备名称" rules={[{ required: true }]}><Input /></Form.Item>
            <Space align="start"><Form.Item name="type" label="类型" rules={[{ required: true }]}><Select style={{ width: 180 }} options={EQUIPMENT_TYPES.map((v) => ({ value: v, label: v }))} /></Form.Item><Form.Item name="status" label="状态"><Select style={{ width: 150 }} options={EQUIPMENT_STATUS.map((v) => ({ value: v, label: v }))} /></Form.Item></Space>
            <Form.Item name="line" label="所属产线"><Input /></Form.Item><Form.Item name="capacity" label="产能参数"><Input /></Form.Item><Form.Item name="note" label="备注"><Input.TextArea rows={2} /></Form.Item>
          </>}
          {editor?.kind === "defect" && <>
            <Form.Item name="reason" label="不良原因" rules={[{ required: true }]}><Input /></Form.Item>
            <Form.Item name="appliesTo" label="适用工艺" rules={[{ required: true }]}><Select options={["注塑", "冲压", "通用"].map((v) => ({ value: v, label: v }))} /></Form.Item>
            <Form.Item name="status" label="状态"><Select options={["启用", "停用"].map((v) => ({ value: v, label: v }))} /></Form.Item>
          </>}
        </Form>
      </Modal>
    </>
  );
}
