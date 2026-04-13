import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Minus, DollarSign, Users, FileText, BarChart3 } from "lucide-react";
import type { VisualizationFormatting, KpiCardOptions } from '@/../../shared/types/visualization';

interface KpiCardProps {
  data: any[];
  title?: string;
  formatting?: VisualizationFormatting;
  options?: KpiCardOptions;
}

const iconMap: Record<string, any> = {
  dollar: DollarSign,
  users: Users,
  file: FileText,
  chart: BarChart3
};

export default function KpiCard({
  data,
  title,
  formatting,
  options = {}
}: KpiCardProps) {
  const {
    trendMode = 'neutral',
    trendValue = 0,
    periodCompare,
    target,
    icon = 'chart',
    size = 'md'
  } = options;

  if (!data || data.length === 0) {
    return (
      <div className="text-muted-foreground p-4">
        No data available
      </div>
    );
  }

  const mainValue = data[0].value ?? data[0].amount ?? 0;
  
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
    
    if (valueFormat === 'integer') {
      return `${prefix}${Math.round(value).toLocaleString()}${suffix}`;
    }
    
    return `${prefix}${value.toFixed(decimals).toLocaleString()}${suffix}`;
  };

  const getTrendIcon = () => {
    if (trendMode === 'up') return <TrendingUp className="h-4 w-4 text-success" />;
    if (trendMode === 'down') return <TrendingDown className="h-4 w-4 text-destructive" />;
    return <Minus className="h-4 w-4 text-muted-foreground" />;
  };

  const getTrendColor = () => {
    if (trendMode === 'up') return 'text-success';
    if (trendMode === 'down') return 'text-destructive';
    return 'text-muted-foreground';
  };

  const Icon = iconMap[icon] || iconMap.chart;
  
  const sizeClasses = {
    sm: 'text-2xl',
    md: 'text-3xl',
    lg: 'text-4xl'
  };

  return (
    <Card className="w-full" data-testid="kpi-card">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">
          {title || data[0].label || 'Metric'}
        </CardTitle>
        <div className="h-8 w-8 rounded-md bg-primary/10 flex items-center justify-center">
          <Icon className="h-4 w-4 text-primary" />
        </div>
      </CardHeader>
      <CardContent>
        <div className={`${sizeClasses[size]} font-bold`}>
          {formatValue(mainValue)}
        </div>
        
        <div className="flex items-center gap-2 mt-2">
          {getTrendIcon()}
          <span className={`text-xs font-medium ${getTrendColor()}`}>
            {trendValue > 0 && '+'}{formatValue(Math.abs(trendValue))}
          </span>
          {periodCompare && (
            <span className="text-xs text-muted-foreground">
              {periodCompare}
            </span>
          )}
        </div>
        
        {target && (
          <div className="mt-3 pt-3 border-t border-border">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Target</span>
              <span className="font-medium">{formatValue(target)}</span>
            </div>
            <div className="w-full bg-muted rounded-full h-2 mt-2">
              <div
                className="bg-primary h-2 rounded-full transition-all"
                style={{ width: `${Math.min((mainValue / target) * 100, 100)}%` }}
              />
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {((mainValue / target) * 100).toFixed(0)}% of target
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
