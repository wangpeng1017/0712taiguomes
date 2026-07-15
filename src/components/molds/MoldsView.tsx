"use client";

import { useState, useTransition } from "react";
import { Button, Card, Checkbox, Descriptions, Drawer, Form, Input, InputNumber, Modal, Select, Space, Table, Tag, message } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import { MAINT_TYPES, MOLD_STATUS, MOLD_TYPES } from "@/lib/constants";
import { StatusTag } from "@/components/StatusTag";
import { MoldLifeMeter } from "@/components/MoldLifeMeter";
import { deleteMold, deleteMoldMaintenance, registerMoldMaintenance, saveMold, updateMoldMaintenance } from "@/lib/actions/molds";

type Batch = { id: string; batchNo: string; startTime: string; goodQty: number; badQty: number; workOrder: { no: string }; sku: { name: string } };
type Maintenance = {
  id: string; maintType: string; startTime: string; endTime: string | null; person: string;
  content: string | null; replacedParts: string | null; result: string | null; canContinue: boolean;
};
type Mold = {
  id: string; code: string; name: string; type: string; status: string;
  currentCount: number; designLife: number; maintCycle: number; warnThreshold: number;
  lastMaintDate: string | null; lastMaintCount: number; cavityCount: number | null;
  note: string | null;
  applicableSku: { id: string; name: string; code: string } | null; applicableEquipment: { id: string; name: string; code: string } | null;
  batches: Batch[]; maintenance: Maintenance[];
};

type SkuOption = { id: string; code: string; name: string; type: string };
type EquipmentOption = { id: string; code: string; name: string; type: string };

