function requestBaseUrl(request: Request) {
  const url = new URL(request.url);
  const forwardedProto = request.headers.get("x-forwarded-proto");
  const forwardedHost = request.headers.get("x-forwarded-host");
  const host = forwardedHost ?? request.headers.get("host") ?? url.host;
  const protocol = forwardedProto ?? url.protocol.replace(":", "");

  return `${protocol}://${host}`;
}

function headerOrigin(value: string | null) {
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

export function isSameOriginMutation(request: Request) {
  const expectedOrigin = requestBaseUrl(request);
  const origin = headerOrigin(request.headers.get("origin"));
  const referer = headerOrigin(request.headers.get("referer"));

  if (origin && origin !== expectedOrigin) return false;
  if (!origin && referer && referer !== expectedOrigin) return false;
  return true;
}
