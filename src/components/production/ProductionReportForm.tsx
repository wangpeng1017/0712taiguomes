"use client";

import { useMemo, useState, useTransition } from "react";
import {
  Alert,
  Button,
  Card,
  Col,
  Descriptions,
  Form,
  Input,
  InputNumber,
  Modal,
  Row,
  Select,
  Space,
  TimePicker,
  Typography,
  message,
} from "antd";
import dayjs from "dayjs";
import { SHIFTS, DEFECT_RESPONSIBLE, DEFECT_ACTION, TODAY } from "@/lib/constants";
import { defectRate, materialUtilization, totalQty } from "@/lib/production-calc";
import { submitProductionBatch } from "@/lib/actions/production";

type WorkOrder = {
  id: string;
  no: string;
  planQty: number;
  planStart: string;
  planEnd: string;
  updatedAt: string;
  status: string;
  planEquipment: { id: string; code: string; name: string } | null;
  planMold: { id: string; code: string; name: string } | null;
  sku: { id: string; code: string; name: string; stdWeight: number | null };
};
type Equipment = { id: string; code: string; name: string; status: string };
type Mold = { id: string; code: string; name: string; status: string; currentCount: number; designLife: number; warnThreshold: number; cavityCount: number | null };
type MaterialLot = { id: string; lotNo: string; remainingQty: number; unit: string; material: { name: string } };
type DefectReason = { id: string; reason: string };

const OPERATOR_PRESETS = ["Somchai", "Niran", "Anong", "Pranee", "Chalermchai", "Kittipong"];

