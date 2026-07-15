"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Button, Card, DatePicker, Form, Input, InputNumber, Modal, Select, Space, Table, Tabs, Tag, message } from "antd";
import { PlusOutlined, InboxOutlined, ReloadOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import type { Dayjs } from "dayjs";
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
export type MaterialsSection = "lots" | "issues" | "returns" | "stock-in";

type DateRange = [Dayjs | null, Dayjs | null] | null;

function matchesKeyword(keyword: string, values: Array<string | number | null | undefined>) {
  const normalized = keyword.trim().toLowerCase();
  return !normalized || values.some((value) => String(value ?? "").toLowerCase().includes(normalized));
}

function matchesDateRange(value: string, range: DateRange) {
  if (!range) return true;
  const date = dayjs(value);
  const [start, end] = range;
  return (!start || !date.isBefore(start, "day")) && (!end || !date.isAfter(end, "day"));
}

function uniqueOptions(values: Array<string | null | undefined>) {
  return [...new Set(values.filter((value): value is string => Boolean(value)))].map((value) => ({ value, label: value }));
}

export function MaterialsView({
  lots, issues, returns, pending, stockIns, materials, section = "lots",
}: {
  lots: MaterialLot[]; issues: MaterialIssue[]; returns: MaterialReturn[];
  pending: PendingBatch[]; stockIns: StockInRecord[]; materials: MaterialMaster[]; section?: MaterialsSection;
}) {
  const [receiveOpen, setReceiveOpen] = useState(false);
  const [stockInTarget, setStockInTarget] = useState<PendingBatch | null>(null);
  const [isolationTarget, setIsolationTarget] = useState<PendingBatch | null>(null);
  const [lotEditor, setLotEditor] = useState<MaterialLot | null>(null);
  const [stockRecordEditor, setStockRecordEditor] = useState<StockInRecord | null>(null);
  const [keyword, setKeyword] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>();
  const [secondaryFilter, setSecondaryFilter] = useState<string>();
  const [warehouseFilter, setWarehouseFilter] = useState<string>();
  const [dateRange, setDateRange] = useState<DateRange>(null);
  const [pending_, startTransition] = useTransition();
  const [receiveForm] = Form.useForm();
  const [stockInForm] = Form.useForm();
  const [isolationForm] = Form.useForm();
  const [lotForm] = Form.useForm();
  const [stockRecordForm] = Form.useForm();

  useEffect(() => {
    setKeyword("");
    setStatusFilter(undefined);
    setSecondaryFilter(undefined);
    setWarehouseFilter(undefined);
    setDateRange(null);
  }, [section]);

  const filteredLots = useMemo(() => lots.filter((row) =>
    matchesKeyword(keyword, [row.lotNo, row.material.name, row.material.code, row.supplierLot, row.supplier])
    && (!statusFilter || row.inspectStatus === statusFilter)
    && (!secondaryFilter || row.stockStatus === secondaryFilter)
    && (!warehouseFilter || row.warehouse === warehouseFilter)
    && matchesDateRange(row.inDate, dateRange)
  ), [lots, keyword, statusFilter, secondaryFilter, warehouseFilter, dateRange]);

  const filteredIssues = useMemo(() => issues.filter((row) =>
    matchesKeyword(keyword, [row.workOrder.no, row.materialLot.lotNo, row.materialLot.material.name, row.issuedBy, row.equipment?.code])
    && (!secondaryFilter || row.equipment?.code === secondaryFilter)
    && matchesDateRange(row.issuedAt, dateRange)
  ), [issues, keyword, secondaryFilter, dateRange]);

  const filteredReturns = useMemo(() => returns.filter((row) =>
    matchesKeyword(keyword, [row.workOrder.no, row.materialLot.lotNo, row.materialLot.material.name, row.reason, row.returnedBy])
    && (!secondaryFilter || row.reason === secondaryFilter)
    && matchesDateRange(row.returnedAt, dateRange)
  ), [returns, keyword, secondaryFilter, dateRange]);

  const filteredPending = useMemo(() => pending.filter((row) =>
    matchesKeyword(keyword, [row.batchNo, row.workOrder.no, row.sku.name])
    && (!statusFilter || (row.sku.isFinished ? "成品" : "半成品") === statusFilter)
    && !warehouseFilter
    && matchesDateRange(row.startTime, dateRange)
  ), [pending, keyword, statusFilter, warehouseFilter, dateRange]);

  const filteredStockIns = useMemo(() => stockIns.filter((row) =>
    matchesKeyword(keyword, [row.no, row.batch.batchNo, row.batch.workOrder.no, row.batch.sku.name, row.inBy])
    && (!statusFilter || row.type === statusFilter)
    && (!warehouseFilter || row.warehouse === warehouseFilter)
    && matchesDateRange(row.inAt, dateRange)
  ), [stockIns, keyword, statusFilter, warehouseFilter, dateRange]);

  const pagination = { defaultPageSize: 10, showSizeChanger: true, showTotal: (total: number) => `共 ${total} 条` };

  function resetFilters() {
    setKeyword("");
    setStatusFilter(undefined);
    setSecondaryFilter(undefined);
    setWarehouseFilter(undefined);
    setDateRange(null);
  }

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
      <div className="table-toolbar" style={{ flexWrap: "wrap" }}>
        <Input.Search
          value={keyword}
          allowClear
          placeholder="搜索批次、物料、供应商"
          onChange={(event) => setKeyword(event.target.value)}
          style={{ width: 260 }}
        />
        <Select value={statusFilter} allowClear placeholder="检验状态" options={INSPECT_STATUS.map((value) => ({ value, label: value }))} onChange={setStatusFilter} style={{ width: 130 }} />
        <Select value={secondaryFilter} allowClear placeholder="库存状态" options={uniqueOptions(lots.map((row) => row.stockStatus))} onChange={setSecondaryFilter} style={{ width: 130 }} />
        <Select value={warehouseFilter} allowClear showSearch optionFilterProp="label" placeholder="仓库/库位" options={uniqueOptions(lots.map((row) => row.warehouse))} onChange={setWarehouseFilter} style={{ width: 150 }} />
        <DatePicker.RangePicker value={dateRange} onChange={setDateRange} allowClear placeholder={["入库开始日期", "入库结束日期"]} />
        <Button icon={<ReloadOutlined />} onClick={resetFilters}>重置</Button>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setReceiveOpen(true)} style={{ marginLeft: "auto" }}>
          原材料入库
        </Button>
      </div>
      <Table
        size="small"
        rowKey="id"
        dataSource={filteredLots}
        pagination={pagination}
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
    <>
      <div className="table-toolbar" style={{ flexWrap: "wrap" }}>
        <Input.Search value={keyword} allowClear placeholder="搜索工单、批次、物料或领料人" onChange={(event) => setKeyword(event.target.value)} style={{ width: 280 }} />
        <Select value={secondaryFilter} allowClear showSearch optionFilterProp="label" placeholder="使用设备" options={uniqueOptions(issues.map((row) => row.equipment?.code))} onChange={setSecondaryFilter} style={{ width: 150 }} />
        <DatePicker.RangePicker value={dateRange} onChange={setDateRange} allowClear placeholder={["领料开始日期", "领料结束日期"]} />
        <Button icon={<ReloadOutlined />} onClick={resetFilters}>重置</Button>
      </div>
      <Table
        size="small"
        rowKey="id"
        dataSource={filteredIssues}
        pagination={pagination}
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
    </>
  );

  const returnsTab = (
    <>
      <div className="table-toolbar" style={{ flexWrap: "wrap" }}>
        <Input.Search value={keyword} allowClear placeholder="搜索工单、批次、物料或退料人" onChange={(event) => setKeyword(event.target.value)} style={{ width: 280 }} />
        <Select value={secondaryFilter} allowClear showSearch optionFilterProp="label" placeholder="退料原因" options={uniqueOptions(returns.map((row) => row.reason))} onChange={setSecondaryFilter} style={{ width: 160 }} />
        <DatePicker.RangePicker value={dateRange} onChange={setDateRange} allowClear placeholder={["退料开始日期", "退料结束日期"]} />
        <Button icon={<ReloadOutlined />} onClick={resetFilters}>重置</Button>
      </div>
      <Table
        size="small"
        rowKey="id"
        dataSource={filteredReturns}
        pagination={pagination}
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
    </>
  );

  const stockInTab = (
    <Space direction="vertical" style={{ width: "100%" }} size="middle">
      <div className="table-toolbar" style={{ flexWrap: "wrap", marginBottom: 0 }}>
        <Input.Search value={keyword} allowClear placeholder="搜索入库单、批次、工单、产品或登记人" onChange={(event) => setKeyword(event.target.value)} style={{ width: 300 }} />
        <Select value={statusFilter} allowClear placeholder="产品/记录类型" options={uniqueOptions([...pending.map((row) => row.sku.isFinished ? "成品" : "半成品"), ...stockIns.map((row) => row.type)])} onChange={setStatusFilter} style={{ width: 160 }} />
        <Select value={warehouseFilter} allowClear showSearch optionFilterProp="label" placeholder="仓库/库位" options={uniqueOptions(stockIns.map((row) => row.warehouse))} onChange={setWarehouseFilter} style={{ width: 160 }} />
        <DatePicker.RangePicker value={dateRange} onChange={setDateRange} allowClear placeholder={["开始日期", "结束日期"]} />
        <Button icon={<ReloadOutlined />} onClick={resetFilters}>重置</Button>
      </div>
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
          dataSource={filteredPending}
          pagination={pagination}
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
          dataSource={filteredStockIns}
          pagination={pagination}
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
        activeKey={section}
        tabBarStyle={{ display: "none" }}
        items={[
          { key: "lots", label: "原材料入库", children: lotsTab },
          { key: "issues", label: "工单领料", children: issuesTab },
          { key: "returns", label: "退料", children: returnsTab },
          { key: "stock-in", label: "成品/半成品入库", children: stockInTab },
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

      <Modal title={lotEditor ? `编辑物料批次 · ${lotEditor.lotNo}` : ""} open={!!lotEditor} onCancel={() => setLotEditor(null)} onOk={() => lotForm.submit()} confirmLoading={pending_} destroyOnHidden>
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

      <Modal title={stockRecordEditor ? `编辑记录 · ${stockRecordEditor.no}` : ""} open={!!stockRecordEditor} onCancel={() => setStockRecordEditor(null)} onOk={() => stockRecordForm.submit()} confirmLoading={pending_} destroyOnHidden>
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
