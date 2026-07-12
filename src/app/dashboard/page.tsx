import { Card, Col, Row, Statistic, Empty } from "antd";
import Link from "next/link";
import { getDashboardData } from "@/lib/queries/dashboard";
import { TrendChart } from "@/components/charts/TrendChart";
import { RankedBarList } from "@/components/charts/RankedBarList";
import { MoldAlertTable } from "@/components/dashboard/MoldAlertTable";
import { PendingWorkOrdersTable } from "@/components/dashboard/PendingWorkOrdersTable";
import { SEMANTIC_COLORS } from "@/app/theme";

export default async function DashboardPage() {
  const data = await getDashboardData();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Row gutter={16}>
        <Col span={6}>
          <Card>
            <Statistic title="今日总产量" value={data.todayTotal} suffix="件" />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="今日良率"
              value={data.todayTotal > 0 ? data.todayYield * 100 : 0}
              precision={1}
              suffix="%"
              valueStyle={{ color: data.todayYield >= 0.95 ? SEMANTIC_COLORS.good : SEMANTIC_COLORS.warn }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="进行中工单" value={data.inProgressWorkOrderCount} suffix="个" />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="模具寿命预警"
              value={data.moldAlertCount}
              suffix="套"
              valueStyle={{ color: data.moldAlertCount > 0 ? SEMANTIC_COLORS.warn : undefined }}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={16}>
        <Col span={12}>
          <Card title="近7日总产量" size="small">
            <TrendChart data={data.volumeTrend} kind="bar" color={SEMANTIC_COLORS.info} unit=" 件" />
          </Card>
        </Col>
        <Col span={12}>
          <Card title="近7日良率趋势" size="small">
            <TrendChart data={data.yieldTrend} kind="line" color={SEMANTIC_COLORS.good} unit="%" />
          </Card>
        </Col>
      </Row>

      <Row gutter={16}>
        <Col span={10}>
          <Card title="不良原因 TOP5（近7日）" size="small">
            {data.defectTop5.length > 0 ? (
              <RankedBarList data={data.defectTop5} color={SEMANTIC_COLORS.critical} />
            ) : (
              <Empty description="近7日暂无不良记录" />
            )}
          </Card>
        </Col>
        <Col span={14}>
          <Card
            title="模具寿命预警"
            size="small"
            extra={
              <Link href="/molds" style={{ fontSize: 12 }}>
                查看模具台账 →
              </Link>
            }
          >
            <MoldAlertTable
              rows={data.moldAlerts.map((r) => ({
                mold: { id: r.mold.id, code: r.mold.code, name: r.mold.name, status: r.mold.status, warnThreshold: r.mold.warnThreshold },
                alert: { lifeRate: r.alert.lifeRate },
              }))}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={16}>
        <Col span={24}>
          <Card
            title="待处理工单（未下达 / 已下达未开工）"
            size="small"
            extra={
              <Link href="/work-orders" style={{ fontSize: 12 }}>
                查看全部工单 →
              </Link>
            }
          >
            <PendingWorkOrdersTable
              rows={data.pendingWorkOrders.map((r) => ({
                id: r.id, no: r.no, type: r.type, planQty: r.planQty,
                planStart: r.planStart.toISOString(), planEnd: r.planEnd.toISOString(), status: r.status,
                sku: { name: r.sku.name, code: r.sku.code },
              }))}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
}
