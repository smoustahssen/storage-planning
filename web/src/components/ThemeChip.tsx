
export const THEME_COLORS: Record<string, string> = {
  "KTLO":        "#5a5648",
  "Reliability": "#1f6f68",
  "Security":    "#c2342b",
  "Cust Exp":    "#9a5b2e",
  "Efficiency":  "#6b6f1f",
};

export const TEAM_COLORS: Record<string, string> = {
  "RDB-KV": "#1f6f68",
  "RDB-PG": "#3a6ea5",
  "EaaS":   "#9a5b2e",
  "RaaS":   "#6b6f1f",
  "QaaS":   "#8a3d6b",
  "R3":     "#2e6b6b",
  "SIM":    "#7a4a8a",
  "MS SQL": "#a8552f",
  "All":    "#5a6648",
};

export function ThemeChip({ theme }: { theme: string }) {
  const color = THEME_COLORS[theme] ?? "#5a5648";
  return (
    <span
      className="themetag"
      style={{ background: color + "22", color }}
    >
      {theme}
    </span>
  );
}

export function TeamBadge({ team }: { team: string }) {
  const color = TEAM_COLORS[team] ?? "#5a6648";
  return (
    <span className="team-badge" style={{ background: color }}>
      {team}
    </span>
  );
}
