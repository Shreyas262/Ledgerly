const SESSION_COOKIE_NAME = "ledgerly.session";

function readCookie(name: string): string | null {
  const prefix = `${name}=`;
  const cookie = document.cookie
    .split(";")
    .map((item) => item.trim())
    .find((item) => item.startsWith(prefix));

  return cookie ? decodeURIComponent(cookie.slice(prefix.length)) : null;
}

export function getSessionCookie(): string | null {
  if (typeof document === "undefined") {
    return null;
  }

  return readCookie(SESSION_COOKIE_NAME);
}

export function setSessionCookie(sessionId: string, expiresAt: string): void {
  if (typeof document === "undefined") {
    return;
  }

  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${SESSION_COOKIE_NAME}=${encodeURIComponent(sessionId)}; Path=/; SameSite=Lax; Expires=${new Date(expiresAt).toUTCString()}${secure}`;
}

export function clearSessionCookie(): void {
  if (typeof document === "undefined") {
    return;
  }

  document.cookie = `${SESSION_COOKIE_NAME}=; Path=/; SameSite=Lax; Max-Age=0`;
}

export function getSessionCookieHeader(request: Request): string | null {
  const cookieHeader = request.headers.get("cookie");

  if (!cookieHeader) {
    // Browsers never expose the forbidden Cookie header on a Request, so the
    // in-page mock backend resolves the cookie the browser would attach to
    // this same-origin, credentialed request.
    if (
      typeof location !== "undefined" &&
      request.credentials !== "omit" &&
      new URL(request.url).origin === location.origin
    ) {
      return getSessionCookie();
    }

    return null;
  }

  const value = cookieHeader
    .split(";")
    .map((item) => item.trim())
    .find((item) => item.startsWith(`${SESSION_COOKIE_NAME}=`));

  return value
    ? decodeURIComponent(value.slice(`${SESSION_COOKIE_NAME}=`.length))
    : null;
}
