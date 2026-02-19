import { ResponsiveContainer } from 'recharts';
import type { ReactElement } from 'react';

export interface ChartConfig {
  [key: string]: {
    label: string;
    color: string;
  };
}

interface ChartContainerProps {
  config: ChartConfig;
  className?: string;
  children: ReactElement;
}

export function ChartContainer({ config, className, children }: ChartContainerProps) {
  const cssVars: Record<string, string> = {};
  for (const [key, value] of Object.entries(config)) {
    if (value.color) {
      cssVars[`--color-${key}` as string] = value.color;
    }
  }

  return (
    <div className={className} style={cssVars as React.CSSProperties}>
      <ResponsiveContainer width="100%" height="100%">
        {children}
      </ResponsiveContainer>
    </div>
  );
}
