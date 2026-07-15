"use client";

import { useMemo, useState } from "react";
import { Alert, Card, Descriptions, Empty, Select, Table, Tabs, Tag } from "antd";
import dayjs from "dayjs";
import { StatusTag } from "@/components/StatusTag";
import { MoldLifeMeter } from "@/components/MoldLifeMeter";

type Defect = { id: string; qty: number; responsible: string | null; action: string | null; reason: { reason: string } };
type StockIn = { id: string; no: string; type: string; qty: number; warehouse: string | null; inBy: string; inAt: string };
type Batch = {
  id: string; batchNo: string; shift: string; operator: string; startTime: string; endTime: string | null;
  goodQty: number; badQty: number; status: string; moldId: string; materialLotId: string;
  confirmedByLeader: boolean; leaderConfirmedBy: string | null; leaderConfirmedAt: string | null;
  workOrder: { no: string }; sku: { name: string; code: string }; equipment: { code: string; name: string };
  mold: { code: string; name: string }; materialLot: { lotNo: string; material: { name: string } };
  defects: Defect[]; stockIns: StockIn[];
};
type MaterialLot = { id: string; lotNo: string; material: { name: string } };
type Maintenance = { id: string; maintType: string; startTime: string; person: string; canContinue: boolean };
type Mold = { id: string; code: string; name: string; currentCount: number; designLife: number; warnThreshold: number; maintenance: Maintenance[] };
export type TraceSection = "forward" | "reverse" | "molds";

