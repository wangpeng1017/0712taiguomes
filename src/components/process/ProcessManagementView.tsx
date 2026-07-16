"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import {
  Button,
  Checkbox,
  DatePicker,
  Descriptions,
  Drawer,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
  Tooltip,
  type FormInstance,
  message,
} from "antd";
import {
  CopyOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
  SendOutlined,
  SettingOutlined,
  StopOutlined,
} from "@ant-design/icons";
import dayjs, { type Dayjs } from "dayjs";
import { useRouter } from "next/navigation";
import type { ProcessManagementData } from "@/lib/queries/process";
import {
  copyProcessRouteVersion,
  deleteOperationMaster,
  deleteProcessRoute,
  deleteProcessRouteVersion,
  deleteRouteOperation,
  disableProcessRouteVersion,
  publishProcessRouteVersion,
  saveOperationMaster,
  saveProcessRoute,
  saveProcessRouteVersion,
  saveRouteOperation,
} from "@/lib/actions/process";

export type ProcessSection = "operations" | "routes" | "versions";

type Operation = ProcessManagementData["operations"][number];
type Route = ProcessManagementData["routes"][number];
type Version = Route["versions"][number];
type RouteOperation = Version["operations"][number];
type Sku = ProcessManagementData["skus"][number];

type OperationFormValues = {
  code: string;
  name: string;
  type: string;
  appliesTo: string;
  workCenter?: string;
  description?: string;
  status: string;
};

type RouteFormValues = {
  code: string;
  name: string;
  skuId: string;
  status: string;
  note?: string;
};

type VersionFormValues = {
  routeId: string;
  version: string;
  effectiveFrom?: Dayjs | null;
  effectiveTo?: Dayjs | null;
  changeReason?: string;
};

type RouteOperationFormValues = {
  routeVersionId: string;
  operationId: string;
  sequence: number;
  workCenter?: string;
  standardCycleSeconds?: number | null;
  setupMinutes?: number | null;
  reportMode: string;
  requiresEquipment: boolean;
  requiresMold: boolean;
  qualityRequired: boolean;
  isFinal: boolean;
  status: string;
  note?: string;
};

const OPERATION_TYPES = ["生产", "检验", "包装", "通用"];
const APPLIES_TO = ["注塑", "冲压", "通用"];
const REPORT_MODES = ["按批次", "按班次", "按件"];

function matchesKeyword(keyword: string, values: Array<string | null | undefined>) {
  const normalized = keyword.trim().toLowerCase();
  return !normalized || values.some((value) => String(value ?? "").toLowerCase().includes(normalized));
}

function uniqueOptions(values: string[]) {
  return [...new Set(values)].map((value) => ({ value, label: value }));
}

function ProcessStatusTag({ status }: { status: string }) {
  const tone = status === "启用" || status === "已发布"
    ? { color: "#1f9d55", background: "#1f9d5518", borderColor: "#1f9d5540" }
    : status === "草稿"
      ? { color: "#52606d", background: "#f1f5f9", borderColor: "#cbd5e1" }
      : status === "审核中"
        ? { color: "#c9860a", background: "#c9860a18", borderColor: "#c9860a40" }
        : { color: "#64748b", background: "#f1f5f9", borderColor: "#cbd5e1" };
  return <Tag style={{ ...tone, fontWeight: 500 }}>{status}</Tag>;
}

function operationRequirements(item: RouteOperation) {
  const values = [
    item.requiresEquipment ? "设备" : null,
    item.requiresMold ? "模具" : null,
    item.qualityRequired ? "质量检验" : null,
    item.isFinal ? "末工序" : null,
  ].filter((value): value is string => Boolean(value));
  return values.length ? values : ["无特殊要求"];
}

