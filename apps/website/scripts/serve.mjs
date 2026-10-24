import path from "node:path";
import { fileURLToPath } from "node:url";
import { createStaticServer } from "./static-server.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../out");
const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || "127.0.0.1";
const server = await createStaticServer(root).catch(() => { throw new Error("Run npm run build before npm start."); });
server.listen(port, host, () => console.log(`SnapSlot static preview: http://${host}:${port}/zh-Hans/`));
