import { describe, it, expect } from "vitest";
import { placeNext, type LayoutState } from "./autoLayout";

const CANVAS = 2400;
const GUTTER = 40;
const empty = (): LayoutState => ({ cursorX: 0, rowTop: 0, rowHeight: 0 });

describe("autoLayout.placeNext", () => {
  it("places first artifact at origin", () => {
    const res = placeNext(empty(), { width: 600, height: 400 }, CANVAS, GUTTER);
    expect(res.position).toEqual({ canvasX: 0, canvasY: 0 });
  });

  it("places second artifact to the right within the same row", () => {
    const a = placeNext(empty(), { width: 600, height: 400 }, CANVAS, GUTTER);
    const b = placeNext(a.state, { width: 600, height: 400 }, CANVAS, GUTTER);
    expect(b.position).toEqual({ canvasX: 600 + GUTTER, canvasY: 0 });
  });

  it("wraps to new row when next artifact would exceed canvas width", () => {
    const state: LayoutState = { cursorX: 2000, rowTop: 0, rowHeight: 400 };
    const r = placeNext(state, { width: 600, height: 500 }, CANVAS, GUTTER);
    expect(r.position.canvasY).toBe(400 + GUTTER);
    expect(r.position.canvasX).toBe(0);
  });

  it("grows row height to the tallest item in the row", () => {
    const a = placeNext(empty(), { width: 600, height: 400 }, CANVAS, GUTTER);
    const b = placeNext(a.state, { width: 600, height: 700 }, CANVAS, GUTTER);
    expect(b.state.rowHeight).toBe(700);
  });

  it("oversized artifact gets its own full-width row", () => {
    const r = placeNext(empty(), { width: 3000, height: 500 }, CANVAS, GUTTER);
    expect(r.position).toEqual({ canvasX: 0, canvasY: 0 });
    const r2 = placeNext(r.state, { width: 600, height: 400 }, CANVAS, GUTTER);
    expect(r2.position.canvasY).toBeGreaterThan(0);
  });
});
