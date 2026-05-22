import type { PreviewConnection } from "./session.js";

export const MAX_FORM_BYTES = 64 * 1024;
export const MAX_MARKUP_RESPONSE_BYTES = 1024 * 1024;

export function validateTargetUrl(rawUrl: string, allowRemoteTargets: boolean): string | undefined {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return "Markup URL must be an absolute HTTP or HTTPS URL.";
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return "Markup URL must use HTTP or HTTPS.";
  }

  if (!allowRemoteTargets && !isLoopbackHost(url.hostname)) {
    return "Remote markup URLs are disabled by default. Use localhost, 127.0.0.1, or enable remote targets explicitly.";
  }

  return undefined;
}

export function redactConnectionError(message: string, connection: PreviewConnection): string {
  let redacted = message;
  for (const value of [connection.token, connection.userUuid, connection.targetUrl]) {
    if (value) {
      redacted = redacted.replaceAll(value, "<redacted>");
    }
  }
  return redacted.replaceAll(/Bearer\s+[A-Za-z0-9._~+/=-]+/g, "Bearer <redacted>");
}

export function safePublicUrl(rawUrl: string): string {
  try {
    const url = new URL(rawUrl);
    url.username = "";
    url.password = "";
    return url.toString();
  } catch {
    return "<invalid url>";
  }
}

function isLoopbackHost(hostname: string): boolean {
  const normalized = hostname.toLowerCase();
  return normalized === "localhost"
    || normalized === "::1"
    || normalized === "[::1]"
    || normalized === "0:0:0:0:0:0:0:1"
    || normalized.startsWith("127.");
}
