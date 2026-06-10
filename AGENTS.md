<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Cursor Cloud specific instructions

**FC Allschwil WebApp** — Next.js 16 club management platform (single app + PostgreSQL). See `package.json` scripts for standard commands.

### Services

| Service | Port | Start |
|---------|------|-------|
| Next.js dev server | 3000 | `npm run dev` |
| PostgreSQL | 5432 | `sudo pg_ctlcluster 16 main start` (if not running) |

There is no `docker-compose` in this repo; PostgreSQL must be provided locally or via a hosted URL in `DATABASE_URL`.

### First-time database setup (once per environment)

1. Copy env: `cp .env.example .env` and set `DATABASE_URL` (local example: `postgresql://fca:fca_dev@localhost:5432/fc_allschwil`), `NEXTAUTH_SECRET`, `APP_BASE_URL`, `NEXTAUTH_URL`.
2. Ensure PostgreSQL is running and the database/user exist (local dev uses user `fca`, db `fc_allschwil`).
3. `npm run db:migrate:deploy` → `npm run db:seed` → `BOOTSTRAP_ADMIN_PASSWORD=<temp> npm run db:bootstrap-admin`
4. Optional demo data: `npm run db:seed-demo`

Default bootstrap admin: `admin@fcallschwil.ch` (password from `BOOTSTRAP_ADMIN_PASSWORD`).

### Lint / build / health

- Lint: `npm run lint` (3 existing warnings, 0 errors)
- Build: `npm run build`
- Health check (dev running): `curl http://localhost:3000/api/health`
- Login page: `http://localhost:3000/login` → redirects to `/dashboard` after auth

### Gotchas

- `postinstall` runs `prisma generate`, which requires `DATABASE_URL` to be set (via `.env` or exported) before `npm install`.
- `prisma migrate dev` may need `SHADOW_DATABASE_URL` for some migrations; use `npm run db:migrate:deploy` for non-interactive apply.
- No automated test suite in `package.json`; verify with lint, build, and manual/API checks.
