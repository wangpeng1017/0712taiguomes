"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import {
  Button,
  Card,
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
  message,
  type FormInstance,
} from "antd";
import {
  CopyOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
  SendOutlined,
  SettingOutlined,
  StopOutlined,
  SwapOutlined,
} from "@ant-design/icons";
import dayjs, { type Dayjs } from "dayjs";
import { useRouter } from "next/navigation";
import type { BomManagementData } from "@/lib/queries/boms";
import {
  copyBomVersion,
  deleteBomItem,
  deleteBomMaster,
  deleteBomSubstitute,
  deleteBomVersion,
  disableBomVersion,
  publishBomVersion,
  saveBomItem,
  saveBomMaster,
  saveBomSubstitute,
  saveBomVersion,
} from "@/lib/actions/boms";

type Bom = BomManagementData["boms"][number];
type Version = Bom["versions"][number];
type BomItem = Version["items"][number];
type Substitute = BomItem["substitutes"][number];
type Sku = BomManagementData["skus"][number];
type Material = BomManagementData["materials"][number];
type Operation = BomManagementData["operations"][number];

type BomFormValues = { code: string; name: string; skuId: string; status: string; note?: string };
type VersionFormValues = {
  bomId: string;
  version: string;
  effectiveFrom?: Dayjs | null;
  effectiveTo?: Dayjs | null;
  changeReason?: string;
};
type ItemFormValues = {
  bomVersionId: string;
  materialId: string;
  operationSequence?: number | null;
  operationCode?: string;
  qtyPerBasis: number;
  basisQty: number;
  unit: string;
  lossRatePercent: number;
  itemType: string;
  status: string;
  note?: string;
};
type SubstituteFormValues = {
  bomItemId: string;
  materialId: string;
  priority: number;
  conversionRate: number;
  status: string;
  effectiveFrom?: Dayjs | null;
  effectiveTo?: Dayjs | null;
  reason?: string;
  note?: string;
};

const ITEM_TYPES = ["主料", "辅料", "包装料", "半成品", "回料", "其他"];

function matchesKeyword(keyword: string, values: Array<string | null | undefined>) {
  const normalized = keyword.trim().toLowerCase();
  return !normalized || values.some((value) => String(value ?? "").toLowerCase().includes(normalized));
}

function statusTag(status: string) {
  const tone = status === "启用" || status === "已发布"
    ? { color: "#1f7a4d", background: "#1f9d5514", borderColor: "#1f9d5538" }
    : status === "草稿"
      ? { color: "#52606d", background: "#f1f5f9", borderColor: "#cbd5e1" }
      : { color: "#64748b", background: "#f1f5f9", borderColor: "#cbd5e1" };
  return <Tag style={{ ...tone, fontWeight: 500 }}>{status}</Tag>;
}

function formatQuantity(value: number) {
  return new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 6 }).format(value);
}

