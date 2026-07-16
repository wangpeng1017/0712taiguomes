"use client";

import { useMemo, useState } from "react";
import { Alert, Button, Card, Col, Descriptions, Empty, Row, Select, Space, Statistic, Table, Tabs, Tag, Timeline, Typography } from "antd";
import dayjs from "dayjs";
import { StatusTag } from "@/components/StatusTag";
import { MoldLifeMeter } from "@/components/MoldLifeMeter";
import type { TraceGenealogyEdge, TraceMaterialConsumption, TraceMaterialRequirement, TraceOperation, TraceQualityResult, TraceReworkOrder } from "@/lib/queries/trace";

type Defect = { id: string; qty: number; responsible: string | null; action: string | null; reason: { reason: string } };
type StockIn = { id: string; no: string; type: string; qty: number; warehouse: string | null; inBy: string; inAt: string };
type Batch = {
  id: string;
  batchNo: string;
  workOrderId: string;
  workOrderOperationId: string | null;
  shift: string;
  operator: string;
  startTime: string;
  endTime: string | null;
  goodQty: number;
  badQty: number;
  status: string;
  moldId: string;
  materialLotId: string;
  confirmedByLeader: boolean;
  leaderConfirmedBy: string | null;
  leaderConfirmedAt: string | null;
  workOrder: { no: string; planQty: number };
  bomVersion: { code: string; name: string; version: string } | null;
  materialRequirements: TraceMaterialRequirement[];
  sku: { name: string; code: string };
  equipment: { code: string; name: string } | null;
  mold: { code: string; name: string } | null;
  materialLot: { lotNo: string; material: { name: string } } | null;
  routeVersion: { id: string | null; label: string } | null;
  operation: TraceOperation | null;
  consumptions: TraceMaterialConsumption[];
  qualityResults: TraceQualityResult[];
  reworkOrders: TraceReworkOrder[];
  defects: Defect[];
  stockIns: StockIn[];
};
type MaterialLot = { id: string; lotNo: string; material: { name: string } };
type Maintenance = { id: string; maintType: string; startTime: string; person: string; canContinue: boolean };
type Mold = { id: string; code: string; name: string; currentCount: number; designLife: number; warnThreshold: number; maintenance: Maintenance[] };
type Capabilities = { routes: boolean; operations: boolean; genealogy: boolean; quality: boolean; rework: boolean };
type TraceRow = { key: string; batch: Batch; level: number; relationType: string; qty: number | null; parentBatchNo: string | null; operator: string; remark: string };
export type TraceSection = "forward" | "reverse" | "molds";

function quantity(value: number) {
  return new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 4 }).format(value);
}

function varianceRate(standardQty: number, consumedQty: number) {
  if (standardQty <= 0) return "-";
  const rate = ((consumedQty - standardQty) / standardQty) * 100;
  return `${rate > 0 ? "+" : ""}${rate.toFixed(2)}%`;
}

function relationColor(relationType: string): string {
  if (relationType.includes("返工")) return "orange";
  if (relationType.includes("合批")) return "purple";
  if (relationType.includes("拆批")) return "blue";
  return "default";
}

function buildHierarchy(
  seedIds: string[],
  batchesById: Map<string, Batch>,
  edges: TraceGenealogyEdge[],
  direction: "forward" | "reverse",
  seedRelation: string,
): TraceRow[] {
  const rows: TraceRow[] = [];
  const queue = seedIds.map((id, index) => ({ id, level: 0, relationType: seedRelation, qty: null as number | null, parentBatchNo: null as string | null, operator: "-", remark: "", path: [id], key: `seed:${index}:${id}` }));

  while (queue.length && rows.length < 200) {
    const current = queue.shift()!;
    const batch = batchesById.get(current.id);
    if (!batch) continue;
    rows.push({ key: current.key, batch, level: current.level, relationType: current.relationType, qty: current.qty, parentBatchNo: current.parentBatchNo, operator: current.operator, remark: current.remark });

    const adjacent = edges.filter((edge) => direction === "forward" ? edge.sourceBatchId === current.id : edge.targetBatchId === current.id);
    for (const edge of adjacent) {
      const nextId = direction === "forward" ? edge.targetBatchId : edge.sourceBatchId;
      if (current.path.includes(nextId) || current.level >= 20) continue;
      queue.push({
        id: nextId,
        level: current.level + 1,
        relationType: edge.relationType,
        qty: edge.qty,
        parentBatchNo: batch.batchNo,
        operator: edge.operator,
        remark: edge.remark,
        path: [...current.path, nextId],
        key: `${current.key}:${edge.id}:${nextId}`,
      });
    }
  }
  return rows;
}

