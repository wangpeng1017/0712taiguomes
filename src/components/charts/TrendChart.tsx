"use client";

import { useState } from "react";

type Point = { label: string; value: number };

export function TrendChart({
  data,
  kind,
  color,
  unit = "",
  height = 160,
  formatValue = (v: number) => v.toLocaleString("zh-CN"),
}: {
  data: Point[];
  kind: "bar" | "line";
  color: string;
  unit?: string;
  height?: number;
  formatValue?: (v: number) => string;
}) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const width = 560;
  const padL = 8;
  const padR = 8;
  const padT = 14;
  const padB = 24;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;
  const maxVal = Math.max(...data.map((d) => d.value), 1);
  const niceMax = maxVal * 1.15;
  const stepX = data.length > 1 ? plotW / (data.length - 1) : plotW;
  const barGap = 10;
  const barW = data.length > 0 ? plotW / data.length - barGap : plotW;

  const xFor = (i: number) => padL + i * stepX;
  const yFor = (v: number) => padT + plotH - (v / niceMax) * plotH;

  const gridLines = [0, 0.25, 0.5, 0.75, 1];

  const linePath = data
    .map((d, i) => `${i === 0 ? "M" : "L"} ${xFor(i)} ${yFor(d.value)}`)
    .join(" ");
  const areaPath =
    data.length > 0
      ? `${linePath} L ${xFor(data.length - 1)} ${padT + plotH} L ${xFor(0)} ${padT + plotH} Z`
      : "";

  const hovered = hoverIdx !== null ? data[hoverIdx] : null;

  return (
    <div style={{ position: "relative" }}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        style={{ width: "100%", height, overflow: "visible" }}
        onMouseLeave={() => setHoverIdx(null)}
      >
        {gridLines.map((g) => (
          <line
            key={g}
            x1={padL}
            x2={width - padR}
            y1={padT + plotH * (1 - g)}
            y2={padT + plotH * (1 - g)}
            stroke="#e2e6ea"
            strokeWidth={1}
          />
        ))}

        {kind === "bar" &&
          data.map((d, i) => {
            const x = padL + i * (plotW / data.length) + barGap / 2;
            const y = yFor(d.value);
            const h = padT + plotH - y;
            const active = hoverIdx === i;
            return (
              <rect
                key={d.label}
                x={x}
                y={y}
                width={barW}
                height={Math.max(h, 2)}
                rx={3}
                fill={color}
                opacity={active || hoverIdx === null ? 1 : 0.45}
              />
            );
          })}

        {kind === "line" && (
          <>
            <path d={areaPath} fill={color} opacity={0.12} />
            <path d={linePath} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            {data.map((d, i) => (
              <circle
                key={d.label}
                cx={xFor(i)}
                cy={yFor(d.value)}
                r={hoverIdx === i ? 5 : 3}
                fill="#fff"
                stroke={color}
                strokeWidth={2}
              />
            ))}
          </>
        )}

        {data.map((d, i) => (
          <text
            key={d.label}
            x={kind === "bar" ? padL + i * (plotW / data.length) + (plotW / data.length) / 2 : xFor(i)}
            y={height - 6}
            fontSize={11}
            fill="#8c98a4"
            textAnchor="middle"
          >
            {d.label}
          </text>
        ))}

        {/* hover hit targets */}
        {data.map((d, i) => (
          <rect
            key={`hit-${d.label}`}
            x={kind === "bar" ? padL + i * (plotW / data.length) : xFor(i) - stepX / 2}
            y={0}
            width={kind === "bar" ? plotW / data.length : stepX}
            height={height}
            fill="transparent"
            onMouseEnter={() => setHoverIdx(i)}
          />
        ))}
      </svg>
      {hovered && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: `${(xFor(hoverIdx!) / width) * 100}%`,
            transform: "translate(-50%, -100%)",
            background: "#12181f",
            color: "#fff",
            fontSize: 12,
            padding: "4px 8px",
            borderRadius: 4,
            whiteSpace: "nowrap",
            pointerEvents: "none",
          }}
        >
          {hovered.label} · {formatValue(hovered.value)}
          {unit}
        </div>
      )}
    </div>
  );
}
