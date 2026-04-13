import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { 
  Download, 
  Maximize2, 
  Minimize2, 
  RefreshCw,
  Table2,
  FileSpreadsheet
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface SpreadsheetData {
  sheets: Sheet[];
  metadata?: {
    title?: string;
    description?: string;
    calculations?: string[];
  };
}

interface Sheet {
  name: string;
  data: (string | number | null)[][];
  styles?: CellStyle[][];
  merges?: MergeRange[];
  formulas?: string[]; // List of formulas in the sheet
}

interface CellStyle {
  font?: {
    bold?: boolean;
    italic?: boolean;
    color?: string;
    size?: number;
  };
  background?: string;
  align?: 'left' | 'center' | 'right';
  border?: {
    top?: boolean;
    bottom?: boolean;
    left?: boolean;
    right?: boolean;
  };
}

interface MergeRange {
  row: number;
  col: number;
  rowspan: number;
  colspan: number;
}

interface SpreadsheetViewerProps {
  data: SpreadsheetData;
  conversationId?: string;
  messageId?: string;
  onFullscreen?: () => void;
  isFullscreen?: boolean;
}

export default function SpreadsheetViewer({
  data,
  conversationId,
  messageId,
  onFullscreen,
  isFullscreen = false
}: SpreadsheetViewerProps) {
  const [activeSheet, setActiveSheet] = useState(0);
  const [zoom, setZoom] = useState(100);
  const { toast } = useToast();
  const containerRef = useRef<HTMLDivElement>(null);

  const currentSheet = data.sheets[activeSheet];

  const formatHeaderLabel = (value: string | number | null): string => {
    const raw = String(value ?? '').trim();
    if (!raw) return '';

    // Normalize verbose period labels like "Year ended 31 December 2024" -> "2024"
    const yearEndedMatch = raw.match(/year\s+ended.*?(\d{4})/i);
    if (yearEndedMatch?.[1]) {
      return yearEndedMatch[1];
    }

    return raw;
  };

  const handleDownloadExcel = () => {
    if (conversationId && messageId) {
      const downloadUrl = `/api/conversations/${conversationId}/messages/${messageId}/excel`;
      window.open(downloadUrl, '_blank');
      toast({
        title: "Downloading Excel file",
        description: "Your spreadsheet is being downloaded."
      });
    }
  };

  const isNumericValue = (value: string | number | null): boolean => {
    if (value === null || value === undefined) return false;
    if (typeof value === 'number') return true;

    const text = String(value).trim();
    if (!text || text === '-' || text === '—') return false;

    const normalized = text.replace(/,/g, '');
    if (/^\(?-?\d+(\.\d+)?\)?$/.test(normalized)) return true;

    return false;
  };

  const getCellStyle = (row: number, col: number, cellValue: string | number | null, isHeader: boolean): React.CSSProperties => {
    const style = currentSheet.styles?.[row]?.[col];
    const resolvedAlign = style?.align || (!isHeader && isNumericValue(cellValue) ? 'right' : 'left');

    return {
      fontWeight: style.font?.bold ? 'bold' : 'normal',
      fontStyle: style.font?.italic ? 'italic' : 'normal',
      color: style.font?.color || 'inherit',
      fontSize: style.font?.size ? `${style.font.size}px` : 'inherit',
      backgroundColor: style.background || 'transparent',
      textAlign: resolvedAlign,
      borderTop: style.border?.top ? '1px solid #e2e8f0' : 'none',
      borderBottom: style.border?.bottom ? '1px solid #e2e8f0' : 'none',
      borderLeft: style.border?.left ? '1px solid #e2e8f0' : 'none',
      borderRight: style.border?.right ? '1px solid #e2e8f0' : 'none',
    };
  };

  const getCellSpan = (row: number, col: number) => {
    const merge = currentSheet.merges?.find(
      m => m.row === row && m.col === col
    );
    if (merge) {
      return {
        rowSpan: merge.rowspan,
        colSpan: merge.colspan
      };
    }
    return {};
  };

  const isCellMerged = (row: number, col: number): boolean => {
    return currentSheet.merges?.some(
      m => row >= m.row && row < m.row + m.rowspan &&
           col >= m.col && col < m.col + m.colspan &&
           !(row === m.row && col === m.col)
    ) || false;
  };

  // Check if a cell value is a formula
  const isFormula = (value: string | number | null): boolean => {
    return typeof value === 'string' && value.startsWith('=');
  };

  const formatCellValue = (value: string | number | null): string => {
    if (value === null || value === undefined) return '';
    if (typeof value === 'number') {
      // Format numbers with commas and decimals
      return new Intl.NumberFormat('en-US', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2
      }).format(value);
    }
    return String(value);
  };

  const getDisplayValue = (value: string | number | null, rowIdx: number): string => {
    if (rowIdx === 0) {
      return formatHeaderLabel(value);
    }
    return formatCellValue(value);
  };

  return (
    <div 
      ref={containerRef}
      className={`flex flex-col ${isFullscreen ? 'fixed inset-0 z-50 h-screen bg-background' : 'w-full'}`}
    >
      {/* Spreadsheet Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
        <div className="flex items-center gap-3">
          <FileSpreadsheet className="h-5 w-5 text-green-600" />
          <div>
            <h3 className="font-semibold text-sm">
              {data.metadata?.title || 'Financial Calculations'}
            </h3>
            {data.metadata?.description && (
              <p className="text-xs text-muted-foreground">
                {data.metadata.description}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setZoom(Math.max(50, zoom - 10))}
            disabled={zoom <= 50}
          >
            −
          </Button>
          <span className="text-sm font-medium min-w-[3rem] text-center">
            {zoom}%
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setZoom(Math.min(200, zoom + 10))}
            disabled={zoom >= 200}
          >
            +
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setZoom(100)}
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
          {conversationId && messageId && (
            <Button
              variant="default"
              size="sm"
              onClick={handleDownloadExcel}
              className="bg-green-600 hover:bg-green-700"
            >
              <Download className="h-4 w-4 mr-2" />
              Download Excel
            </Button>
          )}
          {onFullscreen && (
            <Button
              variant="outline"
              size="sm"
              onClick={onFullscreen}
            >
              {isFullscreen ? (
                <Minimize2 className="h-4 w-4" />
              ) : (
                <Maximize2 className="h-4 w-4" />
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Sheet Tabs */}
      {data.sheets.length > 1 && (
        <div className="flex items-center gap-1 px-4 py-2 border-b bg-muted/10 overflow-x-auto">
          {data.sheets.map((sheet, idx) => (
            <Button
              key={idx}
              variant={activeSheet === idx ? "default" : "ghost"}
              size="sm"
              onClick={() => setActiveSheet(idx)}
              className="shrink-0"
            >
              <Table2 className="h-3 w-3 mr-1" />
              {sheet.name}
            </Button>
          ))}
        </div>
      )}

      {/* Spreadsheet Container */}
      <div className={`${isFullscreen ? 'flex-1 overflow-auto min-h-0' : 'overflow-visible'} bg-background`}>
        <div 
          className="inline-block min-w-full p-4"
          style={{ 
            zoom: `${zoom}%`,
            transformOrigin: 'top left'
          }}
        >
          <div className="border rounded-lg overflow-hidden shadow-sm bg-white dark:bg-gray-900">
            <table className="w-full border-collapse">
              <tbody>
                {currentSheet.data.map((row, rowIdx) => (
                  <tr key={rowIdx} className="hover:bg-muted/20">
                    {row.map((cell, colIdx) => {
                      if (isCellMerged(rowIdx, colIdx)) {
                        return null;
                      }

                      const span = getCellSpan(rowIdx, colIdx);
                      const isHeader = rowIdx === 0;
                      const style = getCellStyle(rowIdx, colIdx, cell, isHeader);
                      const cellIsFormula = isFormula(cell);

                      return (
                        <td
                          key={colIdx}
                          className={`
                            px-3 py-2 border text-sm
                            ${isHeader ? 'font-semibold bg-muted/40' : ''}
                            ${cellIsFormula ? 'bg-emerald-50 dark:bg-emerald-900/20 font-mono text-emerald-700 dark:text-emerald-400 text-xs' : ''}
                          `}
                          style={style}
                          title={cellIsFormula ? `Formula: ${cell}` : undefined}
                          {...span}
                        >
                          {getDisplayValue(cell, rowIdx)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Formulas in this sheet */}
          {currentSheet.formulas && currentSheet.formulas.length > 0 && (
            <div className="mt-6 p-4 border rounded-lg bg-emerald-50/50 dark:bg-emerald-900/10">
              <h4 className="font-semibold text-sm mb-3 flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
                <Table2 className="h-4 w-4" />
                Excel Formulas ({currentSheet.formulas.length})
              </h4>
              <div className="grid gap-2 text-xs font-mono max-h-40 overflow-y-auto">
                {currentSheet.formulas.slice(0, 20).map((formula, idx) => (
                  <div key={idx} className="flex items-start gap-2 text-emerald-700 dark:text-emerald-400">
                    <span className="opacity-60">{idx + 1}.</span>
                    <span>{formula}</span>
                  </div>
                ))}
                {currentSheet.formulas.length > 20 && (
                  <div className="text-muted-foreground italic">
                    ... and {currentSheet.formulas.length - 20} more formulas
                  </div>
                )}
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                💡 Download the Excel file to use these formulas interactively
              </p>
            </div>
          )}

          {/* Calculations Summary */}
          {data.metadata?.calculations && data.metadata.calculations.length > 0 && (
            <div className="mt-6 p-4 border rounded-lg bg-muted/20">
              <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
                <Table2 className="h-4 w-4 text-primary" />
                Applied Calculations
              </h4>
              <ul className="space-y-2 text-sm">
                {data.metadata.calculations.map((calc, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="text-primary font-mono">•</span>
                    <span className="text-muted-foreground">{calc}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
