"use client";

import { Layout, Menu, Segmented } from "antd";
import {
  DashboardOutlined,
  FileTextOutlined,
  ExperimentOutlined,
  ToolOutlined,
  InboxOutlined,
  ControlOutlined,
  SearchOutlined,
  BarChartOutlined,
  DatabaseOutlined,
} from "@ant-design/icons";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLanguage } from "@/components/layout/LanguageProvider";

const { Sider, Header, Content } = Layout;

const NAV_ITEMS = [
  { key: "/dashboard", label: "仪表盘", icon: <DashboardOutlined /> },
  { key: "/work-orders", label: "生产工单", icon: <FileTextOutlined /> },
  { key: "/injection", label: "注塑报工", icon: <ExperimentOutlined /> },
  { key: "/stamping", label: "冲压报工", icon: <ToolOutlined /> },
  { key: "/materials", label: "物料批次", icon: <InboxOutlined /> },
  { key: "/molds", label: "模具台账", icon: <ControlOutlined /> },
  { key: "/trace", label: "批次追溯", icon: <SearchOutlined /> },
  { key: "/report", label: "生产日报", icon: <BarChartOutlined /> },
  { key: "/master-data", label: "基础数据", icon: <DatabaseOutlined /> },
];

const PAGE_TITLES: Record<string, string> = Object.fromEntries(
  NAV_ITEMS.map((item) => [item.key, item.label])
);

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { locale, setLocale } = useLanguage();
  const activeKey = NAV_ITEMS.find((item) => pathname?.startsWith(item.key))?.key ?? "/dashboard";

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Sider width={220} theme="dark">
        <div
          style={{
            height: 56,
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "0 18px",
            color: "#fff",
            borderBottom: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: 2,
              background: "#e0650f",
              display: "inline-block",
            }}
          />
          <div style={{ fontSize: 15, fontWeight: 700 }}>MES</div>
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[activeKey]}
          items={NAV_ITEMS.map((item) => ({
            key: item.key,
            icon: item.icon,
            label: <Link href={item.key}>{item.label}</Link>,
          }))}
          style={{ borderInlineEnd: "none" }}
        />
      </Sider>
      <Layout>
        <Header
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 24px",
            borderBottom: "1px solid #e2e6ea",
          }}
        >
          <div style={{ fontSize: 16, fontWeight: 600, color: "#12181f" }}>
            {PAGE_TITLES[activeKey]}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Segmented
              size="small"
              value={locale}
              onChange={(value) => setLocale(value as "zh" | "en")}
              options={[{ value: "zh", label: "中文" }, { value: "en", label: "English" }]}
            />
          </div>
        </Header>
        <Content style={{ padding: 24 }}>{children}</Content>
      </Layout>
    </Layout>
  );
}
