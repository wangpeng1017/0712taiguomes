"use client";

import { useState, useTransition } from "react";
import { Button, Card, Form, Input, InputNumber, Modal, Select, Space, Table, Tabs, Tag, message } from "antd";
import { PlusOutlined, InboxOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import { INSPECT_STATUS } from "@/lib/constants";
import { StatusTag } from "@/components/StatusTag";
import { receiveMaterialLot, createStockIn, createDefectIsolation, deleteMaterialLot, deleteStockInRecord, updateMaterialLot, updateStockInRecord } from "@/lib/actions/materials";

type MaterialLot = {
  id: string; lotNo: string; supplierLot: string | null; qty: number; remainingQty: number; unit: string;
  inDate: string; supplier: string | null; inspectStatus: string; stockStatus: string; warehouse: string | null;
  material: { name: string; code: string };
};
type MaterialIssue = {
  id: string; qty: number; issuedBy: string; issuedAt: string;
  workOrder: { no: string }; materialLot: { lotNo: string; material: { name: string } }; equipment: { code: string } | null;
};
type MaterialReturn = {
  id: string; qty: number; reason: string | null; returnedAt: string; returnedBy: string;
  workOrder: { no: string }; materialLot: { lotNo: string; material: { name: string } };
};
type PendingBatch = {
  id: string; batchNo: string; goodQty: number; badQty: number; remainingGoodQty: number; remainingBadQty: number; startTime: string;
  sku: { name: string; isFinished: boolean }; workOrder: { no: string };
};
type StockInRecord = {
  id: string; no: string; type: string; qty: number; warehouse: string | null; inBy: string; inAt: string;
  batch: { batchNo: string; sku: { name: string }; workOrder: { no: string } };
};
type MaterialMaster = { id: string; code: string; name: string; unit: string; supplier: string | null };

export function MaterialsView({
  lots, issues, returns, pending, stockIns, materials,
}: {
  lots: MaterialLot[]; issues: MaterialIssue[]; returns: MaterialReturn[];
  pending: PendingBatch[]; stockIns: StockInRecord[]; materials: MaterialMaster[];
}) {
  const [receiveOpen, setReceiveOpen] = useState(false);
  const [stockInTarget, setStockInTarget] = useState<PendingBatch | null>(null);
  const [isolationTarget, setIsolationTarget] = useState<PendingBatch | null>(null);
  const [lotEditor, setLotEditor] = useState<MaterialLot | null>(null);
  const [stockRecordEditor, setStockRecordEditor] = useState<StockInRecord | null>(null);
  const [pending_, startTransition] = useTransition();
  const [receiveForm] = Form.useForm();
  const [stockInForm] = Form.useForm();
  const [isolationForm] = Form.useForm();
  const [lotForm] = Form.useForm();
  const [stockRecordForm] = Form.useForm();

  function submitReceive(values: { materialId: string; qty: number; supplierLot?: string; supplier?: string; warehouse?: string; inspectStatus: string }) {
    startTransition(async () => {
      await receiveMaterialLot(values);
      message.success("原材料入库登记成功");
      setReceiveOpen(false);
      receiveForm.resetFields();
    });
  }

  function submitLotEdit(values: { supplierLot?: string; supplier?: string; inspectStatus: string; stockStatus: string; warehouse?: string }) {
    if (!lotEditor) return;
    startTransition(async () => {
      try {
        await updateMaterialLot({ id: lotEditor.id, ...values });
        message.success("物料批次已更新");
        setLotEditor(null);
      } catch (error) {
        message.error(error instanceof Error ? error.message : "更新失败");
      }
    });
  }

  function removeLot(id: string) {
    startTransition(async () => {
      try { await deleteMaterialLot(id); message.success("物料批次已删除"); }
      catch (error) { message.error(error instanceof Error ? error.message : "删除失败"); }
    });
  }

  function removeStockIn(id: string) {
    startTransition(async () => {
      try { await deleteStockInRecord(id); message.success("入库/隔离登记已撤销"); }
      catch (error) { message.error(error instanceof Error ? error.message : "撤销失败"); }
    });
  }

  function submitStockRecordEdit(values: { qty: number; warehouse: string; inBy: string }) {
    if (!stockRecordEditor) return;
    startTransition(async () => {
      try {
        await updateStockInRecord({ id: stockRecordEditor.id, ...values });
        message.success("入库/隔离记录已更新");
        setStockRecordEditor(null);
      } catch (error) { message.error(error instanceof Error ? error.message : "更新失败"); }
    });
  }

  function submitIsolation(values: { qty: number; warehouse: string; inBy: string }) {
    if (!isolationTarget) return;
    startTransition(async () => {
      try {
        await createDefectIsolation({ batchId: isolationTarget.id, qty: values.qty, warehouse: values.warehouse, inBy: values.inBy });
        message.success("不良品隔离登记成功");
        setIsolationTarget(null);
        isolationForm.resetFields();
      } catch (error) {
        message.error(error instanceof Error ? error.message : "隔离登记失败");
      }
    });
  }

  function submitStockIn(values: { qty: number; warehouse: string; inBy: string }) {
    if (!stockInTarget) return;
    startTransition(async () => {
      try {
        await createStockIn({ batchId: stockInTarget.id, qty: values.qty, warehouse: values.warehouse, inBy: values.inBy });
        message.success("入库登记成功");
        setStockInTarget(null);
        stockInForm.resetFields();
      } catch (e) {
        message.error(e instanceof Error ? e.message : "入库失败");
      }
    });
  }

  const lotsTab = (
    <>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setReceiveOpen(true)}>
          原材料入库
        </Button>
      </div>
      <Table
        size="small"
        rowKey="id"
        dataSource={lots}
        columns={[
          { title: "物料批次号", dataIndex: "lotNo", render: (v) => <span style={{ fontFamily: "ui-monospace, monospace" }}>{v}</span> },
          { title: "物料", render: (_, r) => `${r.material.name}（${r.material.code}）` },
          { title: "供应商批次", dataIndex: "supplierLot", render: (v) => v ?? "-" },
          { title: "入库数量", render: (_, r) => <span className="tabular-nums">{r.qty} {r.unit}</span> },
          { title: "剩余可用", render: (_, r) => <span className="tabular-nums">{r.remainingQty.toFixed(1)} {r.unit}</span> },
          { title: "入库日期", render: (_, r) => dayjs(r.inDate).format("YYYY-MM-DD") },
          { title: "检验状态", dataIndex: "inspectStatus", render: (v) => <StatusTag status={v} /> },
          { title: "库存状态", dataIndex: "stockStatus", render: (v) => <StatusTag status={v} /> },
          { title: "仓库", dataIndex: "warehouse", render: (v) => v ?? "-" },
          { title: "操作", render: (_, r) => <Space size="small"><Button type="link" size="small" onClick={() => { setLotEditor(r); queueMicrotask(() => lotForm.setFieldsValue(r)); }}>编辑</Button><Button className="mes-destructive-action" type="link" size="small" onClick={() => Modal.confirm({ title: `删除物料批次 ${r.lotNo}`, content: "仅未被任何业务引用的批次可以删除。", okButtonProps: { className: "mes-destructive-confirm" }, onOk: () => removeLot(r.id) })}>删除</Button></Space> },
        ]}
      />
    </>
  );

  const issuesTab = (
    <Table
      size="small"
      rowKey="id"
      dataSource={issues}
      columns={[
        { title: "工单号", render: (_, r) => r.workOrder.no },
        { title: "物料批次", render: (_, r) => r.materialLot.lotNo },
        { title: "物料", render: (_, r) => r.materialLot.material.name },
        { title: "领料数量", dataIndex: "qty", className: "tabular-nums" },
        { title: "领料人", dataIndex: "issuedBy" },
        { title: "使用设备", render: (_, r) => r.equipment?.code ?? "-" },
        { title: "领料时间", render: (_, r) => dayjs(r.issuedAt).format("MM-DD HH:mm") },
      ]}
    />
  );

  const returnsTab = (
    <Table
      size="small"
      rowKey="id"
      dataSource={returns}
      columns={[
        { title: "工单号", render: (_, r) => r.workOrder.no },
        { title: "物料批次", render: (_, r) => r.materialLot.lotNo },
        { title: "物料", render: (_, r) => r.materialLot.material.name },
        { title: "退料数量", dataIndex: "qty", className: "tabular-nums" },
        { title: "退料原因", dataIndex: "reason" },
        { title: "退料人", dataIndex: "returnedBy" },
        { title: "退料时间", render: (_, r) => dayjs(r.returnedAt).format("MM-DD HH:mm") },
      ]}
    />
  );

  const stockInTab = (
    <Space direction="vertical" style={{ width: "100%" }} size="middle">
      <Card
        size="small"
        title={
          <span>
            <InboxOutlined /> 待入库批次（良品尚未登记入库）
          </span>
        }
      >
        <Table
          size="small"
          rowKey="id"
          dataSource={pending}
          locale={{ emptyText: "暂无待入库批次" }}
          columns={[
            { title: "批次号", dataIndex: "batchNo", render: (v) => <span style={{ fontFamily: "ui-monospace, monospace" }}>{v}</span> },
            { title: "工单", render: (_, r) => r.workOrder.no },
            { title: "产品", render: (_, r) => r.sku.name },
            { title: "类型", render: (_, r) => (r.sku.isFinished ? <Tag color="green">成品</Tag> : <Tag color="blue">半成品</Tag>) },
            { title: "待入库良品", dataIndex: "remainingGoodQty", className: "tabular-nums" },
            { title: "待隔离不良", dataIndex: "remainingBadQty", className: "tabular-nums" },
            { title: "报工时间", render: (_, r) => dayjs(r.startTime).format("MM-DD HH:mm") },
            { title: "操作", render: (_, r) => (
                <Space size="small">
                  {r.remainingGoodQty > 0 && <Button size="small" type="link" onClick={() => setStockInTarget(r)}>良品入库</Button>}
                  {r.remainingBadQty > 0 && <Button className="mes-destructive-action" size="small" type="link" onClick={() => setIsolationTarget(r)}>不良隔离</Button>}
                </Space>
              ) },
          ]}
        />
      </Card>
      <Card size="small" title="已入库记录">
        <Table
          size="small"
          rowKey="id"
          dataSource={stockIns}
          columns={[
            { title: "入库单号", dataIndex: "no" },
            { title: "批次号", render: (_, r) => r.batch.batchNo },
            { title: "工单", render: (_, r) => r.batch.workOrder.no },
            { title: "产品", render: (_, r) => r.batch.sku.name },
            { title: "类型", dataIndex: "type" },
            { title: "入库数量", dataIndex: "qty", className: "tabular-nums" },
            { title: "仓库", dataIndex: "warehouse" },
            { title: "入库人", dataIndex: "inBy" },
            { title: "入库时间", render: (_, r) => dayjs(r.inAt).format("MM-DD HH:mm") },
            { title: "操作", render: (_, r) => <Space size="small"><Button type="link" size="small" onClick={() => { setStockRecordEditor(r); queueMicrotask(() => stockRecordForm.setFieldsValue(r)); }}>编辑</Button><Button className="mes-destructive-action" type="link" size="small" onClick={() => Modal.confirm({ title: `撤销记录 ${r.no}`, content: "撤销后对应数量将重新出现在待处理列表。", okButtonProps: { className: "mes-destructive-confirm" }, onOk: () => removeStockIn(r.id) })}>撤销</Button></Space> },
          ]}
        />
      </Card>
    </Space>
  );

  return (
    <>
      <Tabs
        defaultActiveKey="lots"
        items={[
          { key: "lots", label: "原材料入库", children: lotsTab },
          { key: "issues", label: "工单领料", children: issuesTab },
          { key: "returns", label: "退料", children: returnsTab },
          { key: "stockin", label: "成品/半成品入库", children: stockInTab },
        ]}
      />

      <Modal title="原材料批次入库" open={receiveOpen} onCancel={() => setReceiveOpen(false)} onOk={() => receiveForm.submit()} confirmLoading={pending_} destroyOnHidden>
        <Form form={receiveForm} layout="vertical" onFinish={submitReceive} initialValues={{ inspectStatus: "合格" }}>
          <Form.Item name="materialId" label="物料" rules={[{ required: true, message: "请选择物料" }]}>
            <Select options={materials.map((m) => ({ value: m.id, label: `${m.name}（${m.code}）` }))} showSearch optionFilterProp="label" />
          </Form.Item>
          <Form.Item name="qty" label="入库数量 (kg)" rules={[{ required: true, message: "请输入入库数量" }]}>
            <InputNumber min={0.01} style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item name="supplierLot" label="供应商批次号">
            <Input />
          </Form.Item>
          <Form.Item name="supplier" label="供应商">
            <Input />
          </Form.Item>
          <Form.Item name="warehouse" label="仓库/库位">
            <Input placeholder="如：原料仓-A" />
          </Form.Item>
          <Form.Item name="inspectStatus" label="检验状态" rules={[{ required: true }]}>
            <Select options={INSPECT_STATUS.map((s) => ({ value: s, label: s }))} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={stockInTarget ? `登记入库 · ${stockInTarget.batchNo}` : ""}
        open={!!stockInTarget}
        onCancel={() => setStockInTarget(null)}
        onOk={() => stockInForm.submit()}
        confirmLoading={pending_}
        destroyOnHidden
      >
        {stockInTarget && (
          <Form form={stockInForm} layout="vertical" onFinish={submitStockIn} initialValues={{ qty: stockInTarget.remainingGoodQty, warehouse: stockInTarget.sku.isFinished ? "成品仓" : "半成品中转仓" }}>
            <Form.Item name="qty" label={`入库数量（剩余待入库 ${stockInTarget.remainingGoodQty}）`} rules={[{ required: true, message: "请输入入库数量" }]}>
              <InputNumber min={1} max={stockInTarget.remainingGoodQty} style={{ width: "100%" }} />
            </Form.Item>
            <Form.Item name="warehouse" label="仓库/库位" rules={[{ required: true }]}>
              <Input />
            </Form.Item>
            <Form.Item name="inBy" label="入库人" rules={[{ required: true, message: "请输入入库人" }]} initialValue="Thanawat">
              <Input />
            </Form.Item>
          </Form>
        )}
      </Modal>

      <Modal title={lotEditor ? `编辑物料批次 · ${lotEditor.lotNo}` : ""} open={!!lotEditor} onCancel={() => setLotEditor(null)} onOk={() => lotForm.submit()} confirmLoading={pending_} destroyOnClose>
        <Form form={lotForm} layout="vertical" onFinish={submitLotEdit} preserve={false}>
          <Form.Item name="supplierLot" label="供应商批次号"><Input /></Form.Item>
          <Form.Item name="supplier" label="供应商"><Input /></Form.Item>
          <Space align="start" style={{ width: "100%" }}>
            <Form.Item name="inspectStatus" label="检验状态" rules={[{ required: true }]}><Select style={{ width: 180 }} options={INSPECT_STATUS.map((s) => ({ value: s, label: s }))} /></Form.Item>
            <Form.Item name="stockStatus" label="库存状态" rules={[{ required: true }]}><Select style={{ width: 180 }} options={["可用", "冻结", "隔离", "已消耗"].map((s) => ({ value: s, label: s }))} /></Form.Item>
          </Space>
          <Form.Item name="warehouse" label="仓库/库位"><Input /></Form.Item>
        </Form>
      </Modal>

      <Modal title={stockRecordEditor ? `编辑记录 · ${stockRecordEditor.no}` : ""} open={!!stockRecordEditor} onCancel={() => setStockRecordEditor(null)} onOk={() => stockRecordForm.submit()} confirmLoading={pending_} destroyOnClose>
        <Form form={stockRecordForm} layout="vertical" onFinish={submitStockRecordEdit} preserve={false}>
          <Form.Item name="qty" label="数量" rules={[{ required: true }]}><InputNumber min={1} precision={0} style={{ width: "100%" }} /></Form.Item>
          <Form.Item name="warehouse" label="仓库/库位" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="inBy" label="登记人" rules={[{ required: true }]}><Input /></Form.Item>
        </Form>
      </Modal>

      <Modal
        title={isolationTarget ? `不良品隔离 · ${isolationTarget.batchNo}` : ""}
        open={!!isolationTarget}
        onCancel={() => setIsolationTarget(null)}
        onOk={() => isolationForm.submit()}
        confirmLoading={pending_}
        destroyOnHidden
      >
        {isolationTarget && (
          <Form form={isolationForm} layout="vertical" onFinish={submitIsolation} initialValues={{ qty: isolationTarget.remainingBadQty, warehouse: "不良品隔离区", inBy: "Thanawat" }}>
            <Form.Item name="qty" label={`隔离数量（剩余待隔离 ${isolationTarget.remainingBadQty}）`} rules={[{ required: true }]}>
              <InputNumber min={1} max={isolationTarget.remainingBadQty} style={{ width: "100%" }} />
            </Form.Item>
            <Form.Item name="warehouse" label="隔离库位" rules={[{ required: true }]}><Input /></Form.Item>
            <Form.Item name="inBy" label="登记人" rules={[{ required: true }]}><Input /></Form.Item>
          </Form>
        )}
      </Modal>
    </>
  );
}
