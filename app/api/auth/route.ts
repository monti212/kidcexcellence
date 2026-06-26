import { NextResponse } from "next/server";
import {
  SESSION_COOKIE_NAME,
  createOrLoginUser,
  getSessionFromRequest,
  isAdminEmail,
  revokeSessionToken,
  sessionTokenFromRequest,
  type UserRole,
} from "@/lib/platform-store";
import { consumeRateLimit, requestIp } from "@/lib/rate-limit";
import { isSameOriginMutation } from "@/lib/request-guard";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = await getSessionFromRequest(request);
  if (!auth) {
    return NextResponse.json({ user: null, session: null }, { status: 401 });
  }

  return NextResponse.json({
    user: auth.user,
    session: {
      userId: auth.session.userId,
      role: auth.session.role,
      createdAt: auth.session.createdAt,
      expiresAt: auth.session.expiresAt,
    },
  });
}

export async function POST(request: Request) {
  if (!isSameOriginMutation(request)) {
    return NextResponse.json({ error: "Cross-origin request rejected" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const mode = body?.mode === "login" ? "login" : "signup";
  const role: UserRole =
    body?.role === "admin" ? "admin" : body?.role === "provider" ? "provider" : "parent";
  const email = typeof body?.email === "string" ? body.email : "";
  const password = typeof body?.password === "string" ? body.password : "";
  const rateLimit = consumeRateLimit({
    key: `auth:${requestIp(request)}:${email.toLowerCase() || "unknown"}`,
    limit: 10,
    windowMs: 15 * 60 * 1000,
  });

  if (!rateLimit.ok) {
    return NextResponse.json(
      { error: "Too many authentication attempts. Please try again shortly." },
      {
        status: 429,
        headers: { "Retry-After": String(rateLimit.retryAfter) },
      }
    );
  }

  if (!email.includes("@")) {
    return NextResponse.json({ error: "A valid email is required" }, { status: 400 });
  }

  if (password.length < 8) {
    return NextResponse.json(
      { error: "Password must be at least 8 characters." },
      { status: 400 }
    );
  }

  if (role === "admin" && !isAdminEmail(email)) {
    return NextResponse.json({ error: "Admin access is not enabled for this email." }, { status: 403 });
  }

  try {
    const { user, session } = await createOrLoginUser({
      mode,
      role,
      name: typeof body?.name === "string" ? body.name : undefined,
      email,
      password,
      phone: typeof body?.phone === "string" ? body.phone : undefined,
      location: typeof body?.location === "string" ? body.location : undefined,
      category: typeof body?.category === "string" ? body.category : undefined,
    });
    const response = NextResponse.json({
      user,
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
      { error: error instanceof Error ? error.message : "Could not authenticate." },
      { status: 400 }
    );
  }
}

export async function DELETE(request: Request) {
  if (!isSameOriginMutation(request)) {
    return NextResponse.json({ error: "Cross-origin request rejected" }, { status: 403 });
  }

  await revokeSessionToken(sessionTokenFromRequest(request));
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(0),
  });
  return response;
}