export function MoldsView({ molds, skus, equipments }: { molds: Mold[]; skus: SkuOption[]; equipments: EquipmentOption[] }) {
  const [detail, setDetail] = useState<Mold | null>(null);
  const [maintTarget, setMaintTarget] = useState<Mold | null>(null);
  const [editingMaintenance, setEditingMaintenance] = useState<Maintenance | null>(null);
  const [moldEditor, setMoldEditor] = useState<Mold | "new" | null>(null);
  const [pending, startTransition] = useTransition();
  const [form] = Form.useForm();
  const [moldForm] = Form.useForm();
  const moldType = Form.useWatch("type", moldForm);

  function submitMaintenance(values: {
    maintType: string; person: string; content?: string; replacedParts?: string; result?: string; canContinue: boolean;
  }) {
    if (!maintTarget) return;
    const now = new Date().toISOString();
    startTransition(async () => {
      try {
        if (editingMaintenance) {
          await updateMoldMaintenance(editingMaintenance.id, values);
        } else {
          await registerMoldMaintenance({
            moldId: maintTarget.id,
            maintType: values.maintType,
            startTime: now,
            endTime: now,
            person: values.person,
            content: values.content,
            replacedParts: values.replacedParts,
            result: values.result,
            canContinue: values.canContinue,
          });
        }
        message.success(editingMaintenance ? "保养记录已更新" : values.canContinue ? "保养登记完成，模具已恢复可用" : "保养/维修记录已登记");
        setMaintTarget(null);
        setEditingMaintenance(null);
        form.resetFields();
      } catch (error) {
        message.error(error instanceof Error ? error.message : "保养登记失败");
      }
    });
  }

  function openMoldEditor(mold?: Mold) {
    setMoldEditor(mold ?? "new");
    moldForm.resetFields();
    queueMicrotask(() => moldForm.setFieldsValue(mold ? {
      code: mold.code, name: mold.name, type: mold.type, status: mold.status,
      applicableSkuId: mold.applicableSku?.id, applicableEquipmentId: mold.applicableEquipment?.id,
      designLife: mold.designLife, currentCount: mold.currentCount, maintCycle: mold.maintCycle,
      warnThresholdPct: mold.warnThreshold * 100, cavityCount: mold.cavityCount, note: mold.note,
    } : { type: "注塑模", status: "可用", currentCount: 0, warnThresholdPct: 80 }));
  }

  function submitMold(values: Record<string, unknown>) {
    startTransition(async () => {
      try {
        await saveMold({
          id: moldEditor && moldEditor !== "new" ? moldEditor.id : undefined,
          code: values.code as string, name: values.name as string, type: values.type as string,
          applicableSkuId: values.applicableSkuId as string | undefined,
          applicableEquipmentId: values.applicableEquipmentId as string | undefined,
          designLife: values.designLife as number, currentCount: values.currentCount as number,
          maintCycle: values.maintCycle as number, warnThreshold: (values.warnThresholdPct as number) / 100,
          status: values.status as string, cavityCount: values.cavityCount as number | null, note: values.note as string | undefined,
        });
        message.success("模具已保存");
        setMoldEditor(null);
      } catch (error) { message.error(error instanceof Error ? error.message : "保存失败"); }
    });
  }

  function removeMold(mold: Mold) {
    Modal.confirm({
      title: `删除模具 ${mold.code}`, content: "已有业务记录的模具将拒绝删除。", okButtonProps: { className: "mes-destructive-confirm" },
      onOk: () => new Promise<void>((resolve, reject) => startTransition(async () => {
        try { await deleteMold(mold.id); message.success("模具已删除"); resolve(); }
        catch (error) { message.error(error instanceof Error ? error.message : "删除失败"); reject(error); }
      })),
    });
  }

  function removeMaintenance(id: string) {
    startTransition(async () => {
      try { await deleteMoldMaintenance(id); message.success("保养记录已删除"); }
      catch (error) { message.error(error instanceof Error ? error.message : "删除失败"); }
    });
  }

  return (
    <>
      <div className="table-toolbar"><Button type="primary" icon={<PlusOutlined />} onClick={() => openMoldEditor()}>新增模具</Button></div>
      <Table
        rowKey="id"
        dataSource={molds}
        columns={[
          { title: "模具", render: (_, r) => (
              <div>
                <a onClick={() => setDetail(r)}>{r.name}</a>
                <div style={{ fontSize: 11, color: "#8c98a4", fontFamily: "ui-monospace, monospace" }}>{r.code}</div>
              </div>
            ) },
          { title: "类型", dataIndex: "type", width: 80 },
          { title: "适用产品/设备", render: (_, r) => (
              <div style={{ fontSize: 12 }}>
                <div>{r.applicableSku?.name ?? "-"}</div>
                <div style={{ color: "#8c98a4" }}>{r.applicableEquipment?.code ?? "-"}</div>
              </div>
            ) },
          { title: "寿命使用率", width: 180, render: (_, r) => <MoldLifeMeter rate={r.currentCount / r.designLife} warnThreshold={r.warnThreshold} /> },
          { title: "累计/设计寿命", render: (_, r) => <span className="tabular-nums">{r.currentCount.toLocaleString("zh-CN")} / {r.designLife.toLocaleString("zh-CN")}</span> },
          { title: "状态", dataIndex: "status", render: (v) => <StatusTag status={v} /> },
          { title: "上次保养", render: (_, r) => (r.lastMaintDate ? dayjs(r.lastMaintDate).format("YYYY-MM-DD") : "-") },
          { title: "操作", render: (_, r) => (
              <Space size="small">
                <Button size="small" type="link" onClick={() => setDetail(r)}>详情</Button>
                <Button size="small" type="link" onClick={() => openMoldEditor(r)}>编辑</Button>
                <Button size="small" type="link" onClick={() => { setEditingMaintenance(null); form.resetFields(); setMaintTarget(r); }}>登记保养</Button>
                <Button className="mes-destructive-action" size="small" type="link" onClick={() => removeMold(r)}>删除</Button>
              </Space>
            ) },
        ]}
      />

      <Drawer title={detail ? `${detail.name} · ${detail.code}` : ""} open={!!detail} onClose={() => setDetail(null)} width={520}>
        {detail && (
          <Space direction="vertical" size="middle" style={{ width: "100%" }}>
            <Descriptions column={2} size="small" bordered>
              <Descriptions.Item label="类型">{detail.type}</Descriptions.Item>
              <Descriptions.Item label="状态"><StatusTag status={detail.status} /></Descriptions.Item>
              <Descriptions.Item label="适用产品">{detail.applicableSku?.name ?? "-"}</Descriptions.Item>
              <Descriptions.Item label="适用设备">{detail.applicableEquipment?.name ?? "-"}</Descriptions.Item>
              <Descriptions.Item label="模穴数/单次出件数">{detail.cavityCount ?? "-"}</Descriptions.Item>
              <Descriptions.Item label="保养周期">{detail.maintCycle.toLocaleString("zh-CN")} 次</Descriptions.Item>
              <Descriptions.Item label="累计次数" span={2}>
                <span className="tabular-nums">{detail.currentCount.toLocaleString("zh-CN")} / {detail.designLife.toLocaleString("zh-CN")}</span>
                （距上次保养 {(detail.currentCount - detail.lastMaintCount).toLocaleString("zh-CN")} 次）
              </Descriptions.Item>
            </Descriptions>

            <Card size="small" title="历史生产批次">
              <Table
                size="small"
                pagination={false}
                rowKey="id"
                dataSource={detail.batches}
                locale={{ emptyText: "暂无记录" }}
                columns={[
                  { title: "批次号", dataIndex: "batchNo", render: (v) => <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 12 }}>{v}</span> },
                  { title: "工单", render: (_, r) => r.workOrder.no },
                  { title: "良/不良", render: (_, r) => `${r.goodQty} / ${r.badQty}` },
                  { title: "时间", render: (_, r) => dayjs(r.startTime).format("MM-DD HH:mm") },
                ]}
              />
            </Card>

            <Card size="small" title="保养 / 维修记录">
              <Table
                size="small"
                pagination={false}
                rowKey="id"
                dataSource={detail.maintenance}
                locale={{ emptyText: "暂无记录" }}
                columns={[
                  { title: "类型", dataIndex: "maintType" },
                  { title: "人员", dataIndex: "person" },
                  { title: "内容", dataIndex: "content", render: (v) => v ?? "-" },
                  { title: "可继续生产", dataIndex: "canContinue", render: (v) => (v ? <Tag color="green">是</Tag> : <Tag color="red">否</Tag>) },
                  { title: "时间", render: (_, r) => dayjs(r.startTime).format("MM-DD HH:mm") },
                  { title: "操作", render: (_, r) => <Space size="small"><Button type="link" size="small" onClick={() => { setEditingMaintenance(r); setMaintTarget(detail); queueMicrotask(() => form.setFieldsValue(r)); }}>编辑</Button><Button className="mes-destructive-action" type="link" size="small" onClick={() => Modal.confirm({ title: "删除该保养记录？", okButtonProps: { className: "mes-destructive-confirm" }, onOk: () => removeMaintenance(r.id) })}>删除</Button></Space> },
                ]}
              />
            </Card>
          </Space>
        )}
      </Drawer>

      <Modal title={moldEditor === "new" ? "新增模具" : "编辑模具"} open={!!moldEditor} onCancel={() => setMoldEditor(null)} onOk={() => moldForm.submit()} confirmLoading={pending} width={700} destroyOnClose>
        <Form form={moldForm} layout="vertical" onFinish={submitMold} preserve={false}>
          <Space align="start"><Form.Item name="code" label="模具编号" rules={[{ required: true }]}><Input style={{ width: 210 }} /></Form.Item><Form.Item name="name" label="模具名称" rules={[{ required: true }]}><Input style={{ width: 250 }} /></Form.Item></Space>
          <Space align="start"><Form.Item name="type" label="类型" rules={[{ required: true }]}><Select style={{ width: 180 }} options={MOLD_TYPES.map((value) => ({ value, label: value }))} /></Form.Item><Form.Item name="status" label="状态" rules={[{ required: true }]}><Select style={{ width: 180 }} options={MOLD_STATUS.map((value) => ({ value, label: value }))} /></Form.Item></Space>
          <Space align="start"><Form.Item name="applicableSkuId" label="适用产品"><Select allowClear showSearch optionFilterProp="label" style={{ width: 280 }} options={skus.filter((sku) => sku.type === (moldType === "注塑模" ? "注塑" : "冲压")).map((sku) => ({ value: sku.id, label: `${sku.name}（${sku.code}）` }))} /></Form.Item><Form.Item name="applicableEquipmentId" label="适用设备"><Select allowClear style={{ width: 260 }} options={equipments.filter((equipment) => equipment.type === (moldType === "注塑模" ? "注塑机" : "冲床")).map((equipment) => ({ value: equipment.id, label: `${equipment.name}（${equipment.code}）` }))} /></Form.Item></Space>
          <Space align="start"><Form.Item name="designLife" label="设计寿命" rules={[{ required: true }]}><InputNumber min={1} style={{ width: 160 }} /></Form.Item><Form.Item name="currentCount" label="初始累计次数"><InputNumber min={0} disabled={moldEditor !== "new"} style={{ width: 160 }} /></Form.Item><Form.Item name="maintCycle" label="保养周期" rules={[{ required: true }]}><InputNumber min={1} style={{ width: 160 }} /></Form.Item></Space>
          <Space align="start"><Form.Item name="warnThresholdPct" label="预警阈值(%)" rules={[{ required: true }]}><InputNumber min={1} max={100} style={{ width: 160 }} /></Form.Item><Form.Item name="cavityCount" label="模穴数/单次出件数"><InputNumber min={1} style={{ width: 200 }} /></Form.Item></Space>
          <Form.Item name="note" label="备注"><Input.TextArea rows={2} /></Form.Item>
        </Form>
      </Modal>

      <Modal
        title={maintTarget ? `${editingMaintenance ? "编辑保养记录" : "登记保养"} · ${maintTarget.name}` : ""}
        open={!!maintTarget}
        onCancel={() => { setMaintTarget(null); setEditingMaintenance(null); }}
        onOk={() => form.submit()}
        confirmLoading={pending}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" onFinish={submitMaintenance} initialValues={{ canContinue: true }}>
          <Form.Item name="maintType" label="保养类型" rules={[{ required: true, message: "请选择保养类型" }]}>
            <Select options={MAINT_TYPES.map((t) => ({ value: t, label: t }))} />
          </Form.Item>
          <Form.Item name="person" label="保养人员" rules={[{ required: true, message: "请输入保养人员" }]} initialValue="Kittipong">
            <Input />
          </Form.Item>
          <Form.Item name="content" label="保养内容">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item name="replacedParts" label="更换部件">
            <Input />
          </Form.Item>
          <Form.Item name="result" label="保养结果">
            <Input />
          </Form.Item>
          <Form.Item name="canContinue" valuePropName="checked">
            <Checkbox>保养完成，模具可恢复&ldquo;可用&rdquo;状态继续生产</Checkbox>
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