export function ProcessManagementView({
  section,
  initialRouteId,
  operations,
  routes,
  skus,
}: ProcessManagementData & { section: ProcessSection; initialRouteId?: string }) {
  const router = useRouter();
  const [operationForm] = Form.useForm<OperationFormValues>();
  const [routeForm] = Form.useForm<RouteFormValues>();
  const [versionForm] = Form.useForm<VersionFormValues>();
  const [routeOperationForm] = Form.useForm<RouteOperationFormValues>();
  const [keyword, setKeyword] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>();
  const [statusFilter, setStatusFilter] = useState<string>();
  const [extraFilter, setExtraFilter] = useState<string>();
  const [selectedRouteId, setSelectedRouteId] = useState<string>();
  const [operationEditor, setOperationEditor] = useState<Operation | "new" | null>(null);
  const [routeEditor, setRouteEditor] = useState<Route | "new" | null>(null);
  const [versionEditor, setVersionEditor] = useState<Version | "new" | null>(null);
  const [configVersionId, setConfigVersionId] = useState<string>();
  const [routeOperationEditor, setRouteOperationEditor] = useState<RouteOperation | "new" | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    setKeyword("");
    setTypeFilter(undefined);
    setStatusFilter(undefined);
    setExtraFilter(undefined);
  }, [section]);

  useEffect(() => {
    const preferred = routes.some((route) => route.id === initialRouteId) ? initialRouteId : routes[0]?.id;
    setSelectedRouteId((current) => current && routes.some((route) => route.id === current) ? current : preferred);
  }, [initialRouteId, routes]);

  const selectedRoute = routes.find((route) => route.id === selectedRouteId);
  const configVersion = selectedRoute?.versions.find((version) => version.id === configVersionId)
    ?? routes.flatMap((route) => route.versions).find((version) => version.id === configVersionId);

  const filteredOperations = useMemo(() => operations.filter((row) =>
    matchesKeyword(keyword, [row.code, row.name, row.workCenter, row.description])
    && (!typeFilter || row.type === typeFilter)
    && (!statusFilter || row.status === statusFilter)
    && (!extraFilter || row.appliesTo === extraFilter)
  ), [operations, keyword, typeFilter, statusFilter, extraFilter]);

  const filteredRoutes = useMemo(() => routes.filter((row) =>
    matchesKeyword(keyword, [row.code, row.name, row.sku.code, row.sku.name, row.note])
    && (!typeFilter || row.sku.type === typeFilter)
    && (!statusFilter || row.status === statusFilter)
    && (!extraFilter || row.skuId === extraFilter)
  ), [routes, keyword, typeFilter, statusFilter, extraFilter]);

  const filteredVersions = useMemo(() => (selectedRoute?.versions ?? []).filter((row) =>
    matchesKeyword(keyword, [row.version, row.changeReason, row.releasedBy])
    && (!statusFilter || row.status === statusFilter)
  ), [selectedRoute, keyword, statusFilter]);

  function resetFilters() {
    setKeyword("");
    setTypeFilter(undefined);
    setStatusFilter(undefined);
    setExtraFilter(undefined);
  }

  function runAction(task: () => Promise<void>, success: string, onSuccess?: () => void) {
    startTransition(async () => {
      try {
        await task();
        message.success(success);
        onSuccess?.();
        router.refresh();
      } catch (error) {
        message.error(error instanceof Error ? error.message : "操作失败");
      }
    });
  }

  function openOperationEditor(row?: Operation) {
    const target = row ?? "new";
    setOperationEditor(target);
    operationForm.resetFields();
    queueMicrotask(() => operationForm.setFieldsValue(row ? {
      code: row.code,
      name: row.name,
      type: row.type,
      appliesTo: row.appliesTo,
      workCenter: row.workCenter ?? undefined,
      description: row.description ?? undefined,
      status: row.status,
    } : { type: "生产", appliesTo: "通用", status: "启用" }));
  }

  function openRouteEditor(row?: Route) {
    const target = row ?? "new";
    setRouteEditor(target);
    routeForm.resetFields();
    queueMicrotask(() => routeForm.setFieldsValue(row ? {
      code: row.code,
      name: row.name,
      skuId: row.skuId,
      status: row.status,
      note: row.note ?? undefined,
    } : { status: "启用" }));
  }

  function openVersionEditor(row?: Version) {
    const target = row ?? "new";
    setVersionEditor(target);
    versionForm.resetFields();
    queueMicrotask(() => versionForm.setFieldsValue(row ? {
      routeId: row.routeId,
      version: row.version,
      effectiveFrom: row.effectiveFrom ? dayjs(row.effectiveFrom) : null,
      effectiveTo: row.effectiveTo ? dayjs(row.effectiveTo) : null,
      changeReason: row.changeReason ?? undefined,
    } : {
      routeId: selectedRouteId,
      version: `V${((selectedRoute?.versions.length ?? 0) + 1).toFixed(1)}`,
    }));
  }

  function openRouteOperationEditor(row?: RouteOperation) {
    if (!configVersion) return;
    const target = row ?? "new";
    setRouteOperationEditor(target);
    routeOperationForm.resetFields();
    queueMicrotask(() => routeOperationForm.setFieldsValue(row ? {
      routeVersionId: row.routeVersionId,
      operationId: row.operationId,
      sequence: row.sequence,
      workCenter: row.workCenter ?? undefined,
      standardCycleSeconds: row.standardCycleSeconds,
      setupMinutes: row.setupMinutes,
      reportMode: row.reportMode,
      requiresEquipment: row.requiresEquipment,
      requiresMold: row.requiresMold,
      qualityRequired: row.qualityRequired,
      isFinal: row.isFinal,
      status: row.status,
      note: row.note ?? undefined,
    } : {
      routeVersionId: configVersion.id,
      sequence: ((configVersion.operations.at(-1)?.sequence ?? 0) + 10),
      reportMode: "按批次",
      requiresEquipment: false,
      requiresMold: false,
      qualityRequired: false,
      isFinal: false,
      status: "启用",
    }));
  }

  function goToVersionConfig(routeId: string) {
    setSelectedRouteId(routeId);
    router.push(`/process/versions?routeId=${routeId}`);
  }

  if (section === "operations") {
    return (
      <>
        <div className="table-toolbar" style={{ flexWrap: "wrap" }}>
          <Input prefix={<SearchOutlined />} value={keyword} allowClear placeholder="搜索工序编码、名称或工作中心" onChange={(event) => setKeyword(event.target.value)} style={{ width: 300 }} />
          <Select value={typeFilter} allowClear placeholder="工序类型" options={OPERATION_TYPES.map((value) => ({ value, label: value }))} onChange={setTypeFilter} style={{ width: 130 }} />
          <Select value={extraFilter} allowClear placeholder="适用工艺" options={APPLIES_TO.map((value) => ({ value, label: value }))} onChange={setExtraFilter} style={{ width: 130 }} />
          <Select value={statusFilter} allowClear placeholder="状态" options={["启用", "停用"].map((value) => ({ value, label: value }))} onChange={setStatusFilter} style={{ width: 110 }} />
          <Button icon={<ReloadOutlined />} onClick={resetFilters}>重置</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => openOperationEditor()}>新增工序</Button>
        </div>
        <Table
          size="middle"
          rowKey="id"
          dataSource={filteredOperations}
          pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (total) => `共 ${total} 条` }}
          columns={[
            { title: "工序编码", dataIndex: "code", width: 150, render: (value) => <span className="mes-code">{value}</span> },
            { title: "工序名称", dataIndex: "name", width: 180 },
            { title: "类型", dataIndex: "type", width: 90 },
            { title: "适用工艺", dataIndex: "appliesTo", width: 100 },
            { title: "工作中心", dataIndex: "workCenter", width: 150, render: (value) => value ?? "-" },
            { title: "说明", dataIndex: "description", ellipsis: true, render: (value) => value ?? "-" },
            { title: "状态", dataIndex: "status", width: 90, render: (value) => <ProcessStatusTag status={value} /> },
            {
              title: "操作",
              width: 130,
              render: (_, row) => <Space size="small">
                <Button type="link" size="small" onClick={() => openOperationEditor(row)}>编辑</Button>
                <Popconfirm title="确认删除该工序？" description="已被路线或工单引用时将拒绝删除。" onConfirm={() => runAction(() => deleteOperationMaster(row.id), "工序已删除") }>
                  <Button type="link" size="small" className="mes-destructive-action" disabled={pending}>删除</Button>
                </Popconfirm>
              </Space>,
            },
          ]}
        />
        <OperationEditor open={!!operationEditor} row={operationEditor === "new" ? undefined : operationEditor ?? undefined} form={operationForm} pending={pending} onClose={() => setOperationEditor(null)} onSave={(values) => runAction(
          () => saveOperationMaster({ ...(operationEditor && operationEditor !== "new" ? { id: operationEditor.id } : {}), ...values }),
          "工序已保存",
          () => setOperationEditor(null)
        )} />
      </>
    );
  }

  if (section === "routes") {
    return (
      <>
        <div className="table-toolbar" style={{ flexWrap: "wrap" }}>
          <Input prefix={<SearchOutlined />} value={keyword} allowClear placeholder="搜索路线、产品或备注" onChange={(event) => setKeyword(event.target.value)} style={{ width: 300 }} />
          <Select value={typeFilter} allowClear placeholder="产品类型" options={uniqueOptions(skus.map((sku) => sku.type))} onChange={setTypeFilter} style={{ width: 130 }} />
          <Select value={extraFilter} allowClear showSearch optionFilterProp="label" placeholder="适用产品" options={skus.map((sku) => ({ value: sku.id, label: `${sku.name}（${sku.code}）` }))} onChange={setExtraFilter} style={{ width: 220 }} />
          <Select value={statusFilter} allowClear placeholder="状态" options={["启用", "停用"].map((value) => ({ value, label: value }))} onChange={setStatusFilter} style={{ width: 110 }} />
          <Button icon={<ReloadOutlined />} onClick={resetFilters}>重置</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => openRouteEditor()}>新增路线</Button>
        </div>
        <Table
          size="middle"
          rowKey="id"
          dataSource={filteredRoutes}
          pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (total) => `共 ${total} 条` }}
          columns={[
            { title: "路线编码", dataIndex: "code", width: 150, render: (value) => <span className="mes-code">{value}</span> },
            { title: "路线名称", dataIndex: "name", width: 190 },
            { title: "适用产品", render: (_, row) => <div><div>{row.sku.name}</div><div className="mes-meta mes-code">{row.sku.code}</div></div> },
            { title: "产品类型", render: (_, row) => row.sku.type, width: 100 },
            { title: "版本数", render: (_, row) => row.versions.length, width: 90, className: "tabular-nums" },
            { title: "当前发布版本", render: (_, row) => <span className="mes-code">{row.versions.find((version) => version.status === "已发布")?.version ?? "-"}</span>, width: 130 },
            { title: "状态", dataIndex: "status", width: 90, render: (value) => <ProcessStatusTag status={value} /> },
            {
              title: "操作",
              width: 210,
              render: (_, row) => <Space size="small">
                <Button type="link" size="small" onClick={() => goToVersionConfig(row.id)}>版本配置</Button>
                <Button type="link" size="small" onClick={() => openRouteEditor(row)}>编辑</Button>
                <Popconfirm title="确认删除该路线？" description="已有版本时将拒绝删除。" onConfirm={() => runAction(() => deleteProcessRoute(row.id), "路线已删除") }>
                  <Button type="link" size="small" className="mes-destructive-action" disabled={pending}>删除</Button>
                </Popconfirm>
              </Space>,
            },
          ]}
        />
        <RouteEditor open={!!routeEditor} row={routeEditor === "new" ? undefined : routeEditor ?? undefined} form={routeForm} skus={skus} pending={pending} onClose={() => setRouteEditor(null)} onSave={(values) => runAction(
          () => saveProcessRoute({ ...(routeEditor && routeEditor !== "new" ? { id: routeEditor.id } : {}), ...values }),
          "工艺路线已保存",
          () => setRouteEditor(null)
        )} />
      </>
    );
  }

  return (
    <>
      <div className="process-route-context">
        <div>
          <div className="process-context-label">当前工艺路线</div>
          <Select
            value={selectedRouteId}
            showSearch
            optionFilterProp="label"
            placeholder="选择工艺路线"
            options={routes.map((route) => ({ value: route.id, label: `${route.code} · ${route.name} · ${route.sku.name}` }))}
            onChange={(value) => { setSelectedRouteId(value); setConfigVersionId(undefined); router.replace(`/process/versions?routeId=${value}`); }}
            style={{ width: 420, maxWidth: "100%" }}
          />
        </div>
        {selectedRoute && <div className="process-context-summary">
          <span>{selectedRoute.sku.name}</span>
          <span className="mes-code">{selectedRoute.sku.code}</span>
          <ProcessStatusTag status={selectedRoute.status} />
        </div>}
      </div>
      <div className="table-toolbar" style={{ flexWrap: "wrap" }}>
        <Input prefix={<SearchOutlined />} value={keyword} allowClear placeholder="搜索版本号、变更原因或发布人" onChange={(event) => setKeyword(event.target.value)} style={{ width: 300 }} />
        <Select value={statusFilter} allowClear placeholder="版本状态" options={["草稿", "审核中", "已发布", "已停用"].map((value) => ({ value, label: value }))} onChange={setStatusFilter} style={{ width: 130 }} />
        <Button icon={<ReloadOutlined />} onClick={resetFilters}>重置</Button>
        <Button type="primary" icon={<PlusOutlined />} disabled={!selectedRoute} onClick={() => openVersionEditor()}>新建版本</Button>
      </div>
      <Table
        size="middle"
        rowKey="id"
        dataSource={filteredVersions}
        locale={{ emptyText: selectedRoute ? "该路线暂无版本" : "请先选择工艺路线" }}
        pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (total) => `共 ${total} 条` }}
        columns={[
          { title: "版本号", dataIndex: "version", width: 110, render: (value) => <span className="mes-code">{value}</span> },
          { title: "工序数", render: (_, row) => row.operations.length, width: 90, className: "tabular-nums" },
          { title: "生效日期", dataIndex: "effectiveFrom", width: 120, render: (value) => value ? dayjs(value).format("YYYY-MM-DD") : "-" },
          { title: "失效日期", dataIndex: "effectiveTo", width: 120, render: (value) => value ? dayjs(value).format("YYYY-MM-DD") : "-" },
          { title: "变更原因", dataIndex: "changeReason", ellipsis: true, render: (value) => value ?? "-" },
          { title: "发布人", dataIndex: "releasedBy", width: 110, render: (value) => value ?? "-" },
          { title: "状态", dataIndex: "status", width: 100, render: (value) => <ProcessStatusTag status={value} /> },
          {
            title: "操作",
            width: 320,
            render: (_, row) => <Space size="small" wrap>
              <Button type="link" size="small" icon={<SettingOutlined />} onClick={() => setConfigVersionId(row.id)}>配置工序</Button>
              {row.status === "草稿" && <Button type="link" size="small" onClick={() => openVersionEditor(row)}>编辑</Button>}
              <Button type="link" size="small" icon={<CopyOutlined />} disabled={pending} onClick={() => runAction(() => copyProcessRouteVersion(row.id), `已复制 ${row.version}`)}>复制版本</Button>
              {(row.status === "草稿" || row.status === "审核中") && <Popconfirm title={`发布版本 ${row.version}？`} description="发布后会停用同路线的上一发布版本。" onConfirm={() => runAction(() => publishProcessRouteVersion(row.id, "Somchai"), `${row.version} 已发布`)}>
                <Button type="link" size="small" icon={<SendOutlined />} disabled={pending}>发布</Button>
              </Popconfirm>}
              {row.status === "已发布" && <Popconfirm title={`停用版本 ${row.version}？`} onConfirm={() => runAction(() => disableProcessRouteVersion(row.id), `${row.version} 已停用`)}>
                <Button type="link" size="small" icon={<StopOutlined />} className="mes-destructive-action" disabled={pending}>停用</Button>
              </Popconfirm>}
              {row.status === "草稿" && <Popconfirm title={`删除草稿版本 ${row.version}？`} onConfirm={() => runAction(() => deleteProcessRouteVersion(row.id), `${row.version} 已删除`)}>
                <Button type="link" size="small" className="mes-destructive-action" disabled={pending}>删除</Button>
              </Popconfirm>}
            </Space>,
          },
        ]}
      />
      <VersionEditor open={!!versionEditor} row={versionEditor === "new" ? undefined : versionEditor ?? undefined} form={versionForm} routes={routes} pending={pending} onClose={() => setVersionEditor(null)} onSave={(values) => runAction(
        () => saveProcessRouteVersion({
          ...(versionEditor && versionEditor !== "new" ? { id: versionEditor.id } : {}),
          ...values,
          effectiveFrom: values.effectiveFrom?.toISOString() ?? null,
          effectiveTo: values.effectiveTo?.toISOString() ?? null,
        }),
        "路线版本已保存",
        () => setVersionEditor(null)
      )} />
      <VersionConfigurationDrawer
        version={configVersion}
        operations={operations}
        pending={pending}
        onClose={() => setConfigVersionId(undefined)}
        onEdit={openRouteOperationEditor}
        onDelete={(row) => runAction(() => deleteRouteOperation(row.id), "工序配置已删除")}
      />
      <RouteOperationEditor
        open={!!routeOperationEditor}
        row={routeOperationEditor === "new" ? undefined : routeOperationEditor ?? undefined}
        form={routeOperationForm}
        operations={operations}
        pending={pending}
        onClose={() => setRouteOperationEditor(null)}
        onSave={(values) => runAction(
          () => saveRouteOperation({ ...(routeOperationEditor && routeOperationEditor !== "new" ? { id: routeOperationEditor.id } : {}), ...values }),
          "工序配置已保存",
          () => setRouteOperationEditor(null)
        )}
      />
    </>
  );
}

