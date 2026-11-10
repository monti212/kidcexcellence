# Kidcellence

Kidcellence is a Botswana childcare marketplace for parents and care providers. It includes provider discovery, side-by-side comparison, provider profiles, in-app messaging, parent/provider workspaces, and an admin verification workflow.

## Current Platform Shape

- Next.js App Router on Next `16.2.2`
- React `19.2.4`
- Tailwind CSS 4 with shadcn/Base UI primitives
- Branded marketplace UI with search, compare, profile, messaging, auth, parent, provider, and admin surfaces
- Route-handler API boundary under `app/api`
- Server-side JSON persistence through `lib/platform-store.ts`
- Password hashing and HTTP-only session cookies for the current first-party auth flow
- Admin verification APIs protected by an admin session and `ADMIN_EMAILS` allowlist
- Basic in-memory rate limiting on auth, profile updates, message sends, and admin verification APIs
- Same-origin mutation checks for cookie-backed API writes
- Provider document and gallery uploads stored under the configured runtime uploads directory
- Baseline security headers configured through Next

The JSON store is suitable for local development and early demos. For production traffic, replace it with a managed database adapter while keeping the current API contracts stable.

## Local Setup

```bash
npm ci
cp .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

`ENABLE_DEMO_PROVIDERS=false` keeps the marketplace on real provider-owned
profiles only. Set it to `true` only when you intentionally want bundled sample
listings for local demonstrations.

## Verification

```bash
npm run lint
npm test
npm run build
```

Use `npm run build` before deploying, then run `npm run start` for a production-like local server.
`npm test` runs four suites: the HTTP integration suite and the file-store regression suite (local development store), the Postgres store and migration suites against a disposable real PostgreSQL server, and an end-to-end suite that runs three `next start` instances of the production build against one database and verifies every acknowledged write with SQL.

## Runtime Data

Platform records (accounts, sessions, profiles, conversations, messages,
uploads metadata, verifications, payments and analytics) are stored in
**Postgres via Netlify Database**. Uploaded files are stored in Netlify Blobs.
See [docs/persistence-architecture.md](docs/persistence-architecture.md) for
the design and its guarantees, and
[docs/production-migration-runbook.md](docs/production-migration-runbook.md)
for moving production off the old Blobs document.

| Environment | Records | Uploaded files |
| --- | --- | --- |
| Netlify (production, previews) | Netlify Database (`NETLIFY_DB_URL`, provided by Netlify) | Netlify Blobs |
| Local with `PLATFORM_DATABASE_URL` | That Postgres server | `PLATFORM_UPLOADS_DIR` or `./data/uploads` |
| Local without a database | `./data/platform-store.json` (development only) | `./data/uploads` |

On Netlify the app never falls back to files or Blobs for records: without a
database every request answers 503.

Schema changes live in `netlify/database/migrations/`. Netlify applies them to
deploy-preview branches on every deploy and to production just before publish.

### Environment variables

| Variable | Where | Purpose |
| --- | --- | --- |
| `PLATFORM_DATABASE_ALLOW_EMPTY_INIT` | Deploy previews and branch deploys only (Functions scope) | Lets a database with no imported data start empty. Never set in production: there the site answers 503 until the production import has run. |
| `PLATFORM_DATABASE_URL` | Local development and tests only | Any Postgres connection string. Never set on Netlify. |
| `PLATFORM_BLOB_STORE_NAME` | Every Netlify context (Functions scope) | Selects the uploads store: `kidcellence-platform` in production gives `kidcellence-uploads`; `kidcellence-platform-preview` gives `kidcellence-platform-preview-uploads`. |
| `PLATFORM_BLOB_STORE_ALLOW_PRODUCTION` | Production only | Required for the production uploads store. |

`netlify.toml` environment values do not reach functions at runtime; set these
in the Netlify dashboard.

### Failures and recovery

- A request is acknowledged only after its transaction commits.
- Storage failures are explicit: 503 `STORE_UNAVAILABLE` (database unreachable
  or not yet migrated), 503 `STORE_BUSY` (could not get the write lock within
  8 s), 409 `STORE_INTEGRITY` (a constraint rejected the change). Nothing is
  partially saved.
- Netlify Database takes a backup daily and on every production publish. Restoring
  one requires the Team Owner role (Data & Storage → Database → Backups).
- `npm run db:migrate -- export --database-url <url> --out <file>` writes the
  database back into the legacy JSON format (see the runbook before using it).

## Admin Access

Set `ADMIN_EMAILS` to a comma-separated list of emails allowed to create or use admin accounts. The first successful admin sign-in for an allowlisted email creates the admin account in the runtime store. Kidcellence also includes built-in admin access for `monti@uhuruai.co`, `gaone@uhuruai.co`, `katlotarniah@gmail.com`, and `kidcellencebw@gmail.com`.

## API Routes

- `GET /api/providers`
- `GET /api/providers/:id`
- `GET /api/compare?ids=1,2,5`
- `GET /api/messages`
- `POST /api/messages`
- `GET /api/admin/verifications`
- `PATCH /api/admin/verifications`
- `GET /api/auth`
- `POST /api/auth`
- `DELETE /api/auth`
- `POST /api/auth/verify-email`
- `POST /api/auth/reset-password`
- `GET /api/profiles/parent`
- `POST /api/profiles/parent`
- `GET /api/profiles/provider`
- `POST /api/profiles/provider`
- `GET /api/uploads`
- `POST /api/uploads`
- `GET /api/uploads/:id`
- `DELETE /api/uploads/:id`

## Production Readiness Notes

Before the platform is considered fully production complete:

- Replace the JSON store with a database-backed adapter.
- Connect password reset and email verification to a production email provider, then add CSRF token rotation, finer-grained admin permissions, and distributed rate limiting.
- Move provider uploads from local disk to durable object storage for serverless production.
- Add automated end-to-end tests for auth, search, compare, messaging, profile saving, and admin verification.
- Expand automated browser coverage for search, compare, provider profile editing, and responsive UI flows.
- Configure a deployment target with a writable data layer or managed database.
