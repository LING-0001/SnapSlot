import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { once } from "node:events";
import { createStaticServer } from "../scripts/static-server.mjs";

let directory, server, origin;
const file = "/downloads/v1.0.0/SnapSlot-1.0.0-windows-x64-setup.exe";
const bytes = Buffer.from(Array.from({ length: 1024 }, (_, i) => i % 256));
before(async () => {
  directory = await mkdtemp(path.join(tmpdir(), "snapslot-download-check-"));
  await mkdir(path.join(directory, "downloads/v1.0.0"), { recursive: true });
  await mkdir(path.join(directory, "en"));
  await writeFile(path.join(directory, file), bytes);
  await writeFile(path.join(directory, "/downloads/v1.0.0/SnapSlot-1.0.0-macOS-universal.dmg"), bytes);
  await writeFile(path.join(directory, "404.html"), "Missing download");
  await writeFile(path.join(directory, "en/index.html"), "SnapSlot");
  server = await createStaticServer(directory); server.listen(0, "127.0.0.1"); await once(server, "listening");
  origin = `http://127.0.0.1:${server.address().port}`;
});
after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); await rm(directory, { recursive: true, force: true }); });
test("Installer GET/HEAD use attachment headers and immutable versioned URLs", async () => {
  const response = await fetch(origin + file);
  assert.equal(response.status, 200); assert.equal(response.headers.get("content-type"), "application/vnd.microsoft.portable-executable");
  assert.equal(response.headers.get("content-disposition"), 'attachment; filename="SnapSlot-1.0.0-windows-x64-setup.exe"');
  assert.match(response.headers.get("cache-control"), /immutable/); assert.equal(response.headers.get("accept-ranges"), "bytes");
  assert.deepEqual(Buffer.from(await response.arrayBuffer()), bytes);
  const head = await fetch(origin + file, { method: "HEAD" });
  assert.equal(head.status, 200); assert.equal(head.headers.get("content-length"), "1024"); assert.equal((await head.arrayBuffer()).byteLength, 0);
});
test("paused downloads resume with the requested bytes, including suffix and open-ended ranges", async () => {
  for (const [range, start, end] of [["bytes=100-199", 100, 199], ["bytes=1000-", 1000, 1023], ["bytes=-16", 1008, 1023]]) {
    const response = await fetch(origin + file, { headers: { Range: range } });
    assert.equal(response.status, 206); assert.equal(response.headers.get("content-range"), `bytes ${start}-${end}/1024`);
    assert.deepEqual(Buffer.from(await response.arrayBuffer()), bytes.subarray(start, end + 1));
  }
});
test("out-of-bounds/multiple ranges fail cleanly and a stale If-Range returns the full archive", async () => {
  for (const range of ["bytes=1024-", "bytes=10-2", "bytes=0-2,8-9", "bytes=-0"]) {
    const response = await fetch(origin + file, { headers: { Range: range } });
    assert.equal(response.status, 416); assert.equal(response.headers.get("content-range"), "bytes */1024");
  }
  const response = await fetch(origin + file, { headers: { Range: "bytes=0-9", "If-Range": '"old-version"' } });
  assert.equal(response.status, 200); assert.equal((await response.arrayBuffer()).byteLength, 1024);
});
test("missing binaries remain ordinary 404 responses and conditional requests return 304", async () => {
  const missing = await fetch(origin + "/downloads/v1.0.0/missing.exe");
  assert.equal(missing.status, 404); assert.equal(missing.headers.get("content-disposition"), null); assert.doesNotMatch(missing.headers.get("cache-control"), /immutable/);
  const first = await fetch(origin + file, { method: "HEAD" });
  const cached = await fetch(origin + file, { headers: { "If-None-Match": first.headers.get("etag") } });
  assert.equal(cached.status, 304); assert.equal((await cached.arrayBuffer()).byteLength, 0);
  const html = await fetch(origin + "/en/"); assert.equal(await html.text(), "SnapSlot"); assert.equal(html.headers.get("cache-control"), "no-cache");
});
test("only read methods are served and encoded traversal is rejected", async () => {
  assert.equal((await fetch(origin + file, { method: "POST" })).status, 405);
  assert.equal((await fetch(origin + "/..%2foutside.txt")).status, 403);
});

test("Mac DMGs are downloaded with their disk-image MIME type and attachment headers", async () => {
  const response = await fetch(origin + "/downloads/v1.0.0/SnapSlot-1.0.0-macOS-universal.dmg", { method: "HEAD" });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "application/x-apple-diskimage");
  assert.equal(response.headers.get("content-disposition"), 'attachment; filename="SnapSlot-1.0.0-macOS-universal.dmg"');
  assert.match(response.headers.get("cache-control"), /immutable/);
});
