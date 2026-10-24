import http from "node:http";
import { createReadStream } from "node:fs";
import { realpath, stat } from "node:fs/promises";
import path from "node:path";

const types = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png",
  ".json": "application/json", ".txt": "text/plain; charset=utf-8", ".ico": "image/x-icon",
  ".woff2": "font/woff2", ".woff": "font/woff", ".zip": "application/zip",
  ".dmg": "application/x-apple-diskimage", ".exe": "application/vnd.microsoft.portable-executable",
};
function rangeOf(value, size) {
  const match = /^bytes=(\d*)-(\d*)$/.exec(value);
  if (!match || (!match[1] && !match[2])) return null;
  const suffix = match[1] === "";
  const start = suffix ? Math.max(0, size - Number(match[2])) : Number(match[1]);
  const end = suffix || match[2] === "" ? size - 1 : Math.min(size - 1, Number(match[2]));
  if (![start, end].every(Number.isSafeInteger) || start < 0 || start > end || start >= size) return null;
  return { start, end };
}
export async function createStaticServer(directory) {
  const root = await realpath(directory);
  return http.createServer(async (req, res) => {
    if (!["GET", "HEAD"].includes(req.method)) { res.writeHead(405, { Allow: "GET, HEAD" }); res.end(); return; }
    try {
      const pathname = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
      let file = path.resolve(root, "." + pathname);
      if (file !== root && !file.startsWith(root + path.sep)) { res.writeHead(403); res.end(); return; }
      let info = await stat(file).catch(() => null);
      if (info?.isDirectory()) { file = path.join(file, "index.html"); info = await stat(file).catch(() => null); }
      if (!info?.isFile()) {
        file = path.join(root, "404.html"); res.statusCode = 404;
        info = await stat(file).catch(() => null);
        if (!info?.isFile()) { res.end("Not found"); return; }
      }
      const actual = await realpath(file);
      if (!actual.startsWith(root + path.sep)) { res.writeHead(403); res.end(); return; }
      const etag = `"${info.size.toString(16)}-${Math.trunc(info.mtimeMs).toString(16)}"`;
      res.setHeader("Content-Type", types[path.extname(file)] || "application/octet-stream");
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("ETag", etag); res.setHeader("Last-Modified", info.mtime.toUTCString());
      res.setHeader("Cache-Control", "no-cache");
      const download = res.statusCode === 200 && /^\/downloads\/v\d+\.\d+\.\d+\/[^/]+\.(dmg|exe)$/.test(pathname);
      if (download) {
        res.setHeader("Content-Disposition", `attachment; filename="${path.basename(file).replace(/["\\\r\n]/g, "_")}"`);
        res.setHeader("Accept-Ranges", "bytes"); res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      } else if (res.statusCode === 200 && pathname.startsWith("/_next/static/")) {
        res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      }
      if (res.statusCode === 200 && req.headers["if-none-match"] === etag) { res.writeHead(304); res.end(); return; }
      let range;
      const ifRange = req.headers["if-range"];
      if (download && req.method === "GET" && req.headers.range && (!ifRange || ifRange === etag || ifRange === info.mtime.toUTCString())) {
        range = rangeOf(req.headers.range, info.size);
        if (!range) { res.writeHead(416, { "Content-Range": `bytes */${info.size}`, "Content-Length": 0 }); res.end(); return; }
        res.statusCode = 206; res.setHeader("Content-Range", `bytes ${range.start}-${range.end}/${info.size}`);
      }
      res.setHeader("Content-Length", range ? range.end - range.start + 1 : info.size);
      if (req.method === "HEAD") { res.end(); return; }
      const stream = createReadStream(file, range);
      stream.on("error", () => res.destroy()); res.on("close", () => stream.destroy()); stream.pipe(res);
    } catch {
      if (!res.headersSent) res.writeHead(400);
      res.end();
    }
  });
}
