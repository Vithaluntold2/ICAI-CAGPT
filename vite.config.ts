import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [
    react(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
      "highlight.js": path.resolve(import.meta.dirname, "node_modules/highlight.js"),
    },
  },
  root: path.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
  optimizeDeps: {
    // Mermaid is dynamic-imported by FlowchartArtifact; pre-bundling it pulls in
    // chevrotain-allstar which mis-resolves against the root chevrotain@7 instead
    // of the nested v12 it needs.
    exclude: ["mermaid"],
  },
});
