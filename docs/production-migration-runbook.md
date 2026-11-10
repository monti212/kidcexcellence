# Production migration runbook: Netlify Blobs → Netlify Database

Moves every Kidcellence platform record from the Netlify Blobs document
`kidcellence-platform/platform-store.json` into Netlify Database (Postgres).

Uploaded files stay in the `kidcellence-uploads` Blobs store and are not
moved. Their records keep the same `blob:` paths.

**Who runs it:** a Netlify Team Owner, because restoring a database backup
requires that role.

**Expected downtime:** 10 to 20 minutes, during which the site answers 503
"finishing a scheduled data migration".

Each step says what proves it worked. Stop at the first step that does not
match.

## 0. Ground rules

- Every file that contains store data has personal data and password hashes.
  - Keep these files encrypted, outside the repository, readable only by you.
  - Never paste them into chat, tickets or Slack.
  - Delete working copies when the cutover is accepted.
- Do not run `import` against production until steps 1 to 4 are complete.
- The scripts print counts, record ids and hashes only. They never print emails,
  names, tokens or password hashes.

## 1. Approvals and provisioning (before the cutover day)

1. Approve pushing `fix/postgres-persistence` and opening a pull request. The
   first deploy that contains `netlify/database/migrations/` provisions Netlify
   Database for the site. That consumes Netlify credits (see
   `docs/persistence-architecture.md`).
2. In **Site configuration → Environment variables**, add:

   | Variable | Scope | Production | Deploy Previews | Branch deploys |
   |---|---|---|---|---|
   | `PLATFORM_DATABASE_ALLOW_EMPTY_INIT` | Functions | *(not set)* | `true` | `true` |

   Keep the existing variables unchanged: `PLATFORM_BLOB_STORE_NAME` and
   `PLATFORM_BLOB_STORE_ALLOW_PRODUCTION`. They now select the uploads store
   only. Never set `PLATFORM_DATABASE_URL` on Netlify; Netlify Database
   provides `NETLIFY_DB_URL` itself.
3. Trigger the preview deploy after setting the variable, because values are
   fixed when a deploy is built. Then confirm all of the following:
   - **Schema:** in **Data & Storage → Database**, the database exists and the
     preview branch shows migration `0001_platform_store` applied.
   - **Initialisation:** `GET <preview>/api/providers` returns 200. That proves
     the preview database initialised empty.
   - **Production untouched:** the production site is unaffected. It still runs
     `main` on Blobs.

## 2. Verify concurrency on the deployed preview

1. Get both connection strings. Confirm in each command's output which database
   branch it describes before using it.

   ```bash
   cd /Users/gaonemolefi/kidcel/kidcexcellence
   netlify database status --branch <preview-branch-name> --show-credentials --json
   netlify database status --show-credentials --json --branch <production-branch-name>
   ```

   Store both strings in shell variables. Never write them to files in the repo.
2. Run the deployed verification. It writes synthetic records to the preview
   only, and only reads production row counts.

   ```bash
   node scripts/verify-deployed-concurrency.mjs \
     --target https://deploy-preview-<n>--kidcexcellence-app.netlify.app \
     --preview-database-url "$PREVIEW_DB" \
     --production-database-url "$PRODUCTION_DB" \
     --confirm
   ```

   **Proof:** `ALL CHECKS PASSED`. If any check fails, stop and investigate. Do
   not migrate.

## 3. Dry run against your backup (any day before cutover)

```bash
npm run db:migrate -- analyze --source /secure/path/kidcellence-backup-YYYY-MM-DD.json
npm run db:migrate -- dry-run --source /secure/path/kidcellence-backup-YYYY-MM-DD.json
```

- **analyze** lists counts for every collection, plus:
  - **ignored** records: records the app already discards on every read.
    These are not imported.
  - **blocking** problems.
- **dry-run** imports into a disposable local PostgreSQL, imports a second time
  to prove the second run is a no-op, then deletes the temporary database.

Resolving blockers:

| Blocking kind | Meaning | Resolution |
|---|---|---|
| `orphan-user` in `sessions` | A session points at an account that no longer exists. It cannot be used. | Re-run with `--drop-orphan-sessions`. Holders of those cookies are signed out. |
| `orphan-user` in `accountTokens` | An email or reset token for a missing account. It cannot be used. | Re-run with `--drop-orphan-account-tokens`. |
| `duplicate-email` | Two accounts share an email, which the unique constraint forbids. | Decide which account is real. Fix the backup copy by hand and record the decision. Never merge silently. |
| `duplicate-parent-provider` | Two conversations exist between the same parent and listing. | Decide whether to merge the messages. Fix the copy and record the decision. |
| anything else | Malformed data. | Investigate before going further. |

**Proof:** the dry run reports `{"first":"imported","second":"already-imported"}`,
with counts that match analyze. Every flag you used goes into the cutover log.

