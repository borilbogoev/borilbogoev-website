# Local database for testing

Runs the whole app (admin, builders, public pages, statistics, the `landing` CLI) against an in-memory Postgres, so nothing touches the Neon database. The data is gone when you stop the server.

```bash
# 1. the database (applies drizzle/*.sql)
node scripts/local-db/server.mjs

# 2. the environment for the app, in another terminal (shell variables win over .env.local)
export DATABASE_URL="postgresql://u:p@ep-local.pglite.local/neondb"
export AUTH_SECRET="local-test-secret-local-test-secret-1234"
export BLOB_READ_WRITE_TOKEN=""                      # no file storage locally
export LANDING_SITE_URL="http://localhost:3000"      # where the CLI asks for a page refresh
export CRON_SECRET="local"                           # also the CLI refresh token
export NODE_OPTIONS="--require \"$PWD/scripts/local-db/preload.cjs\""   # quotes matter when the path has spaces

npm run dev                                          # or: npm run build && npm start
npm run landing -- list                              # the CLI talks to the same local database

# 3. sign in to /admin: create an owner and put the printed value in a cookie named bb_session
node scripts/local-db/seed-admin.mjs
```

The Neon driver always calls `https://api.<host>/sql`; `preload.cjs` redirects calls for the fake host `*.pglite.local` to the local server.