export function BomManagementView({
  initialBomId,
  boms,
  skus,
  materials,
  operations,
}: BomManagementData & { initialBomId?: string }) {
  const router = useRouter();
  const [bomForm] = Form.useForm<BomFormValues>();
  const [versionForm] = Form.useForm<VersionFormValues>();
  const [itemForm] = Form.useForm<ItemFormValues>();
  const [substituteForm] = Form.useForm<SubstituteFormValues>();
  const [keyword, setKeyword] = useState("");
  const [skuFilter, setSkuFilter] = useState<string>();
  const [statusFilter, setStatusFilter] = useState<string>();
  const [selectedBomId, setSelectedBomId] = useState<string>();
  const [selectedVersionId, setSelectedVersionId] = useState<string>();
  const [bomEditor, setBomEditor] = useState<Bom | "new" | null>(null);
  const [versionEditor, setVersionEditor] = useState<Version | "new" | null>(null);
  const [itemEditor, setItemEditor] = useState<BomItem | "new" | null>(null);
  const [substituteContext, setSubstituteContext] = useState<BomItem>();
  const [substituteEditor, setSubstituteEditor] = useState<Substitute | "new" | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!initialBomId || !boms.some((bom) => bom.id === initialBomId)) return;
    setSelectedBomId(initialBomId);
  }, [initialBomId, boms]);

  const selectedBom = boms.find((bom) => bom.id === selectedBomId);
  const selectedVersion = selectedBom?.versions.find((version) => version.id === selectedVersionId);

  useEffect(() => {
    if (!selectedBom) {
      setSelectedVersionId(undefined);
      return;
    }
    setSelectedVersionId((current) => current && selectedBom.versions.some((version) => version.id === current)
      ? current
      : selectedBom.versions[0]?.id);
  }, [selectedBom]);

  const filteredBoms = useMemo(() => boms.filter((bom) =>
    matchesKeyword(keyword, [bom.code, bom.name, bom.sku.code, bom.sku.name, bom.note])
      && (!skuFilter || bom.skuId === skuFilter)
      && (!statusFilter || bom.status === statusFilter)
  ), [boms, keyword, skuFilter, statusFilter]);

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

  function resetFilters() {
    setKeyword("");
    setSkuFilter(undefined);
    setStatusFilter(undefined);
  }

  function openBomEditor(row?: Bom) {
    setBomEditor(row ?? "new");
    bomForm.resetFields();
    queueMicrotask(() => bomForm.setFieldsValue(row ? {
      code: row.code,
      name: row.name,
      skuId: row.skuId,
      status: row.status,
      note: row.note ?? undefined,
    } : { status: "启用" }));
  }

  function openVersionEditor(row?: Version) {
    if (!selectedBom) return;
    setVersionEditor(row ?? "new");
    versionForm.resetFields();
    queueMicrotask(() => versionForm.setFieldsValue(row ? {
      bomId: row.bomId,
      version: row.version,
      effectiveFrom: row.effectiveFrom ? dayjs(row.effectiveFrom) : null,
      effectiveTo: row.effectiveTo ? dayjs(row.effectiveTo) : null,
      changeReason: row.changeReason ?? undefined,
    } : {
      bomId: selectedBom.id,
      version: `V${((selectedBom.versions.length || 0) + 1).toFixed(1)}`,
    }));
  }

  function openItemEditor(row?: BomItem) {
    if (!selectedVersion) return;
    setItemEditor(row ?? "new");
    itemForm.resetFields();
    queueMicrotask(() => itemForm.setFieldsValue(row ? {
      bomVersionId: row.bomVersionId,
      materialId: row.materialId,
      operationSequence: row.operationSequence,
      operationCode: row.operationCode ?? undefined,
      qtyPerBasis: row.qtyPerBasis,
      basisQty: row.basisQty,
      unit: row.unit,
      lossRatePercent: row.lossRate * 100,
      itemType: row.itemType,
      status: row.status,
      note: row.note ?? undefined,
    } : {
      bomVersionId: selectedVersion.id,
      basisQty: 1000,
      lossRatePercent: 0,
      itemType: "主料",
      status: "启用",
    }));
  }

  function openSubstituteEditor(item: BomItem, row?: Substitute) {
    setSubstituteContext(item);
    setSubstituteEditor(row ?? "new");
    substituteForm.resetFields();
    queueMicrotask(() => substituteForm.setFieldsValue(row ? {
      bomItemId: row.bomItemId,
      materialId: row.materialId,
      priority: row.priority,
      conversionRate: row.conversionRate,
      status: row.status,
      effectiveFrom: row.effectiveFrom ? dayjs(row.effectiveFrom) : null,
      effectiveTo: row.effectiveTo ? dayjs(row.effectiveTo) : null,
      reason: row.reason ?? undefined,
      note: row.note ?? undefined,
    } : {
      bomItemId: item.id,
      priority: (item.substitutes.at(-1)?.priority ?? 0) + 1,
      conversionRate: 1,
      status: "启用",
    }));
  }

  function closeSubstituteEditor() {
    setSubstituteEditor(null);
  }

  return (
    <>
      <div className="table-toolbar" style={{ flexWrap: "wrap" }}>
        <Input
          prefix={<SearchOutlined />}
          value={keyword}
          allowClear
          placeholder="搜索 BOM、产品或备注"
          onChange={(event) => setKeyword(event.target.value)}
          style={{ width: 300 }}
        />
        <Select
          value={skuFilter}
          allowClear
          showSearch
          optionFilterProp="label"
          placeholder="适用产品"
          options={skus.map((sku) => ({ value: sku.id, label: `${sku.name}（${sku.code}）` }))}
          onChange={setSkuFilter}
          style={{ width: 230 }}
        />
        <Select
          value={statusFilter}
          allowClear
          placeholder="状态"
          options={["启用", "停用"].map((value) => ({ value, label: value }))}
          onChange={setStatusFilter}
          style={{ width: 110 }}
        />
        <Button icon={<ReloadOutlined />} onClick={resetFilters}>重置</Button>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => openBomEditor()}>新增 BOM</Button>
      </div>

      <Table
        size="middle"
        rowKey="id"
        dataSource={filteredBoms}
        pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (total) => `共 ${total} 条` }}
        columns={[
          { title: "BOM 编码", dataIndex: "code", width: 160, render: (value) => <span className="mes-code">{value}</span> },
          { title: "BOM 名称", dataIndex: "name", width: 210 },
          { title: "适用产品", render: (_, row) => <div><div>{row.sku.name}</div><div className="mes-meta mes-code">{row.sku.code}</div></div> },
          { title: "产品类型", render: (_, row) => row.sku.type, width: 100 },
          { title: "版本数", render: (_, row) => row.versions.length, width: 90, className: "tabular-nums" },
          { title: "当前发布版本", width: 130, render: (_, row) => <span className="mes-code">{row.versions.find((version) => version.status === "已发布")?.version ?? "-"}</span> },
          { title: "备注", dataIndex: "note", ellipsis: true, render: (value) => value ?? "-" },
          { title: "状态", dataIndex: "status", width: 90, render: (value) => statusTag(value) },
          {
            title: "操作",
            width: 220,
            render: (_, row) => <Space size="small">
              <Button type="link" size="small" icon={<SettingOutlined />} onClick={() => {
                setSelectedBomId(row.id);
                router.replace(`/process/boms?bomId=${row.id}`);
              }}>版本与明细</Button>
              <Button type="link" size="small" onClick={() => openBomEditor(row)}>编辑</Button>
              <Popconfirm title="确认删除该 BOM？" description="已有版本时将拒绝删除。" onConfirm={() => runAction(() => deleteBomMaster(row.id), "BOM 已删除")}>
                <Button type="link" size="small" className="mes-destructive-action" disabled={pending}>删除</Button>
              </Popconfirm>
            </Space>,
          },
        ]}
      />

      <BomEditor open={!!bomEditor} row={bomEditor === "new" ? undefined : bomEditor ?? undefined} form={bomForm} skus={skus} pending={pending} onClose={() => setBomEditor(null)} onSave={(values) => runAction(
        () => saveBomMaster({ ...(bomEditor && bomEditor !== "new" ? { id: bomEditor.id } : {}), ...values }),
        "BOM 已保存",
        () => setBomEditor(null)
      )} />

      <Drawer
        title={selectedBom ? `BOM 版本与明细 · ${selectedBom.code}` : "BOM 版本与明细"}
        open={!!selectedBom}
        onClose={() => { setSelectedBomId(undefined); setSelectedVersionId(undefined); router.replace("/process/boms"); }}
        width="min(1240px, 97vw)"
        destroyOnHidden
      >
        {selectedBom && <Space direction="vertical" size="large" style={{ width: "100%" }}>
          <Descriptions size="small" bordered column={4}>
            <Descriptions.Item label="BOM 编码"><span className="mes-code">{selectedBom.code}</span></Descriptions.Item>
            <Descriptions.Item label="BOM 名称">{selectedBom.name}</Descriptions.Item>
            <Descriptions.Item label="适用产品">{selectedBom.sku.name}（<span className="mes-code">{selectedBom.sku.code}</span>）</Descriptions.Item>
            <Descriptions.Item label="状态">{statusTag(selectedBom.status)}</Descriptions.Item>
          </Descriptions>

          <Card size="small" title="版本管理" extra={<Button type="primary" icon={<PlusOutlined />} onClick={() => openVersionEditor()}>新建版本</Button>}>
            <Table
              size="small"
              rowKey="id"
              dataSource={selectedBom.versions}
              pagination={false}
              rowClassName={(row) => row.id === selectedVersionId ? "ant-table-row-selected" : ""}
              onRow={(row) => ({ onClick: () => setSelectedVersionId(row.id), style: { cursor: "pointer" } })}
              locale={{ emptyText: "该 BOM 暂无版本" }}
              columns={[
                { title: "版本号", dataIndex: "version", width: 100, render: (value) => <span className="mes-code">{value}</span> },
                { title: "明细数", render: (_, row) => row.items.length, width: 85, className: "tabular-nums" },
                { title: "生效日期", dataIndex: "effectiveFrom", width: 115, render: (value) => value ? dayjs(value).format("YYYY-MM-DD") : "-" },
                { title: "变更原因", dataIndex: "changeReason", ellipsis: true, render: (value) => value ?? "-" },
                { title: "发布人", dataIndex: "releasedBy", width: 100, render: (value) => value ?? "-" },
                { title: "状态", dataIndex: "status", width: 90, render: (value) => statusTag(value) },
                {
                  title: "操作",
                  width: 300,
                  render: (_, row) => <Space size="small" wrap onClick={(event) => event.stopPropagation()}>
                    {row.status === "草稿" && <Button type="link" size="small" onClick={() => openVersionEditor(row)}>编辑</Button>}
                    <Button type="link" size="small" icon={<CopyOutlined />} disabled={pending} onClick={() => runAction(() => copyBomVersion(row.id), `已复制 ${row.version}`)}>复制</Button>
                    {row.status === "草稿" && <Popconfirm title={`发布 BOM 版本 ${row.version}？`} description="发布后会停用该 BOM 的上一发布版本。" onConfirm={() => runAction(() => publishBomVersion(row.id, "Somchai"), `${row.version} 已发布`)}>
                      <Button type="link" size="small" icon={<SendOutlined />} disabled={pending}>发布</Button>
                    </Popconfirm>}
                    {row.status === "已发布" && <Popconfirm title={`停用 BOM 版本 ${row.version}？`} onConfirm={() => runAction(() => disableBomVersion(row.id), `${row.version} 已停用`)}>
                      <Button type="link" size="small" icon={<StopOutlined />} className="mes-destructive-action" disabled={pending}>停用</Button>
                    </Popconfirm>}
                    {row.status === "草稿" && <Popconfirm title={`删除草稿版本 ${row.version}？`} onConfirm={() => runAction(() => deleteBomVersion(row.id), `${row.version} 已删除`)}>
                      <Button type="link" size="small" className="mes-destructive-action" disabled={pending}>删除</Button>
                    </Popconfirm>}
                  </Space>,
                },
              ]}
            />
          </Card>

          <Card
            size="small"
            title={selectedVersion ? `物料明细 · ${selectedVersion.version}` : "物料明细"}
            extra={<Tooltip title={selectedVersion?.status !== "草稿" ? "请选择草稿版本后配置明细" : undefined}>
              <Button type="primary" icon={<PlusOutlined />} disabled={!selectedVersion || selectedVersion.status !== "草稿"} onClick={() => openItemEditor()}>新增明细</Button>
            </Tooltip>}
          >
            <Table
              size="small"
              rowKey="id"
              dataSource={selectedVersion?.items ?? []}
              pagination={false}
              locale={{ emptyText: selectedVersion ? "该版本尚未配置物料明细" : "请先选择 BOM 版本" }}
              expandable={{
                rowExpandable: (row) => row.substitutes.length > 0,
                expandedRowRender: (row) => <SubstituteTable item={row} pending={pending} onEdit={(substitute) => openSubstituteEditor(row, substitute)} onDelete={(substitute) => runAction(() => deleteBomSubstitute(substitute.id), "替代料已删除")} />,
              }}
              columns={[
                { title: "工序", width: 110, render: (_, row) => row.operationSequence ? <div><span className="tabular-nums">{row.operationSequence}</span><div className="mes-meta mes-code">{row.operationCode ?? "-"}</div></div> : "通用" },
                { title: "物料", width: 210, render: (_, row) => <div><div>{row.material.name}</div><div className="mes-meta mes-code">{row.material.code}</div></div> },
                { title: "类型", dataIndex: "itemType", width: 90 },
                { title: "基准用量", width: 125, render: (_, row) => <span className="tabular-nums">{formatQuantity(row.qtyPerBasis)} {row.unit}</span> },
                { title: "基准产量", width: 115, render: (_, row) => <span className="tabular-nums">{formatQuantity(row.basisQty)}</span> },
                { title: "损耗率", width: 90, render: (_, row) => <span className="tabular-nums">{(row.lossRate * 100).toFixed(2)}%</span> },
                { title: "替代料", width: 85, render: (_, row) => row.substitutes.length, className: "tabular-nums" },
                { title: "状态", dataIndex: "status", width: 80, render: (value) => statusTag(value) },
                {
                  title: "操作",
                  width: 230,
                  render: (_, row) => selectedVersion?.status === "草稿" ? <Space size="small">
                    <Button type="link" size="small" onClick={() => openItemEditor(row)}>编辑</Button>
                    <Button type="link" size="small" icon={<SwapOutlined />} onClick={() => { setSubstituteContext(row); setSubstituteEditor(null); }}>替代料</Button>
                    <Popconfirm title="确认删除该物料明细？" onConfirm={() => runAction(() => deleteBomItem(row.id), "BOM 明细已删除")}>
                      <Button type="link" size="small" className="mes-destructive-action" disabled={pending}>删除</Button>
                    </Popconfirm>
                  </Space> : "-",
                },
              ]}
            />
          </Card>
        </Space>}
      </Drawer>

      <VersionEditor open={!!versionEditor} row={versionEditor === "new" ? undefined : versionEditor ?? undefined} form={versionForm} pending={pending} onClose={() => setVersionEditor(null)} onSave={(values) => runAction(
        () => saveBomVersion({
          ...(versionEditor && versionEditor !== "new" ? { id: versionEditor.id } : {}),
          ...values,
          effectiveFrom: values.effectiveFrom?.toISOString() ?? null,
          effectiveTo: values.effectiveTo?.toISOString() ?? null,
        }),
        "BOM 版本已保存",
        () => setVersionEditor(null)
      )} />

      <ItemEditor open={!!itemEditor} row={itemEditor === "new" ? undefined : itemEditor ?? undefined} form={itemForm} materials={materials} operations={operations} pending={pending} onClose={() => setItemEditor(null)} onSave={(values) => runAction(
        () => saveBomItem({
          ...(itemEditor && itemEditor !== "new" ? { id: itemEditor.id } : {}),
          ...values,
          lossRate: values.lossRatePercent / 100,
        }),
        "BOM 明细已保存",
        () => setItemEditor(null)
      )} />

      <SubstituteDrawer
        item={substituteContext}
        materials={materials}
        pending={pending}
        onClose={() => { setSubstituteContext(undefined); setSubstituteEditor(null); }}
        onAdd={() => substituteContext && openSubstituteEditor(substituteContext)}
        onEdit={(row) => substituteContext && openSubstituteEditor(substituteContext, row)}
        onDelete={(row) => runAction(() => deleteBomSubstitute(row.id), "替代料已删除")}
      />

      <SubstituteEditor open={!!substituteEditor} row={substituteEditor === "new" ? undefined : substituteEditor ?? undefined} item={substituteContext} form={substituteForm} materials={materials} pending={pending} onClose={closeSubstituteEditor} onSave={(values) => runAction(
        () => saveBomSubstitute({
          ...(substituteEditor && substituteEditor !== "new" ? { id: substituteEditor.id } : {}),
          ...values,
          effectiveFrom: values.effectiveFrom?.toISOString() ?? null,
          effectiveTo: values.effectiveTo?.toISOString() ?? null,
        }),
        "替代料已保存",
        () => setSubstituteEditor(null)
      )} />
    </>
  );
}

