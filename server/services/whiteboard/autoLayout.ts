export interface LayoutInput { width: number; height: number; }
export interface Position { canvasX: number; canvasY: number; }
export interface LayoutState { cursorX: number; rowTop: number; rowHeight: number; }
export interface PlacementResult { position: Position; state: LayoutState; }

export const DEFAULT_CANVAS_WIDTH = 2400;
export const DEFAULT_GUTTER = 40;

export function placeNext(
  state: LayoutState,
  item: LayoutInput,
  canvasWidth: number = DEFAULT_CANVAS_WIDTH,
  gutter: number = DEFAULT_GUTTER
): PlacementResult {
  const needsWrap = state.cursorX > 0 && state.cursorX + item.width > canvasWidth;
  if (needsWrap) {
    const wrappedRowTop = state.rowTop + state.rowHeight + gutter;
    const position: Position = { canvasX: 0, canvasY: wrappedRowTop };
    return {
      position,
      state: {
        cursorX: item.width + gutter,
        rowTop: wrappedRowTop,
        rowHeight: item.height,
      },
    };
  }
  const position: Position = { canvasX: state.cursorX, canvasY: state.rowTop };
  return {
    position,
    state: {
      cursorX: state.cursorX + item.width + gutter,
      rowTop: state.rowTop,
      rowHeight: Math.max(state.rowHeight, item.height),
    },
  };
}

export const NATURAL_SIZE: Record<string, { width: number; height: number }> = {
  chart: { width: 600, height: 400 },
  workflow: { width: 800, height: 500 },
  mindmap: { width: 700, height: 500 },
  flowchart: { width: 700, height: 450 },
  spreadsheet: { width: 900, height: 500 },
  checklist: { width: 520, height: 480 },
};