export function TraceView({ batches, materialLots, molds, section = "forward" }: { batches: Batch[]; materialLots: MaterialLot[]; molds: Mold[]; section?: TraceSection }) {
  const [lotId, setLotId] = useState<string | undefined>();
  const [batchId, setBatchId] = useState<string | undefined>();
  const [moldId, setMoldId] = useState<string | undefined>();

  const forwardResults = useMemo(() => (lotId ? batches.filter((b) => b.materialLotId === lotId) : []), [lotId, batches]);
  const reverseResult = useMemo(() => batches.find((b) => b.id === batchId), [batchId, batches]);
  const moldResult = useMemo(() => molds.find((m) => m.id === moldId), [moldId, molds]);
  const moldBatches = useMemo(() => (moldId ? batches.filter((b) => b.moldId === moldId) : []), [moldId, batches]);

  const forwardTab = (
    <div>
      <Select
        style={{ width: 420, marginBottom: 16 }}
        placeholder="选择原材料批次号进行正向追溯"
        options={materialLots.map((l) => ({ value: l.id, label: `${l.lotNo} · ${l.material.name}` }))}
        showSearch
        optionFilterProp="label"
        onChange={setLotId}
        allowClear
      />
      {lotId ? (
        <Table
          size="small"
          rowKey="id"
          dataSource={forwardResults}
          locale={{ emptyText: "该物料批次尚未被任何生产批次使用" }}
          columns={[
            { title: "生产批次", dataIndex: "batchNo", render: (v) => <span style={{ fontFamily: "ui-monospace, monospace" }}>{v}</span> },
            { title: "工单", render: (_, r) => r.workOrder.no },
            { title: "产品", render: (_, r) => `${r.sku.name}（${r.sku.code}）` },
            { title: "设备/模具", render: (_, r) => `${r.equipment.code} / ${r.mold.code}` },
            { title: "日期/班次", render: (_, r) => `${dayjs(r.startTime).format("MM-DD")} · ${r.shift}` },
            { title: "良品/不良", render: (_, r) => `${r.goodQty} / ${r.badQty}` },
            { title: "入库数量", render: (_, r) => r.stockIns.filter((record) => record.type !== "不良品隔离").reduce((s, si) => s + si.qty, 0) },
          ]}
        />
      ) : (
        <Empty description="请选择一个原材料批次号" />
      )}
    </div>
  );

  const reverseTab = (
    <div>
      <Select
        style={{ width: 420, marginBottom: 16 }}
        placeholder="选择生产批次号进行反向追溯"
        options={batches.map((b) => ({ value: b.id, label: `${b.batchNo} · ${b.sku.name}` }))}
        showSearch
        optionFilterProp="label"
        onChange={setBatchId}
        allowClear
      />
      {reverseResult ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Descriptions bordered size="small" column={2} title="生产批次全链路">
            <Descriptions.Item label="生产批次号" span={2}>
              <span style={{ fontFamily: "ui-monospace, monospace" }}>{reverseResult.batchNo}</span>
            </Descriptions.Item>
            <Descriptions.Item label="工单">{reverseResult.workOrder.no}</Descriptions.Item>
            <Descriptions.Item label="产品">{reverseResult.sku.name}（{reverseResult.sku.code}）</Descriptions.Item>
            <Descriptions.Item label="设备">{reverseResult.equipment.name}（{reverseResult.equipment.code}）</Descriptions.Item>
            <Descriptions.Item label="模具">{reverseResult.mold.name}（{reverseResult.mold.code}）</Descriptions.Item>
            <Descriptions.Item label="原材料批次">{reverseResult.materialLot.lotNo}（{reverseResult.materialLot.material.name}）</Descriptions.Item>
            <Descriptions.Item label="班次/操作员">{reverseResult.shift} · {reverseResult.operator}</Descriptions.Item>
            <Descriptions.Item label="生产时间" span={2}>
              {dayjs(reverseResult.startTime).format("YYYY-MM-DD HH:mm")} ~ {reverseResult.endTime ? dayjs(reverseResult.endTime).format("HH:mm") : "-"}
            </Descriptions.Item>
            <Descriptions.Item label="良品/不良数量">{reverseResult.goodQty} / {reverseResult.badQty}</Descriptions.Item>
            <Descriptions.Item label="状态"><StatusTag status={reverseResult.status} /></Descriptions.Item>
            <Descriptions.Item label="超寿命主管确认" span={2}>
              {reverseResult.confirmedByLeader
                ? `${reverseResult.leaderConfirmedBy ?? "-"} · ${reverseResult.leaderConfirmedAt ? dayjs(reverseResult.leaderConfirmedAt).format("YYYY-MM-DD HH:mm") : "-"}`
                : "未触发"}
            </Descriptions.Item>
          </Descriptions>

          <Card size="small" title="不良记录">
            <Table
              size="small"
              pagination={false}
              rowKey="id"
              dataSource={reverseResult.defects}
              locale={{ emptyText: "该批次无不良记录" }}
              columns={[
                { title: "不良原因", render: (_, r) => r.reason.reason },
                { title: "数量", dataIndex: "qty" },
                { title: "责任环节", dataIndex: "responsible" },
                { title: "处理方式", dataIndex: "action" },
              ]}
            />
          </Card>

          <Card size="small" title="入库记录">
            <Table
              size="small"
              pagination={false}
              rowKey="id"
              dataSource={reverseResult.stockIns}
              locale={{ emptyText: "尚未入库" }}
              columns={[
                { title: "入库单号", dataIndex: "no" },
                { title: "类型", dataIndex: "type" },
                { title: "数量", dataIndex: "qty" },
                { title: "仓库", dataIndex: "warehouse" },
                { title: "入库人", dataIndex: "inBy" },
                { title: "入库时间", render: (_, r) => dayjs(r.inAt).format("MM-DD HH:mm") },
              ]}
            />
          </Card>
        </div>
      ) : (
        <Empty description="请选择一个生产批次号" />
      )}
    </div>
  );

  const moldTab = (
    <div>
      <Select
        style={{ width: 420, marginBottom: 16 }}
        placeholder="选择模具编号进行模具追溯"
        options={molds.map((m) => ({ value: m.id, label: `${m.name}（${m.code}）` }))}
        showSearch
        optionFilterProp="label"
        onChange={setMoldId}
        allowClear
      />
      {moldResult ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Card size="small" title="累计使用情况">
            <MoldLifeMeter rate={moldResult.currentCount / moldResult.designLife} warnThreshold={moldResult.warnThreshold} />
            <div style={{ marginTop: 8, fontSize: 12, color: "#8c98a4" }} className="tabular-nums">
              累计 {moldResult.currentCount.toLocaleString("zh-CN")} / 设计寿命 {moldResult.designLife.toLocaleString("zh-CN")}
            </div>
          </Card>
          <Card size="small" title="历史生产批次">
            <Table
              size="small"
              pagination={false}
              rowKey="id"
              dataSource={moldBatches}
              locale={{ emptyText: "暂无生产记录" }}
              columns={[
                { title: "批次号", dataIndex: "batchNo", render: (v) => <span style={{ fontFamily: "ui-monospace, monospace" }}>{v}</span> },
                { title: "工单", render: (_, r) => r.workOrder.no },
                { title: "产品", render: (_, r) => r.sku.name },
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
              dataSource={moldResult.maintenance}
              locale={{ emptyText: "暂无保养记录" }}
              columns={[
                { title: "类型", dataIndex: "maintType" },
                { title: "人员", dataIndex: "person" },
                { title: "可继续生产", dataIndex: "canContinue", render: (v) => (v ? <Tag color="green">是</Tag> : <Tag color="red">否</Tag>) },
                { title: "时间", render: (_, r) => dayjs(r.startTime).format("MM-DD HH:mm") },
              ]}
            />
          </Card>
        </div>
      ) : (
        <Empty description="请选择一套模具" />
      )}
    </div>
  );

  return (
    <div>
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message="小批次追溯：追溯粒度为「工单+日期+班次+SKU+设备+模具+原材料批次」组成的生产批次，不追溯到单件产品（见 SPEC §4）"
      />
      <Tabs
        activeKey={section === "molds" ? "mold" : section}
        tabBarStyle={{ display: "none" }}
        items={[
          { key: "forward", label: "正向追溯（原材料→生产批次）", children: forwardTab },
          { key: "reverse", label: "反向追溯（生产批次→全链路）", children: reverseTab },
          { key: "mold", label: "模具追溯", children: moldTab },
        ]}
      />
    </div>
  );
}
