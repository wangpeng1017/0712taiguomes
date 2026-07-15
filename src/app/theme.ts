import type { ThemeConfig } from "antd";

// 工业控制台主题：石墨侧边栏 + 安全橙主操作 + Slate 中性色。
// 红色仅用于错误和阻断状态，不用于操作按钮。
export const themeConfig: ThemeConfig = {
  token: {
    colorPrimary: "#c6540d",
    colorPrimaryHover: "#ad4609",
    colorPrimaryActive: "#913a08",
    colorSuccess: "#1f9d55",
    colorWarning: "#c9860a",
    colorError: "#dc3545",
    colorInfo: "#3b82c4",
    colorText: "#17202a",
    colorTextSecondary: "#5b6876",
    colorTextTertiary: "#64748b",
    colorBorder: "#cfd6df",
    colorBorderSecondary: "#e2e7ed",
    colorBgLayout: "#f3f5f7",
    colorBgContainer: "#ffffff",
    borderRadius: 6,
    borderRadiusLG: 8,
    controlHeight: 34,
    controlHeightSM: 28,
    fontSize: 14,
    boxShadowSecondary: "0 10px 28px rgba(23, 32, 42, 0.10)",
    wireframe: false,
  },
  components: {
    Layout: {
      siderBg: "#30343b",
      headerBg: "#ffffff",
      bodyBg: "#f3f5f7",
    },
    Menu: {
      darkItemBg: "#30343b",
      darkItemSelectedBg: "#24303b",
      darkItemHoverBg: "#39424d",
      darkItemColor: "#c9d1da",
      darkItemSelectedColor: "#ffffff",
      itemBorderRadius: 4,
      itemMarginInline: 8,
    },
    Table: {
      headerBg: "#f1f4f7",
      headerColor: "#334155",
      rowHoverBg: "#fff7ed",
      borderColor: "#e2e7ed",
    },
    Card: {
      headerBg: "#ffffff",
    },
  },
};

// 语义状态色（供 Tag/进度条等直接使用十六进制，不经过 antd token 的场景）
export const SEMANTIC_COLORS = {
  good: "#1f9d55",
  warn: "#c9860a",
  critical: "#dc3545",
  info: "#3b82c4",
  default: "#8c98a4",
} as const;
