"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Avatar, Layout, Menu, Segmented } from "antd";
import {
  BarChartOutlined,
  BranchesOutlined,
  ControlOutlined,
  DashboardOutlined,
  DatabaseOutlined,
  ExperimentOutlined,
  InboxOutlined,
  SearchOutlined,
  SettingOutlined,
  ToolOutlined,
  UserOutlined,
} from "@ant-design/icons";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLanguage } from "@/components/layout/LanguageProvider";
import { translateText } from "@/lib/i18n";

const { Sider, Header, Content } = Layout;

type NavigationLeaf = {
  key: string;
  label: string;
  icon?: ReactNode;
};

type NavigationGroup = {
  key: string;
  label: string;
  icon: ReactNode;
  children: NavigationLeaf[];
};

type NavigationItem = NavigationLeaf | NavigationGroup;
type NavigationSection = "main" | "system";

type ActiveNavigation = {
  section: NavigationSection;
  selectedKey: string;
  openKey?: string;
  label: string;
  parentLabel?: string;
};

const MAIN_NAV_ITEMS: NavigationItem[] = [
  { key: "/dashboard", label: "仪表盘", icon: <DashboardOutlined /> },
  {
    key: "/production",
    label: "生产管理",
    icon: <ToolOutlined />,
    children: [
      { key: "/work-orders", label: "生产工单" },
      { key: "/operations", label: "工序任务" },
      { key: "/injection", label: "注塑生产批次", icon: <ExperimentOutlined /> },
      { key: "/stamping", label: "冲压生产批次", icon: <ToolOutlined /> },
    ],
  },
  {
    key: "/process",
    label: "工艺管理",
    icon: <BranchesOutlined />,
    children: [
      { key: "/process/boms", label: "BOM 管理" },
      { key: "/process/operations", label: "工序管理" },
      { key: "/process/routes", label: "工艺路线" },
      { key: "/process/versions", label: "路线版本 / 工序配置" },
    ],
  },
  {
    key: "/materials",
    label: "物料管理",
    icon: <InboxOutlined />,
    children: [
      { key: "/materials/lots", label: "物料批次" },
      { key: "/materials/issues", label: "工单领料" },
      { key: "/materials/returns", label: "退料" },
      { key: "/materials/stock-in", label: "成品/半成品入库" },
    ],
  },
  { key: "/molds", label: "模具管理", icon: <ControlOutlined /> },
  {
    key: "/trace",
    label: "质量与追溯",
    icon: <SearchOutlined />,
    children: [
      { key: "/quality", label: "过程检验 / 返工" },
      { key: "/trace/forward", label: "原材料正向追溯" },
      { key: "/trace/reverse", label: "生产批次反向追溯" },
      { key: "/trace/molds", label: "模具追溯" },
    ],
  },
  { key: "/report", label: "生产报表", icon: <BarChartOutlined /> },
  {
    key: "/master-data",
    label: "基础数据",
    icon: <DatabaseOutlined />,
    children: [
      { key: "/master-data/products", label: "产品 SKU" },
      { key: "/master-data/materials", label: "物料主数据" },
      { key: "/master-data/equipment", label: "设备台账" },
      { key: "/master-data/dictionaries", label: "班次 / 不良原因" },
    ],
  },
];

const SYSTEM_NAV_ITEMS: NavigationItem[] = [
  {
    key: "/system",
    label: "系统管理",
    icon: <SettingOutlined />,
    children: [
      { key: "/system/personnel", label: "人员管理" },
      { key: "/system/permissions", label: "权限管理" },
      { key: "/system/organization", label: "组织管理" },
    ],
  },
];

function isNavigationGroup(item: NavigationItem): item is NavigationGroup {
  return "children" in item;
}

function matchesPath(pathname: string, key: string) {
  return pathname === key || pathname.startsWith(`${key}/`);
}

