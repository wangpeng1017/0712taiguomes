"use client";

import { useState, useTransition } from "react";
import { Button, Descriptions, Drawer, Form, Input, InputNumber, Modal, Select, Space, Table, message } from "antd";
import { StatusTag } from "@/components/StatusTag";
import { createReworkOrder, recordOperationQuality } from "@/lib/actions/operations";

type PendingBatch = {
  id: string; batchNo: string; status: string; goodQty: number; badQty: number; operator: string; startTime: string;
  workOrder: { no: string }; sku: { code: string; name: string };
  workOrderOperation: { id: string; sequence: number; operationName: string; qualityStatus: string } | null;
  equipment: { code: string; name: string } | null; mold: { code: string; name: string } | null;
};
type QualityData = {
  pendingBatches: PendingBatch[];
  qualityResults: { id: string; result: string; qualifiedQty: number | null; unqualifiedQty: number | null; inspector: string; inspectedAt: string; batch: { batchNo: string } | null; workOrderOperation: { operationName: string; workOrder: { no: string } } }[];
  reworkOrders: { id: string; no: string; qty: number; qualifiedQty: number; scrapQty: number; reason: string; status: string; createdBy: string; sourceBatch: { batchNo: string }; workOrderOperation: { operationName: string; workOrder: { no: string } }; routeVersion: { version: string; route: { name: string } }; resultBatch: { batchNo: string } | null }[];
  routeVersions: { id: string; version: string; route: { name: string; code: string } }[];
};

