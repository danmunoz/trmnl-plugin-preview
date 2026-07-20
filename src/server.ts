import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { URL } from "node:url";
import { MARKUP_KEYS, VIEWS } from "./defaults.js";
import { cssDimensions } from "./device.js";
import {
  applyDashboardQueryTemplate,
  renderDashboard,
  renderErrorDocument,
  renderDiagnosticsJson,
  renderPluginDocument,
  type DashboardSelection,
  type PreviewMode,
} from "./html.js";
import { findModel, findPalette, getModels, getPalettes } from "./metadata.js";
import { PluginClient } from "./plugin-client.js";
import { renderPng } from "./png.js";
import { MAX_FORM_BYTES, redactConnectionError, validateTargetUrl } from "./security.js";
import { PreviewSessionStore, type PreviewConnection } from "./session.js";
import type { FrameworkFontFamily, Orientation, PreviewConfig, RenderContext, ViewName } from "./types.js";

const SESSION_COOKIE = "trmnl_preview_sid";

export function createPreviewServer(config: PreviewConfig) {
  const client = new PluginClient(config.requestTimeoutMs, config.cacheTtlMs);
  const sessions = new PreviewSessionStore(config);

  return createServer(async (request, response) => {
    try {
      await routeRequest(config, sessions, client, request, response);
    } catch (error) {
      const status = error instanceof RequestError ? error.status : 500;
      const message = error instanceof RequestError ? error.message : "Preview server error.";
      send(response, status, "text/html; charset=utf-8", renderErrorDocument(message));
    }
  });
}

async function routeRequest(
  config: PreviewConfig,
  sessions: PreviewSessionStore,
  client: PluginClient,
  request: IncomingMessage,
  response: ServerResponse,
): Promise<void> {
  const url = new URL(request.url ?? "/", "http://127.0.0.1");
  const pathname = url.pathname;

  if (pathname === "/healthz") {
    sendJson(response, { ok: true });
    return;
  }

  if (pathname === "/api/models") {
    sendJson(response, { data: await getModels() });
    return;
  }

  if (pathname === "/api/palettes") {
    sendJson(response, { data: await getPalettes() });
    return;
  }

  if (pathname === "/") {
    const session = sessions.getOrCreate(sessionIdFromRequest(request, url.searchParams));
    const dashboardParams = paramsWithDefaults(url.searchParams, session.id);
    const selection = selectionFromQuery(dashboardParams);

    if (session.source === "configured") {
      const validation = await validateConnection(config, client, session.connection, selection);
      if (!validation.ok) {
        const html = applyDashboardQueryTemplate(
          renderDashboard(
            { ...config, ...session.connection, connectionSource: "default" },
            selection,
            session.id,
            session.csrfToken,
            { connectionError: validation.error },
          ),
          dashboardParams,
        );
        send(response, 400, "text/html; charset=utf-8", html, cookieHeader(session.id));
        return;
      }
    }

    const html = applyDashboardQueryTemplate(
      renderDashboard(
        { ...config, ...session.connection, connectionSource: session.source },
        selection,
        session.id,
        session.csrfToken,
      ),
      dashboardParams,
    );
    send(response, 200, "text/html; charset=utf-8", html, cookieHeader(session.id));
    return;
  }

  if (pathname === "/settings" && request.method === "POST") {
    const form = await readForm(request);
    const sessionId = form.get("sid") ?? sessionIdFromRequest(request, url.searchParams);
    const current = sessions.getOrCreate(sessionId);
    assertValidCsrf(form, current.csrfToken);
    assertTrustedSettingsOrigin(request);
    const connectionInput = connectionFromParams(form);
    const candidateConnection = normalizeConnection(config, { ...current.connection, ...connectionInput });
    const params = paramsWithDefaults(form, current.id);
    const selection = selectionFromQuery(params);
    const validation = await validateConnection(config, client, candidateConnection, selection);

    if (!validation.ok) {
      const html = applyDashboardQueryTemplate(
        renderDashboard(
          { ...config, ...candidateConnection, connectionSource: "default" },
          selection,
          current.id,
          current.csrfToken,
          { connectionError: validation.error },
        ),
        params,
      );
      send(response, 400, "text/html; charset=utf-8", html, cookieHeader(current.id));
      return;
    }

    const session = sessions.update(current.id, connectionInput);
    sendRedirect(response, `/?${params.toString()}`, session.id);
    return;
  }

  if (pathname === "/api/diagnostics") {
    const context = await contextFromQuery(sessions, request, url.searchParams, "full");
    assertAllowedTarget(config, context.targetUrl);
    const { diagnostics } = await client.inspectMarkup(context);
    send(response, 200, "application/json; charset=utf-8", renderDiagnosticsJson(diagnostics));
    return;
  }

  const htmlMatch = pathname.match(/^\/render\/([a-z_]+)\.html$/);
  if (htmlMatch?.[1]) {
    const context = await contextFromQuery(sessions, request, url.searchParams, htmlMatch[1]);
    assertAllowedTarget(config, context.targetUrl);
    const payload = await client.fetchMarkup(context);
    const markupKey = MARKUP_KEYS[context.view];
    if (!payload[markupKey]) {
      throw new Error(`Markup response missing ${markupKey}`);
    }
    const html = renderPluginDocument(config, context, payload);
    send(response, 200, "text/html; charset=utf-8", html, renderSecurityHeaders(config));
    return;
  }

  const pngMatch = pathname.match(/^\/render\/([a-z_]+)\.png$/);
  if (pngMatch?.[1]) {
    const context = await contextFromQuery(sessions, request, url.searchParams, pngMatch[1]);
    assertAllowedTarget(config, context.targetUrl);
    const renderUrl = renderHtmlUrl(request, context);
    const png = await renderPng({
      url: renderUrl,
      model: context.model,
      orientation: context.orientation,
      palette: context.palette,
    });
    send(response, 200, "image/png", png);
    return;
  }

  send(response, 404, "text/plain; charset=utf-8", "Not found");
}

