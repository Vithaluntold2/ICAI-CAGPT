import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// npm hoists chevrotain@7 (needed by fast-formula-parser) to the repo root.
// chevrotain-allstar requires chevrotain@^12 which lives at
// node_modules/langium/node_modules/chevrotain. Vite/esbuild's default
// resolution finds the hoisted v7 first and blows up on missing exports
// (LLkLookaheadStrategy, getLookaheadPaths).
//
// Fix: redirect ONLY chevrotain-allstar's (and langium's) `import "chevrotain"`
// to the nested v12 entry file. Fast-formula-parser's v7 imports are untouched.
// v12 uses `"exports": { ".": { "import": "./lib/src/api.js" } }` — we point at
// that file directly because esbuild's resolver ignores nested node_modules
// when it matches an earlier hoisted copy.
const CHEVROTAIN_V12_ENTRY = path.resolve(
  import.meta.dirname,
  "node_modules/langium/node_modules/chevrotain/lib/src/api.js",
);

function shouldRedirectChevrotain(importer: string | undefined): boolean {
  if (!importer) return false;
  return importer.includes("chevrotain-allstar") || importer.includes("/langium/");
}

// Plugin that runs in Vite's module graph (post-pre-bundle, during dev requests).
function chevrotainVersionPin(): Plugin {
  return {
    name: "chevrotain-version-pin",
    enforce: "pre",
    async resolveId(id, importer) {
      if (id !== "chevrotain") return null;
      if (!shouldRedirectChevrotain(importer)) return null;
      return CHEVROTAIN_V12_ENTRY;
    },
  };
}

// Esbuild plugin that runs during Vite's dep pre-bundle (optimizeDeps phase).
const chevrotainVersionPinEsbuild = {
  name: "chevrotain-version-pin-esbuild",
  setup(build: any) {
    build.onResolve({ filter: /^chevrotain$/ }, (args: any) => {
      if (!shouldRedirectChevrotain(args.importer)) return null;
      return { path: CHEVROTAIN_V12_ENTRY };
    });
  },
};

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
  optimizeDeps: {
    esbuildOptions: {
      plugins: [chevrotainVersionPinEsbuild],
    },
  },
});