function OperationEditor({ open, row, form, pending, onClose, onSave }: {
  open: boolean;
  row?: Operation;
  form: FormInstance<OperationFormValues>;
  pending: boolean;
  onClose: () => void;
  onSave: (values: OperationFormValues) => void;
}) {
  return <Modal title={row ? "编辑工序" : "新增工序"} open={open} onCancel={onClose} onOk={() => form.submit()} confirmLoading={pending} width={620} destroyOnHidden>
    <Form form={form} layout="vertical" onFinish={onSave} preserve={false}>
      <Space align="start" style={{ width: "100%" }}><Form.Item name="code" label="工序编码" rules={[{ required: true }]}><Input style={{ width: 220 }} /></Form.Item><Form.Item name="name" label="工序名称" rules={[{ required: true }]}><Input style={{ width: 300 }} /></Form.Item></Space>
      <Space align="start" style={{ width: "100%" }}><Form.Item name="type" label="工序类型" rules={[{ required: true }]}><Select style={{ width: 160 }} options={OPERATION_TYPES.map((value) => ({ value, label: value }))} /></Form.Item><Form.Item name="appliesTo" label="适用工艺" rules={[{ required: true }]}><Select style={{ width: 160 }} options={APPLIES_TO.map((value) => ({ value, label: value }))} /></Form.Item><Form.Item name="status" label="状态"><Select style={{ width: 140 }} options={["启用", "停用"].map((value) => ({ value, label: value }))} /></Form.Item></Space>
      <Form.Item name="workCenter" label="默认工作中心"><Input placeholder="例如：注塑一线 / 冲压二线 / 终检区" /></Form.Item>
      <Form.Item name="description" label="工序说明"><Input.TextArea rows={3} /></Form.Item>
    </Form>
  </Modal>;
}

