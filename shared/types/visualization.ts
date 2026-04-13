import type { MindMapData } from './mindmap';

// Workflow types (shared)
export interface WorkflowNode {
  id: string;
  type: 'step' | 'decision' | 'start' | 'end';
  label: string;
  description?: string;
  substeps?: string[];
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
}

// Legacy visualization types (Recharts-based)
export type LegacyVisualizationType = 
  | 'line' 
  | 'bar' 
  | 'pie' 
  | 'area' 
  | 'workflow';

// Advanced visualization types (ECharts/custom components)
export type AdvancedVisualizationType =
  | 'combo'
  | 'waterfall'
  | 'gauge'
  | 'table'
  | 'kpi-card'
  | 'mindmap';
  // Future implementations:
  // | 'scatter'
  // | 'radar'
  // | 'candlestick'
  // | 'heatmap'
  // | 'funnel';

// All visualization types
export type VisualizationType = LegacyVisualizationType | AdvancedVisualizationType;

// Series metadata (unified across chart types)
export interface VisualizationSeries {
  id: string;
  label: string;
  dataKey: string;
  color?: string;
  type?: 'line' | 'bar' | 'area' | 'scatter';
  yAxisIndex?: number;
  stack?: string;
}

// Formatting helpers (serializable tokens)
export interface VisualizationFormatting {
  valueFormat?: 'currency' | 'percentage' | 'number' | 'integer' | 'decimal';
  dateFormat?: 'short' | 'medium' | 'long' | 'iso' | 'relative';
  currency?: 'USD' | 'EUR' | 'GBP' | 'INR' | 'CAD' | 'AED' | 'IDR' | 'TRY';
  decimals?: number;
  prefix?: string;
  suffix?: string;
}

// Export configuration
export interface ExportHints {
  includeAsImage?: boolean;
  preferredFormat?: 'png' | 'svg';
  includeRawData?: boolean;
  filenameSlug?: string;
}

// Chart-specific option types
export interface ComboChartOptions {
  primaryAxis?: 'left' | 'right';
  secondaryAxis?: 'left' | 'right';
  stackedBars?: boolean;
}

export interface WaterfallOptions {
  startKey?: string;
  varianceKeys?: string[];
  subtotalIndices?: number[];
  showTotal?: boolean;
  positiveColor?: string;
  negativeColor?: string;
  totalColor?: string;
}

export interface GaugeOptions {
  min: number;
  max: number;
  target?: number;
  thresholds?: Array<{ value: number; color: string; label?: string }>;
  showPointer?: boolean;
}

export interface KpiCardOptions {
  trendMode?: 'up' | 'down' | 'neutral';
  trendValue?: number;
  periodCompare?: string;
  target?: number;
  icon?: string;
  size?: 'sm' | 'md' | 'lg';
}

export interface TableOptions {
  sortable?: boolean;
  filterable?: boolean;
  paginated?: boolean;
  pageSize?: number;
  columns?: Array<{
    key: string;
    label: string;
    sortable?: boolean;
    align?: 'left' | 'center' | 'right';
  }>;
}

export interface RadarOptions {
  indicators?: Array<{ name: string; max: number }>;
  fillArea?: boolean;
  areaOpacity?: number;
}

export interface HeatmapOptions {
  xAxisLabels?: string[];
  yAxisLabels?: string[];
  min?: number;
  max?: number;
  colorScale?: 'blue' | 'green' | 'red' | 'purple' | 'custom';
}

// Legacy config type (for backwards compatibility)
export interface LegacyVisualizationConfig {
  /** @deprecated Use series instead */
  lines?: Array<{ dataKey: string; name: string; color: string }>;
  /** @deprecated Use series instead */
  bars?: Array<{ dataKey: string; name: string; color: string }>;
  /** @deprecated Use series instead */
  areas?: Array<{ dataKey: string; name: string; color: string }>;
  xAxisLabel?: string;
  yAxisLabel?: string;
  formatValue?: string;
  stacked?: boolean;
  layout?: 'horizontal' | 'vertical';
  showPercentage?: boolean;
  nodes?: WorkflowNode[];
  edges?: WorkflowEdge[];
}

// Legacy visualization data (backwards compatibility)
export interface LegacyVisualizationData {
  type: LegacyVisualizationType;
  title?: string;
  data: any[];
  config?: LegacyVisualizationConfig;
}

// Base properties shared by all advanced visualizations
interface AdvancedVisualizationBase {
  title?: string;
  subtitle?: string;
  data: any[];
  series?: VisualizationSeries[];
  axes?: {
    xAxis?: {
      dataKey?: string;
      label?: string;
      type?: 'category' | 'value' | 'time';
    };
    yAxis?: Array<{
      label?: string;
      type?: 'value' | 'log';
      position?: 'left' | 'right';
    }>;
  };
  formatting?: VisualizationFormatting;
  export?: ExportHints;
}

// Advanced visualization data (discriminated union)
export type AdvancedVisualizationData =
  | (AdvancedVisualizationBase & { type: 'combo'; options?: ComboChartOptions })
  | (AdvancedVisualizationBase & { type: 'waterfall'; options?: WaterfallOptions })
  | (AdvancedVisualizationBase & { type: 'gauge'; options?: GaugeOptions })
  | (AdvancedVisualizationBase & { type: 'table'; options?: TableOptions })
  | (AdvancedVisualizationBase & { type: 'kpi-card'; options?: KpiCardOptions })
  | MindMapData;  // MindMapData already includes type: 'mindmap'

// Union type for all visualizations
export type VisualizationData = LegacyVisualizationData | AdvancedVisualizationData;

export interface MessageMetadata {
  showInOutputPane?: boolean;
  visualization?: VisualizationData;
  [key: string]: any;
}
