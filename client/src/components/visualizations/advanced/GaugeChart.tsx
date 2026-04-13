import ReactECharts from 'echarts-for-react';
import type { EChartsOption } from 'echarts';
import type { VisualizationFormatting, GaugeOptions } from '@/../../shared/types/visualization';

interface GaugeChartProps {
  data: any[];
  title?: string;
  subtitle?: string;
  formatting?: VisualizationFormatting;
  options: GaugeOptions;
}

export default function GaugeChart({
  data,
  title,
  subtitle,
  formatting,
  options
}: GaugeChartProps) {
  
  if (!data || data.length === 0) {
    return (
      <div className="text-muted-foreground p-4">
        No data available
      </div>
    );
  }

  const value = data[0].value ?? data[0].amount ?? 0;
  const { min, max, target, thresholds, showPointer = true } = options;
  
  const formatValue = (val: number) => {
    if (!formatting) return val.toLocaleString();
    
    const { valueFormat, currency = 'USD', decimals = 0 } = formatting;
    
    if (valueFormat === 'currency') {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency,
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
      }).format(val);
    }
    
    if (valueFormat === 'percentage') {
      return `${(val * 100).toFixed(decimals)}%`;
    }
    
    return val.toFixed(decimals);
  };

  // Build color stops from thresholds
  const axisLine = thresholds && thresholds.length > 0
    ? {
        lineStyle: {
          width: 30,
          color: thresholds.map((t, index) => {
            const nextThreshold = thresholds[index + 1];
            const end = nextThreshold ? ((nextThreshold.value - min) / (max - min)) : 1;
            return [end, t.color] as [number, string];
          })
        }
      }
    : {
        lineStyle: {
          width: 30,
          color: [
            [0.3, 'hsl(var(--destructive))'] as [number, string],
            [0.7, 'hsl(var(--warning))'] as [number, string],
            [1, 'hsl(var(--success))'] as [number, string]
          ]
        }
      };

  const chartOption: EChartsOption = {
    title: {
      text: title,
      subtext: subtitle,
      left: 'center',
      textStyle: {
        color: 'hsl(var(--foreground))',
        fontSize: 16,
        fontWeight: 'bold'
      },
      subtextStyle: {
        color: 'hsl(var(--muted-foreground))',
        fontSize: 12
      }
    },
    series: [
      {
        type: 'gauge',
        min,
        max,
        startAngle: 200,
        endAngle: -20,
        axisLine,
        pointer: {
          show: showPointer,
          length: '60%',
          width: 6,
          itemStyle: {
            color: 'hsl(var(--foreground))'
          }
        },
        axisTick: {
          distance: -30,
          length: 8,
          lineStyle: {
            color: 'hsl(var(--muted))',
            width: 2
          }
        },
        splitLine: {
          distance: -30,
          length: 15,
          lineStyle: {
            color: 'hsl(var(--muted))',
            width: 3
          }
        },
        axisLabel: {
          distance: -50,
          color: 'hsl(var(--foreground))',
          fontSize: 12,
          formatter: (value: number) => {
            if (formatting?.valueFormat === 'percentage') {
              return `${value}%`;
            }
            return String(value);
          }
        },
        detail: {
          valueAnimation: true,
          formatter: (val: number) => formatValue(val),
          color: 'hsl(var(--foreground))',
          fontSize: 24,
          fontWeight: 'bold',
          offsetCenter: [0, '70%']
        },
        data: [
          {
            value,
            name: data[0].label || ''
          }
        ],
        // Add target marker if specified
        markPoint: target ? {
          data: [
            {
              name: 'Target',
              value: target,
              xAxis: target,
              yAxis: 0,
              itemStyle: {
                color: 'hsl(var(--primary))'
              }
            }
          ]
        } : undefined
      }
    ]
  };

  return (
    <div className="w-full" data-testid="chart-gauge">
      <ReactECharts 
        option={chartOption} 
        style={{ height: '400px', width: '100%' }}
        opts={{ renderer: 'canvas' }}
      />
      {target && (
        <div className="text-center text-sm text-muted-foreground mt-2">
          Target: {formatValue(target)}
        </div>
      )}
    </div>
  );
}
