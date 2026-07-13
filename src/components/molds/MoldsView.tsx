"use client";

import { useState, useTransition } from "react";
import { Button, Card, Checkbox, Descriptions, Drawer, Form, Input, Modal, Select, Space, Table, Tag, message } from "antd";
import dayjs from "dayjs";
import { MAINT_TYPES } from "@/lib/constants";
import { StatusTag } from "@/components/StatusTag";
import { MoldLifeMeter } from "@/components/MoldLifeMeter";
import { registerMoldMaintenance } from "@/lib/actions/molds";

type Batch = { id: string; batchNo: string; startTime: string; goodQty: number; badQty: number; workOrder: { no: string }; sku: { name: string } };
type Maintenance = {
  id: string; maintType: string; startTime: string; endTime: string | null; person: string;
  content: string | null; replacedParts: string | null; result: string | null; canContinue: boolean;
};
type Mold = {
  id: string; code: string; name: string; type: string; status: string;
  currentCount: number; designLife: number; maintCycle: number; warnThreshold: number;
  lastMaintDate: string | null; lastMaintCount: number; cavityCount: number | null;
  applicableSku: { name: string; code: string } | null; applicableEquipment: { name: string; code: string } | null;
  batches: Batch[]; maintenance: Maintenance[];
};

export function MoldsView({ molds }: { molds: Mold[] }) {
  const [detail, setDetail] = useState<Mold | null>(null);
  const [maintTarget, setMaintTarget] = useState<Mold | null>(null);
  const [pending, startTransition] = useTransition();
  const [form] = Form.useForm();

  function submitMaintenance(values: {
    maintType: string; person: string; content?: string; replacedParts?: string; result?: string; canContinue: boolean;
  }) {
    if (!maintTarget) return;
    const now = new Date().toISOString();
    startTransition(async () => {
      try {
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
        message.success(values.canContinue ? "保养登记完成，模具已恢复可用" : "保养/维修记录已登记");
        setMaintTarget(null);
        form.resetFields();
      } catch (error) {
        message.error(error instanceof Error ? error.message : "保养登记失败");
      }
    });
  }

  return (
    <>
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
                <Button size="small" type="link" onClick={() => setMaintTarget(r)}>登记保养</Button>
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
                ]}
              />
            </Card>
          </Space>
        )}
      </Drawer>

      <Modal
        title={maintTarget ? `登记保养 · ${maintTarget.name}` : ""}
        open={!!maintTarget}
        onCancel={() => setMaintTarget(null)}
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
