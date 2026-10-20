// Node preload: sends the Neon driver's calls for the fake host ep-local.pglite.local to the local database server.
const real = globalThis.fetch;
globalThis.fetch = function (input, init) {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  if (url.startsWith("https://api.pglite.local/")) return real("http://127.0.0.1:4400/sql", init);
  return real(input, init);
};
