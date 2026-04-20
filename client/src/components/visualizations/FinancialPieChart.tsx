import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';

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
  showPercentage = true
}: FinancialPieChartProps) {
  const total = data.reduce((sum, item) => sum + item.value, 0);

  const renderLabel = (entry: DataPoint) => {
    const percentage = ((entry.value / total) * 100).toFixed(1);
    return showPercentage ? `${entry.name} (${percentage}%)` : entry.name;
  };

  return (
    <div className="w-full" data-testid="chart-financial-pie">
      {title && (
        <h3 className="text-lg font-semibold mb-4 text-center">{title}</h3>
      )}
      <ResponsiveContainer width="100%" height={400}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            labelLine={true}
            label={renderLabel}
            outerRadius={120}
            fill="#8884d8"
            dataKey="value"
          >
            {data.map((entry, index) => (
              <Cell 
                key={`cell-${index}`} 
                fill={entry.color || DEFAULT_COLORS[index % DEFAULT_COLORS.length]} 
              />
            ))}
          </Pie>
          <Tooltip 
            formatter={formatValue}
            contentStyle={{ 
              backgroundColor: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '6px'
            }}
          />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
