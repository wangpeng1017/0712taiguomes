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
  Tag,
  message,
} from "antd";
import { PlusOutlined, SearchOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import { StatusTag } from "@/components/StatusTag";
import { createWorkOrder, deleteWorkOrder, setWorkOrderStatus, updateWorkOrder } from "@/lib/actions/work-orders";

type Sku = { id: string; code: string; name: string; type: string };
type Equipment = { id: string; code: string; name: string; type: string; status: string };
type Mold = { id: string; code: string; name: string; type: string; applicableSkuId: string | null; status: string };
type RouteVersion = {
  id: string;
  version: string;
  route: { code: string; name: string; skuId: string };
  operations: { sequence: number; operationCode: string; operationName: string; isFinal: boolean }[];
};
type WorkOrderOperation = {
  id: string; sequence: number; operationCode: string; operationName: string; operationType: string; workCenter: string | null;
  status: string; plannedQty: number; inputQty: number; goodQty: number; badQty: number; scrapQty: number;
  transferredQty: number; qualityStatus: string; isFinal: boolean;
};

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
  routeVersion: { id: string; version: string; status: string; route: { code: string; name: string } } | null;
  operations: WorkOrderOperation[];
  note: string | null;
};

const EQUIP_TYPE_FOR: Record<string, string> = { 注塑: "注塑机", 冲压: "冲床" };
const MOLD_TYPE_FOR: Record<string, string> = { 注塑: "注塑模", 冲压: "冲压模" };