async function contextFromQuery(
  sessions: PreviewSessionStore,
  request: IncomingMessage,
  params: URLSearchParams,
  rawView: string,
): Promise<RenderContext> {
  const view = parseView(rawView);
  const modelName = params.get("model") ?? "og_png";
  const orientation = parseOrientation(params.get("orientation") ?? "landscape");
  const fontFamily = parseFontFamily(params.get("font") ?? "default");
  const model = await findModel(modelName);
  const palette = await findPalette(params.get("palette") ?? undefined, model);
  const session = sessions.getOrCreate(sessionIdFromRequest(request, params));

  return {
    view,
    model,
    palette,
    orientation,
    fontFamily,
    sessionId: session.id,
    targetUrl: session.connection.targetUrl,
    token: session.connection.token,
    userUuid: session.connection.userUuid,
  };
}

function renderHtmlUrl(request: IncomingMessage, context: RenderContext): string {
  const address = resolveRenderHost(request.socket.localAddress);
  const port = request.socket.localPort;
  if (!port) {
    throw new RequestError(500, "Unable to determine preview render port.");
  }
  const params = new URLSearchParams({
    sid: context.sessionId,
    model: context.model.name,
    orientation: context.orientation,
    font: context.fontFamily,
    palette: context.palette.id,
  });
  return `http://${address}:${port}/render/${context.view}.html?${params.toString()}`;
}

function parseView(raw: string): ViewName {
  if (VIEWS.includes(raw as ViewName)) {
    return raw as ViewName;
  }
  throw new RequestError(400, `Unsupported view: ${raw}`);
}

function parseOrientation(raw: string): Orientation {
  if (raw === "landscape" || raw === "portrait") {
    return raw;
  }
  throw new RequestError(400, `Unsupported orientation: ${raw}`);
}

function selectionFromQuery(params: URLSearchParams): DashboardSelection {
  const model = params.get("model") === "v2" ? "v2" : "og_png";
  const orientation = parseOrientation(params.get("orientation") ?? "landscape");
  const fontFamily = parseFontFamily(params.get("font") ?? "default");
  const previewMode = parsePreviewMode(params.get("mode") ?? "html");
  return { model, orientation, fontFamily, previewMode };
}

function parsePreviewMode(raw: string): PreviewMode {
  if (raw === "html" || raw === "png") {
    return raw;
  }
  throw new RequestError(400, `Unsupported preview mode: ${raw}`);
}

function parseFontFamily(raw: string): FrameworkFontFamily {
  if (raw === "classic" || raw === "trmnl" || raw === "default") {
    return raw;
  }
  throw new RequestError(400, `Unsupported framework font: ${raw}`);
}

function sendJson(response: ServerResponse, body: unknown, headers: Record<string, string> = {}): void {
  send(response, 200, "application/json; charset=utf-8", JSON.stringify(body, null, 2), headers);
}

function send(
  response: ServerResponse,
  status: number,
  contentType: string,
  body: string | Buffer,
  headers: Record<string, string> = {},
): void {
  response.writeHead(status, {
    "content-type": contentType,
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
    "referrer-policy": "no-referrer",
    "permissions-policy": "camera=(), microphone=(), geolocation=()",
    ...headers,
  });
  response.end(body);
}

function sendRedirect(response: ServerResponse, location: string, sessionId: string): void {
  response.writeHead(303, {
    location,
    "cache-control": "no-store",
    ...cookieHeader(sessionId),
  });
  response.end();
}

function paramsWithDefaults(source: URLSearchParams, sessionId: string): URLSearchParams {
  const params = new URLSearchParams(source);
  params.set("sid", sessionId);
  params.delete("target");
  params.delete("token");
  params.delete("user_uuid");
  params.delete("csrf");
  if (!params.has("model")) {
    params.set("model", "og_png");
  }
  if (!params.has("orientation")) {
    params.set("orientation", "landscape");
  }
  if (!params.has("font")) {
    params.set("font", "default");
  }
  if (!params.has("mode")) {
    params.set("mode", "html");
  }
  return params;
}

