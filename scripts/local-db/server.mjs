// A local stand-in for Neon: an in-memory Postgres (PGlite) behind the same SQL-over-HTTP endpoint the app's driver calls.
// It applies every migration in /drizzle on start. Nothing touches the real database. See README.md in this folder.
//   node scripts/local-db/server.mjs
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const { PGlite, types } = await import(pathToFileURL(path.join(root, "node_modules/@electric-sql/pglite/dist/index.js")).href);
const pg = new PGlite();
for (const f of fs.readdirSync(path.join(root, "drizzle")).filter((x) => x.endsWith(".sql")).sort()) {
  await pg.exec(fs.readFileSync(path.join(root, "drizzle", f), "utf8").replaceAll("--> statement-breakpoint", ""));
  console.log("applied", f);
}

// Neon sends and expects raw text for every value; the driver parses it by type.
const parsers = {};
for (const oid of Object.values(types)) if (typeof oid === "number") parsers[oid] = (v) => v;

const text = (v) => (v === null ? null : typeof v === "string" ? v : typeof v === "object" ? JSON.stringify(v) : String(v));

http
  .createServer(async (req, res) => {
    let body = "";
    for await (const c of req) body += c;
    try {
      const { query, params } = JSON.parse(body);
      const r = await pg.query(query, params ?? [], { rowMode: "array", parsers });
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({ command: "", rowCount: r.affectedRows ?? r.rows.length, rows: r.rows.map((row) => row.map(text)), fields: r.fields.map((f) => ({ name: f.name, dataTypeID: f.dataTypeID })) }));
    } catch (e) {
      console.error("SQL error:", e.message);
      res.statusCode = 400;
      res.end(JSON.stringify({ message: e.message, code: e.code ?? "XX000" }));
    }
  })
  .listen(4400, "127.0.0.1", () => console.log("local database on http://127.0.0.1:4400"));
