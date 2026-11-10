// Runs store operations in its own process, standing in for a separate
// serverless instance with its own connection pool. Started by the tests with:
//   node --import ./scripts/test-support/register-alias.mjs store-worker.mjs '<json>'
// and PLATFORM_DATABASE_URL in the environment. Prints one JSON line per result.
import path from "node:path";
import { pathToFileURL } from "node:url";

const task = JSON.parse(process.argv[2]);
const store = await import(pathToFileURL(path.join(process.cwd(), "lib", "platform-store.ts")).href);
const { closeDatabasePool } = await import(pathToFileURL(path.join(process.cwd(), "lib", "store-postgres.ts")).href);

// Start together with the other workers so the operations genuinely overlap.
await new Promise((resolve) => setTimeout(resolve, Math.max(0, task.startAt - Date.now())));

const operations = Array.from({ length: task.count }, (_, i) => async () => {
  if (task.op === "signup") {
    const { user } = await store.createOrLoginUser({
      mode: "signup",
      role: "parent",
      name: `Worker ${task.worker} ${i}`,
      email: `${task.prefix}-w${task.worker}-${i}@example.invalid`,
      password: "synthetic-password-1",
    });
    return { email: user.email, id: user.id };
  }
  if (task.op === "message") {
    const { message } = await store.appendConversationMessage({
      viewerUserId: task.parentUserId,
      viewerRole: "parent",
      providerId: task.providerId,
      text: `${task.prefix} w${task.worker} m${i}`,
    });
    return { text: message.text, id: message.id };
  }
  if (task.op === "pageview") {
    await store.recordPlatformPageView({ visitorId: `${task.prefix}-w${task.worker}-${i}`, pathname: task.pathname });
    return { ok: true };
  }
  throw new Error(`unknown op ${task.op}`);
});

const results = await Promise.all(
  operations.map((run) =>
    run().then(
      (value) => ({ ok: true, value }),
      (error) => ({ ok: false, code: error?.code ?? null, message: String(error?.message ?? error) })
    )
  )
);
for (const result of results) process.stdout.write(`${JSON.stringify(result)}\n`);
await closeDatabasePool();
