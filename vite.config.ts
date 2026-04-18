import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// npm hoists chevrotain@7 (needed by fast-formula-parser) to the repo root.
// chevrotain-allstar requires chevrotain@^12 which lives at
// node_modules/langium/node_modules/chevrotain. Vite / esbuild's default
// resolution finds the hoisted v7 first and blows up on missing exports.
// This plugin redirects ONLY chevrotain-allstar's `import "chevrotain"` to
// the nested v12, leaving fast-formula-parser's imports untouched.
const CHEVROTAIN_V12 = path.resolve(
  import.meta.dirname,
  "node_modules/langium/node_modules/chevrotain",
);

function chevrotainVersionPin() {
  return {
    name: "chevrotain-version-pin",
    enforce: "pre" as const,
    resolveId(id: string, importer: string | undefined) {
      if (id !== "chevrotain") return null;
      if (!importer) return null;
      if (importer.includes("chevrotain-allstar") || importer.includes("/langium/")) {
        // Point at the package root — Vite will resolve the main field from there.
        return this.resolve?.(CHEVROTAIN_V12, importer, { skipSelf: true }) ?? CHEVROTAIN_V12;
      }
      return null;
    },
  };
}

export default defineConfig({
  plugins: [
    chevrotainVersionPin(),
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
});
