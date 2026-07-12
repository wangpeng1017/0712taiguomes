import { SEMANTIC_COLORS } from "@/app/theme";

export function MoldLifeMeter({ rate, warnThreshold = 0.8 }: { rate: number; warnThreshold?: number }) {
  const pct = Math.round(rate * 1000) / 10;
  const color =
    rate >= 1 ? SEMANTIC_COLORS.critical : rate >= warnThreshold ? SEMANTIC_COLORS.warn : SEMANTIC_COLORS.good;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 140 }}>
      <div style={{ flex: 1, background: "#eef1f3", borderRadius: 3, height: 8, position: "relative" }}>
        <div
          style={{
            width: `${Math.min(pct, 100)}%`,
            background: color,
            height: "100%",
            borderRadius: 3,
          }}
        />
      </div>
      <span className="tabular-nums" style={{ fontSize: 12, fontWeight: 600, color, width: 44 }}>
        {pct}%
      </span>
    </div>
  );
}