function BomEditor({ open, row, form, skus, pending, onClose, onSave }: {
  open: boolean;
  row?: Bom;
  form: FormInstance<BomFormValues>;
  skus: Sku[];
  pending: boolean;
  onClose: () => void;
  onSave: (values: BomFormValues) => void;
}) {
  return <Modal title={row ? "编辑 BOM" : "新增 BOM"} open={open} onCancel={onClose} onOk={() => form.submit()} confirmLoading={pending} width={640} destroyOnHidden>
    <Form form={form} layout="vertical" onFinish={onSave} preserve={false}>
      <Space align="start" style={{ width: "100%" }}>
        <Form.Item name="code" label="BOM 编码" rules={[{ required: true }]}><Input style={{ width: 220 }} placeholder="例如 BOM-FG-001" /></Form.Item>
        <Form.Item name="name" label="BOM 名称" rules={[{ required: true }]}><Input style={{ width: 340 }} /></Form.Item>
      </Space>
      <Form.Item name="skuId" label="适用产品" rules={[{ required: true }]}>
        <Select showSearch optionFilterProp="label" options={skus.map((sku) => ({ value: sku.id, label: `${sku.code} · ${sku.name} · ${sku.type}` }))} />
      </Form.Item>
      <Form.Item name="status" label="状态"><Select options={["启用", "停用"].map((value) => ({ value, label: value }))} /></Form.Item>
      <Form.Item name="note" label="备注"><Input.TextArea rows={3} /></Form.Item>
    </Form>
  </Modal>;
}

