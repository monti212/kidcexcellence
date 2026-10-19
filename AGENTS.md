<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Kidcellence — agent guide

Botswana childcare marketplace. Parents discover and message providers;
providers publish listings and submit verification; admins approve them.

`README.md` covers setup, env vars, storage drivers, and the API route list.
Read it for those. This file covers what the code does not make obvious and
what is easy to get wrong.

## Start here

`lib/platform-store.ts` is the whole backend. Users, sessions, profiles,
uploads, verifications, analytics, and conversations all live in one JSON
document behind one module. There is no database and no auth library. Read this
file before changing anything server-side — most questions are answered in it.

## Architecture invariants

**All writes go through `updateStore()`.** It does read → mutate → persist as a
unit. Never write the store file directly, and never persist from inside a
route handler.

**Route handlers are the only API boundary.** No server actions; `app/api/**`
owns every mutation. Keep the response contracts stable if you swap the storage
layer — they are what the client is coupled to, not the store's shape.

**`normalizeStore()` is the migration mechanism.** New fields get defaulted or
backfilled there so old stored documents keep loading. If you add a field to a
record type, add its default in `normalizeStore` in the same change, or
existing data will read back `undefined`.

**Declare `export const runtime = "nodejs"` on any route that touches the
store.** It uses `node:crypto` and `node:fs`. The four routes without it
(`providers`, `providers/[id]`, `compare`, `admin/featured-providers`) are
read-only and intentionally left alone.

## Auth and account types

Three roles on one `users` array: `parent`, `provider`, `admin`.

**`user.role` is the *active* role; `user.roles` is every role the account
holds.** Accounts can switch between parent and provider from `/settings`
(`switchActiveRole`). Authorization checks key off `role`, so flipping it
changes what many unrelated surfaces do at once — search visibility, the
message inbox, the admin provider roster. Trace the consequences before adding
another `role`-dependent check.

**Admin is allowlist-only and switchable in neither direction.** `isAdminEmail`
checks `BUILT_IN_ADMIN_EMAILS` plus the `ADMIN_EMAILS` env var. An allowlisted
email is force-promoted to admin on any login; a non-allowlisted request asking
for admin is rejected; an admin cannot demote themselves. Never add a code path
that writes `role: "admin"` from request input — that grants verification
approval and read access to every provider's ID documents and police
clearances.

**The session cookie is self-contained.** `kidcellence_session` holds an
AES-256-GCM sealed payload (the user, their role, and the session claims), so
**mutating a user's role or permissions requires re-issuing the cookie** —
otherwise the stale token keeps the old role until it expires. `switchActiveRole`
revokes prior sessions and issues a fresh one; follow that pattern.

Because the token is self-contained, `getSessionByToken` will **rehydrate a user
and session back into the store** from a valid cookie when the store has no
matching row. That is deliberate resilience for ephemeral storage. It also means
revocation needs the explicit `revokedSessionTokens` denylist — deleting a
session row alone does not log anyone out.

**Every mutating route needs two guards**, matching the existing routes:

```ts
if (!isSameOriginMutation(request)) return 403;   // CSRF defense (no tokens)
const rateLimit = consumeRateLimit({ key, limit, windowMs });
```

`consumeRateLimit` is an in-memory `Map` — per-instance and reset on cold
start. Treat it as soft protection, not a real control.

## Provider listings

A provider is only publicly visible when **all** of these hold: `role` is
`provider`, the profile is `published`, and it passes
`missingPublishRequirements` (display name, location, bio, services, phone,
starting price). `accountProvidersFromStore` enforces the first two.

Signup creates a starter profile with `published: true`; switching into the
provider role creates one with `published: false`, so a settings toggle cannot
push an unfinished listing into search. Keep that asymmetry.

The `PROVIDERS` array in `lib/mock-data.ts` is demo data gated behind
`ENABLE_DEMO_PROVIDERS`. Do not add real listings there and do not enable it by
default.

## Services (provider categories)

`lib/services.ts` is the service catalogue and the only place a service is
defined. Each `SERVICES` entry drives the home page tile and headline count,
search filters, signup and profile category pickers, listing badge and icon,
verification documents, required profile details, pricing copy, the profile
form's service-specific fields, the public listing, and the admin review card.
If you find yourself writing `category === "some-id"` anywhere else, add a
field to `ServiceDefinition` instead.

### Adding a service

1. Add one entry to `SERVICES`. The `id` is a plural slug
   (`postpartum-nurses`) stored on every profile of that service: never rename
   or delete one that has shipped.
