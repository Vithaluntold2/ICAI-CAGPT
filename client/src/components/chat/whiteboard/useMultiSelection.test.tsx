// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useMultiSelection } from "./useMultiSelection";

const order = ["a", "b", "c", "d"];

describe("useMultiSelection", () => {
  it("plain click replaces selection with single id", () => {
    const { result } = renderHook(() => useMultiSelection(order));
    act(() => result.current.click("b", { metaKey: false, shiftKey: false, ctrlKey: false }));
    expect([...result.current.selected]).toEqual(["b"]);
    act(() => result.current.click("c", { metaKey: false, shiftKey: false, ctrlKey: false }));
    expect([...result.current.selected]).toEqual(["c"]);
  });

  it("cmd-click toggles membership", () => {
    const { result } = renderHook(() => useMultiSelection(order));
    act(() => result.current.click("a", { metaKey: false, shiftKey: false, ctrlKey: false }));
    act(() => result.current.click("c", { metaKey: true, shiftKey: false, ctrlKey: false }));
    expect([...result.current.selected].sort()).toEqual(["a", "c"]);
    act(() => result.current.click("a", { metaKey: true, shiftKey: false, ctrlKey: false }));
    expect([...result.current.selected]).toEqual(["c"]);
  });

  it("shift-click selects range by order", () => {
    const { result } = renderHook(() => useMultiSelection(order));
    act(() => result.current.click("a", { metaKey: false, shiftKey: false, ctrlKey: false }));
    act(() => result.current.click("c", { metaKey: false, shiftKey: true, ctrlKey: false }));
    expect([...result.current.selected].sort()).toEqual(["a", "b", "c"]);
  });

  it("clear() empties selection", () => {
    const { result } = renderHook(() => useMultiSelection(order));
    act(() => result.current.click("a", { metaKey: false, shiftKey: false, ctrlKey: false }));
    act(() => result.current.clear());
    expect([...result.current.selected]).toEqual([]);
  });
});
