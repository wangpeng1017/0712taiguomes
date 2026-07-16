"use client";

import { useMemo, useState, useTransition } from "react";
import { Alert, Button, Col, DatePicker, Descriptions, Drawer, Form, Input, InputNumber, Modal, Row, Select, Space, Table, Tag, message } from "antd";
import { PauseOutlined, PlayCircleOutlined, PlusOutlined, SearchOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import { StatusTag } from "@/components/StatusTag";
import { setOperationStatus, submitOperationReport } from "@/lib/actions/operations";
import { DEFECT_ACTION, DEFECT_RESPONSIBLE, SHIFTS } from "@/lib/constants";

type OperationTask = {
  id: string; sequence: number; operationCode: string; operationName: string; operationType: string; workCenter: string | null;
  status: string; plannedQty: number; inputQty: number; goodQty: number; badQty: number; scrapQty: number; transferredQty: number;
  qualityStatus: string; qualityRequired: boolean; isFinal: boolean; requiresEquipment: boolean; requiresMold: boolean;
  planEquipment: { id: string; code: string; name: string } | null;
  planMold: { id: string; code: string; name: string } | null;
  workOrder: { id: string; no: string; type: "注塑" | "冲压"; status: string; sku: { code: string; name: string }; routeVersion: { version: string; route: { code: string; name: string } } | null; bomVersionId: string | null; bomDefinition: { version: string; bom: { code: string; name: string } } | null; materialRequirements: { id: string; materialId: string | null; materialCode: string; materialName: string; operationSequence: number | null; unit: string; standardQty: number; requiredQty: number; issuedQty: number; consumedQty: number; bomItem: { substitutes: { materialId: string; conversionRate: number; material: { name: string; code: string } }[] } | null }[] };
  batches: { id: string; batchNo: string; status: string; goodQty: number; badQty: number; startTime: string; operator: string }[];
};
type CompletedBatch = {
  id: string; batchNo: string; workOrderId: string; workOrderOperationId: string | null; goodQty: number;
  workOrderOperation: { id: string; sequence: number; operationName: string } | null;
  genealogySources: { qty: number; relationType: string }[];
};
type ExecutionData = {
  operations: OperationTask[];
  equipments: { id: string; code: string; name: string; type: string; status: string }[];
  molds: { id: string; code: string; name: string; status: string; currentCount: number; designLife: number }[];
  materialLots: { id: string; lotNo: string; remainingQty: number; unit: string; material: { name: string; type: string } }[];
  defectReasons: { id: string; reason: string; appliesTo: string }[];
  completedBatches: CompletedBatch[];
  reworkOrders: { id: string; no: string; qty: number; status: string; sourceBatch: { id: string; batchNo: string }; workOrderOperation: { id: string; operationName: string; workOrder: { no: string } } }[];
};
type ReportFormValues = {
  equipmentId?: string;
  moldId?: string;
  materialInputs?: { requirementId?: string; materialLotId?: string; qty?: number; consumptionType?: string }[];
  sourceBatchInputs?: { batchId?: string; qty?: number; relationType?: "转序" | "拆批" | "合批" | "返工" }[];
  shift: "白班" | "夜班";
  operator: string;
  timeRange: [dayjs.Dayjs, dayjs.Dayjs];
  goodQty: number;
  badQty?: number;
  scrapWeight?: number;
  returnWeight?: number;
  defects?: { reasonId?: string; qty?: number; responsible: string; action: string }[];
  note?: string;
  leaderConfirmedBy?: string;
};

function quantity(value: number) {
  return new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 4 }).format(value);
}

function varianceRate(standardQty: number, consumedQty: number) {
  if (standardQty <= 0) return "-";
  const rate = ((consumedQty - standardQty) / standardQty) * 100;
  return `${rate > 0 ? "+" : ""}${rate.toFixed(2)}%`;
}

