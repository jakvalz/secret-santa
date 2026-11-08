/**
 * Local demo server: same API as Netlify Functions, file-backed store.
 * Usage: node server.mjs
 */
import http from "node:http";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { handler } from "./netlify/functions/api.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(__dirname, "public");
const PORT = Number(process.env.PORT || 8787);

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".json": "application/json",
  ".woff2": "font/woff2",
};

async function serveStatic(urlPath, res) {
  let rel = decodeURIComponent(urlPath.split("?")[0]);
  if (rel === "/" || rel === "") rel = "/index.html";
  // SPA fallback for non-file routes
  const candidate = path.join(PUBLIC, rel);
  const resolved = path.resolve(candidate);
  if (!resolved.startsWith(PUBLIC)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }
  try {
    const data = await fs.readFile(resolved);
    const ext = path.extname(resolved);
    res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
    res.end(data);
  } catch {
    // SPA: serve index for unknown paths (except /api)
    const index = await fs.readFile(path.join(PUBLIC, "index.html"));
    res.writeHead(200, { "Content-Type": MIME[".html"] });
    res.end(index);
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host}`);

  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/.netlify/functions/api")) {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = Buffer.concat(chunks).toString("utf8");

    const event = {
      httpMethod: req.method,
      path: url.pathname.replace(/^\/\.netlify\/functions\/api/, "/api"),
      body: body || null,
      queryStringParameters: Object.fromEntries(url.searchParams.entries()),
      headers: req.headers,
    };

    const result = await handler(event);
    res.writeHead(result.statusCode, result.headers || {});
    res.end(result.body || "");
    return;
  }

  await serveStatic(url.pathname, res);
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`Secret Santa local server: http://127.0.0.1:${PORT}`);
});
