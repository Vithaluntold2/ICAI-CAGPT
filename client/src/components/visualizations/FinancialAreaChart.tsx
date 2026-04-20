import { AreaChart, Area, XAxis, YAxis, CartesianGrid } from 'recharts';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from '@/components/ui/chart';

interface DataPoint {
  name: string;
  [key: string]: string | number;
}

interface FinancialAreaChartProps {
  data: DataPoint[];
  areas: Array<{
    dataKey: string;
    name: string;
    color: string;
  }>;
  title?: string;
  xAxisLabel?: string;
  yAxisLabel?: string;
  formatValue?: (value: number) => string;
  stacked?: boolean;
}

export default function FinancialAreaChart({
  data,
  areas,
  title,
  xAxisLabel,
  yAxisLabel,
  formatValue = (value) => `$${value.toLocaleString()}`,
  stacked = false,
}: FinancialAreaChartProps) {
  const chartConfig: ChartConfig = areas.reduce<ChartConfig>((acc, area) => {
    acc[area.dataKey] = { label: area.name, color: area.color };
    return acc;
  }, {});

  return (
    <div className="w-full" data-testid="chart-financial-area">
      {title && (
        <h3 className="text-lg font-semibold mb-4 text-center">{title}</h3>
      )}
      <ChartContainer config={chartConfig} className="h-[400px] w-full">
        <AreaChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          {/* Soft gradient fill per series. `--color-<key>` resolves through
              ChartContainer's CSS vars, so light/dark switches reflow the
              gradient automatically. */}
          <defs>
            {areas.map((area) => (
              <linearGradient key={area.dataKey} id={`color-${area.dataKey}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={`var(--color-${area.dataKey})`} stopOpacity={0.8} />
                <stop offset="95%" stopColor={`var(--color-${area.dataKey})`} stopOpacity={0.1} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis
            dataKey="name"
            label={xAxisLabel ? { value: xAxisLabel, position: 'insideBottom', offset: -5 } : undefined}
          />
          <YAxis
            label={yAxisLabel ? { value: yAxisLabel, angle: -90, position: 'insideLeft' } : undefined}
            tickFormatter={formatValue}
          />
          <ChartTooltip
            content={<ChartTooltipContent formatter={(value) => formatValue(Number(value))} />}
          />
          <ChartLegend content={<ChartLegendContent />} />
          {areas.map((area) => (
            <Area
              key={area.dataKey}
              type="monotone"
              dataKey={area.dataKey}
              name={area.name}
              stroke={`var(--color-${area.dataKey})`}
              fillOpacity={1}
              fill={`url(#color-${area.dataKey})`}
              stackId={stacked ? "1" : undefined}
            />
          ))}
        </AreaChart>
      </ChartContainer>
    </div>
  );
}
