import { useQuery } from "@tanstack/react-query";

export interface ClientFeatures {
  whiteboardV2: boolean;
  [k: string]: unknown;
}

interface FeaturesResponse {
  features: ClientFeatures;
  environment?: unknown;
}

export function useFeatureFlags() {
  return useQuery<ClientFeatures>({
    queryKey: ["features"],
    queryFn: async () => {
      const res = await fetch("/api/features", { credentials: "include" });
      if (!res.ok) return { whiteboardV2: false };
      const body = (await res.json()) as FeaturesResponse | ClientFeatures;
      if (body && typeof body === "object" && "features" in body) {
        return (body as FeaturesResponse).features;
      }
      return body as ClientFeatures;
    },
    staleTime: 60_000,
  });
}
