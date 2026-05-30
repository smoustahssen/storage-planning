
interface CapacityMeterProps {
  allocated: number;
  capacity: number;
  label?: string;
  meta?: string;
}

export function CapacityMeter({ allocated, capacity, label, meta }: CapacityMeterProps) {
  const pct    = capacity > 0 ? Math.min((allocated / capacity) * 100, 100) : 0;
  const over   = allocated > capacity;
  const gap    = capacity - allocated;

  return (
    <div className="capwrap">
      <div className="caprow">
        <div>
          <div className="capnum">
            {allocated.toFixed(1)}<small> / {capacity.toFixed(1)} HC</small>
          </div>
          {meta && <div className="capmeta">{meta}</div>}
        </div>
        <div className="capbarwrap">
          <div className={`capbar${over ? " over" : ""}`}>
            <div className="fill" style={{ width: `${pct}%` }} />
          </div>
          <div className="caplbls">
            <span>{label ?? "Allocated"}</span>
            {over
              ? <span style={{ color: "var(--red)", fontWeight: 600 }}>+{(-gap).toFixed(1)} over capacity</span>
              : <span>{gap.toFixed(1)} HC available</span>
            }
          </div>
        </div>
        {over && (
          <div className="overflag" style={{ background: "var(--red-soft)", color: "var(--red)" }}>
            Over capacity
          </div>
        )}
      </div>
    </div>
  );
}