function RouteEditor({ open, row, form, skus, pending, onClose, onSave }: {
  open: boolean;
  row?: Route;
  form: FormInstance<RouteFormValues>;
  skus: Sku[];
  pending: boolean;
  onClose: () => void;
  onSave: (values: RouteFormValues) => void;
}) {
  return <Modal title={row ? "编辑工艺路线" : "新增工艺路线"} open={open} onCancel={onClose} onOk={() => form.submit()} confirmLoading={pending} width={620} destroyOnHidden>
    <Form form={form} layout="vertical" onFinish={onSave} preserve={false}>
      <Space align="start" style={{ width: "100%" }}><Form.Item name="code" label="路线编码" rules={[{ required: true }]}><Input style={{ width: 220 }} /></Form.Item><Form.Item name="name" label="路线名称" rules={[{ required: true }]}><Input style={{ width: 300 }} /></Form.Item></Space>
      <Form.Item name="skuId" label="适用产品" rules={[{ required: true }]}><Select showSearch optionFilterProp="label" options={skus.map((sku) => ({ value: sku.id, label: `${sku.name}（${sku.code}）· ${sku.type}` }))} /></Form.Item>
      <Form.Item name="status" label="状态"><Select options={["启用", "停用"].map((value) => ({ value, label: value }))} /></Form.Item>
      <Form.Item name="note" label="备注"><Input.TextArea rows={3} /></Form.Item>
    </Form>
  </Modal>;
}

