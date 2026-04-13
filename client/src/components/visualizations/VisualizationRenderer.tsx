// Legacy Recharts-based visualizations
import FinancialLineChart from './FinancialLineChart';
import FinancialBarChart from './FinancialBarChart';
import FinancialPieChart from './FinancialPieChart';
import FinancialAreaChart from './FinancialAreaChart';
import WorkflowRenderer from './WorkflowRenderer';

// Advanced ECharts-based visualizations
import ComboChart from './advanced/ComboChart';
import WaterfallChart from './advanced/WaterfallChart';
import GaugeChart from './advanced/GaugeChart';
import KpiCard from './advanced/KpiCard';
import DataTable from './advanced/DataTable';

// MindMap visualization
import MindMapRenderer from './MindMapRenderer';

import type { 
  VisualizationData, 
  LegacyVisualizationType,
  AdvancedVisualizationType,
  LegacyVisualizationData,
  AdvancedVisualizationData,
  LegacyVisualizationConfig
} from '@/../../shared/types/visualization';
import type { MindMapData } from '@/../../shared/types/mindmap';

// Legacy ChartData export for backwards compatibility
export type ChartData = VisualizationData;

interface VisualizationRendererProps {
  chartData: VisualizationData;
}

// Type guard for legacy visualizations
function isLegacyVisualization(viz: VisualizationData): viz is LegacyVisualizationData {
  const legacyTypes: LegacyVisualizationType[] = ['line', 'bar', 'pie', 'area', 'workflow'];
  return legacyTypes.includes(viz.type as LegacyVisualizationType);
}

// Type guard for advanced visualizations
function isAdvancedVisualization(viz: VisualizationData): viz is AdvancedVisualizationData {
  const advancedTypes: AdvancedVisualizationType[] = ['combo', 'waterfall', 'gauge', 'table', 'kpi-card'];
  return advancedTypes.includes(viz.type as AdvancedVisualizationType);
}

// Type guard for mindmap visualizations
function isMindMapVisualization(viz: VisualizationData): viz is MindMapData {
  return viz.type === 'mindmap';
}

export default function VisualizationRenderer({ chartData }: VisualizationRendererProps) {
  const { type, title } = chartData;

  // Handle MindMap visualization first (different structure)
  if (isMindMapVisualization(chartData)) {
    return <MindMapRenderer data={chartData} />;
  }

  // For legacy and advanced charts, data is always present
  const data = 'data' in chartData ? chartData.data : [];

  // Handle legacy Recharts-based visualizations
  if (isLegacyVisualization(chartData)) {
    const config: LegacyVisualizationConfig = chartData.config || {};
    
    switch (type) {
      case 'line':
        return (
          <FinancialLineChart
            data={data}
            lines={config.lines || []}
            title={title}
            xAxisLabel={config.xAxisLabel}
            yAxisLabel={config.yAxisLabel}
          />
        );

      case 'bar':
        return (
          <FinancialBarChart
            data={data}
            bars={config.bars || []}
            title={title}
            xAxisLabel={config.xAxisLabel}
            yAxisLabel={config.yAxisLabel}
            layout={config.layout}
          />
        );

      case 'pie':
        return (
          <FinancialPieChart
            data={data}
            title={title}
            showPercentage={config.showPercentage}
          />
        );

      case 'area':
        return (
          <FinancialAreaChart
            data={data}
            areas={config.areas || []}
            title={title}
            xAxisLabel={config.xAxisLabel}
            yAxisLabel={config.yAxisLabel}
            stacked={config.stacked}
          />
        );

      case 'workflow':
        if (!config.nodes || !config.edges) {
          return (
            <div className="text-destructive p-4 border border-destructive rounded-md">
              Workflow visualization requires nodes and edges
            </div>
          );
        }
        return (
          <WorkflowRenderer
            nodes={config.nodes}
            edges={config.edges}
            title={title}
            layout={config.layout}
          />
        );
    }
  }

  // Handle advanced ECharts/data display visualizations
  if (!isAdvancedVisualization(chartData)) {
    return (
      <div className="text-destructive p-4 border border-destructive rounded-md">
        Invalid visualization type: {type}
      </div>
    );
  }

  // TypeScript now knows this is AdvancedVisualizationData
  // Each branch narrows to specific chart type with its corresponding options type
  const { series = [], axes, formatting, subtitle } = chartData;
  
  switch (type) {
    case 'combo': {
      const comboData = chartData; // TypeScript narrows to type: 'combo'
      if (series.length === 0) {
        return (
          <div className="text-muted-foreground p-4 border border-border rounded-md">
            Loading combo chart data...
          </div>
        );
      }
      return (
        <ComboChart
          data={data}
          series={series}
          title={title}
          subtitle={subtitle}
          xAxisLabel={axes?.xAxis?.label}
          yAxisLabel={axes?.yAxis?.[0]?.label}
          formatting={formatting}
          options={comboData.options}
        />
      );
    }

    case 'waterfall': {
      const waterfallData = chartData; // TypeScript narrows to type: 'waterfall'
      if (data.length === 0) {
        return (
          <div className="text-muted-foreground p-4 border border-border rounded-md">
            Loading waterfall chart data...
          </div>
        );
      }
      return (
        <WaterfallChart
          data={data}
          title={title}
          subtitle={subtitle}
          formatting={formatting}
          options={waterfallData.options}
        />
      );
    }

    case 'gauge': {
      const gaugeData = chartData; // TypeScript narrows to type: 'gauge'
      const gaugeOptions = gaugeData.options;
      
      if (!gaugeOptions || typeof gaugeOptions.min === 'undefined' || typeof gaugeOptions.max === 'undefined') {
        return (
          <div className="text-destructive p-4 border border-destructive rounded-md">
            Gauge chart requires min and max values in options
          </div>
        );
      }
      if (data.length === 0) {
        return (
          <div className="text-muted-foreground p-4 border border-border rounded-md">
            Loading gauge data...
          </div>
        );
      }
      return (
        <GaugeChart
          data={data}
          title={title}
          subtitle={subtitle}
          formatting={formatting}
          options={gaugeOptions}
        />
      );
    }

    case 'kpi-card': {
      const kpiData = chartData; // TypeScript narrows to type: 'kpi-card'
      if (data.length === 0) {
        return (
          <div className="text-muted-foreground p-4 border border-border rounded-md">
            Loading KPI data...
          </div>
        );
      }
      return (
        <KpiCard
          data={data}
          title={title}
          formatting={formatting}
          options={kpiData.options}
        />
      );
    }

    case 'table': {
      const tableData = chartData; // TypeScript narrows to type: 'table'
      if (data.length === 0) {
        return (
          <div className="text-muted-foreground p-4 border border-border rounded-md">
            No data available
          </div>
        );
      }
      return (
        <DataTable
          data={data}
          title={title}
          formatting={formatting}
          options={tableData.options}
        />
      );
    }

    default:
      return (
        <div className="text-destructive p-4 border border-destructive rounded-md">
          Unsupported chart type: {type}
        </div>
      );
  }
}
