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

  return (
    <div className="w-full" data-testid="chart-financial-bar">
      {title && (
        <h3 className="text-lg font-semibold mb-4 text-center">{title}</h3>
      )}
      <ChartContainer config={chartConfig} className="h-[400px] w-full">
        <BarChart
          data={data}
          layout={layout}
          margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          {layout === 'horizontal' ? (
            <>
              <XAxis
                dataKey="name"
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
              <YAxis type="category" dataKey="name" />
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
