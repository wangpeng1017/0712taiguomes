"use client";

import { useMemo, useState, useTransition } from "react";
import {
  Button,
  DatePicker,
  Drawer,
  Form,
  Input,
  InputNumber,
  Modal,
  Progress,
  Select,
  Space,
  Table,
  message,
} from "antd";
import { PlusOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import { StatusTag } from "@/components/StatusTag";
import { createWorkOrder, deleteWorkOrder, setWorkOrderStatus, updateWorkOrder } from "@/lib/actions/work-orders";

type Sku = { id: string; code: string; name: string; type: string };
type Equipment = { id: string; code: string; name: string; type: string; status: string };
type Mold = { id: string; code: string; name: string; type: string; applicableSkuId: string | null; status: string };

export type WorkOrderRow = {
  id: string;
  no: string;
  type: string;
  planQty: number;
  planStart: string;
  planEnd: string;
  status: string;
  sku: Sku;
  planEquipment: Equipment | null;
  planMold: Mold | null;
  goodQty: number;
  badQty: number;
  produced: number;
  completionRate: number;
  batchCount: number;
  bomVersion: string | null;
  route: string | null;
  note: string | null;
};

const EQUIP_TYPE_FOR: Record<string, string> = { 注塑: "注塑机", 冲压: "冲床" };
const MOLD_TYPE_FOR: Record<string, string> = { 注塑: "注塑模", 冲压: "冲压模" };

export function WorkOrderTable({
  rows,
  skus,
  equipments,
  molds,
}: {
  rows: WorkOrderRow[];
  skus: Sku[];
  equipments: Equipment[];
  molds: Mold[];
}) {
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<WorkOrderRow | null>(null);
  const [detail, setDetail] = useState<WorkOrderRow | null>(null);
  const [form] = Form.useForm();
  const [pending, startTransition] = useTransition();
  const selectedSkuId = Form.useWatch("skuId", form);

  const selectedSkuType = useMemo(
    () => skus.find((s) => s.id === selectedSkuId)?.type,
    [selectedSkuId, skus]
  );
  const equipmentOptions = equipments.filter((e) => e.type === EQUIP_TYPE_FOR[selectedSkuType ?? ""]);
  const moldOptions = molds.filter(
    (m) => m.type === MOLD_TYPE_FOR[selectedSkuType ?? ""] && (!m.applicableSkuId || m.applicableSkuId === selectedSkuId)
  );

  function submitCreate(values: {
    skuId: string;
    planQty: number;
    planRange: [dayjs.Dayjs, dayjs.Dayjs];
    planEquipmentId?: string;
    planMoldId?: string;
    bomVersion?: string;
    route?: string;
    note?: string;
  }) {
    startTransition(async () => {
      try {
        const input = {
          skuId: values.skuId,
          planQty: values.planQty,
          planStart: values.planRange[0].toISOString(),
          planEnd: values.planRange[1].toISOString(),
          planEquipmentId: values.planEquipmentId,
          planMoldId: values.planMoldId,
          bomVersion: values.bomVersion,
          route: values.route,
          note: values.note,
        };
        if (editing) await updateWorkOrder(editing.id, input);
        else await createWorkOrder(input);
        message.success(editing ? "工单已更新" : "工单已创建（状态：未下达）");
        setCreateOpen(false);
        setEditing(null);
        form.resetFields();
      } catch (error) {
        message.error(error instanceof Error ? error.message : "工单创建失败");
      }
    });
  }

  function openEdit(row: WorkOrderRow) {
    setEditing(row);
    setCreateOpen(true);
    queueMicrotask(() => form.setFieldsValue({
      skuId: row.sku.id, planQty: row.planQty,
      planRange: [dayjs(row.planStart), dayjs(row.planEnd)],
      planEquipmentId: row.planEquipment?.id, planMoldId: row.planMold?.id,
      bomVersion: row.bomVersion, route: row.route, note: row.note,
    }));
  }

  function removeWorkOrder(row: WorkOrderRow) {
    Modal.confirm({
      title: `删除工单 ${row.no}`,
      content: "只有未下达且没有任何业务记录的工单可以删除。",
      okText: "确认删除", okButtonProps: { danger: true }, cancelText: "取消",
      onOk: () => new Promise<void>((resolve, reject) => startTransition(async () => {
        try { await deleteWorkOrder(row.id); message.success("工单已删除"); resolve(); }
        catch (error) { message.error(error instanceof Error ? error.message : "删除失败"); reject(error); }
      })),
    });
  }

  function changeStatus(id: string, status: string, label: string) {
    startTransition(async () => {
      try {
        await setWorkOrderStatus(id, status);
        message.success(`工单已${label}`);
      } catch (error) {
        message.error(error instanceof Error ? error.message : "工单状态更新失败");
      }
    });
  }

  return (
    <>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditing(null); form.resetFields(); setCreateOpen(true); }}>
          新建工单
        </Button>
      </div>

      <Table
        rowKey="id"
        dataSource={rows}
        pagination={{ pageSize: 10 }}
        columns={[
          { title: "工单号", dataIndex: "no", render: (v, r) => (
              <a onClick={() => setDetail(r)} style={{ fontFamily: "ui-monospace, monospace" }}>{v}</a>
            ) },
          { title: "产品", render: (_, r) => (
              <div>
                <div>{r.sku.name}</div>
                <div style={{ fontSize: 11, color: "#8c98a4", fontFamily: "ui-monospace, monospace" }}>{r.sku.code}</div>
              </div>
            ) },
          { title: "类型", dataIndex: "type", width: 70 },
          { title: "计划数量", dataIndex: "planQty", className: "tabular-nums", width: 90 },
          { title: "计划区间", render: (_, r) => `${dayjs(r.planStart).format("MM-DD")} ~ ${dayjs(r.planEnd).format("MM-DD")}` },
          { title: "设备/模具", render: (_, r) => (
              <div style={{ fontSize: 12 }}>
                <div>{r.planEquipment?.code ?? "-"}</div>
                <div style={{ color: "#8c98a4" }}>{r.planMold?.code ?? "-"}</div>
              </div>
            ) },
          { title: "进度", width: 160, render: (_, r) => (
              <div>
                <Progress percent={Math.round(r.completionRate * 100)} size="small" status={r.completionRate >= 1 ? "success" : "active"} />
                <div style={{ fontSize: 11, color: "#8c98a4" }} className="tabular-nums">
                  良{r.goodQty} / 不良{r.badQty} / 批次{r.batchCount}
                </div>
              </div>
            ) },
          { title: "状态", dataIndex: "status", render: (v) => <StatusTag status={v} /> },
          { title: "操作", render: (_, r) => (
              <Space size="small">
                {!['已完工', '已关闭'].includes(r.status) && <Button size="small" type="link" onClick={() => openEdit(r)}>编辑</Button>}
                {r.status === "未下达" && (
                  <Button size="small" type="link" onClick={() => changeStatus(r.id, "已下达", "下达")}>下达</Button>
                )}
                {r.status === "生产中" && (
                  <Button size="small" type="link" onClick={() => changeStatus(r.id, "暂停", "暂停")}>暂停</Button>
                )}
                {r.status === "暂停" && (
                  <Button size="small" type="link" onClick={() => changeStatus(r.id, "生产中", "恢复")}>恢复</Button>
                )}
                {["生产中", "暂停"].includes(r.status) && r.goodQty >= r.planQty && (
                  <Button size="small" type="link" onClick={() => changeStatus(r.id, "已完工", "完工")}>完工</Button>
                )}
                {["已下达", "生产中", "暂停", "已完工"].includes(r.status) && (
                  <Button size="small" type="link" danger onClick={() => changeStatus(r.id, "已关闭", "关闭")}>关闭</Button>
                )}
                {r.status === "未下达" && r.batchCount === 0 && <Button size="small" type="link" danger onClick={() => removeWorkOrder(r)}>删除</Button>}
              </Space>
            ) },
        ]}
      />

      <Modal
        title={editing ? `编辑生产工单 · ${editing.no}` : "新建生产工单"}
        open={createOpen}
        onCancel={() => { setCreateOpen(false); setEditing(null); }}
        onOk={() => form.submit()}
        confirmLoading={pending}
        destroyOnHidden
        width={560}
      >
        <Form form={form} layout="vertical" onFinish={submitCreate} initialValues={{ bomVersion: "V1.0", route: "标准工艺" }}>
          <Form.Item name="skuId" label="产品 SKU" rules={[{ required: true, message: "请选择产品 SKU" }]}>
            <Select
              placeholder="选择产品 SKU"
              options={skus.map((s) => ({ value: s.id, label: `${s.name}（${s.code}） · ${s.type}` }))}
              showSearch
              optionFilterProp="label"
            />
          </Form.Item>
          <Form.Item name="planQty" label="计划数量" rules={[{ required: true, message: "请输入计划数量" }]}>
            <InputNumber min={1} style={{ width: "100%" }} addonAfter="件" />
          </Form.Item>
          <Form.Item name="planRange" label="计划开始 ~ 结束日期" rules={[{ required: true, message: "请选择计划区间" }]}>
            <DatePicker.RangePicker style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item name="planEquipmentId" label="计划设备">
            <Select
              placeholder={selectedSkuType ? "选择计划设备" : "请先选择产品 SKU"}
              disabled={!selectedSkuType}
              allowClear
              options={equipmentOptions.map((e) => ({
                value: e.id,
                label: `${e.name}（${e.code}）`,
                disabled: e.status !== "可用",
              }))}
            />
          </Form.Item>
          <Form.Item name="planMoldId" label="计划模具">
            <Select
              placeholder={selectedSkuType ? "选择计划模具" : "请先选择产品 SKU"}
              disabled={!selectedSkuType}
              allowClear
              options={moldOptions.map((m) => ({
                value: m.id,
                label: `${m.name}（${m.code}） · ${m.status}`,
              }))}
            />
          </Form.Item>
          <Form.Item name="bomVersion" label="BOM 版本">
            <Input />
          </Form.Item>
          <Form.Item name="route" label="工艺路线">
            <Input />
          </Form.Item>
          <Form.Item name="note" label="备注">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>

      <Drawer title={detail ? `工单详情 · ${detail.no}` : ""} open={!!detail} onClose={() => setDetail(null)} width={420}>
        {detail && (
          <Space direction="vertical" size="middle" style={{ width: "100%" }}>
            <div>
              <div style={{ color: "#8c98a4", fontSize: 12 }}>产品</div>
              <div>{detail.sku.name}（{detail.sku.code}）· {detail.type}</div>
            </div>
            <div>
              <div style={{ color: "#8c98a4", fontSize: 12 }}>状态</div>
              <StatusTag status={detail.status} />
            </div>
            <div>
              <div style={{ color: "#8c98a4", fontSize: 12 }}>计划数量 / 已产 / 完成率</div>
              <div className="tabular-nums">
                {detail.planQty} / {detail.produced}（良{detail.goodQty} 不良{detail.badQty}）/ {Math.round(detail.completionRate * 100)}%
              </div>
            </div>
            <div>
              <div style={{ color: "#8c98a4", fontSize: 12 }}>计划设备 / 模具</div>
              <div>{detail.planEquipment?.name ?? "-"} / {detail.planMold?.name ?? "-"}</div>
            </div>
            <div>
              <div style={{ color: "#8c98a4", fontSize: 12 }}>当前生产批次数</div>
              <div className="tabular-nums">{detail.batchCount}</div>
            </div>
            {detail.note && (
              <div>
                <div style={{ color: "#8c98a4", fontSize: 12 }}>备注</div>
                <div>{detail.note}</div>
              </div>
            )}
          </Space>
        )}
      </Drawer>
    </>
  );
}