export function WorkOrderTable({
  rows,
  skus,
  equipments,
  molds,
  routeVersions,
}: {
  rows: WorkOrderRow[];
  skus: Sku[];
  equipments: Equipment[];
  molds: Mold[];
  routeVersions: RouteVersion[];
}) {
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<WorkOrderRow | null>(null);
  const [detail, setDetail] = useState<WorkOrderRow | null>(null);
  const [keyword, setKeyword] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>();
  const [statusFilter, setStatusFilter] = useState<string>();
  const [planRange, setPlanRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null);
  const [form] = Form.useForm();
  const [pending, startTransition] = useTransition();
  const selectedSkuId = Form.useWatch("skuId", form);
  const selectedRouteVersionId = Form.useWatch("routeVersionId", form);

  const selectedSkuType = useMemo(
    () => skus.find((s) => s.id === selectedSkuId)?.type,
    [selectedSkuId, skus]
  );
  const equipmentOptions = equipments.filter((e) => e.type === EQUIP_TYPE_FOR[selectedSkuType ?? ""]);
  const moldOptions = molds.filter(
    (m) => m.type === MOLD_TYPE_FOR[selectedSkuType ?? ""] && (!m.applicableSkuId || m.applicableSkuId === selectedSkuId)
  );
  const routeVersionOptions = routeVersions.filter((version) => version.route.skuId === selectedSkuId);
  const selectedRouteVersion = routeVersions.find((version) => version.id === selectedRouteVersionId);
  const filteredRows = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase();
    return rows.filter((row) => {
      const searchableText = [
        row.no,
        row.sku.name,
        row.sku.code,
        row.planEquipment?.name,
        row.planEquipment?.code,
        row.planMold?.name,
        row.planMold?.code,
      ].filter(Boolean).join(" ").toLowerCase();
      const matchesRange = !planRange
        || (dayjs(row.planEnd).endOf("day").valueOf() >= planRange[0].startOf("day").valueOf()
          && dayjs(row.planStart).startOf("day").valueOf() <= planRange[1].endOf("day").valueOf());
      return (!normalizedKeyword || searchableText.includes(normalizedKeyword))
        && (!typeFilter || row.type === typeFilter)
        && (!statusFilter || row.status === statusFilter)
        && matchesRange;
    });
  }, [keyword, planRange, rows, statusFilter, typeFilter]);

  const typeOptions = useMemo(
    () => Array.from(new Set(rows.map((row) => row.type))).map((value) => ({ value, label: value })),
    [rows]
  );
  const statusOptions = useMemo(
    () => Array.from(new Set(rows.map((row) => row.status))).map((value) => ({ value, label: value })),
    [rows]
  );

  function submitCreate(values: {
    skuId: string;
    planQty: number;
    planRange: [dayjs.Dayjs, dayjs.Dayjs];
    planEquipmentId?: string;
    planMoldId?: string;
    bomVersion?: string;
    routeVersionId: string;
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
          routeVersionId: values.routeVersionId,
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
      bomVersion: row.bomVersion, routeVersionId: row.routeVersion?.id, note: row.note,
    }));
  }

  function removeWorkOrder(row: WorkOrderRow) {
    Modal.confirm({
      title: `删除工单 ${row.no}`,
      content: "只有未下达且没有任何业务记录的工单可以删除。",
      okText: "确认删除", okButtonProps: { className: "mes-destructive-confirm" }, cancelText: "取消",
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
      <div className="table-toolbar" style={{ flexWrap: "wrap" }}>
        <Input
          prefix={<SearchOutlined />}
          allowClear
          placeholder="搜索工单、产品、设备或模具"
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
          style={{ width: 300 }}
        />
        <Select allowClear placeholder="全部类型" value={typeFilter} onChange={setTypeFilter} options={typeOptions} style={{ width: 130 }} />
        <Select allowClear placeholder="全部状态" value={statusFilter} onChange={setStatusFilter} options={statusOptions} style={{ width: 140 }} />
        <DatePicker.RangePicker
          value={planRange}
          onChange={(value) => setPlanRange(value?.[0] && value[1] ? [value[0], value[1]] : null)}
          placeholder={["计划开始", "计划结束"]}
        />
        <Button onClick={() => { setKeyword(""); setTypeFilter(undefined); setStatusFilter(undefined); setPlanRange(null); }}>重置</Button>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditing(null); form.resetFields(); setCreateOpen(true); }}>
          新建工单
        </Button>
      </div>

      <Table
        rowKey="id"
        dataSource={filteredRows}
        pagination={{ pageSize: 10, showSizeChanger: true }}
        columns={[
          { title: "工单号", dataIndex: "no", render: (v, r) => (
              <a className="mes-code" onClick={() => setDetail(r)}>{v}</a>
            ) },
          { title: "产品", render: (_, r) => (
              <div>
                <div>{r.sku.name}</div>
                <div className="mes-code" style={{ fontSize: 12, color: "#8c98a4" }}>{r.sku.code}</div>
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
          { title: "工艺版本", width: 170, render: (_, r) => r.routeVersion
              ? <div><div>{r.routeVersion.route.name}</div><div className="mes-code mes-meta">{r.routeVersion.route.code} · {r.routeVersion.version}</div></div>
              : <span className="mes-meta">历史单工序</span> },
          { title: "进度", width: 160, render: (_, r) => (
              <div>
                <Progress percent={Math.round(r.completionRate * 100)} size="small" status={r.completionRate >= 1 ? "success" : "active"} />
                <div style={{ fontSize: 12, color: "#8c98a4" }} className="tabular-nums">
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
                  <Button className="mes-destructive-action" size="small" type="link" onClick={() => changeStatus(r.id, "已关闭", "关闭")}>关闭</Button>
                )}
                {r.status === "未下达" && r.batchCount === 0 && <Button className="mes-destructive-action" size="small" type="link" onClick={() => removeWorkOrder(r)}>删除</Button>}
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
        <Form form={form} layout="vertical" onFinish={submitCreate} initialValues={{ bomVersion: "V1.0" }}>
          <Form.Item name="skuId" label="产品 SKU" rules={[{ required: true, message: "请选择产品 SKU" }]}>
            <Select
              placeholder="选择产品 SKU"
              options={skus.map((s) => ({ value: s.id, label: `${s.name}（${s.code}） · ${s.type}` }))}
              showSearch
              optionFilterProp="label"
              onChange={() => form.setFieldsValue({ routeVersionId: undefined, planEquipmentId: undefined, planMoldId: undefined })}
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
          <Form.Item name="routeVersionId" label="工艺路线版本" rules={[{ required: true, message: "请选择已发布的工艺路线版本" }]}>
            <Select
              placeholder={selectedSkuId ? "选择已发布的工艺路线版本" : "请先选择产品 SKU"}
              disabled={!selectedSkuId || (!!editing && editing.status !== "未下达")}
              showSearch
              optionFilterProp="label"
              options={routeVersionOptions.map((version) => ({
                value: version.id,
                label: `${version.route.name}（${version.route.code}）· ${version.version} · ${version.operations.length}道工序`,
              }))}
            />
          </Form.Item>
          {selectedSkuId && routeVersionOptions.length === 0 && <div className="mes-inline-note">该产品暂无已发布工艺路线，请先到“工艺管理”完成路线配置与发布。</div>}
          {selectedRouteVersion && <div className="mes-route-preview">
            {selectedRouteVersion.operations.map((operation, index) => (
              <span key={`${operation.sequence}-${operation.operationCode}`}>
                <Tag>{operation.sequence} {operation.operationName}{operation.isFinal ? " · 末道" : ""}</Tag>
                {index < selectedRouteVersion.operations.length - 1 && <span className="mes-route-arrow">→</span>}
              </span>
            ))}
          </div>}
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
              <div className="mes-meta">冻结工艺版本</div>
              <div>{detail.routeVersion ? `${detail.routeVersion.route.name}（${detail.routeVersion.route.code}）· ${detail.routeVersion.version}` : detail.route ?? "历史单工序"}</div>
            </div>
            <div>
              <div className="mes-meta" style={{ marginBottom: 8 }}>工序执行进度</div>
              <Table<WorkOrderOperation>
                size="small"
                rowKey="id"
                pagination={false}
                dataSource={detail.operations}
                locale={{ emptyText: "工单尚未下达，暂未生成工序任务" }}
                columns={[
                  { title: "工序", render: (_, operation) => `${operation.sequence} ${operation.operationName}` },
                  { title: "良/不良", render: (_, operation) => `${operation.goodQty}/${operation.badQty}` },
                  { title: "状态", render: (_, operation) => <StatusTag status={operation.status} /> },
                ]}
              />
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
