import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "@/lib/auth";
import { Toaster } from "@/components/ui/toaster";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import App from "./App";
import { queryClient } from "@/lib/queryClient";
import "./index.css";
import "katex/dist/katex.min.css";
import "highlight.js/styles/github-dark.css";

// CRITICAL: we import the shared queryClient from @/lib/queryClient rather
// than constructing a second QueryClient here. Previously there were TWO
// separate QueryClient instances — main.tsx had its own `new QueryClient(…)`
// and /lib/queryClient.ts exported another. All useQuery() hooks consumed
// main.tsx's instance via <QueryClientProvider client={queryClient}>, while
// every non-hook code path (Chat.tsx, ChecklistArtifact, etc.) imported and
// wrote to /lib/queryClient's instance via `queryClient.setQueryData(…)`.
// Writes and reads hit different caches, so cache priming + manual updates
// were invisible to the subscribed components. Symptoms included the
// artifact-placeholder sticking on "[artifact … loading…]" until a full
// page reload forced a fresh fetch through the context-bound client.

// Initialize theme from localStorage or system preference
const initializeTheme = () => {
  const savedTheme = localStorage.getItem('theme');
  const isDarkMode = savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches);
  if (isDarkMode) {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
};

initializeTheme();

createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
      <Toaster />
    </AuthProvider>
  </QueryClientProvider>
);
