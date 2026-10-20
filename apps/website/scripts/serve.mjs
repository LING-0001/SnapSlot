import http from "node:http";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";

const root = path.resolve("out");
const port = Number(process.env.PORT || 3000);
const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png",
  ".json": "application/json", ".txt": "text/plain; charset=utf-8", ".ico": "image/x-icon" };
await stat(root).catch(() => { throw new Error("Run npm run build before npm start."); });
http.createServer(async (req, res) => {
  if (!["GET", "HEAD"].includes(req.method)) { res.writeHead(405); res.end(); return; }
  try {
    const pathname = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
    let file = path.resolve(root, "." + pathname);
    if (file !== root && !file.startsWith(root + path.sep)) { res.writeHead(403); res.end(); return; }
    let info = await stat(file).catch(() => null);
    if (info?.isDirectory()) { file = path.join(file, "index.html"); info = await stat(file).catch(() => null); }
    if (!info?.isFile()) {
      file = path.join(root, "404.html");
      res.statusCode = 404;
      info = await stat(file);
    }
    res.setHeader("Content-Type", types[path.extname(file)] || "application/octet-stream");
    res.setHeader("Content-Length", info.size);
    res.setHeader("X-Content-Type-Options", "nosniff");
    if (req.method === "HEAD") { res.end(); return; }
    createReadStream(file).on("error", () => res.destroy()).pipe(res);
  } catch {
    if (!res.headersSent) res.writeHead(400);
    res.end();
  }
}).listen(port, "127.0.0.1", () => console.log(`SnapSlot static preview: http://127.0.0.1:${port}/zh-Hans/`));