function VersionEditor({ open, row, form, pending, onClose, onSave }: {
  open: boolean;
  row?: Version;
  form: FormInstance<VersionFormValues>;
  pending: boolean;
  onClose: () => void;
  onSave: (values: VersionFormValues) => void;
}) {
  return <Modal title={row ? `编辑 BOM 版本 · ${row.version}` : "新建 BOM 版本"} open={open} onCancel={onClose} onOk={() => form.submit()} confirmLoading={pending} width={640} destroyOnHidden>
    <Form form={form} layout="vertical" onFinish={onSave} preserve={false}>
      <Form.Item name="bomId" hidden><Input /></Form.Item>
      <Space align="start" style={{ width: "100%" }}>
        <Form.Item name="version" label="版本号" rules={[{ required: true }]}><Input style={{ width: 180 }} placeholder="例如 V1.0" /></Form.Item>
        <Form.Item name="effectiveFrom" label="计划生效日期"><DatePicker style={{ width: 180 }} /></Form.Item>
        <Form.Item name="effectiveTo" label="计划失效日期"><DatePicker style={{ width: 180 }} /></Form.Item>
      </Space>
      <Form.Item name="changeReason" label="变更原因"><Input.TextArea rows={3} placeholder="说明本版本新增或调整的物料、用量或替代关系" /></Form.Item>
    </Form>
  </Modal>;
}

