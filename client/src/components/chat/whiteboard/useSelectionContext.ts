import { create } from "zustand";

export interface SelectionContextState {
  artifactIds: string[];
  highlightedText?: string;
  setArtifacts: (ids: string[]) => void;
  setHighlight: (ids: string[], text: string) => void;
  clear: () => void;
}

export const useSelectionContext = create<SelectionContextState>((set) => ({
  artifactIds: [],
  highlightedText: undefined,
  setArtifacts: (ids) => set({ artifactIds: ids, highlightedText: undefined }),
  setHighlight: (ids, text) => set({ artifactIds: ids, highlightedText: text }),
  clear: () => set({ artifactIds: [], highlightedText: undefined }),
}));
