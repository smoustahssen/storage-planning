import { THEME_COLORS } from "./ThemeChip.js";

interface DonutProps {
  data: Record<string, number>;
  total: number;
}

export function Donut({ data, total }: DonutProps) {
  const entries = Object.entries(data).filter(([, v]) => v > 0);
  const sum = entries.reduce((s, [, v]) => s + v, 0);

  // Build conic-gradient segments
  let cumPct = 0;
  const segments: string[] = [];
  for (const [theme, hc] of entries) {
    const pct = sum > 0 ? (hc / sum) * 100 : 0;
    const color = THEME_COLORS[theme] ?? "#9a9384";
    segments.push(`${color} ${cumPct.toFixed(2)}% ${(cumPct + pct).toFixed(2)}%`);
    cumPct += pct;
  }
  const gradient = segments.length
    ? `conic-gradient(${segments.join(", ")})`
    : "conic-gradient(#ece8df 0% 100%)";

  return (
    <div className="donutwrap">
      <div
        className="donut"
        style={{ background: gradient }}
      >
        <div className="ctr">
          <b>{total.toFixed(1)}</b>
          <span>HC</span>
        </div>
      </div>
      <div className="legend">
        {entries.map(([theme, hc]) => (
          <div key={theme} className="lgrow">
            <div className="sw" style={{ background: THEME_COLORS[theme] ?? "#9a9384" }} />
            <span className="nm">{theme}</span>
            <span className="vv">
              <b>{hc.toFixed(1)}</b> HC &nbsp;
              {sum > 0 ? `${((hc / sum) * 100).toFixed(0)}%` : "—"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
