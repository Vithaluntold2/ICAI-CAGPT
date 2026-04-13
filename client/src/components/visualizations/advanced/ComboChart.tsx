import ReactECharts from 'echarts-for-react';
import type { EChartsOption } from 'echarts';
import type { VisualizationSeries, VisualizationFormatting, ComboChartOptions } from '@/../../shared/types/visualization';

interface ComboChartProps {
  data: any[];
  series: VisualizationSeries[];
  title?: string;
  subtitle?: string;
  xAxisLabel?: string;
  yAxisLabel?: string;
  formatting?: VisualizationFormatting;
  options?: ComboChartOptions;
}

export default function ComboChart({
  data,
  series,
  title,
  subtitle,
  xAxisLabel,
  yAxisLabel,
  formatting,
  options = {}
}: ComboChartProps) {
  
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
    
    if (valueFormat === 'percentage') {
      return `${prefix}${(value * 100).toFixed(decimals)}%${suffix}`;
    }
    
    return `${prefix}${value.toFixed(decimals)}${suffix}`;
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
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'cross',
        crossStyle: {
          color: 'hsl(var(--muted-foreground))'
        }
      },
      backgroundColor: 'hsl(var(--card))',
      borderColor: 'hsl(var(--border))',
      textStyle: {
        color: 'hsl(var(--foreground))'
      },
      formatter: (params: any) => {
        if (!Array.isArray(params)) return '';
        let result = `<div style="font-weight: bold; margin-bottom: 4px;">${params[0].axisValue}</div>`;
        params.forEach((param: any) => {
          const marker = `<span style="display:inline-block;margin-right:5px;border-radius:50%;width:10px;height:10px;background-color:${param.color};"></span>`;
          result += `<div>${marker}${param.seriesName}: ${formatValue(param.value[param.seriesName])}</div>`;
        });
        return result;
      }
    },
    legend: {
      data: series.map(s => s.label),
      top: title ? 60 : 20,
      textStyle: {
        color: 'hsl(var(--foreground))'
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
      data: data.map(d => d.name || d.period || d.category),
      axisPointer: {
        type: 'shadow'
      },
      name: xAxisLabel,
      nameLocation: 'middle',
      nameGap: 25,
      axisLine: {
        lineStyle: {
          color: 'hsl(var(--border))'
        }
      },
      axisLabel: {
        color: 'hsl(var(--muted-foreground))'
      }
    },
    yAxis: [
      {
        type: 'value',
        name: yAxisLabel,
        position: options.primaryAxis || 'left',
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
      {
        type: 'value',
        position: options.secondaryAxis || 'right',
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
          show: false
        }
      }
    ],
    series: series.map(s => {
      const seriesData = data.map(d => ({
        value: d[s.dataKey],
        [s.label]: d[s.dataKey]
      }));
      
      const baseConfig = {
        name: s.label,
        yAxisIndex: s.yAxisIndex || 0,
        data: seriesData,
        stack: s.stack,
        color: s.color
      };
      
      // Return type-specific configuration
      if (s.type === 'line') {
        return {
          ...baseConfig,
          type: 'line' as const,
          smooth: true,
          lineStyle: { width: 2 }
        };
      } else if (s.type === 'area') {
        return {
          ...baseConfig,
          type: 'line' as const,
          areaStyle: {},
          smooth: true,
          lineStyle: { width: 2 }
        };
      } else if (s.type === 'scatter') {
        return {
          ...baseConfig,
          type: 'scatter' as const,
          symbolSize: 8
        };
      } else {
        // Default to bar
        return {
          ...baseConfig,
          type: 'bar' as const,
          itemStyle: {
            borderRadius: [4, 4, 0, 0]
          }
        };
      }
    })
  };

  return (
    <div className="w-full" data-testid="chart-combo">
      <ReactECharts 
        option={chartOption} 
        style={{ height: '500px', width: '100%' }}
        opts={{ renderer: 'canvas' }}
      />
    </div>
  );
}
