import type { Metadata } from "next";
import { AntdRegistry } from "@ant-design/nextjs-registry";
import { AppShell } from "@/components/layout/AppShell";
import { LanguageProvider } from "@/components/layout/LanguageProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "MES 制造执行",
  description: "Manufacturing Execution System",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body>
        <AntdRegistry>
          <LanguageProvider>
            <AppShell>{children}</AppShell>
          </LanguageProvider>
        </AntdRegistry>
      </body>
    </html>
  );
}