function OperationTimeline({ operations }: { operations: TraceOperation[] }) {
  if (!operations.length) return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="该历史批次尚未绑定工艺路线快照" />;
  return (
    <Timeline
      items={operations.map((operation) => ({
        color: operation.status === "已完成" ? "green" : operation.status === "质量冻结" ? "red" : operation.status === "生产中" ? "blue" : "gray",
        children: (
          <div>
            <Space wrap size={6}>
              <Typography.Text strong>{operation.sequence}. {operation.name}</Typography.Text>
              <span className="mes-code">{operation.code}</span>
              <Tag>{operation.workCenter}</Tag>
              <StatusTag status={operation.status} />
            </Space>
            <div style={{ marginTop: 4, color: "#64748b", fontSize: 12 }}>
              投入/良品/不良：<span className="tabular-nums">{operation.inputQty || "-"} / {operation.goodQty} / {operation.badQty}</span>
              {operation.startTime ? ` · ${dayjs(operation.startTime).format("MM-DD HH:mm")}` : ""}
              {operation.endTime ? ` ~ ${dayjs(operation.endTime).format("MM-DD HH:mm")}` : ""}
            </div>
          </div>
        ),
      }))}
    />
  );
}

function GenealogyTable({ rows, onSelect }: { rows: TraceRow[]; onSelect?: (batch: Batch) => void }) {
  return (
    <Table
      size="small"
      rowKey="key"
      dataSource={rows}
      pagination={rows.length > 20 ? { pageSize: 20 } : false}
      locale={{ emptyText: "没有找到关联生产批次" }}
      columns={[
        {
          title: "批次层级",
          render: (_, row) => (
            <div style={{ paddingLeft: row.level * 24 }}>
              {row.level > 0 && <span style={{ color: "#94a3b8", marginRight: 6 }}>↳</span>}
              <Button type="link" size="small" className="mes-code" style={{ padding: 0 }} onClick={() => onSelect?.(row.batch)}>
                {row.batch.batchNo}
              </Button>
            </div>
          ),
        },
        { title: "关系", render: (_, row) => <Tag color={relationColor(row.relationType)}>{row.relationType}</Tag> },
        { title: "贡献/转移数量", render: (_, row) => row.qty === null ? "-" : <span className="tabular-nums">{row.qty}</span> },
        { title: "操作 / 备注", render: (_, row) => row.level === 0 ? "-" : `${row.operator}${row.remark ? ` · ${row.remark}` : ""}` },
        { title: "工单", render: (_, row) => <span className="mes-code">{row.batch.workOrder.no}</span> },
        { title: "工序 / 工作中心", render: (_, row) => row.batch.operation ? `${row.batch.operation.sequence}. ${row.batch.operation.name} / ${row.batch.operation.workCenter}` : "历史单工序" },
        { title: "产品", render: (_, row) => `${row.batch.sku.name}（${row.batch.sku.code}）` },
        { title: "良品 / 不良", render: (_, row) => <span className="tabular-nums">{row.batch.goodQty} / {row.batch.badQty}</span> },
        { title: "时间", render: (_, row) => dayjs(row.batch.startTime).format("MM-DD HH:mm") },
      ]}
    />
  );
}

