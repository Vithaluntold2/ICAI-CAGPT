import { PieChart, Pie, Cell } from 'recharts';
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
  value: number;
  color?: string;
}

interface FinancialPieChartProps {
  data: DataPoint[];
  title?: string;
  formatValue?: (value: number) => string;
  showPercentage?: boolean;
}

const DEFAULT_COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
];

export default function FinancialPieChart({
  data,
  title,
  formatValue = (value) => `$${value.toLocaleString()}`,
  showPercentage = true,
}: FinancialPieChartProps) {
  const total = data.reduce((sum, item) => sum + item.value, 0);

  // Some series names the AI emits are full sentences ("turnover below ₹2
  // crore - Due Date"). Cap at a readable length so extreme outliers can't
  // defeat the chart's horizontal margin and clip on the card edge. Hover
  // tooltip still shows the full name.
  const truncate = (s: string, max = 32) =>
    s.length > max ? s.slice(0, max - 1).trimEnd() + "…" : s;

  const renderLabel = (entry: DataPoint) => {
    const percentage = ((entry.value / total) * 100).toFixed(1);
    const name = truncate(entry.name);
    return showPercentage ? `${name} (${percentage}%)` : name;
  };

  // Pie slices are keyed by `name` (the slice label), not a series dataKey.
  // Build a chart config entry per slice so ChartContainer can expose
  // `--color-<safeName>` CSS vars and the legend content can map labels.
  const toSafeKey = (s: string) => s.replace(/[^a-z0-9]+/gi, "_").toLowerCase();
  const chartConfig: ChartConfig = data.reduce<ChartConfig>((acc, item, idx) => {
    acc[toSafeKey(item.name)] = {
      label: item.name,
      color: item.color || DEFAULT_COLORS[idx % DEFAULT_COLORS.length],
    };
    return acc;
  }, {});

  return (
    <div className="w-full" data-testid="chart-financial-pie">
      {title && (
        <h3 className="text-lg font-semibold mb-4 text-center">{title}</h3>
      )}
      <ChartContainer config={chartConfig} className="h-[400px] w-full">
        {/* Horizontal margin reserves room for the external label lines
            ("Electronic Cash Ledger", "turnover below ₹2 crore", etc.) so
            they don't spill past the SVG viewport and get clipped by the
            card edges. Radius is a percentage so the pie auto-scales with
            container width instead of staying locked at 120px. */}
        <PieChart margin={{ top: 16, right: 96, bottom: 16, left: 96 }}>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            labelLine={true}
            label={renderLabel}
            outerRadius="70%"
            fill="#8884d8"
            dataKey="value"
            nameKey="name"
          >
            {data.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={entry.color || DEFAULT_COLORS[index % DEFAULT_COLORS.length]}
              />
            ))}
          </Pie>
          <ChartTooltip
            content={<ChartTooltipContent formatter={(value) => formatValue(Number(value))} />}
          />
          <ChartLegend content={<ChartLegendContent nameKey="name" />} />
        </PieChart>
      </ChartContainer>
    </div>
  );
}
