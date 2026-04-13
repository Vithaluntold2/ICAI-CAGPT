import ReactECharts from 'echarts-for-react';
import type { EChartsOption } from 'echarts';
import type { VisualizationFormatting, WaterfallOptions } from '@/../../shared/types/visualization';

interface WaterfallChartProps {
  data: any[];
  title?: string;
  subtitle?: string;
  formatting?: VisualizationFormatting;
  options?: WaterfallOptions;
}

export default function WaterfallChart({
  data,
  title,
  subtitle,
  formatting,
  options = {}
}: WaterfallChartProps) {
  
  const formatValue = (value: number) => {
    if (!formatting) return value.toLocaleString();
    
    const { valueFormat, currency = 'USD', decimals = 0, prefix = '', suffix = '' } = formatting;
    
    if (valueFormat === 'currency') {
      return `${prefix}${new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency,
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
      }).format(value)}${suffix}`;
    }
    
    return `${prefix}${value.toFixed(decimals)}${suffix}`;
  };

  // Calculate cumulative values for waterfall
  const processedData: any[] = [];
  let cumulative = 0;
  
  data.forEach((item, index) => {
    const value = item.value || item.amount || 0;
    const isTotal = options.subtotalIndices?.includes(index) || index === data.length - 1 && options.showTotal;
    
    if (isTotal) {
      processedData.push({
        name: item.name || item.category,
        value: cumulative + value,
        itemStyle: {
          color: options.totalColor || 'hsl(var(--primary))'
        }
      });
    } else {
      processedData.push({
        name: item.name || item.category,
        value: [cumulative, cumulative + value],
        itemStyle: {
          color: value >= 0 
            ? (options.positiveColor || 'hsl(var(--success))')
            : (options.negativeColor || 'hsl(var(--destructive))')
        }
      });
      cumulative += value;
    }
  });

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
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'hsl(var(--card))',
      borderColor: 'hsl(var(--border))',
      textStyle: {
        color: 'hsl(var(--foreground))'
      },
      formatter: (params: any) => {
        if (!Array.isArray(params) || !params[0]) return '';
        const param = params[0];
        const value = Array.isArray(param.value) 
          ? param.value[1] - param.value[0]
          : param.value;
        return `<div style="font-weight: bold;">${param.name}</div>
                <div>Change: ${formatValue(value)}</div>`;
      }
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '10%',
      top: title ? 100 : 60,
      containLabel: true
    },
    xAxis: {
      type: 'category',
      data: processedData.map(d => d.name),
      axisLine: {
        lineStyle: {
          color: 'hsl(var(--border))'
        }
      },
      axisLabel: {
        color: 'hsl(var(--muted-foreground))',
        rotate: 45,
        interval: 0
      }
    },
    yAxis: {
      type: 'value',
      axisLine: {
        lineStyle: {
          color: 'hsl(var(--border))'
        }
      },
      axisLabel: {
        formatter: (value: number) => formatValue(value),
        color: 'hsl(var(--muted-foreground))'
      },
      splitLine: {
        lineStyle: {
          color: 'hsl(var(--border))',
          type: 'dashed'
        }
      }
    },
    series: [
      {
        type: 'bar',
        stack: 'total',
        itemStyle: {
          borderColor: 'transparent',
          color: 'transparent'
        },
        emphasis: {
          itemStyle: {
            borderColor: 'transparent',
            color: 'transparent'
          }
        },
        data: processedData.map(d => 
          Array.isArray(d.value) ? d.value[0] : 0
        )
      },
      {
        type: 'bar',
        stack: 'total',
        label: {
          show: true,
          position: 'top',
          formatter: (params: any) => {
            const value = Array.isArray(params.value)
              ? params.value[1] - params.value[0]
              : params.value;
            return formatValue(value);
          },
          color: 'hsl(var(--foreground))'
        },
        data: processedData,
        itemStyle: {
          borderRadius: [4, 4, 0, 0]
        }
      }
    ]
  };

  return (
    <div className="w-full" data-testid="chart-waterfall">
      <ReactECharts 
        option={chartOption} 
        style={{ height: '500px', width: '100%' }}
        opts={{ renderer: 'canvas' }}
      />
    </div>
  );
}