2. Use `profileTemplate: "standard"` and describe service-specific profile
   fields in `detailFields`. Values live in `profile.serviceDetails`, are
   sanitized against the catalogue on every save (unknown keys and off-list
   select values are dropped), appear on the public listing and the admin
   card, and `required` ones block verification submission. No changes to the
   store, `normalizeStore`, the profile route, or the form are needed.
3. List the verification `documents`. Reuse the shared constants
   (`CERTIFIED_ID_DOCUMENT`, `POLICE_CLEARANCE_DOCUMENT`) where they fit.
   `sensitive: true` documents are admin-only.
4. Set what applies: `pricing` (copy, `defaultUnit`, whether a price is
   required for verification), `servicesPlaceholder`, `tone`,
   `priceVisibleToParentsOnly`, `vettingPackages`. A new billing unit goes in
   `PRICE_UNITS`.
5. Run `npm test`. The "Service catalogue" test checks the entry is internally
   consistent, and the discovery assertions count services from the API, so a
   new service needs no test edits. Add a flow test only for new rules. The
   catalogue test imports TypeScript directly and needs Node 22.18+.
6. Decide what code can't: which subscription tier the service sits in on
   `/pricing` (hand-written copy) and whether it earns a footer link.

Two traps:

- **`detailFields` are public.** Anything private (ID numbers, addresses,
  referee phone numbers) belongs in a document, not a field.
- **Select options are part of stored data.** A stored value that no longer
  matches an option is ignored everywhere (listing, admin card, verification
  checks), so renaming an option sends those providers back to pick again.

The five older templates (`care-worker`, `school`, `pediatric`, `transport`,
`party`) predate the catalogue and keep their bespoke top-level profile
columns and hand-built form sections. Do not add new columns for new services.

## Verification

Lifecycle: `not_submitted → pending → approved | rejected`.
`submitProviderVerification` gates on effective payment, required profile
fields, and per-service documents (`lib/services.ts`, applied by
`lib/verification-requirements.ts`) before an admin can decide it.

Payment is layered: `effectiveVerificationPayment` treats an account inside its
free month (`FREE_FULL_ACCESS_MONTHS`, from `createdAt`) as paid. Stripe is
wired as **hosted payment links with no webhooks**, so approval trusts the
redirect. Do not assume a verified payment signal exists.

## UI conventions

- Client components with `usePlatformSession()` for auth state; there is **no
  `middleware.ts`** and page-level gating is UI-only. Real authorization lives
  in the route handlers.
- shadcn/Base UI primitives in `components/ui/`, `lucide-react` icons.
- Style with the brand CSS variables from `app/globals.css`
  (`var(--brand-ink)`, `--brand-leaf`, `--brand-coral`, `--brand-line`,
  `--brand-ivory`, …) rather than raw hex or default Tailwind palette colors.
  Match the rounded-full buttons and `font-black` headings already in use.
- Signed-out states render an inline sign-in prompt, not a redirect. Copy the
  pattern from `app/profile/parent/page.tsx`.

## Testing

`npm test` runs `scripts/integration-smoke.mjs`: it boots a real dev server on
a temp port with isolated store and upload paths, then drives the API over
HTTP. Add coverage there for any API change.

Two traps that have already caused wrong assertions:

- **It is HTTP-only — there is no browser.** Anything rendered client-side
  after the session resolves is not in the server HTML. Assert on the
  pre-session shell and grep the component source, as the `/auth` and
  `/settings` cases do.
- **Assert the contract, not your assumption about it.** Several handlers are
  scoped to the caller's own record rather than role-gated, so they return 200
  where a role check might be expected. Read the handler before asserting a
  status.

Before claiming work is done: `npx tsc --noEmit`, `npm run lint`, `npm test`.
For user-visible changes, also drive the real UI — the integration suite cannot
see rendering or client-side behavior.

## Notes for anything touching production

- `next dev` rewrites `package.json` / `package-lock.json`, pinning exact
  `typescript` and `@types` versions. Those edits are a tooling side effect,
  not your change — commit them separately. (The generated block above claims
  `next dev` re-adds it too, but that generator is not present in Next
  `16.2.2`; treat the block as a normal tracked file.)
- `SESSION_SECRET` falls back to a hardcoded development string. If it ships
  unset, session tokens are forgeable and roles can be forged with them.
- Password reset and email verification **return the token in the HTTP
  response** because email delivery is not configured. Anyone who can call the
  endpoint can reset any account.
- `POST /api/profiles/provider` checks ownership but not role.

These are known gaps, listed so you do not mistake them for intended design.
`README.md` tracks the broader production-readiness list.
