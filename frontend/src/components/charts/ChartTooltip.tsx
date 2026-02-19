interface PayloadEntry {
  color?: string;
  name?: string;
  value?: number | string;
}

interface ChartTooltipProps {
  active?: boolean;
  payload?: PayloadEntry[];
  label?: string | number;
  hideLabel?: boolean;
  labelFormatter?: (label: string) => string;
  valueFormatter?: (value: number) => string;
}

export function ChartTooltipContent({
  active,
  payload,
  label,
  hideLabel = false,
  valueFormatter = (v) => String(v),
  labelFormatter = (l) => l,
}: ChartTooltipProps) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 shadow-lg">
      {!hideLabel && (
        <p className="mb-1 text-xs font-medium text-gray-500">
          {labelFormatter(String(label))}
        </p>
      )}
      <div className="space-y-1">
        {payload.map((entry: PayloadEntry, index: number) => (
          <div key={index} className="flex items-center gap-2 text-sm">
            <div
              className="h-2.5 w-2.5 rounded-full shrink-0"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-gray-500">{entry.name}:</span>
            <span className="font-semibold tabular-nums text-gray-900">
              {valueFormatter(Number(entry.value))}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ChartLegend({ items, onClick }: { items: { label: string; color: string }[]; onClick?: (label: string) => void }) {
  return (
    <div className="flex items-center justify-center gap-4 mt-3">
      {items.map((item) => (
        <div
          key={item.label}
          className={`flex items-center gap-1.5 ${onClick ? 'cursor-pointer hover:opacity-75' : ''}`}
          onClick={onClick ? () => onClick(item.label) : undefined}
        >
          <div
            className="h-2.5 w-2.5 rounded-full shrink-0"
            style={{ backgroundColor: item.color }}
          />
          <span className="text-xs text-gray-500">{item.label}</span>
        </div>
      ))}
    </div>
  );
}
