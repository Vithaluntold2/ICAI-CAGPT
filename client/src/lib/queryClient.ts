import { QueryClient, QueryFunction } from "@tanstack/react-query";

// Global handler for 401 errors - clears localStorage and redirects to login
function handle401() {
  // Clear user from localStorage
  localStorage.removeItem('ca_user');
  
  // Only redirect if not already on auth page
  if (!window.location.pathname.includes('/auth')) {
    window.location.href = '/auth';
  }
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    // Handle 401 globally - session expired
    if (res.status === 401) {
      handle401();
    }
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const res = await fetch(url, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(queryKey.join("/") as string, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: (failureCount, error) => {
        // Retry on 503 (server starting) up to 3 times
        if (error instanceof Error && error.message.includes('503')) {
          return failureCount < 3;
        }
        return false;
      },
      retryDelay: 1000, // Wait 1 second between retries
    },
    mutations: {
      retry: false,
    },
  },
});
