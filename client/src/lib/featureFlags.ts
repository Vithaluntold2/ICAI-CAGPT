import { useQuery } from "@tanstack/react-query";

export interface ClientFeatures {
  WHITEBOARD_V2: boolean;
  [k: string]: unknown;
}

export function useFeatureFlags() {
  return useQuery<ClientFeatures>({
    queryKey: ["features"],
    queryFn: async () => {
      const res = await fetch("/api/features", { credentials: "include" });
      if (!res.ok) return { WHITEBOARD_V2: false };
      return res.json();
    },
    staleTime: 60_000,
  });
}
