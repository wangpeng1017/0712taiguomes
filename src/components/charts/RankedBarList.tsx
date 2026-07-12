import { SEMANTIC_COLORS } from "@/app/theme";

export function RankedBarList({
  data,
  color = SEMANTIC_COLORS.info,
}: {
  data: { label: string; value: number }[];
  color?: string;
}) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {data.map((d) => (
        <div key={d.label} style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 72, fontSize: 12, color: "#4b5563", textAlign: "right", flexShrink: 0 }}>
            {d.label}
          </div>
          <div style={{ flex: 1, background: "#f2f4f6", borderRadius: 3, height: 14, position: "relative" }}>
            <div
              style={{
                width: `${(d.value / max) * 100}%`,
                background: color,
                height: "100%",
                borderRadius: 3,
                minWidth: 4,
              }}
            />
          </div>
          <div className="tabular-nums" style={{ width: 36, fontSize: 12, color: "#12181f", fontWeight: 600 }}>
            {d.value}
          </div>
        </div>
      ))}
    </div>
  );
}
