/**
 * D1 proxy Worker for Kidcellence.
 *
 * The app runs as a Node function (Netlify), where no D1 binding exists.
 * Cloudflare's REST API is the other way in, but it is rate limited at 1200
 * requests per five minutes across the entire account, and readStore() issues
 * 14 statements per call — that ceiling arrives almost immediately under real
 * traffic. This Worker sits in front of the binding instead: the app sends one
 * batch, this runs it, one HTTP request either way.
 *
 * SECURITY: this endpoint executes arbitrary SQL against the platform database,
 * which holds password hashes, session tokens, ID documents, and children's
 * details. The bearer token is the ONLY thing protecting it. Generate it with
 * `openssl rand -hex 32`, store it with `wrangler secret put PROXY_TOKEN`, and
 * never expose it to the browser. If it leaks, rotate it immediately.
 */

/** Constant-time compare so the token cannot be recovered by timing the response. */
function tokensMatch(provided, expected) {
  if (typeof provided !== "string" || typeof expected !== "string") return false;
  if (provided.length !== expected.length) return false;
  let mismatch = 0;
  for (let index = 0; index < provided.length; index += 1) {
    mismatch |= provided.charCodeAt(index) ^ expected.charCodeAt(index);
  }
  return mismatch === 0;
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const worker = {
  async fetch(request, env) {
    if (request.method !== "POST") {
      return json({ error: "Method not allowed" }, 405);
    }

    if (!env.PROXY_TOKEN) {
      return json({ error: "Proxy is not configured" }, 500);
    }

    const provided = request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "") ?? "";
    if (!tokensMatch(provided, env.PROXY_TOKEN)) {
      return json({ error: "Unauthorized" }, 401);
    }

    const body = await request.json().catch(() => null);
    const batch = body?.batch;
    if (!Array.isArray(batch) || batch.length === 0) {
      return json({ error: "Expected a non-empty batch array" }, 400);
    }

    try {
      const statements = batch.map((statement) => {
        if (typeof statement?.sql !== "string") {
          throw new Error("Each batch entry needs a sql string");
        }
        const prepared = env.DB.prepare(statement.sql);
        const params = statement.params ?? [];
        // .bind() with no arguments throws on some D1 versions.
        return params.length > 0 ? prepared.bind(...params) : prepared;
      });

      // D1 runs a batch as a single implicit transaction, so a multi-table
      // write from updateStore() either lands completely or not at all.
      const results = await env.DB.batch(statements);

      return json({
        results: results.map((result) => ({
          success: result.success,
          results: result.results ?? [],
        })),
      });
    } catch (error) {
      return json({ error: error?.message ?? "Query failed" }, 500);
    }
  },
};

export default worker;