## 4. Backups immediately before cutover

1. Netlify takes a database backup on every production publish, and daily ones
   (kept 30 days on Pro). Nothing is needed here, because the database is empty
   until the import.
2. The Blobs document is the source of truth until cutover, and it is never
   modified by this procedure. Take the final export in step 5.4. That export
   doubles as the rollback source.

## 5. Cutover

1. Announce a maintenance window.
2. Merge the pull request into `main`. Netlify builds the production deploy,
   applies the migration to the production database branch, then publishes.
   - **Proof:** the deploy is published.
   - **Proof:** `https://kidcellence.com/api/providers` now returns **503** with
     the migration message. This is the initialisation gate: the old code no
     longer runs, so nothing writes to Blobs any more.
3. Wait 2 minutes. That lets in-flight requests on old function instances finish,
   and lets Blobs' eventual consistency (up to 60 s) settle.
4. Final export of the legacy store, read-only:

   ```bash
   netlify blobs:get kidcellence-platform platform-store.json --output /secure/path/final-YYYY-MM-DD.json
   shasum -a 256 /secure/path/final-YYYY-MM-DD.json
   ```

   - **Proof:** a valid JSON file.
   - **Proof:** its user count is at least the count in your backup (18 on 2026-11-10).
5. Analyse and rehearse the exact file, using the same flags as step 3:

   ```bash
   npm run db:migrate -- analyze --source /secure/path/final-YYYY-MM-DD.json [flags]
   npm run db:migrate -- dry-run --source /secure/path/final-YYYY-MM-DD.json [flags]
   ```

   Note the printed `source sha256`.
6. Import into production:

   ```bash
   PRODUCTION_DB="$(netlify database status --show-credentials --json --branch <production-branch-name> | ...)"
   npm run db:migrate -- import --source /secure/path/final-YYYY-MM-DD.json \
     --database-url "$PRODUCTION_DB" --expect-sha256 <sha256 from step 5> [flags]
   ```

   How the import behaves:
   - It runs in a single transaction that holds the application's store lock.
   - It refuses a database that already has records or a different source.
   - It reconciles every collection and analytics before committing.
   - It rolls everything back on any mismatch.

   **Proof:** `import: imported`. Re-running prints `already-imported`.
7. Independent verification:

   ```bash
   npm run db:migrate -- verify --source /secure/path/final-YYYY-MM-DD.json --database-url "$PRODUCTION_DB" [flags]
   ```

   **Proof:** `database matches the source exactly`.
8. The site serves again immediately, because the gate opens as soon as the
   import marker exists. Smoke-check without creating test data in production:
   - `/api/providers` returns 200, and the listings match yesterday's.
   - An admin signs in, and the dashboard counts match the analyze counts.
   - One real account holder signs in with their existing password.
   - Function logs show no `[store-postgres]` errors.
9. Leave the Blobs document `kidcellence-platform/platform-store.json` in place,
   untouched. It is the frozen pre-cutover copy.

## 6. Rollback

**Before step 5.6 completes** (no data in the database yet):

1. In Netlify, publish the previous production deploy.
2. The old release reads the unchanged Blobs document. Nothing is lost.

**After the import, once the site has accepted new writes:**

Rolling back means moving the newer data back into Blobs. Do it only if the
database release is unusable, because the old release has the original
data-loss bug.

1. Export the database, read-only. This refuses to overwrite an existing file.

   ```bash
   npm run db:migrate -- export --database-url "$PRODUCTION_DB" --out /secure/path/rollback-YYYY-MM-DD.json
   ```

2. Back up the current Blobs document, then write the export into it. Both
   commands are production writes and need the owner's explicit approval at
   the time.

   ```bash
   netlify blobs:get kidcellence-platform platform-store.json --output /secure/path/pre-rollback-blob.json
   netlify blobs:set kidcellence-platform platform-store.json --input /secure/path/rollback-YYYY-MM-DD.json
   ```

3. Publish the previous production deploy.

What the rollback keeps and drops:

- **Analytics:** written into the exported document, which is where the old
  release reads them.
- **Message idempotency keys:** remain in message records. The old release
  ignores them.
- **Database:** rolling back a deploy does not restore or change it. Keep it
  until you decide.
- **Database backups:** to restore one, use **Data & Storage → Database →
  Backups → Restore** (Team Owner only). Restoring replaces the production
  branch and loses changes made after the backup. Netlify keeps the
  pre-restore state on a separate branch.

## 7. After acceptance

- Delete the working copies of the exports from local disks. Keep only the
  encrypted archival backup, per your retention policy.
- Record in Notion: the cutover time, source sha256, flags used, counts, and who
  approved each step.
- Previews now start from a copy of production data, which includes personal
  data. Decide who may access deploy previews.