function ItemEditor({ open, row, form, materials, operations, pending, onClose, onSave }: {
  open: boolean;
  row?: BomItem;
  form: FormInstance<ItemFormValues>;
  materials: Material[];
  operations: Operation[];
  pending: boolean;
  onClose: () => void;
  onSave: (values: ItemFormValues) => void;
}) {
  return <Modal title={row ? "编辑 BOM 明细" : "新增 BOM 明细"} open={open} onCancel={onClose} onOk={() => form.submit()} confirmLoading={pending} width={760} destroyOnHidden>
    <Form form={form} layout="vertical" onFinish={onSave} preserve={false}>
      <Form.Item name="bomVersionId" hidden><Input /></Form.Item>
      <Form.Item name="materialId" label="物料" rules={[{ required: true }]}>
        <Select showSearch optionFilterProp="label" disabled={!!row} options={materials.map((material) => ({ value: material.id, label: `${material.code} · ${material.name} · ${material.type}` }))} onChange={(value) => {
          const material = materials.find((item) => item.id === value);
          if (material?.unit) form.setFieldValue("unit", material.unit);
        }} />
      </Form.Item>
      <Space align="start" style={{ width: "100%" }} wrap>
        <Form.Item name="operationSequence" label="工序序号"><InputNumber min={1} precision={0} style={{ width: 140 }} /></Form.Item>
        <Form.Item name="operationCode" label="工序编码">
          <Select allowClear showSearch optionFilterProp="label" style={{ width: 220 }} options={operations.map((operation) => ({ value: operation.code, label: `${operation.code} · ${operation.name}` }))} />
        </Form.Item>
        <Form.Item name="itemType" label="明细类型" rules={[{ required: true }]}><Select style={{ width: 150 }} options={ITEM_TYPES.map((value) => ({ value, label: value }))} /></Form.Item>
        <Form.Item name="status" label="状态"><Select style={{ width: 120 }} options={["启用", "停用"].map((value) => ({ value, label: value }))} /></Form.Item>
      </Space>
      <Space align="start" style={{ width: "100%" }} wrap>
        <Form.Item name="qtyPerBasis" label="基准用量" rules={[{ required: true }]}><InputNumber min={0.000001} style={{ width: 160 }} /></Form.Item>
        <Form.Item name="basisQty" label="基准产量" rules={[{ required: true }]}><InputNumber min={0.000001} style={{ width: 160 }} /></Form.Item>
        <Form.Item name="unit" label="单位" rules={[{ required: true }]}><Input style={{ width: 120 }} /></Form.Item>
        <Form.Item name="lossRatePercent" label="损耗率（%）" rules={[{ required: true }]}><InputNumber min={0} max={100} precision={4} style={{ width: 150 }} /></Form.Item>
      </Space>
      <Form.Item name="note" label="明细说明"><Input.TextArea rows={3} /></Form.Item>
    </Form>
  </Modal>;
}

