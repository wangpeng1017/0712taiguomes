import type { Metadata } from "next";
import { AntdRegistry } from "@ant-design/nextjs-registry";
import { ConfigProvider } from "antd";
import zhCN from "antd/locale/zh_CN";
import { themeConfig } from "./theme";
import { AppShell } from "@/components/layout/AppShell";
import "./globals.css";

export const metadata: Metadata = {
  title: "轻量 MES · 泰国工厂",
  description: "泰国工厂汽车电子结构件轻量MES一期 Demo",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>
        <AntdRegistry>
          <ConfigProvider theme={themeConfig} locale={zhCN}>
            <AppShell>{children}</AppShell>
          </ConfigProvider>
        </AntdRegistry>
      </body>
    </html>
  );
}