function VersionEditor({ open, row, form, routes, pending, onClose, onSave }: {
  open: boolean;
  row?: Version;
  form: FormInstance<VersionFormValues>;
  routes: Route[];
  pending: boolean;
  onClose: () => void;
  onSave: (values: VersionFormValues) => void;
}) {
  return <Modal title={row ? `编辑路线版本 · ${row.version}` : "新建路线版本"} open={open} onCancel={onClose} onOk={() => form.submit()} confirmLoading={pending} width={620} destroyOnHidden>
    <Form form={form} layout="vertical" onFinish={onSave} preserve={false}>
      <Form.Item name="routeId" label="工艺路线" rules={[{ required: true }]}><Select disabled={!!row} showSearch optionFilterProp="label" options={routes.map((route) => ({ value: route.id, label: `${route.code} · ${route.name} · ${route.sku.name}` }))} /></Form.Item>
      <Space align="start" style={{ width: "100%" }}><Form.Item name="version" label="版本号" rules={[{ required: true }]}><Input placeholder="例如 V1.0" style={{ width: 180 }} /></Form.Item><Form.Item name="effectiveFrom" label="计划生效日期"><DatePicker style={{ width: 180 }} /></Form.Item><Form.Item name="effectiveTo" label="计划失效日期"><DatePicker style={{ width: 180 }} /></Form.Item></Space>
      <Form.Item name="changeReason" label="变更原因"><Input.TextArea rows={3} placeholder="说明本版本新增或调整的内容" /></Form.Item>
    </Form>
  </Modal>;
}

