import { NextResponse } from "next/server";

/**
 * Error codes thrown by the storage layer when data could not be read or saved
 * (lib/store-postgres.ts, lib/store-engine.ts). Routes must never answer such a
 * request with 200, and must not blame the user's input with a 400.
 */
const PERSISTENCE_ERROR_CODES = new Set([
  "STORE_BUSY",
  "STORE_UNAVAILABLE",
  "STORE_CORRUPT",
  "STORE_INTEGRITY",
]);

export function isPersistenceError(error: unknown): error is Error & { code: string } {
  return (
    error instanceof Error &&
    PERSISTENCE_ERROR_CODES.has(String((error as { code?: unknown }).code ?? ""))
  );
}

/** 503 (retry later) for unavailable or busy storage; 409 for a constraint conflict. */
export function persistenceErrorResponse(error: Error & { code: string }) {
  const status = error.code === "STORE_INTEGRITY" ? 409 : 503;
  const headers: Record<string, string> = {};
  if (status === 503) headers["Retry-After"] = "5";
  // The storage layer only puts client-safe text in these messages.
  return NextResponse.json({ error: error.message, code: error.code }, { status, headers });
}

/**
 * Wraps a route handler so that storage failures escaping it become explicit
 * 503/409 JSON responses. Other errors propagate unchanged.
 */
export function withPersistenceErrors<Args extends unknown[]>(
  handler: (...args: Args) => Promise<Response>
) {
  return async (...args: Args): Promise<Response> => {
    try {
      return await handler(...args);
    } catch (error) {
      if (isPersistenceError(error)) return persistenceErrorResponse(error);
      throw error;
    }
  };
}
