import express from "express";
import fs from "fs";
import path from "path";
import { createServer as createViteServer, createLogger } from "vite";
import viteConfig from "../vite.config";
import { nanoid } from "nanoid";

const viteLogger = createLogger();

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

export async function setupVite(app: Express, server: Server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true as const,
  };

  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        process.exit(1);
      },
    },
    server: serverOptions,
    appType: "custom",
  });

  app.use(vite.middlewares);
  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;

    try {
      const clientTemplate = path.resolve(
        import.meta.dirname,
        "..",
        "client",
        "index.html",
      );

      // always reload the index.html file from disk incase it changes
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`,
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

export function serveStatic(app: Express) {
  // Try multiple paths to find the built client files
  const possiblePaths = [
    // When server runs with tsx from source (e.g., tsx server/index.ts)
    path.resolve(process.cwd(), "dist", "public"),
    // When server runs from dist folder
    path.resolve(import.meta.dirname, "public"),
    // Alternative: relative to import.meta.dirname going up one level
    path.resolve(import.meta.dirname, "..", "dist", "public"),
  ];

  console.log(`[Static] Looking for client build in:`);
  console.log(`[Static]   process.cwd(): ${process.cwd()}`);
  console.log(`[Static]   import.meta.dirname: ${import.meta.dirname}`);

  let actualPath: string | null = null;
  for (const p of possiblePaths) {
    console.log(`[Static]   Checking: ${p} - exists: ${fs.existsSync(p)}`);
    if (fs.existsSync(p)) {
      actualPath = p;
      break;
    }
  }

  if (!actualPath) {
    console.error(`[Static] Build directory not found! Tried:`);
    possiblePaths.forEach(p => console.error(`  - ${p}`));
    throw new Error(
      `Could not find the build directory, make sure to build the client first with: npm run build`,
    );
  }

  // Check if assets folder exists
  const assetsPath = path.resolve(actualPath, "assets");
  console.log(`[Static] Assets path: ${assetsPath}, exists: ${fs.existsSync(assetsPath)}`);
  if (fs.existsSync(assetsPath)) {
    const assetFiles = fs.readdirSync(assetsPath);
    console.log(`[Static] Assets folder contents: ${assetFiles.length} files`);
    const cssFiles = assetFiles.filter(f => f.endsWith('.css'));
    console.log(`[Static] CSS files: ${cssFiles.join(', ')}`);
  }

  console.log(`[Static] Serving static files from: ${actualPath}`);
  
  // Serve assets folder with specific route to ensure JS/CSS files are served correctly
  app.use("/assets", express.static(path.join(actualPath, "assets"), { 
    maxAge: '1y', // Long cache for hashed assets
    etag: true,
    immutable: true
  }));

  // Serve static HTML files from docs/ explicitly (bypass SPA catch-all)
  // Register BEFORE generic static middleware so no-cache headers are applied.
  const docsPath = path.join(actualPath, "docs");
  console.log(`[Static] Docs path: ${docsPath}, exists: ${fs.existsSync(docsPath)}`);
  if (fs.existsSync(docsPath)) {
    const docFiles = fs.readdirSync(docsPath);
    console.log(`[Static] Docs folder contents: ${docFiles.join(', ')}`);
  }
  app.use("/docs", express.static(docsPath, {
    maxAge: 0,
    etag: true,
    setHeaders: (res) => {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    }
  }));
  
  // Serve other static files (favicon, etc.)
  app.use(express.static(actualPath, { 
    maxAge: '1d',
    etag: true,
    index: false // Don't serve index.html for directory requests via static
  }));

  // fall through to index.html if the file doesn't exist (SPA routing)
  app.use("*", (_req, res) => {
    res.sendFile(path.resolve(actualPath, "index.html"));
  });
}