function VersionConfigurationDrawer({ version, operations, pending, onClose, onEdit, onDelete }: {
  version?: Version;
  operations: Operation[];
  pending: boolean;
  onClose: () => void;
  onEdit: (row?: RouteOperation) => void;
  onDelete: (row: RouteOperation) => void;
}) {
  return <Drawer title={version ? `路线版本配置 · ${version.version}` : "路线版本配置"} open={!!version} onClose={onClose} width="min(1120px, 96vw)" destroyOnHidden>
    {version && <Space direction="vertical" size="middle" style={{ width: "100%" }}>
      <Descriptions size="small" bordered column={4}>
        <Descriptions.Item label="版本号"><span className="mes-code">{version.version}</span></Descriptions.Item>
        <Descriptions.Item label="状态"><ProcessStatusTag status={version.status} /></Descriptions.Item>
        <Descriptions.Item label="工序数">{version.operations.length}</Descriptions.Item>
        <Descriptions.Item label="标准周期合计"><span className="tabular-nums">{version.operations.reduce((sum, item) => sum + (item.standardCycleSeconds ?? 0), 0)} 秒</span></Descriptions.Item>
        <Descriptions.Item label="变更原因" span={4}>{version.changeReason ?? "-"}</Descriptions.Item>
      </Descriptions>
      <div className="table-toolbar" style={{ marginBottom: 0 }}>
        <strong>工序配置</strong>
        <Tooltip title={version.status !== "草稿" ? "已发布或停用版本只读" : undefined}>
          <Button type="primary" icon={<PlusOutlined />} disabled={version.status !== "草稿" || operations.every((operation) => operation.status !== "启用")} onClick={() => onEdit()}>新增工序</Button>
        </Tooltip>
      </div>
      <Table
        size="small"
        rowKey="id"
        dataSource={version.operations}
        pagination={false}
        locale={{ emptyText: "尚未配置工序" }}
        columns={[
          { title: "顺序", dataIndex: "sequence", width: 70, className: "tabular-nums" },
          { title: "工序", render: (_, row) => <div><div>{row.operationName}</div><div className="mes-meta mes-code">{row.operationCode}</div></div>, width: 180 },
          { title: "类型", dataIndex: "operationType", width: 80 },
          { title: "工作中心", dataIndex: "workCenter", width: 130, render: (value) => value ?? "-" },
          { title: "标准周期", dataIndex: "standardCycleSeconds", width: 105, render: (value) => value == null ? "-" : <span className="tabular-nums">{value} 秒</span> },
          { title: "准备工时", dataIndex: "setupMinutes", width: 100, render: (value) => value == null ? "-" : <span className="tabular-nums">{value} 分钟</span> },
          { title: "报工模式", dataIndex: "reportMode", width: 100 },
          { title: "业务要求", render: (_, row) => <Space size={[0, 4]} wrap>{operationRequirements(row).map((value) => <Tag key={value}>{value}</Tag>)}</Space> },
          { title: "状态", dataIndex: "status", width: 80, render: (value) => <ProcessStatusTag status={value} /> },
          {
            title: "操作",
            width: 120,
            render: (_, row) => version.status === "草稿" ? <Space size="small">
              <Button type="link" size="small" onClick={() => onEdit(row)}>编辑</Button>
              <Popconfirm title="确认删除该工序配置？" onConfirm={() => onDelete(row)}>
                <Button type="link" size="small" className="mes-destructive-action" disabled={pending}>删除</Button>
              </Popconfirm>
            </Space> : "-",
          },
        ]}
      />
    </Space>}
  </Drawer>;
}

