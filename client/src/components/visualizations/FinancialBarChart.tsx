import { BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
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

interface FinancialBarChartProps {
  data: DataPoint[];
  bars: Array<{
    dataKey: string;
    name: string;
    color: string;
  }>;
  title?: string;
  xAxisLabel?: string;
  yAxisLabel?: string;
  formatValue?: (value: number) => string;
  layout?: 'horizontal' | 'vertical';
}

// Truncate category/series labels so a full-sentence name from the AI
// ("turnover below ₹2 crore - Due Date") can't defeat the axis margin and
// clip against the card edge. Full text stays visible in the hover tooltip.
const truncateTick = (s: string | number, max = 20) => {
  const str = String(s);
  return str.length > max ? str.slice(0, max - 1).trimEnd() + '…' : str;
};

export default function FinancialBarChart({
  data,
  bars,
  title,
  xAxisLabel,
  yAxisLabel,
  formatValue = (value) => `$${value.toLocaleString()}`,
  layout = 'horizontal',
}: FinancialBarChartProps) {
  const chartConfig: ChartConfig = bars.reduce<ChartConfig>((acc, bar) => {
    acc[bar.dataKey] = { label: bar.name, color: bar.color };
    return acc;
  }, {});

  // Does this dataset have any long category names? If so, rotate ticks and
  // reserve vertical room. Short labels stay horizontal to save space.
  const hasLongLabels = data.some(d => String(d.name ?? '').length > 8);

  return (
    <div className="w-full" data-testid="chart-financial-bar">
      {title && (
        <h3 className="text-lg font-semibold mb-4 text-center">{title}</h3>
      )}
      <ChartContainer config={chartConfig} className="h-[400px] w-full">
        <BarChart
          data={data}
          layout={layout}
          // Extra bottom room for rotated X-axis labels. Reserve more in the
          // horizontal layout (where X holds the category names) than the
          // vertical layout (where X is numeric and tidy).
          margin={{
            top: 5,
            right: 30,
            left: 20,
            bottom: layout === 'horizontal' && hasLongLabels ? 60 : 5,
          }}
        >
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          {layout === 'horizontal' ? (
            <>
              <XAxis
                dataKey="name"
                // interval={0} forces Recharts to render every tick —
                // without it the library silently drops every other label
                // at narrow widths, making chunks of the X axis vanish.
                interval={0}
                // Rotate when any label is long enough to likely collide
                // with its neighbours. 10pt vertical offset keeps the
                // rotated tail clear of the tick line.
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
            </>
          ) : (
            <>
              <XAxis type="number" tickFormatter={formatValue} />
              <YAxis
                type="category"
                dataKey="name"
                interval={0}
                width={110}
                tickFormatter={(v) => truncateTick(v, 16)}
              />
            </>
          )}
          <ChartTooltip
            content={<ChartTooltipContent formatter={(value) => formatValue(Number(value))} />}
          />
          <ChartLegend content={<ChartLegendContent />} />
          {bars.map((bar) => (
            <Bar
              key={bar.dataKey}
              dataKey={bar.dataKey}
              name={bar.name}
              fill={`var(--color-${bar.dataKey})`}
              radius={[4, 4, 0, 0]}
            />
          ))}
        </BarChart>
      </ChartContainer>
    </div>
  );
}