function connectionFromParams(params: URLSearchParams): Partial<PreviewConnection> {
  const connection: Partial<PreviewConnection> = {};
  const targetUrl = params.get("target")?.trim();
  const token = params.get("token")?.trim();
  const userUuid = params.get("user_uuid")?.trim();
  if (targetUrl) connection.targetUrl = targetUrl;
  if (token) connection.token = token;
  if (userUuid) connection.userUuid = userUuid;
  return connection;
}

function normalizeConnection(config: PreviewConfig, input: Partial<PreviewConnection>): PreviewConnection {
  return {
    targetUrl: input.targetUrl?.trim() || config.targetUrl,
    token: input.token?.trim() || config.token,
    userUuid: input.userUuid?.trim() || config.userUuid,
  };
}

async function validateConnection(
  config: PreviewConfig,
  client: PluginClient,
  connection: PreviewConnection,
  selection: DashboardSelection,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const targetError = validateTargetUrl(connection.targetUrl, config.allowRemoteTargets);
  if (targetError) {
    return { ok: false, error: targetError };
  }

  const model = await findModel(selection.model);
  const { diagnostics } = await client.inspectMarkup({
    targetUrl: connection.targetUrl,
    token: connection.token,
    userUuid: connection.userUuid,
    model,
    orientation: selection.orientation,
  });

  if (diagnostics.ok) {
    return { ok: true };
  }

  return {
    ok: false,
    error: redactConnectionError(diagnostics.error ?? "Connection failed.", connection),
  };
}

function assertAllowedTarget(config: PreviewConfig, targetUrl: string): void {
  const error = validateTargetUrl(targetUrl, config.allowRemoteTargets);
  if (error) {
    throw new RequestError(400, error);
  }
}

function assertValidCsrf(form: URLSearchParams, expected: string): void {
  if (form.get("csrf") !== expected) {
    throw new RequestError(403, "Settings form expired. Reload the preview server and try again.");
  }
}

function assertTrustedSettingsOrigin(request: IncomingMessage): void {
  const origin = request.headers.origin;
  if (!origin || origin === "null") {
    return;
  }
  const host = request.headers.host;
  if (!host) {
    throw new RequestError(403, "Settings requests require a valid host.");
  }
  try {
    const parsed = new URL(origin);
    if (parsed.host !== host) {
      throw new RequestError(403, "Settings requests must come from this preview server.");
    }
  } catch (error) {
    if (error instanceof RequestError) throw error;
    return;
  }
}

function renderSecurityHeaders(config: PreviewConfig): Record<string, string> {
  const assetHost = new URL(config.frameworkAssetHost);
  const assetOrigin = assetHost.origin;
  return {
    "content-security-policy": [
      "default-src 'none'",
      `script-src ${assetOrigin}`,
      `style-src ${assetOrigin} https://fonts.googleapis.com 'unsafe-inline'`,
      `font-src ${assetOrigin} https://fonts.gstatic.com`,
      "img-src data: http: https:",
      "connect-src 'none'",
      "base-uri 'none'",
      "form-action 'none'",
      "frame-ancestors 'self'",
    ].join("; "),
  };
}

function sessionIdFromRequest(request: IncomingMessage, params: URLSearchParams): string | undefined {
  return params.get("sid") ?? cookiesFromRequest(request).get(SESSION_COOKIE);
}

function cookiesFromRequest(request: IncomingMessage): Map<string, string> {
  const cookies = new Map<string, string>();
  const header = request.headers.cookie;
  if (!header) return cookies;

  for (const pair of header.split(";")) {
    const [rawName, ...rawValue] = pair.trim().split("=");
    if (!rawName || rawValue.length === 0) continue;
    cookies.set(rawName, decodeURIComponent(rawValue.join("=")));
  }

  return cookies;
}

function cookieHeader(sessionId: string): Record<string, string> {
  return {
    "set-cookie": `${SESSION_COOKIE}=${encodeURIComponent(sessionId)}; Path=/; HttpOnly; SameSite=Strict`,
  };
}

async function readForm(request: IncomingMessage): Promise<URLSearchParams> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > MAX_FORM_BYTES) {
      throw new RequestError(413, "Settings form is too large.");
    }
    chunks.push(buffer);
  }
  return new URLSearchParams(Buffer.concat(chunks).toString("utf8"));
}

export function resolveRenderHost(localAddress: string | undefined): string {
  if (!localAddress || localAddress === "0.0.0.0" || localAddress === "::") {
    return "127.0.0.1";
  }
  const address = localAddress.startsWith("::ffff:") ? localAddress.slice(7) : localAddress;
  return address.includes(":") ? `[${address}]` : address;
}

export { cssDimensions };

class RequestError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}
