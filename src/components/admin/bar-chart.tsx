/** Minimal server-rendered bar chart (one series), scaled to its max value. */
export function BarChart({
  data,
  format,
  height = 160,
}: {
  data: { label: string; value: number }[];
  format: (v: number) => string;
  height?: number;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const w = 100 / Math.max(1, data.length);
  const step = Math.max(1, Math.ceil(data.length / 8)); // ~8 x-labels max
  return (
    <div>
      <div className="relative" style={{ height }}>
        <div className="absolute inset-x-0 top-0 border-t border-dashed border-border" />
        <span className="absolute -top-2.5 right-0 bg-card px-1 text-[10px] text-muted-foreground">{format(max)}</span>
        <div className="absolute inset-x-0 bottom-0 border-t border-border" />
        <div className="absolute inset-0 flex items-end">
          {data.map((d, i) => (
            <div key={i} className="flex h-full items-end justify-center" style={{ width: `${w}%` }}>
              <div
                className="w-[70%] rounded-t-sm bg-primary/80"
                style={{ height: `${d.value === 0 ? 0 : Math.max(2, (d.value / max) * 100)}%` }}
                title={`${d.label}: ${format(d.value)}`}
              />
            </div>
          ))}
        </div>
      </div>
      <div className="mt-1 flex text-[10px] text-muted-foreground">
        {data.map((d, i) => (
          <span key={i} className="truncate text-center" style={{ width: `${w}%` }}>
            {i % step === 0 ? d.label : ''}
          </span>
        ))}
      </div>
    </div>
  );
}
