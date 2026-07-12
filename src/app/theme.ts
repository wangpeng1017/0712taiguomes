import type { ThemeConfig } from "antd";

// 工业风主题 token：石墨侧边栏 + 安全橙主色 + 语义状态色（good/warn/critical/info 独立于主色）。
// 校验过 CVD 可访问性（见 dataviz skill 的 validate_palette 结果）。
export const themeConfig: ThemeConfig = {
  token: {
    colorPrimary: "#e0650f",
    colorSuccess: "#1f9d55",
    colorWarning: "#c9860a",
    colorError: "#dc3545",
    colorInfo: "#3b82c4",
    colorBgLayout: "#f2f4f6",
    colorBgContainer: "#ffffff",
    borderRadius: 6,
    fontSize: 14,
    wireframe: false,
  },
  components: {
    Layout: {
      siderBg: "#1a232c",
      headerBg: "#ffffff",
      bodyBg: "#f2f4f6",
    },
    Menu: {
      darkItemBg: "#1a232c",
      darkItemSelectedBg: "#2a3542",
      darkItemHoverBg: "#22303c",
      darkItemColor: "#c3ccd6",
      darkItemSelectedColor: "#ffffff",
    },
    Table: {
      headerBg: "#f7f8fa",
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