function BatchDetail({ batch, operations }: { batch: Batch; operations: TraceOperation[] }) {
  const stockInQty = batch.stockIns.filter((record) => record.type !== "不良品隔离").reduce((sum, record) => sum + record.qty, 0);
  const routeOperations = operations.filter((operation) => operation.workOrderId === batch.workOrderId).sort((left, right) => left.sequence - right.sequence);
  return (
    <Space direction="vertical" size="middle" style={{ width: "100%" }}>
      <Descriptions bordered size="small" column={2} title="生产批次过程履历">
        <Descriptions.Item label="生产批次号" span={2}><span className="mes-code">{batch.batchNo}</span></Descriptions.Item>
        <Descriptions.Item label="工单"><span className="mes-code">{batch.workOrder.no}</span></Descriptions.Item>
        <Descriptions.Item label="产品">{batch.sku.name}（{batch.sku.code}）</Descriptions.Item>
        <Descriptions.Item label="工艺路线版本">{batch.routeVersion?.label ?? "历史单工序路线"}</Descriptions.Item>
        <Descriptions.Item label="BOM 版本">{batch.bomVersion ? `${batch.bomVersion.name}（${batch.bomVersion.code}）· ${batch.bomVersion.version}` : "未绑定"}</Descriptions.Item>
        <Descriptions.Item label="当前工序">{batch.operation ? `${batch.operation.sequence}. ${batch.operation.name}（${batch.operation.code}）` : "历史单工序"}</Descriptions.Item>
        <Descriptions.Item label="工作中心">{batch.operation?.workCenter ?? "-"}</Descriptions.Item>
        <Descriptions.Item label="设备 / 模具">{batch.equipment?.code ?? "-"} / {batch.mold?.code ?? "-"}</Descriptions.Item>
        <Descriptions.Item label="班次 / 操作员">{batch.shift} · {batch.operator}</Descriptions.Item>
        <Descriptions.Item label="生产时间">{dayjs(batch.startTime).format("YYYY-MM-DD HH:mm")} ~ {batch.endTime ? dayjs(batch.endTime).format("HH:mm") : "-"}</Descriptions.Item>
        <Descriptions.Item label="良品 / 不良 / 入库"><span className="tabular-nums">{batch.goodQty} / {batch.badQty} / {stockInQty}</span></Descriptions.Item>
        <Descriptions.Item label="状态"><StatusTag status={batch.status} /></Descriptions.Item>
        <Descriptions.Item label="超寿命主管确认" span={2}>
          {batch.confirmedByLeader ? `${batch.leaderConfirmedBy ?? "-"} · ${batch.leaderConfirmedAt ? dayjs(batch.leaderConfirmedAt).format("YYYY-MM-DD HH:mm") : "-"}` : "未触发"}
        </Descriptions.Item>
      </Descriptions>

      <Card size="small" title="工艺路线与工序时间轴"><OperationTimeline operations={routeOperations} /></Card>

      <Card size="small" title="BOM 标准用量与实际执行（工单累计）">
        <Table
          size="small"
          pagination={false}
          rowKey="id"
          scroll={{ x: 900 }}
          dataSource={batch.materialRequirements}
          locale={{ emptyText: "该工单暂无 BOM 用量快照" }}
          columns={[
            { title: "工序", width: 125, render: (_, row) => row.operationSequence ? `${row.operationSequence} ${row.operationName ?? row.operationCode ?? ""}` : "通用/首工序" },
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
      </Card>

      <Row gutter={16}>
        <Col span={12}>
          <Card size="small" title="物料 / 上游批次投入">
            <Table
              size="small"
              pagination={false}
              rowKey="id"
              dataSource={batch.consumptions}
              locale={{ emptyText: "暂无投入记录" }}
              columns={[
                { title: "类型", dataIndex: "consumptionType" },
                { title: "来源", render: (_, row) => row.lotNo ? `${row.lotNo} · ${row.materialName ?? ""}` : row.sourceBatchNo ?? "-" },
                { title: "数量", render: (_, row) => <span className="tabular-nums">{row.qty} {row.unit}</span> },
              ]}
            />
          </Card>
        </Col>
        <Col span={12}>
          <Card size="small" title="工序质量结果">
            <Table
              size="small"
              pagination={false}
              rowKey="id"
              dataSource={batch.qualityResults}
              locale={{ emptyText: "暂无独立工序检验结果" }}
              columns={[
                { title: "判定", dataIndex: "result", render: (status) => <StatusTag status={status} /> },
                { title: "抽检 / 合格 / 不合格", render: (_, row) => <span className="tabular-nums">{row.inspectedQty} / {row.passedQty} / {row.failedQty}</span> },
                { title: "检验员", dataIndex: "inspector" },
                { title: "时间", render: (_, row) => row.inspectedAt ? dayjs(row.inspectedAt).format("MM-DD HH:mm") : "-" },
              ]}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={16}>
        <Col span={12}>
          <Card size="small" title="不良记录">
            <Table
              size="small"
              pagination={false}
              rowKey="id"
              dataSource={batch.defects}
              locale={{ emptyText: "该批次无不良记录" }}
              columns={[
                { title: "不良原因", render: (_, row) => row.reason.reason },
                { title: "数量", dataIndex: "qty", className: "tabular-nums" },
                { title: "责任环节", dataIndex: "responsible" },
                { title: "处理方式", dataIndex: "action" },
              ]}
            />
          </Card>
        </Col>
        <Col span={12}>
          <Card size="small" title="返工任务">
            <Table
              size="small"
              pagination={false}
              rowKey="id"
              dataSource={batch.reworkOrders}
              locale={{ emptyText: "该批次无返工任务" }}
              columns={[
                { title: "返工单", dataIndex: "no", render: (no) => <span className="mes-code">{no}</span> },
                { title: "状态", dataIndex: "status", render: (status) => <StatusTag status={status} /> },
                { title: "投入 / 合格 / 报废", render: (_, row) => <span className="tabular-nums">{row.qty} / {row.qualifiedQty} / {row.scrapQty}</span> },
                { title: "原因", dataIndex: "reason" },
              ]}
            />
          </Card>
        </Col>
      </Row>

      <Card size="small" title="入库记录">
        <Table
          size="small"
          pagination={false}
          rowKey="id"
          dataSource={batch.stockIns}
          locale={{ emptyText: "尚未入库" }}
          columns={[
            { title: "入库单号", dataIndex: "no", render: (no) => <span className="mes-code">{no}</span> },
            { title: "类型", dataIndex: "type" },
            { title: "数量", dataIndex: "qty", className: "tabular-nums" },
            { title: "仓库", dataIndex: "warehouse" },
            { title: "入库人", dataIndex: "inBy" },
            { title: "入库时间", render: (_, row) => dayjs(row.inAt).format("MM-DD HH:mm") },
          ]}
        />
      </Card>
    </Space>
  );
}

export function TraceView({ batches, materialLots, molds, operations, genealogy, capabilities, section = "forward" }: {
  batches: Batch[];
  materialLots: MaterialLot[];
  molds: Mold[];
  operations: TraceOperation[];
  genealogy: TraceGenealogyEdge[];
  capabilities: Capabilities;
  section?: TraceSection;
}) {
  const [lotId, setLotId] = useState<string>();
  const [batchId, setBatchId] = useState<string>();
  const [forwardDetailId, setForwardDetailId] = useState<string>();
  const [moldId, setMoldId] = useState<string>();
  const batchesById = useMemo(() => new Map(batches.map((batch) => [batch.id, batch])), [batches]);

  const forwardSeedIds = useMemo(() => lotId ? batches.filter((batch) => batch.consumptions.some((item) => item.materialLotId === lotId)).map((batch) => batch.id) : [], [batches, lotId]);
  const forwardRows = useMemo(() => buildHierarchy(forwardSeedIds, batchesById, genealogy, "forward", "原料投入"), [batchesById, forwardSeedIds, genealogy]);
  const reverseRows = useMemo(() => batchId ? buildHierarchy([batchId], batchesById, genealogy, "reverse", "当前批次") : [], [batchId, batchesById, genealogy]);
  const reverseResult = batchId ? batchesById.get(batchId) : undefined;
  const forwardDetail = forwardDetailId ? batchesById.get(forwardDetailId) : undefined;
  const moldResult = molds.find((mold) => mold.id === moldId);
  const moldBatches = moldId ? batches.filter((batch) => batch.moldId === moldId) : [];

  const forwardTab = (
    <Space direction="vertical" size="middle" style={{ width: "100%" }}>
      <Select
        style={{ width: 460, maxWidth: "100%" }}
        placeholder="选择原材料批次，递归查看受影响的工序与下游批次"
        options={materialLots.map((lot) => ({ value: lot.id, label: `${lot.lotNo} · ${lot.material.name}` }))}
        showSearch optionFilterProp="label" value={lotId} onChange={(value) => { setLotId(value); setForwardDetailId(undefined); }} allowClear
      />
      {lotId ? <GenealogyTable rows={forwardRows} onSelect={(batch) => setForwardDetailId(batch.id)} /> : <Empty description="请选择一个原材料批次号" />}
      {forwardDetail && <BatchDetail batch={forwardDetail} operations={operations} />}
    </Space>
  );

  const reverseTab = (
    <Space direction="vertical" size="middle" style={{ width: "100%" }}>
      <Select
        style={{ width: 460, maxWidth: "100%" }}
        placeholder="选择生产批次，递归查看全部上游来源"
        options={batches.map((batch) => ({ value: batch.id, label: `${batch.batchNo} · ${batch.operation?.name ?? batch.sku.name}` }))}
        showSearch optionFilterProp="label" value={batchId} onChange={setBatchId} allowClear
      />
      {reverseResult ? (
        <>
          <Row gutter={16}>
            <Col span={8}><Card size="small"><Statistic title="追溯层级" value={Math.max(...reverseRows.map((row) => row.level), 0) + 1} suffix="层" /></Card></Col>
            <Col span={8}><Card size="small"><Statistic title="关联批次" value={new Set(reverseRows.map((row) => row.batch.id)).size} suffix="个" /></Card></Col>
            <Col span={8}><Card size="small"><Statistic title="路线工序" value={operations.filter((operation) => operation.workOrderId === reverseResult.workOrderId).length || 1} suffix="道" /></Card></Col>
          </Row>
          <Card size="small" title="批次来源谱系（由当前批次递归到原料端）"><GenealogyTable rows={reverseRows} /></Card>
          <BatchDetail batch={reverseResult} operations={operations} />
        </>
      ) : <Empty description="请选择一个生产批次号" />}
    </Space>
  );

  const moldTab = (
    <Space direction="vertical" size="middle" style={{ width: "100%" }}>
      <Select
        style={{ width: 420, maxWidth: "100%" }} placeholder="选择模具编号进行模具追溯"
        options={molds.map((mold) => ({ value: mold.id, label: `${mold.name}（${mold.code}）` }))}
        showSearch optionFilterProp="label" value={moldId} onChange={setMoldId} allowClear
      />
      {moldResult ? (
        <>
          <Card size="small" title="累计使用情况">
            <MoldLifeMeter rate={moldResult.currentCount / moldResult.designLife} warnThreshold={moldResult.warnThreshold} />
            <div style={{ marginTop: 8, fontSize: 12, color: "#8c98a4" }} className="tabular-nums">累计 {moldResult.currentCount.toLocaleString("zh-CN")} / 设计寿命 {moldResult.designLife.toLocaleString("zh-CN")}</div>
          </Card>
          <Card size="small" title="历史工序批次">
            <Table size="small" pagination={false} rowKey="id" dataSource={moldBatches} locale={{ emptyText: "暂无生产记录" }} columns={[
              { title: "批次号", dataIndex: "batchNo", render: (value) => <span className="mes-code">{value}</span> },
              { title: "工单", render: (_, row) => row.workOrder.no },
              { title: "工序", render: (_, row) => row.operation ? `${row.operation.sequence}. ${row.operation.name}` : "历史单工序" },
              { title: "产品", render: (_, row) => row.sku.name },
              { title: "良 / 不良", render: (_, row) => `${row.goodQty} / ${row.badQty}` },
              { title: "时间", render: (_, row) => dayjs(row.startTime).format("MM-DD HH:mm") },
            ]} />
          </Card>
          <Card size="small" title="保养 / 维修记录">
            <Table size="small" pagination={false} rowKey="id" dataSource={moldResult.maintenance} locale={{ emptyText: "暂无保养记录" }} columns={[
              { title: "类型", dataIndex: "maintType" }, { title: "人员", dataIndex: "person" },
              { title: "可继续生产", dataIndex: "canContinue", render: (allowed) => allowed ? <Tag color="green">是</Tag> : <Tag color="red">否</Tag> },
              { title: "时间", render: (_, row) => dayjs(row.startTime).format("MM-DD HH:mm") },
            ]} />
          </Card>
        </>
      ) : <Empty description="请选择一套模具" />}
    </Space>
  );

  return (
    <div>
      <Alert
        type={capabilities.operations ? "info" : "warning"}
        showIcon
        style={{ marginBottom: 16 }}
        message={capabilities.operations
          ? "过程追溯粒度：工艺路线版本 + 工序执行批次 + 原料/上游批次投入；支持转序、拆批、合批和返工关系递归。"
          : "当前历史数据尚未绑定工序任务，系统按原有单工序批次兼容展示；新工单下达后将按路线版本生成完整过程履历。"}
      />
      <Tabs activeKey={section === "molds" ? "mold" : section} tabBarStyle={{ display: "none" }} items={[
        { key: "forward", label: "正向追溯", children: forwardTab },
        { key: "reverse", label: "反向追溯", children: reverseTab },
        { key: "mold", label: "模具追溯", children: moldTab },
      ]} />
    </div>
  );
}