function RouteOperationEditor({ open, row, form, operations, pending, onClose, onSave }: {
  open: boolean;
  row?: RouteOperation;
  form: FormInstance<RouteOperationFormValues>;
  operations: Operation[];
  pending: boolean;
  onClose: () => void;
  onSave: (values: RouteOperationFormValues) => void;
}) {
  const selectedOperationId = Form.useWatch("operationId", form);
  const selectedOperation = operations.find((operation) => operation.id === selectedOperationId);
  return <Modal title={row ? "编辑路线工序" : "新增路线工序"} open={open} onCancel={onClose} onOk={() => form.submit()} confirmLoading={pending} width={720} destroyOnHidden>
    <Form form={form} layout="vertical" onFinish={onSave} preserve={false}>
      <Form.Item name="routeVersionId" hidden><Input /></Form.Item>
      <Form.Item name="operationId" label="标准工序" rules={[{ required: true }]}>
        <Select showSearch optionFilterProp="label" disabled={!!row} options={operations.filter((operation) => operation.status === "启用").map((operation) => ({ value: operation.id, label: `${operation.code} · ${operation.name} · ${operation.type}` }))} onChange={(value) => {
          const operation = operations.find((item) => item.id === value);
          if (operation?.workCenter) form.setFieldValue("workCenter", operation.workCenter);
        }} />
      </Form.Item>
      {selectedOperation && <div className="process-operation-hint">适用工艺：{selectedOperation.appliesTo} · 默认工作中心：{selectedOperation.workCenter ?? "未设置"}</div>}
      <Space align="start" style={{ width: "100%" }}>
        <Form.Item name="sequence" label="工序顺序" rules={[{ required: true }]}><InputNumber min={1} precision={0} style={{ width: 130 }} /></Form.Item>
        <Form.Item name="workCenter" label="工作中心"><Input style={{ width: 190 }} /></Form.Item>
        <Form.Item name="reportMode" label="报工模式" rules={[{ required: true }]}><Select style={{ width: 150 }} options={REPORT_MODES.map((value) => ({ value, label: value }))} /></Form.Item>
        <Form.Item name="status" label="状态"><Select style={{ width: 120 }} options={["启用", "停用"].map((value) => ({ value, label: value }))} /></Form.Item>
      </Space>
      <Space align="start" style={{ width: "100%" }}>
        <Form.Item name="standardCycleSeconds" label="标准周期（秒）"><InputNumber min={0.01} style={{ width: 180 }} /></Form.Item>
        <Form.Item name="setupMinutes" label="准备工时（分钟）"><InputNumber min={0} style={{ width: 180 }} /></Form.Item>
      </Space>
      <div className="process-checkbox-grid">
        <Form.Item name="requiresEquipment" valuePropName="checked"><Checkbox>必须选择设备</Checkbox></Form.Item>
        <Form.Item name="requiresMold" valuePropName="checked"><Checkbox>必须选择模具</Checkbox></Form.Item>
        <Form.Item name="qualityRequired" valuePropName="checked"><Checkbox>需要质量检验</Checkbox></Form.Item>
        <Form.Item name="isFinal" valuePropName="checked"><Checkbox>设为末工序</Checkbox></Form.Item>
      </div>
      <Form.Item name="note" label="工序配置说明"><Input.TextArea rows={3} /></Form.Item>
    </Form>
  </Modal>;
}
