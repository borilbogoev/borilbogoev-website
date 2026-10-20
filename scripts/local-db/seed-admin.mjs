// Creates an owner in the local database and prints a session cookie value for it (cookie name: bb_session).
//   AUTH_SECRET=... node scripts/local-db/seed-admin.mjs
import path from "node:path";
import { pathToFileURL } from "node:url";

const secret = process.env.AUTH_SECRET;
if (!secret || secret.length < 32) throw new Error("Set AUTH_SECRET (32+ characters), the same value the app runs with.");
const { SignJWT } = await import(pathToFileURL(path.join(process.cwd(), "node_modules/jose/dist/webapi/index.js")).href);
const id = "11111111-1111-4111-8111-111111111111";
await fetch("http://127.0.0.1:4400/sql", {
  method: "POST",
  body: JSON.stringify({ query: `INSERT INTO users (id, email, name, role, status) VALUES ('${id}','test@example.com','Test Owner','owner','active') ON CONFLICT DO NOTHING`, params: [] }),
});
const token = await new SignJWT({ ver: 0, method: "password" }).setProtectedHeader({ alg: "HS256" }).setSubject(id).setIssuedAt().setExpirationTime("14d").sign(new TextEncoder().encode(secret));
console.log(token);
