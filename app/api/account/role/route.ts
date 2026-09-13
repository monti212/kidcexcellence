import { NextResponse } from "next/server";
import {
  SESSION_COOKIE_NAME,
  fullAccessEntitlementForUser,
  getSessionFromRequest,
  switchActiveRole,
  type UserRole,
} from "@/lib/platform-store";
import { consumeRateLimit, requestIp } from "@/lib/rate-limit";
import { isSameOriginMutation } from "@/lib/request-guard";

export const runtime = "nodejs";

/**
 * Account types a user may switch into themselves. Admin is excluded on
 * purpose: it is granted only by the email allowlist, so it must never be
 * reachable from a request body.
 */
const SWITCHABLE_ROLES: UserRole[] = ["parent", "provider"];

export async function POST(request: Request) {
  if (!isSameOriginMutation(request)) {
    return NextResponse.json({ error: "Cross-origin request rejected" }, { status: 403 });
  }

  const auth = await getSessionFromRequest(request);
  if (!auth) {
    return NextResponse.json({ error: "Account authentication required" }, { status: 401 });
  }

  const rateLimit = consumeRateLimit({
    key: `account-role:${requestIp(request)}:${auth.session.userId}`,
    limit: 10,
    windowMs: 15 * 60 * 1000,
  });
  if (!rateLimit.ok) {
    return NextResponse.json(
      { error: "Too many account type changes. Please try again shortly." },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfter) } }
    );
  }

  const body = await request.json().catch(() => null);
  const target = typeof body?.target === "string" ? body.target : "";

  if (!SWITCHABLE_ROLES.includes(target as UserRole)) {
    return NextResponse.json(
      { error: "Choose either a parent or a provider account." },
      { status: 403 }
    );
  }

  try {
    const { user, session } = await switchActiveRole(
      auth.session.userId,
      target as UserRole
    );
    const response = NextResponse.json({
      user,
      subscription: fullAccessEntitlementForUser(user),
      session: {
        userId: session.userId,
        role: session.role,
        createdAt: session.createdAt,
        expiresAt: session.expiresAt,
      },
    });
    response.cookies.set(SESSION_COOKIE_NAME, session.token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      expires: new Date(session.expiresAt),
    });
    return response;
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not change account type." },
      { status: 400 }
    );
  }
}