export function QualityExecutionView({ data }: { data: QualityData }) {
  const [inspecting, setInspecting] = useState<PendingBatch | null>(null);
  const [reworking, setReworking] = useState<PendingBatch | null>(null);
  const [qualityForm] = Form.useForm();
  const [reworkForm] = Form.useForm();
  const [pending, startTransition] = useTransition();

  function submitQuality(values: { result: "合格" | "不合格" | "让步接收"; qualifiedQty: number; unqualifiedQty: number; sampleQty?: number; inspector: string; valuesJson?: string; note?: string }) {
    if (!inspecting) return;
    startTransition(async () => {
      try {
        await recordOperationQuality({ batchId: inspecting.id, ...values });
        message.success("工序检验结果已保存并更新放行状态"); setInspecting(null); qualityForm.resetFields();
      } catch (error) { message.error(error instanceof Error ? error.message : "检验提交失败"); }
    });
  }

  function submitRework(values: { qty: number; reason: string; createdBy: string; approvedBy?: string; routeVersionId: string; note?: string }) {
    if (!reworking?.workOrderOperation) return;
    startTransition(async () => {
      try {
        await createReworkOrder({ sourceBatchId: reworking.id, workOrderOperationId: reworking.workOrderOperation!.id, ...values });
        message.success("返工任务已创建，可在工序任务页面执行返工报工"); setReworking(null); reworkForm.resetFields();
      } catch (error) { message.error(error instanceof Error ? error.message : "返工任务创建失败"); }
    });
  }

  return <Space direction="vertical" size="large" style={{ width: "100%" }}>
    <section>
      <div className="mes-section-heading"><div><h2>待检与质量冻结</h2><p>必检工序报工后必须由质量人员放行，合格数量才可流入下道工序。</p></div></div>
      <Table<PendingBatch> rowKey="id" dataSource={data.pendingBatches} pagination={{ pageSize: 10 }} columns={[
        { title: "生产批次", dataIndex: "batchNo", className: "mes-code" },
        { title: "工单 / 产品", render: (_, row) => <div>{row.workOrder.no}<div className="mes-meta">{row.sku.name} · {row.sku.code}</div></div> },
        { title: "工序", render: (_, row) => row.workOrderOperation ? `${row.workOrderOperation.sequence} ${row.workOrderOperation.operationName}` : "-" },
        { title: "待检 / 已报不良", render: (_, row) => `${row.goodQty} / ${row.badQty}` },
        { title: "资源", render: (_, row) => `${row.equipment?.code ?? "-"} / ${row.mold?.code ?? "-"}` },
        { title: "状态", render: (_, row) => <StatusTag status={row.status} /> },
        { title: "操作", render: (_, row) => <Space><Button type="link" size="small" onClick={() => { setInspecting(row); qualityForm.setFieldsValue({ result: "合格", qualifiedQty: row.goodQty, unqualifiedQty: 0, sampleQty: row.goodQty }); }}>检验</Button><Button type="link" size="small" onClick={() => { setReworking(row); reworkForm.setFieldsValue({ qty: row.badQty || row.goodQty }); }}>创建返工</Button></Space> },
      ]} />
    </section>

    <section>
      <div className="mes-section-heading"><div><h2>返工任务</h2><p>返工批次保留原不良批次、返工路线和最终结果批次的完整关联。</p></div></div>
      <Table rowKey="id" dataSource={data.reworkOrders} pagination={{ pageSize: 8 }} columns={[
        { title: "返工单", dataIndex: "no", className: "mes-code" },
        { title: "原批次", render: (_, row) => row.sourceBatch.batchNo },
        { title: "返工工序", render: (_, row) => `${row.workOrderOperation.workOrder.no} · ${row.workOrderOperation.operationName}` },
        { title: "路线", render: (_, row) => `${row.routeVersion.route.name} ${row.routeVersion.version}` },
        { title: "数量", render: (_, row) => `${row.qty}（合格${row.qualifiedQty}/报废${row.scrapQty}）` },
        { title: "结果批次", render: (_, row) => row.resultBatch?.batchNo ?? "-" },
        { title: "状态", render: (_, row) => <StatusTag status={row.status} /> },
      ]} />
    </section>

    <Drawer title={inspecting ? `工序检验 · ${inspecting.batchNo}` : ""} open={!!inspecting} onClose={() => setInspecting(null)} width={520}>
      {inspecting && <Form form={qualityForm} layout="vertical" onFinish={submitQuality}>
        <Descriptions bordered size="small" column={1} style={{ marginBottom: 16 }}><Descriptions.Item label="工单">{inspecting.workOrder.no}</Descriptions.Item><Descriptions.Item label="工序">{inspecting.workOrderOperation?.operationName}</Descriptions.Item><Descriptions.Item label="待检数量">{inspecting.goodQty}</Descriptions.Item></Descriptions>
        <Form.Item name="result" label="检验结论" rules={[{ required: true }]}><Select options={["合格", "不合格", "让步接收"].map((value) => ({ value, label: value }))} /></Form.Item>
        <Form.Item name="sampleQty" label="抽检数量"><InputNumber min={0} style={{ width: "100%" }} /></Form.Item>
        <Form.Item name="qualifiedQty" label="合格数量" rules={[{ required: true }]}><InputNumber min={0} style={{ width: "100%" }} /></Form.Item>
        <Form.Item name="unqualifiedQty" label="不合格数量" rules={[{ required: true }]}><InputNumber min={0} style={{ width: "100%" }} /></Form.Item>
        <Form.Item name="inspector" label="检验员" rules={[{ required: true }]}><Input /></Form.Item>
        <Form.Item name="valuesJson" label="检验参数 / 结果"><Input.TextArea rows={3} placeholder="例如：尺寸A=10.02mm；外观=合格" /></Form.Item>
        <Form.Item name="note" label="备注"><Input.TextArea rows={2} /></Form.Item>
        <Button type="primary" htmlType="submit" loading={pending} block>提交检验结果</Button>
      </Form>}
    </Drawer>

    <Modal title={reworking ? `创建返工任务 · ${reworking.batchNo}` : ""} open={!!reworking} onCancel={() => setReworking(null)} onOk={() => reworkForm.submit()} confirmLoading={pending} destroyOnHidden>
      <Form form={reworkForm} layout="vertical" onFinish={submitRework}>
        <Form.Item name="qty" label="返工数量" rules={[{ required: true }]}><InputNumber min={1} style={{ width: "100%" }} /></Form.Item>
        <Form.Item name="routeVersionId" label="返工路线版本" rules={[{ required: true }]}><Select showSearch optionFilterProp="label" options={data.routeVersions.map((version) => ({ value: version.id, label: `${version.route.name}（${version.route.code}）· ${version.version}` }))} /></Form.Item>
        <Form.Item name="reason" label="返工原因" rules={[{ required: true }]}><Input /></Form.Item>
        <Form.Item name="createdBy" label="创建人" rules={[{ required: true }]}><Input /></Form.Item>
        <Form.Item name="approvedBy" label="批准人"><Input /></Form.Item>
        <Form.Item name="note" label="备注"><Input.TextArea rows={2} /></Form.Item>
      </Form>
    </Modal>
  </Space>;
}
