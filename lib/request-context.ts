export function getRequestContext(request?: Request) {
  if (!request) {
    return {};
  }

  const forwardedFor = request.headers.get("x-forwarded-for");

  return {
    ip:
      forwardedFor?.split(",")[0]?.trim() ??
      request.headers.get("x-real-ip") ??
      null,
    userAgent: request.headers.get("user-agent"),
  };
}