export function ProductionReportForm({
  type,
  workOrders,
  equipments,
  molds,
  materialLots,
  defectReasons,
  initialWorkOrderId,
  onSuccess,
}: {
  type: "注塑" | "冲压";
  workOrders: WorkOrder[];
  equipments: Equipment[];
  molds: Mold[];
  materialLots: MaterialLot[];
  defectReasons: DefectReason[];
  initialWorkOrderId?: string;
  onSuccess?: () => void;
}) {
  const [form] = Form.useForm();
  const [pending, startTransition] = useTransition();
  const [lastResult, setLastResult] = useState<{ batchNo: string; util: number | null; defectPct: number } | null>(null);

  const workOrderId = Form.useWatch("workOrderId", form);
  const moldId = Form.useWatch("moldId", form);
  const goodQty = Form.useWatch("goodQty", form) ?? 0;
  const badQty = Form.useWatch("badQty", form) ?? 0;
  const issuedWeight = Form.useWatch("issuedWeight", form) ?? 0;
  const returnWeight = Form.useWatch("returnWeight", form) ?? 0;

  const selectedWorkOrder = workOrders.find((w) => w.id === workOrderId);
  const initialWorkOrder = workOrders.find((w) => w.id === initialWorkOrderId);
  const selectedMold = molds.find((m) => m.id === moldId);
  const moldLifeRate = selectedMold ? selectedMold.currentCount / selectedMold.designLife : 0;

  const total = totalQty(goodQty, badQty);
  const consumption = Math.max(issuedWeight - returnWeight, 0);
  const util = materialUtilization(goodQty, selectedWorkOrder?.sku.stdWeight, consumption);
  const dRate = defectRate(badQty, total);

  const scrapLabel = type === "注塑" ? "水口料 / 报废重量 (kg)" : "边角料重量 (kg)";
  const returnLabel = type === "注塑" ? "退料重量 (kg)" : "剩余卷材重量 (kg)";

  function doSubmit(confirmOverLife: boolean) {
    const values = form.getFieldsValue();
    const day = TODAY;
    const startTime = `${day}T${values.timeRange[0].format("HH:mm")}:00+07:00`;
    const endTime = `${day}T${values.timeRange[1].format("HH:mm")}:00+07:00`;
    const defects = (values.defects ?? []).filter((d: { reasonId?: string; qty?: number }) => d?.reasonId && d?.qty);

    startTransition(async () => {
      const result = await submitProductionBatch({
        type,
        workOrderId: values.workOrderId,
        equipmentId: values.equipmentId,
        moldId: values.moldId,
        materialLotId: values.materialLotId,
        shift: values.shift,
        operator: values.operator,
        startTime,
        endTime,
        issuedWeight: values.issuedWeight,
        goodQty: values.goodQty,
        badQty: values.badQty ?? 0,
        scrapWeight: values.scrapWeight ?? 0,
        returnWeight: values.returnWeight ?? 0,
        defects,
        confirmOverLife,
        leaderConfirmedBy: confirmOverLife ? form.getFieldValue("leaderConfirmedBy") : undefined,
      });

      if (result.ok) {
        message.success(`批次 ${result.batchNo} 报工成功${result.enteredMaintenance ? "（模具已进入待保养状态）" : ""}`);
        setLastResult({
          batchNo: result.batchNo,
          util: util,
          defectPct: Math.round(dRate * 1000) / 10,
        });
        form.resetFields();
        onSuccess?.();
        return;
      }
      if ("needOverLifeConfirm" in result && result.needOverLifeConfirm) {
        let confirmedBy = "";
        Modal.confirm({
          title: "模具已超过设计寿命",
          content: (
            <Space direction="vertical" style={{ width: "100%" }}>
              <span>该模具寿命使用率已达 {result.lifeRatePct}%，需主管确认后才能继续生产。</span>
              <Input placeholder="输入主管姓名" onChange={(event) => { confirmedBy = event.target.value; }} />
            </Space>
          ),
          okText: "主管已确认，继续",
          cancelText: "取消",
          onOk: () => {
            if (!confirmedBy.trim()) {
              message.error("请输入主管姓名");
              return Promise.reject();
            }
            form.setFieldValue("leaderConfirmedBy", confirmedBy.trim());
            doSubmit(true);
          },
        });
        return;
      }
      message.error("error" in result ? result.error : "提交失败");
    });
  }

  const moldOptions = useMemo(
    () =>
      molds.map((m) => {
        const rate = m.currentCount / m.designLife;
        const blocked = ["维修中", "停用", "报废"].includes(m.status);
        return {
          value: m.id,
          label: `${m.name}（${m.code}） · ${m.status} · 寿命${Math.round(rate * 1000) / 10}%`,
          disabled: blocked,
        };
      }),
    [molds]
  );

  return (
    <Row gutter={16}>
      <Col span={15}>
        <Card title={`${type}开工 + 生产报工`} size="small">
          <Form
            form={form}
            layout="vertical"
            onFinish={() => doSubmit(false)}
            initialValues={{
              workOrderId: initialWorkOrderId,
              equipmentId: initialWorkOrder?.planEquipment?.id,
              moldId: initialWorkOrder?.planMold?.id,
              shift: "白班",
              timeRange: [dayjs("08:00", "HH:mm"), dayjs("19:00", "HH:mm")],
              scrapWeight: 0,
              returnWeight: 0,
              badQty: 0,
            }}
          >
            <Row gutter={12}>
              <Col span={24}>
                <Form.Item name="workOrderId" label="生产工单" rules={[{ required: true, message: "请选择工单" }]}>
                  <Select
                    placeholder={workOrders.length ? "选择已下达/生产中的工单" : "暂无可开工工单（需先下达）"}
                    options={workOrders.map((w) => ({ value: w.id, label: `${w.no} · ${w.sku.name}（${w.sku.code}） · 计划${w.planQty}` }))}
                    showSearch
                    optionFilterProp="label"
                    onChange={(value) => {
                      const nextWorkOrder = workOrders.find((workOrder) => workOrder.id === value);
                      form.setFieldsValue({
                        equipmentId: nextWorkOrder?.planEquipment?.id,
                        moldId: nextWorkOrder?.planMold?.id,
                      });
                    }}
                  />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="equipmentId" label="设备" rules={[{ required: true, message: "请选择设备" }]}>
                  <Select
                    options={equipments.map((e) => ({ value: e.id, label: `${e.name}（${e.code}）`, disabled: e.status !== "可用" }))}
                  />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="moldId" label="模具" rules={[{ required: true, message: "请选择模具" }]}>
                  <Select options={moldOptions} />
                </Form.Item>
              </Col>
              <Col span={24}>
                <Form.Item name="materialLotId" label="原材料批次" rules={[{ required: true, message: "请选择原材料批次" }]}>
                  <Select
                    options={materialLots.map((l) => ({
                      value: l.id,
                      label: `${l.lotNo} · ${l.material.name} · 可用 ${l.remainingQty.toLocaleString("zh-CN")} ${l.unit}`,
                    }))}
                  />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="shift" label="班次" rules={[{ required: true }]}>
                  <Select options={SHIFTS.map((s) => ({ value: s, label: s }))} />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="operator" label="操作员" rules={[{ required: true, message: "请输入操作员" }]}>
                  <Select
                    options={OPERATOR_PRESETS.map((o) => ({ value: o, label: o }))}
                    showSearch
                    allowClear
                    placeholder="选择或输入操作员"
                  />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="timeRange" label="开工 ~ 结束时间" rules={[{ required: true }]}>
                  <TimePicker.RangePicker format="HH:mm" style={{ width: "100%" }} />
                </Form.Item>
              </Col>

              <Col span={24}>
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  报工数据
                </Typography.Text>
              </Col>
              <Col span={12}>
                <Form.Item name="issuedWeight" label="本批领用重量 (kg)" rules={[{ required: true, message: "请输入领用重量" }]}>
                  <InputNumber min={0} style={{ width: "100%" }} />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="returnWeight" label={returnLabel}>
                  <InputNumber min={0} style={{ width: "100%" }} />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="goodQty" label="良品数量" rules={[{ required: true, message: "请输入良品数量" }]}>
                  <InputNumber min={0} style={{ width: "100%" }} />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="badQty" label="不良数量">
                  <InputNumber min={0} style={{ width: "100%" }} />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="scrapWeight" label={scrapLabel}>
                  <InputNumber min={0} style={{ width: "100%" }} />
                </Form.Item>
              </Col>

              {badQty > 0 && (
                <Col span={24}>
                  <Alert
                    type="warning"
                    showIcon
                    style={{ marginBottom: 12 }}
                    message="存在不良数量，请录入不良明细（合计不可超过不良数量）"
                  />
                  <Form.List name="defects">
                    {(fields, { add, remove }) => (
                      <Space direction="vertical" style={{ width: "100%" }}>
                        {fields.map((field) => (
                          <Row gutter={8} key={field.key} align="middle">
                            <Col span={7}>
                              <Form.Item name={[field.name, "reasonId"]} noStyle rules={[{ required: true, message: "选择原因" }]}>
                                <Select placeholder="不良原因" options={defectReasons.map((r) => ({ value: r.id, label: r.reason }))} />
                              </Form.Item>
                            </Col>
                            <Col span={4}>
                              <Form.Item name={[field.name, "qty"]} noStyle rules={[{ required: true, message: "数量" }]}>
                                <InputNumber min={1} placeholder="数量" style={{ width: "100%" }} />
                              </Form.Item>
                            </Col>
                            <Col span={6}>
                              <Form.Item name={[field.name, "responsible"]} noStyle rules={[{ required: true, message: "责任环节" }]}>
                                <Select placeholder="责任环节" options={DEFECT_RESPONSIBLE.map((r) => ({ value: r, label: r }))} />
                              </Form.Item>
                            </Col>
                            <Col span={5}>
                              <Form.Item name={[field.name, "action"]} noStyle rules={[{ required: true, message: "处理方式" }]}>
                                <Select placeholder="处理方式" options={DEFECT_ACTION.map((a) => ({ value: a, label: a }))} />
                              </Form.Item>
                            </Col>
                            <Col span={2}>
                              <Button size="small" danger onClick={() => remove(field.name)}>
                                删
                              </Button>
                            </Col>
                          </Row>
                        ))}
                        <Button size="small" onClick={() => add()}>
                          + 添加不良明细
                        </Button>
                      </Space>
                    )}
                  </Form.List>
                </Col>
              )}
            </Row>

            <Form.Item style={{ marginTop: 16 }}>
              <Button type="primary" htmlType="submit" loading={pending} block>
                提交报工，生成生产批次
              </Button>
            </Form.Item>
          </Form>
        </Card>
      </Col>

      <Col span={9}>
        <Space direction="vertical" style={{ width: "100%" }} size="middle">
          <Card title="实时计算预览" size="small">
            <Descriptions column={1} size="small">
              <Descriptions.Item label="总生产数量">
                <span className="tabular-nums">{total}</span> 件
              </Descriptions.Item>
              <Descriptions.Item label="不良率">
                <span className="tabular-nums">{Math.round(dRate * 1000) / 10}</span> %
              </Descriptions.Item>
              <Descriptions.Item label="实际消耗重量">
                <span className="tabular-nums">{consumption.toFixed(2)}</span> kg
              </Descriptions.Item>
              <Descriptions.Item label="材料利用率">
                {util !== null ? <span className="tabular-nums">{Math.round(util * 1000) / 10}%</span> : "—（需 SKU 标准重量）"}
              </Descriptions.Item>
            </Descriptions>
          </Card>

          {selectedMold && (
            <Card title="选中模具寿命" size="small">
              <Descriptions column={1} size="small">
                <Descriptions.Item label="当前状态">{selectedMold.status}</Descriptions.Item>
                <Descriptions.Item label="累计 / 设计寿命">
                  <span className="tabular-nums">
                    {selectedMold.currentCount.toLocaleString("zh-CN")} / {selectedMold.designLife.toLocaleString("zh-CN")}
                  </span>
                </Descriptions.Item>
                <Descriptions.Item label="寿命使用率">
                  <span className="tabular-nums">{Math.round(moldLifeRate * 1000) / 10}%</span>
                  {moldLifeRate >= 1 && <Alert style={{ marginTop: 6 }} type="error" showIcon message="已超设计寿命，提交时需主管二次确认" />}
                  {moldLifeRate >= selectedMold.warnThreshold && moldLifeRate < 1 && (
                    <Alert style={{ marginTop: 6 }} type="warning" showIcon message="接近/超过保养预警阈值" />
                  )}
                </Descriptions.Item>
              </Descriptions>
            </Card>
          )}

          {lastResult && (
            <Card title="最近一次提交结果" size="small">
              <Descriptions column={1} size="small">
                <Descriptions.Item label="生成批次号">
                  <span style={{ fontFamily: "ui-monospace, monospace" }}>{lastResult.batchNo}</span>
                </Descriptions.Item>
                <Descriptions.Item label="不良率">{lastResult.defectPct}%</Descriptions.Item>
                <Descriptions.Item label="材料利用率">
                  {lastResult.util !== null ? `${Math.round(lastResult.util * 1000) / 10}%` : "—"}
                </Descriptions.Item>
              </Descriptions>
            </Card>
          )}
        </Space>
      </Col>
    </Row>
  );
}