function SubstituteTable({ item, pending, onEdit, onDelete }: {
  item: BomItem;
  pending: boolean;
  onEdit: (row: Substitute) => void;
  onDelete: (row: Substitute) => void;
}) {
  return <Table
    size="small"
    rowKey="id"
    dataSource={item.substitutes}
    pagination={false}
    columns={[
      { title: "替代优先级", dataIndex: "priority", width: 100, className: "tabular-nums" },
      { title: "替代物料", render: (_, row) => <div><div>{row.material.name}</div><div className="mes-meta mes-code">{row.material.code}</div></div> },
      { title: "换算率", dataIndex: "conversionRate", width: 100, className: "tabular-nums" },
      { title: "有效期", width: 190, render: (_, row) => `${row.effectiveFrom ? dayjs(row.effectiveFrom).format("YYYY-MM-DD") : "即时"} ~ ${row.effectiveTo ? dayjs(row.effectiveTo).format("YYYY-MM-DD") : "长期"}` },
      { title: "替代原因", dataIndex: "reason", ellipsis: true, render: (value) => value ?? "-" },
      { title: "状态", dataIndex: "status", width: 80, render: (value) => statusTag(value) },
      { title: "操作", width: 120, render: (_, row) => <Space size="small"><Button type="link" size="small" onClick={() => onEdit(row)}>编辑</Button><Popconfirm title="确认删除该替代料？" onConfirm={() => onDelete(row)}><Button type="link" size="small" className="mes-destructive-action" disabled={pending}>删除</Button></Popconfirm></Space> },
    ]}
  />;
}

