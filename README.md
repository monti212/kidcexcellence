# Kidcexcellence

Kidcexcellence is a Botswana childcare marketplace for parents and care providers. It includes provider discovery, side-by-side comparison, provider profiles, in-app messaging, parent/provider workspaces, and an admin verification workflow.

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

## Verification

```bash
npm run lint
npm run build
```

Use `npm run build` before deploying, then run `npm run start` for a production-like local server.

## Runtime Data

The app writes runtime data to `PLATFORM_STORE_PATH` and uploaded provider files to `PLATFORM_UPLOADS_DIR`.

Default:

```bash
./data/platform-store.json
```

For production hosts, set `PLATFORM_STORE_PATH` to a writable mounted path, for example:

```bash
PLATFORM_STORE_PATH=/var/lib/kidcexcellence/platform-store.json
PLATFORM_UPLOADS_DIR=/var/lib/kidcexcellence/uploads
```

Do not rely on the repository working directory as durable storage on serverless platforms. Use a mounted volume or migrate `lib/platform-store.ts` to a real database and object storage.

## Admin Access

Set `ADMIN_EMAILS` to a comma-separated list of emails allowed to create or use admin accounts. The first successful admin sign-in for an allowlisted email creates the admin account in the runtime store.

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
- Harden authentication with password reset, email verification, CSRF protection, finer-grained admin permissions, and distributed rate limiting.
- Move provider uploads from local disk to durable object storage for serverless production.
- Add automated end-to-end tests for auth, search, compare, messaging, profile saving, and admin verification.
- Configure a deployment target with a writable data layer or managed database.