function findActiveNavigation(
  pathname: string,
  items: NavigationItem[],
  section: NavigationSection
): ActiveNavigation | undefined {
  for (const item of items) {
    if (isNavigationGroup(item)) {
      const child = item.children.find((candidate) => matchesPath(pathname, candidate.key));
      if (child) {
        return {
          section,
          selectedKey: child.key,
          openKey: item.key,
          label: child.label,
          parentLabel: item.label,
        };
      }

      if (matchesPath(pathname, item.key)) {
        return {
          section,
          selectedKey: item.key,
          openKey: item.key,
          label: item.label,
        };
      }
    } else if (matchesPath(pathname, item.key)) {
      return { section, selectedKey: item.key, label: item.label };
    }
  }
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "/dashboard";
  const { locale, setLocale } = useLanguage();
  const activeNavigation = useMemo(
    () =>
      findActiveNavigation(pathname, SYSTEM_NAV_ITEMS, "system") ??
      findActiveNavigation(pathname, MAIN_NAV_ITEMS, "main") ?? {
        section: "main" as const,
        selectedKey: "/dashboard",
        label: "仪表盘",
      },
    [pathname]
  );
  const [mainOpenKeys, setMainOpenKeys] = useState<string[]>(
    activeNavigation.section === "main" && activeNavigation.openKey ? [activeNavigation.openKey] : []
  );
  const [systemOpenKeys, setSystemOpenKeys] = useState<string[]>(
    activeNavigation.section === "system" && activeNavigation.openKey ? [activeNavigation.openKey] : []
  );

  const text = (label: string) => (locale === "en" ? translateText(label) : label);

  useEffect(() => {
    setMainOpenKeys(
      activeNavigation.section === "main" && activeNavigation.openKey ? [activeNavigation.openKey] : []
    );
    setSystemOpenKeys(
      activeNavigation.section === "system" && activeNavigation.openKey ? [activeNavigation.openKey] : []
    );
  }, [pathname, activeNavigation.openKey, activeNavigation.section]);

  const createMenuItems = (items: NavigationItem[]) =>
    items.map((item) => {
      if (isNavigationGroup(item)) {
        return {
          key: item.key,
          icon: item.icon,
          label: text(item.label),
          children: item.children.map((child) => ({
            key: child.key,
            label: <Link href={child.key}>{text(child.label)}</Link>,
          })),
        };
      }

      return {
        key: item.key,
        icon: item.icon,
        label: <Link href={item.key}>{text(item.label)}</Link>,
      };
    });

  const pageTitle = activeNavigation.parentLabel
    ? `${text(activeNavigation.parentLabel)} / ${text(activeNavigation.label)}`
    : text(activeNavigation.label);

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Sider width={220} theme="dark" className="mes-sider">
        <div className="mes-brand">
          <span className="mes-brand-mark" aria-hidden="true" />
          <div className="mes-brand-name">{text("MES 制造执行")}</div>
        </div>
        <div className="mes-sidebar-navigation">
          <Menu
            className="mes-sidebar-menu mes-sidebar-main-menu"
            theme="dark"
            mode="inline"
            selectedKeys={activeNavigation.section === "main" ? [activeNavigation.selectedKey] : []}
            openKeys={mainOpenKeys}
            onOpenChange={setMainOpenKeys}
            items={createMenuItems(MAIN_NAV_ITEMS)}
            style={{ borderInlineEnd: "none" }}
          />
          <div className="mes-sidebar-system-area">
            <Menu
              className="mes-sidebar-menu mes-sidebar-system-menu"
              aria-label={text("系统管理")}
              theme="dark"
              mode="inline"
              selectedKeys={activeNavigation.section === "system" ? [activeNavigation.selectedKey] : []}
              openKeys={systemOpenKeys}
              onOpenChange={setSystemOpenKeys}
              items={createMenuItems(SYSTEM_NAV_ITEMS)}
              style={{ borderInlineEnd: "none" }}
            />
          </div>
        </div>
      </Sider>
      <Layout>
        <Header className="mes-header">
          <div className="mes-page-title">{pageTitle}</div>
          <div className="mes-header-actions">
            <Segmented
              aria-label={text("界面语言")}
              size="small"
              value={locale}
              onChange={(value) => setLocale(value as "zh" | "en")}
              options={[{ value: "zh", label: "中文" }, { value: "en", label: "English" }]}
            />
            <div className="mes-current-user" aria-label={`${text("当前登录用户")}：Somchai`}>
              <Avatar size={30} icon={<UserOutlined />} className="mes-current-user-avatar" />
              <div className="mes-current-user-copy">
                <span className="mes-current-user-name">Somchai</span>
                <span className="mes-current-user-role">{text("系统管理员")}</span>
              </div>
            </div>
          </div>
        </Header>
        <Content className="mes-content">{children}</Content>
      </Layout>
    </Layout>
  );
}
