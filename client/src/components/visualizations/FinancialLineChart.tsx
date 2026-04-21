import { LineChart, Line, XAxis, YAxis, CartesianGrid } from 'recharts';
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

interface FinancialLineChartProps {
  data: DataPoint[];
  lines: Array<{
    dataKey: string;
    name: string;
    color: string;
  }>;
  title?: string;
  xAxisLabel?: string;
  yAxisLabel?: string;
  formatValue?: (value: number) => string;
}

// See FinancialBarChart for the rationale behind these truncation + axis
// tweaks. Line charts are more commonly short-label (months, quarters) but
// the AI occasionally emits sentence-level x-axis names that would collide
// without rotation.
const truncateTick = (s: string | number, max = 20) => {
  const str = String(s);
  return str.length > max ? str.slice(0, max - 1).trimEnd() + '…' : str;
};

export default function FinancialLineChart({
  data,
  lines,
  title,
  xAxisLabel,
  yAxisLabel,
  formatValue = (value) => `$${value.toLocaleString()}`,
}: FinancialLineChartProps) {
  // ChartContainer auto-derives colors + labels from the config, and exposes
  // them as `--color-<dataKey>` CSS vars so Recharts series can reference
  // them without being re-wired on theme toggles.
  const chartConfig: ChartConfig = lines.reduce<ChartConfig>((acc, line) => {
    acc[line.dataKey] = { label: line.name, color: line.color };
    return acc;
  }, {});

  const hasLongLabels = data.some(d => String(d.name ?? '').length > 8);

  return (
    <div className="w-full" data-testid="chart-financial-line">
      {title && (
        <h3 className="text-lg font-semibold mb-4 text-center">{title}</h3>
      )}
      <ChartContainer config={chartConfig} className="h-[400px] w-full">
        <LineChart
          data={data}
          margin={{ top: 5, right: 30, left: 20, bottom: hasLongLabels ? 60 : 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis
            dataKey="name"
            // Ensure every tick renders instead of Recharts silently
            // dropping every-other label at narrow widths.
            interval={0}
            angle={hasLongLabels ? -35 : 0}
            textAnchor={hasLongLabels ? 'end' : 'middle'}
            height={hasLongLabels ? 70 : 30}
            tickFormatter={(v) => truncateTick(v)}
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
          {lines.map((line) => (
            <Line
              key={line.dataKey}
              type="monotone"
              dataKey={line.dataKey}
              name={line.name}
              stroke={`var(--color-${line.dataKey})`}
              strokeWidth={2}
              dot={{ r: 4 }}
              activeDot={{ r: 6 }}
            />
          ))}
        </LineChart>
      </ChartContainer>
    </div>
  );
}
