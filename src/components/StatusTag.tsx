import { Tag } from "antd";
import { STATUS_TONE } from "@/lib/constants";
import { SEMANTIC_COLORS } from "@/app/theme";

const TONE_COLOR: Record<string, string> = {
  good: SEMANTIC_COLORS.good,
  warn: SEMANTIC_COLORS.warn,
  critical: SEMANTIC_COLORS.critical,
  info: SEMANTIC_COLORS.info,
  default: SEMANTIC_COLORS.default,
};

export function StatusTag({ status }: { status: string }) {
  const tone = STATUS_TONE[status] ?? "default";
  const color = TONE_COLOR[tone];
  return (
    <Tag
      style={{
        color,
        background: `${color}18`,
        borderColor: `${color}40`,
        fontWeight: 500,
      }}
    >
      {status}
    </Tag>
  );
}
