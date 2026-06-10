# CusCuciin — Laundry Server API

REST API for the CusCuciin laundry management system, built with Express.js + TypeScript + Prisma over MySQL.

## Requirements

- **pnpm** (package manager)
- **Node.js** v20.19.0 (use `nvm use` — `.nvmrc` is provided)
- **MySQL** database

## Technology Stack

1. **TypeScript**
2. **Node.js** with **Express.js** framework
3. **REST API**
4. **MySQL** database
5. **Prisma** ORM
6. **JWT** Authentication (dual: admin Users + customer Members)
7. **Zod** schema validation
8. **Pino** logging
9. **Nodemailer** for email notifications
10. **Helmet** for baseline HTTP security headers

## Quick Start

1. Clone the repository
2. Set up environment variables (copy `docs/.env.example` and fill in your values — the committed `.env.development` works for local dev)
3. Use the correct Node version:
   ```sh
   nvm use
   ```
4. Install dependencies:

   ```sh
   pnpm install
   ```

5. Set up the database autoincrement table:
   ```sh
   pnpm db:setup
   ```
6. (Optional) Generate initial seed data:
   ```sh
   pnpm seed
   # Choose "initial" for required data (users, levels, services, settings)
   # or "generate" to create fake customers
   ```
7. Start the dev server:
   ```sh
   pnpm dev
   # Server runs on http://localhost:3001
   ```

## Commands

| Command | Description |
|---|---|
| `pnpm install` | Install dependencies |
| `pnpm dev` | Start dev server with hot reload (port 3001) |
| `pnpm build` | Compile TypeScript to `build/` |
| `pnpm start` | Run compiled production server |
| `pnpm db:generate` | Generate Prisma client |
| `pnpm db:push` | Push schema to database |
| `pnpm db:pull` | Pull schema from database |
| `pnpm db:migrate` | Run Prisma migrations |
| `pnpm db:sync` | Sync Prisma schema with migrations |
| `pnpm db:studio` | Open Prisma Studio GUI |
| `pnpm db:setup` | Populate `tb_autoincrement` table (run after schema changes that add new entity types) |
| `pnpm seed` | Interactive seed script |
| `pnpm start:local` | Production mode using local build |
| `pnpm seed:prod` / `db:*:prod` | Production-mode equivalents |

## JWT Key Generation

Generate RSA key pair for JWT signing:

```sh
# Private key
openssl genrsa -out private_key.pem 2048

# Public key
openssl rsa -in private_key.pem -pubout -out public_key.pem
```

Place the key paths in your environment variables.

## Project Structure

```
src/
├── app/              # Feature modules (auth, user, laundryQueue, payment, etc.)
│   └── <feature>/
│       ├── *.routes.ts
│       ├── *.controller.ts
│       ├── *.service.ts
│       └── *.schema.ts
├── configs/          # Environment vars, Prisma client, logger, nodemailer
├── core/             # BaseRouter, BaseController, BaseService abstractions
├── database/         # Setup, seed scripts
├── helpers/          # JWT, autoincrement IDs, email, pagination, file upload
├── middlewares/      # Auth, validation, error handling, logging, file upload
└── utils/            # Decorators, auth utilities, version info
```

## Key Design Notes

- **Prefix ID convention**: All primary keys are prefixed strings (e.g., `USR-0001`, `LQU-0042`) generated via `tb_autoincrement`. New entity types require an entry in `DB_AUTOINC_COLOUMNS` and `pnpm db:setup`.
- **Dual auth**: Admin Users (`/auth/user/*`) and customer Members (`/auth/member/*`) are completely separate systems — different session stores, middleware, and JWT keys. Do not merge them.
- **No DB-level foreign keys**: `relationMode = "prisma"` — referential integrity is enforced at the application level by Prisma.
- **Env loading**: `TS_NODE_DEV` → `.env.development`, `NODE_ENV=testing` → `.env.test`, otherwise → `.env`.

## Security

[Helmet](https://helmetjs.github.io/) is registered globally in `src/app.ts` immediately after CORS, applying a safe baseline of HTTP security headers to every response.

### Why Helmet was added

Without explicit security headers, the API relied on browser defaults and leaked framework information (the `X-Powered-By: Express` header) that aids reconnaissance. Helmet closes that gap with minimal effort and zero behavioural change for legitimate clients.

### Protections enabled (Helmet defaults)

| Header | Purpose |
|---|---|
| `X-Frame-Options: SAMEORIGIN` | Clickjacking protection — pages can only be framed by the same origin. |
| `X-Content-Type-Options: nosniff` | Blocks MIME-type sniffing. |
| `Referrer-Policy: no-referrer` | `Referer` header is omitted on outbound navigations. |
| `Cross-Origin-Opener-Policy: same-origin` | Isolates browsing context. |
| `Origin-Agent-Cluster: ?1` | Requests origin-keyed agent clusters. |
| `X-DNS-Prefetch-Control: off` | Disables browser DNS prefetching. |
| `X-Download-Options: noopen` | Legacy IE download prompt hardening. |
| `X-Permitted-Cross-Domain-Policies: none` | Blocks legacy Flash/Acrobat cross-domain policies. |
| `X-XSS-Protection: 0` | Disables the legacy broken XSS auditor (modern browsers ignore it). |
| `Strict-Transport-Security: max-age=15552000; includeSubDomains` | HSTS for HTTPS deployments (only sent over secure connections). |
| `X-Powered-By` | Removed — reduces framework fingerprinting. |

### Configuration overrides (intentional)

- `contentSecurityPolicy: false` — CSP is **not** configured in this issue. The Next.js client uses inline styles and external assets that would require a tailored policy, and CSP is explicitly listed as a non-goal in issue 008. See *Future considerations* below.
- `crossOriginResourcePolicy: { policy: "cross-origin" }` — relaxed from Helmet's default `same-origin`. The Next.js client runs on a separate origin (`localhost:3379`) from this API (`localhost:3001`). The default `same-origin` would block the browser from loading uploaded images and static files served by this API. CORS is still enforced for credentialed cross-origin requests.

### Future security considerations

- **Content Security Policy (CSP)** — once the client and any third-party integrations are audited, a strict CSP should be introduced. The current `X-Frame-Options` covers the clickjacking concern in the meantime.
- **HSTS tuning** — Helmet's default 180-day HSTS is a safe starting point. Consider extending `max-age` and adding `preload` once the production domain is locked in.
- **Permissions Policy** — explicitly listed as a non-goal for this issue. Evaluate `Permissions-Policy` (e.g. camera, geolocation) before exposing features that need them.
- **CORS hardening** — tracked separately in issue 009.

### Related issues

- Issue 007 — Authentication rate limiting
- Issue 008 — Helmet security headers (this issue)
- Issue 009 — CORS review
- Issue 010 — Input sanitization

## Notes

- The `.env.development` file is committed (contains dev credentials). For production, use a separate `.env`.
- Uploaded files go to `.node_dev/uploads/` in dev and `public/uploads/` in prod.
- Tests are not yet configured (Jest is installed but no test suite exists — tracked in `.dev/TECHNICAL_DEBT.md` KI-02).
- See `AGENTS.md` in the repo root for full development conventions and known issues.
