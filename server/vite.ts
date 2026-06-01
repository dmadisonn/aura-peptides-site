import { createServer as createViteServer, type ViteDevServer } from "vite";
import type { Server } from "http";
import type { Express } from "express";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function setupVite(httpServer: Server, app: Express) {
  const vite: ViteDevServer = await createViteServer({
    server: { middlewareMode: true, hmr: { server: httpServer } },
    appType: "spa",
    root: path.resolve(__dirname, "../client"),
  });
  app.use(vite.middlewares);
}