function SubstituteDrawer({ item, materials, pending, onClose, onAdd, onEdit, onDelete }: {
  item?: BomItem;
  materials: Material[];
  pending: boolean;
  onClose: () => void;
  onAdd: () => void;
  onEdit: (row: Substitute) => void;
  onDelete: (row: Substitute) => void;
}) {
  return <Drawer title={item ? `替代料配置 · ${item.material.code}` : "替代料配置"} open={!!item} onClose={onClose} width="min(900px, 96vw)" destroyOnHidden extra={<Button type="primary" icon={<PlusOutlined />} disabled={!materials.some((material) => material.id !== item?.materialId)} onClick={onAdd}>新增替代料</Button>}>
    {item && <Space direction="vertical" size="middle" style={{ width: "100%" }}>
      <div className="mes-notice">主物料：<span className="mes-code">{item.material.code}</span> · {item.material.name}。替代料按优先级升序选择，实际使用仍应在报工时保留替代标识。</div>
      <SubstituteTable item={item} pending={pending} onEdit={onEdit} onDelete={onDelete} />
    </Space>}
  </Drawer>;
}

function SubstituteEditor({ open, row, item, form, materials, pending, onClose, onSave }: {
  open: boolean;
  row?: Substitute;
  item?: BomItem;
  form: FormInstance<SubstituteFormValues>;
  materials: Material[];
  pending: boolean;
  onClose: () => void;
  onSave: (values: SubstituteFormValues) => void;
}) {
  return <Modal title={row ? "编辑替代料" : "新增替代料"} open={open} onCancel={onClose} onOk={() => form.submit()} confirmLoading={pending} width={680} destroyOnHidden>
    <Form form={form} layout="vertical" onFinish={onSave} preserve={false}>
      <Form.Item name="bomItemId" hidden><Input /></Form.Item>
      <Form.Item name="materialId" label="替代物料" rules={[{ required: true }]}>
        <Select showSearch optionFilterProp="label" disabled={!!row} options={materials.filter((material) => material.id !== item?.materialId).map((material) => ({ value: material.id, label: `${material.code} · ${material.name} · ${material.type}` }))} />
      </Form.Item>
      <Space align="start" style={{ width: "100%" }} wrap>
        <Form.Item name="priority" label="优先级" rules={[{ required: true }]}><InputNumber min={1} precision={0} style={{ width: 130 }} /></Form.Item>
        <Form.Item name="conversionRate" label="换算率" rules={[{ required: true }]}><InputNumber min={0.000001} style={{ width: 150 }} /></Form.Item>
        <Form.Item name="status" label="状态"><Select style={{ width: 120 }} options={["启用", "停用"].map((value) => ({ value, label: value }))} /></Form.Item>
      </Space>
      <Space align="start" style={{ width: "100%" }}>
        <Form.Item name="effectiveFrom" label="生效日期"><DatePicker style={{ width: 180 }} /></Form.Item>
        <Form.Item name="effectiveTo" label="失效日期"><DatePicker style={{ width: 180 }} /></Form.Item>
      </Space>
      <Form.Item name="reason" label="替代原因"><Input placeholder="例如缺料替代、客户批准替代、工程变更" /></Form.Item>
      <Form.Item name="note" label="备注"><Input.TextArea rows={3} /></Form.Item>
    </Form>
  </Modal>;
}