export function OperationExecutionView({ data }: { data: ExecutionData }) {
  const [keyword, setKeyword] = useState("");
  const [status, setStatus] = useState<string>();
  const [type, setType] = useState<string>();
  const [reporting, setReporting] = useState<OperationTask | null>(null);
  const [reworkId, setReworkId] = useState<string>();
  const [form] = Form.useForm();
  const [pending, startTransition] = useTransition();

  const isFirstTask = (operation: OperationTask) => !data.operations.some(
    (candidate) => candidate.workOrder.id === operation.workOrder.id && candidate.sequence < operation.sequence
  );

  const rows = useMemo(() => data.operations.filter((operation) => {
    const text = `${operation.workOrder.no} ${operation.workOrder.sku.code} ${operation.workOrder.sku.name} ${operation.operationCode} ${operation.operationName} ${operation.workCenter ?? ""}`.toLowerCase();
    return (!keyword.trim() || text.includes(keyword.trim().toLowerCase())) && (!status || operation.status === status) && (!type || operation.operationType === type);
  }), [data.operations, keyword, status, type]);

  const predecessorBatches = useMemo(() => {
    if (!reporting) return [];
    const predecessorSequence = Math.max(
      ...data.operations
        .filter((operation) => operation.workOrder.id === reporting.workOrder.id && operation.sequence < reporting.sequence)
        .map((operation) => operation.sequence),
      Number.NEGATIVE_INFINITY
    );
    return data.completedBatches.filter((batch) => batch.workOrderId === reporting.workOrder.id && batch.workOrderOperation?.sequence === predecessorSequence)
      .map((batch) => ({ ...batch, availableQty: Math.max(batch.goodQty - batch.genealogySources.filter((edge) => edge.relationType !== "返工").reduce((sum, edge) => sum + edge.qty, 0), 0) }))
      .filter((batch) => batch.availableQty > 0);
  }, [data.completedBatches, data.operations, reporting]);

  const reportingRequirements = reporting
    ? reporting.workOrder.materialRequirements.filter((requirement) =>
        requirement.operationSequence === reporting.sequence || (requirement.operationSequence == null && isFirstTask(reporting))
      )
    : [];

  function openReport(operation: OperationTask, rework?: ExecutionData["reworkOrders"][number]) {
    setReporting(operation);
    setReworkId(rework?.id);
    form.resetFields();
    queueMicrotask(() => form.setFieldsValue({
      equipmentId: operation.planEquipment?.id,
      moldId: operation.planMold?.id,
      shift: "白班",
      timeRange: [dayjs().subtract(1, "hour"), dayjs()],
      goodQty: rework?.qty ?? 0,
      badQty: 0,
      scrapWeight: 0,
      returnWeight: 0,
      sourceBatchInputs: rework ? [{ batchId: rework.sourceBatch.id, qty: rework.qty, relationType: "返工" }] : undefined,
      materialInputs: !rework && (isFirstTask(operation) || operation.workOrder.materialRequirements.some((r) => r.operationSequence === operation.sequence)) ? [{}] : undefined,
    }));
  }

  function changeStatus(operation: OperationTask, next: string) {
    startTransition(async () => {
      try { await setOperationStatus(operation.id, next); message.success(`工序已更新为${next}`); }
      catch (error) { message.error(error instanceof Error ? error.message : "状态更新失败"); }
    });
  }

  function submit(values: ReportFormValues, confirmOverLife = false) {
    if (!reporting) return;
    const timeRange = values.timeRange;
    startTransition(async () => {
      const result = await submitOperationReport({
        workOrderOperationId: reporting.id,
        equipmentId: values.equipmentId,
        moldId: values.moldId,
        materialInputs: (values.materialInputs ?? []).filter(
          (item): item is { requirementId?: string; materialLotId: string; qty: number; consumptionType?: string } => !!item.materialLotId && !!item.qty
        ),
        sourceBatchInputs: (values.sourceBatchInputs ?? []).filter(
          (item): item is { batchId: string; qty: number; relationType?: "转序" | "拆批" | "合批" | "返工" } => !!item.batchId && !!item.qty
        ),
        shift: values.shift,
        operator: values.operator,
        startTime: timeRange[0].toISOString(),
        endTime: timeRange[1].toISOString(),
        goodQty: values.goodQty,
        badQty: values.badQty ?? 0,
        scrapWeight: values.scrapWeight ?? 0,
        returnWeight: values.returnWeight ?? 0,
        defects: (values.defects ?? []).filter(
          (item): item is { reasonId: string; qty: number; responsible: string; action: string } => !!item.reasonId && !!item.qty
        ),
        note: values.note,
        confirmOverLife,
        leaderConfirmedBy: values.leaderConfirmedBy,
        reworkOrderId: reworkId,
      });
      if (result.ok) {
        message.success(`工序报工成功，生成批次 ${result.batchNo}`);
        setReporting(null); setReworkId(undefined); form.resetFields();
      } else if ("needOverLifeConfirm" in result) {
        let leader = "";
        Modal.confirm({
          title: "模具超过设计寿命",
          content: <Input placeholder="请输入确认主管姓名" onChange={(event) => { leader = event.target.value; }} />,
          onOk: () => { if (!leader.trim()) return Promise.reject(); form.setFieldValue("leaderConfirmedBy", leader.trim()); submit(form.getFieldsValue(), true); },
        });
      } else message.error(result.error);
    });
  }

  const columns = [
    { title: "工单 / 产品", render: (_: unknown, row: OperationTask) => <div><div className="mes-code">{row.workOrder.no}</div><div className="mes-meta">{row.workOrder.sku.name} · {row.workOrder.sku.code}</div></div> },
    { title: "工序", render: (_: unknown, row: OperationTask) => <div><div>{row.sequence} · {row.operationName}{row.isFinal && <Tag style={{ marginLeft: 6 }}>末道</Tag>}</div><div className="mes-code mes-meta">{row.operationCode} · {row.workCenter ?? "未配置工作中心"}</div></div> },
    { title: "计划 / 投入", render: (_: unknown, row: OperationTask) => <span className="tabular-nums">{row.plannedQty} / {row.inputQty}</span> },
    { title: "合格 / 不良 / 报废", render: (_: unknown, row: OperationTask) => <span className="tabular-nums">{row.goodQty} / {row.badQty} / {row.scrapQty}</span> },
    { title: "已转序", dataIndex: "transferredQty", className: "tabular-nums" },
    { title: "质量", render: (_: unknown, row: OperationTask) => row.qualityRequired ? <StatusTag status={row.qualityStatus} /> : <span className="mes-meta">免检</span> },
    { title: "状态", render: (_: unknown, row: OperationTask) => <StatusTag status={row.status} /> },
    { title: "操作", fixed: "right" as const, render: (_: unknown, row: OperationTask) => <Space size="small">
      {row.status === "可开工" && <Button type="link" size="small" icon={<PlayCircleOutlined />} onClick={() => changeStatus(row, "生产中")}>开工</Button>}
      {["可开工", "生产中"].includes(row.status) && <Button type="link" size="small" onClick={() => openReport(row)}>报工</Button>}
      {row.status === "生产中" && <Button type="link" size="small" icon={<PauseOutlined />} onClick={() => changeStatus(row, "暂停")}>暂停</Button>}
      {row.status === "暂停" && <Button type="link" size="small" onClick={() => changeStatus(row, "生产中")}>恢复</Button>}
    </Space> },
  ];

  return <>
    <div className="table-toolbar" style={{ flexWrap: "wrap" }}>
      <Input prefix={<SearchOutlined />} allowClear placeholder="搜索工单、产品、工序或工作中心" value={keyword} onChange={(event) => setKeyword(event.target.value)} style={{ width: 320 }} />
      <Select allowClear placeholder="全部工序类型" value={type} onChange={setType} style={{ width: 150 }} options={Array.from(new Set(data.operations.map((item) => item.operationType))).map((value) => ({ value, label: value }))} />
      <Select allowClear placeholder="全部状态" value={status} onChange={setStatus} style={{ width: 150 }} options={Array.from(new Set(data.operations.map((item) => item.status))).map((value) => ({ value, label: value }))} />
      <Button onClick={() => { setKeyword(""); setType(undefined); setStatus(undefined); }}>重置</Button>
    </div>
    <Table rowKey="id" dataSource={rows} columns={columns} scroll={{ x: 1250 }} pagination={{ pageSize: 12, showSizeChanger: true }} locale={{ emptyText: "暂无工序任务，请先下达已绑定工艺路线的工单" }} />

    <Drawer title={reporting ? `工序报工 · ${reporting.workOrder.no} · ${reporting.sequence} ${reporting.operationName}` : ""} open={!!reporting} onClose={() => { setReporting(null); setReworkId(undefined); }} width="min(980px, 96vw)" destroyOnHidden>
      {reporting && <Form form={form} layout="vertical" onFinish={(values) => submit(values)}>
        {reworkId && <Alert type="warning" showIcon message="当前为返工任务报工，产出批次将与原不良批次建立返工谱系。" style={{ marginBottom: 16 }} />}
        <Descriptions size="small" bordered column={3} style={{ marginBottom: 16 }}>
          <Descriptions.Item label="工艺版本">{reporting.workOrder.routeVersion ? `${reporting.workOrder.routeVersion.route.name} ${reporting.workOrder.routeVersion.version}` : "-"}</Descriptions.Item>
          <Descriptions.Item label="BOM 版本">{reporting.workOrder.bomDefinition ? `${reporting.workOrder.bomDefinition.bom.name}（${reporting.workOrder.bomDefinition.bom.code}）· ${reporting.workOrder.bomDefinition.version}` : "-"}</Descriptions.Item>
          <Descriptions.Item label="工作中心">{reporting.workCenter ?? "-"}</Descriptions.Item>
          <Descriptions.Item label="质量控制">{reporting.qualityRequired ? "报工后待检" : "免检自动放行"}</Descriptions.Item>
        </Descriptions>
        <Row gutter={12}>
          {reporting.requiresEquipment && <Col span={12}><Form.Item name="equipmentId" label="设备" rules={[{ required: true }]}><Select options={data.equipments.map((item) => ({ value: item.id, label: `${item.name}（${item.code}）`, disabled: item.status !== "可用" }))} /></Form.Item></Col>}
          {reporting.requiresMold && <Col span={12}><Form.Item name="moldId" label="模具" rules={[{ required: true }]}><Select options={data.molds.map((item) => ({ value: item.id, label: `${item.name}（${item.code}）· ${item.status}`, disabled: ["维修中", "停用", "报废"].includes(item.status) }))} /></Form.Item></Col>}
          <Col span={8}><Form.Item name="shift" label="班次" rules={[{ required: true }]}><Select options={SHIFTS.map((value) => ({ value, label: value }))} /></Form.Item></Col>
          <Col span={8}><Form.Item name="operator" label="操作员" rules={[{ required: true }]}><Input /></Form.Item></Col>
          <Col span={8}><Form.Item name="timeRange" label="开始 / 结束" rules={[{ required: true }]}><DatePicker.RangePicker showTime style={{ width: "100%" }} /></Form.Item></Col>
        </Row>

        {!reworkId && reporting.workOrder.bomVersionId && reportingRequirements.length > 0 && <div style={{ marginBottom: 16 }}>
          <div className="mes-section-title" style={{ marginBottom: 8 }}>当前工序 BOM 用量执行</div>
          <Table
            size="small"
            rowKey="id"
            pagination={false}
            scroll={{ x: 900 }}
            dataSource={reportingRequirements}
            columns={[
              { title: "物料", width: 190, render: (_, row) => <div><div>{row.materialName}</div><div className="mes-code mes-meta">{row.materialCode}</div></div> },
              { title: "标准需求", width: 110, render: (_, row) => <span className="tabular-nums">{quantity(row.standardQty)} {row.unit}</span> },
              { title: "含损耗需求", width: 120, render: (_, row) => <span className="tabular-nums">{quantity(row.requiredQty)} {row.unit}</span> },
              { title: "已领", width: 90, render: (_, row) => <span className="tabular-nums">{quantity(row.issuedQty)}</span> },
              { title: "已耗", width: 90, render: (_, row) => <span className="tabular-nums">{quantity(row.consumedQty)}</span> },
              { title: "剩余需求", width: 105, render: (_, row) => <span className="tabular-nums">{quantity(Math.max(row.requiredQty - row.consumedQty, 0))}</span> },
              { title: "耗用差异", width: 105, render: (_, row) => {
                const difference = row.consumedQty - row.standardQty;
                return <span className="tabular-nums">{difference > 0 ? "+" : ""}{quantity(difference)}</span>;
              } },
              { title: "差异率", width: 90, render: (_, row) => <span className="tabular-nums">{varianceRate(row.standardQty, row.consumedQty)}</span> },
            ]}
          />
        </div>}

        {!reworkId && (isFirstTask(reporting) || reporting.workOrder.materialRequirements.some((r) => r.operationSequence === reporting.sequence)) && <Form.List name="materialInputs">{(fields, { add, remove }) => <Space direction="vertical" style={{ width: "100%", marginBottom: 16 }}>
          <div className="mes-section-title">物料投入（支持多批次主料/辅料）</div>
          {fields.map((field) => <Row gutter={8} key={field.key}>
            {reporting.workOrder.bomVersionId && <Col span={8}><Form.Item name={[field.name, "requirementId"]} rules={[{ required: true }]}><Select showSearch optionFilterProp="label" placeholder="选择 BOM 用料要求" options={reportingRequirements.map((r) => ({ value: r.id, label: `${r.materialName} · 需求${quantity(r.requiredQty)}${r.unit} · 已耗${quantity(r.consumedQty)} · 剩余${quantity(Math.max(r.requiredQty - r.consumedQty, 0))}` }))} /></Form.Item></Col>}
            <Col span={reporting.workOrder.bomVersionId ? 8 : 12}><Form.Item name={[field.name, "materialLotId"]} rules={[{ required: true }]}><Select showSearch optionFilterProp="label" placeholder="选择物料批次" options={data.materialLots.map((lot) => ({ value: lot.id, label: `${lot.lotNo} · ${lot.material.name} · 可用${lot.remainingQty}${lot.unit}` }))} /></Form.Item></Col>
            <Col span={reporting.workOrder.bomVersionId ? 3 : 5}><Form.Item name={[field.name, "qty"]} rules={[{ required: true }]}><InputNumber min={0.0001} placeholder="数量" style={{ width: "100%" }} /></Form.Item></Col>
            <Col span={reporting.workOrder.bomVersionId ? 3 : 5}><Form.Item name={[field.name, "consumptionType"]} initialValue="主料"><Select options={["主料", "辅料"].map((value) => ({ value, label: value }))} /></Form.Item></Col>
            <Col span={2}><Button onClick={() => remove(field.name)}>删</Button></Col>
          </Row>)}
          <Button icon={<PlusOutlined />} onClick={() => add({ consumptionType: "辅料" })}>增加物料批次</Button>
        </Space>}</Form.List>}
        {(!isFirstTask(reporting) || reworkId) && <Form.List name="sourceBatchInputs">{(fields, { add, remove }) => <Space direction="vertical" style={{ width: "100%", marginBottom: 16 }}>
          <div className="mes-section-title">上游在制品投入（支持拆批/合批）</div>
          {fields.map((field) => <Row gutter={8} key={field.key}>
            <Col span={13}><Form.Item name={[field.name, "batchId"]} rules={[{ required: true }]}><Select showSearch optionFilterProp="label" placeholder="选择上游批次" options={predecessorBatches.map((batch) => ({ value: batch.id, label: `${batch.batchNo} · ${batch.workOrderOperation?.operationName} · 可转${batch.availableQty}` }))} /></Form.Item></Col>
            <Col span={5}><Form.Item name={[field.name, "qty"]} rules={[{ required: true }]}><InputNumber min={1} placeholder="投入数量" style={{ width: "100%" }} /></Form.Item></Col>
            <Col span={4}><Form.Item name={[field.name, "relationType"]} initialValue="转序"><Select options={["转序", "拆批", "合批", "返工"].map((value) => ({ value, label: value }))} /></Form.Item></Col>
            <Col span={2}><Button onClick={() => remove(field.name)}>删</Button></Col>
          </Row>)}
          {!reworkId && <Button icon={<PlusOutlined />} onClick={() => add({ relationType: fields.length ? "合批" : "转序" })}>增加上游批次</Button>}
        </Space>}</Form.List>}

        <Row gutter={12}>
          <Col span={8}><Form.Item name="goodQty" label="本次良品" rules={[{ required: true }]}><InputNumber min={0} style={{ width: "100%" }} /></Form.Item></Col>
          <Col span={8}><Form.Item name="badQty" label="本次不良"><InputNumber min={0} style={{ width: "100%" }} /></Form.Item></Col>
          <Col span={8}><Form.Item name="scrapWeight" label="废料重量"><InputNumber min={0} style={{ width: "100%" }} /></Form.Item></Col>
        </Row>
        <Form.List name="defects">{(fields, { add, remove }) => <Space direction="vertical" style={{ width: "100%", marginBottom: 16 }}>
          <div className="mes-section-title">不良明细</div>
          {fields.map((field) => <Row gutter={8} key={field.key}>
            <Col span={8}><Form.Item name={[field.name, "reasonId"]}><Select placeholder="不良原因" options={data.defectReasons.filter((reason) => [reporting.workOrder.type, "通用"].includes(reason.appliesTo)).map((reason) => ({ value: reason.id, label: reason.reason }))} /></Form.Item></Col>
            <Col span={4}><Form.Item name={[field.name, "qty"]}><InputNumber min={1} placeholder="数量" style={{ width: "100%" }} /></Form.Item></Col>
            <Col span={5}><Form.Item name={[field.name, "responsible"]}><Select placeholder="责任" options={DEFECT_RESPONSIBLE.map((value) => ({ value, label: value }))} /></Form.Item></Col>
            <Col span={5}><Form.Item name={[field.name, "action"]}><Select placeholder="处理" options={DEFECT_ACTION.map((value) => ({ value, label: value }))} /></Form.Item></Col>
            <Col span={2}><Button onClick={() => remove(field.name)}>删</Button></Col>
          </Row>)}
          <Button onClick={() => add()}>增加不良明细</Button>
        </Space>}</Form.List>
        <Form.Item name="note" label="备注"><Input.TextArea rows={2} /></Form.Item>
        <Button type="primary" htmlType="submit" loading={pending} block>提交工序报工</Button>
      </Form>}
    </Drawer>
  </>;
}
