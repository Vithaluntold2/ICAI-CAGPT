import { useState } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type ColumnFiltersState
} from '@tanstack/react-table';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChevronDown, ChevronUp, ChevronsUpDown, ChevronLeft, ChevronRight } from 'lucide-react';
import type { TableOptions, VisualizationFormatting } from '@/../../shared/types/visualization';

interface DataTableProps {
  data: any[];
  title?: string;
  formatting?: VisualizationFormatting;
  options?: TableOptions;
}

export default function DataTable({
  data,
  title,
  formatting,
  options = {}
}: DataTableProps) {
  const {
    sortable = true,
    filterable = true,
    paginated = true,
    pageSize = 10,
    columns: columnConfig
  } = options;

  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState('');

  if (!data || data.length === 0) {
    return (
      <div className="text-muted-foreground p-4 border border-border rounded-md" data-testid="data-table-empty">
        No data available
      </div>
    );
  }

  // Auto-generate columns from data if not provided
  const allKeys = columnConfig?.map(c => c.key) || Array.from(
    new Set(data.flatMap(row => Object.keys(row)))
  );

  const isNumericLike = (value: unknown): boolean => {
    if (value === null || value === undefined) return false;
    if (typeof value === 'number') return true;
    if (typeof value !== 'string') return false;

    const text = value.trim();
    if (!text || text === '-' || text === '—') return false;

    const normalized = text.replace(/,/g, '');
    return /^\(?-?\d+(\.\d+)?\)?$/.test(normalized);
  };

  const formatCellValue = (value: any, key: string) => {
    if (value === null || value === undefined) return '-';
    
    if (typeof value === 'number' && formatting) {
      const { valueFormat, currency = 'USD', decimals = 2 } = formatting;
      
      if (valueFormat === 'currency') {
        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency,
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals
        }).format(value);
      }
      
      if (valueFormat === 'percentage') {
        return `${(value * 100).toFixed(decimals)}%`;
      }
      
      if (valueFormat === 'integer') {
        return Math.round(value).toLocaleString();
      }
      
      return value.toFixed(decimals);
    }
    
    return String(value);
  };

  const columns: ColumnDef<any>[] = allKeys.map(key => {
    const colConfig = columnConfig?.find(c => c.key === key);
    const nonEmptyValues = data
      .map(row => row[key])
      .filter(value => value !== null && value !== undefined && String(value).trim() !== '' && String(value).trim() !== '-' && String(value).trim() !== '—');
    const numericCount = nonEmptyValues.filter(isNumericLike).length;
    const inferredAlign: 'left' | 'center' | 'right' =
      nonEmptyValues.length > 0 && numericCount / nonEmptyValues.length >= 0.7 ? 'right' : 'left';
    const align: 'left' | 'center' | 'right' = colConfig?.align || inferredAlign;
    const alignClass = align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left';
    const justifyClass = align === 'right' ? 'justify-end' : align === 'center' ? 'justify-center' : 'justify-start';
    
    return {
      accessorKey: key,
      header: ({ column }) => {
        const isSortable = sortable && (colConfig?.sortable !== false);
        const label = colConfig?.label || key;
        
        if (!isSortable) {
          return <div className={`font-semibold ${alignClass}`}>{label}</div>;
        }
        
        return (
          <Button
            variant="ghost"
            size="sm"
            className={`-ml-3 h-8 w-full data-[state=open]:bg-accent ${justifyClass}`}
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            data-testid={`table-header-${key}`}
          >
            <span className="font-semibold">{label}</span>
            {column.getIsSorted() === "asc" ? (
              <ChevronUp className="ml-2 h-4 w-4" />
            ) : column.getIsSorted() === "desc" ? (
              <ChevronDown className="ml-2 h-4 w-4" />
            ) : (
              <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
            )}
          </Button>
        );
      },
      cell: ({ row }) => {
        const value = row.getValue(key);
        
        return (
          <div className={alignClass}>
            {formatCellValue(value, key)}
          </div>
        );
      }
    };
  });

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: paginated ? getPaginationRowModel() : undefined,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    state: {
      sorting,
      columnFilters,
      globalFilter,
    },
    initialState: {
      pagination: {
        pageSize
      }
    }
  });

  return (
    <div className="w-full space-y-4" data-testid="data-table">
      {title && (
        <h3 className="text-lg font-semibold">{title}</h3>
      )}
      
      {filterable && (
        <div className="flex items-center gap-2">
          <Input
            placeholder="Search all columns..."
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            className="max-w-sm"
            data-testid="table-global-filter"
          />
        </div>
      )}
      
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id} data-state={row.getIsSelected() && "selected"}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  No results found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      
      {paginated && table.getPageCount() > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
            {' · '}
            {table.getFilteredRowModel().rows.length} row(s)
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              data-testid="table-prev-page"
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              data-testid="table-next-page"
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
