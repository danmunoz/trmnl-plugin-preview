import { MARKUP_KEYS, MASHUP_CLASSES, VIEW_LABELS, VIEWS } from "./defaults.js";
import { cssDimensions, screenClasses, screenStyle } from "./device.js";
import type { FrameworkFontFamily, MarkupDiagnostics, PreviewConfig, RenderContext, TrmnlMarkupResponse } from "./types.js";

export type DashboardSelection = {
  model: "og_png" | "v2";
  orientation: "landscape" | "portrait";
  fontFamily: FrameworkFontFamily;
};

export type DashboardRenderOptions = {
  connectionError?: string;
};

export function renderDashboard(
  config: PreviewConfig,
  selection: DashboardSelection,
  sessionId = "local",
  csrfToken = "local",
  options: DashboardRenderOptions = {},
): string {
  if (config.connectionSource === "default") {
    return renderFirstRunDashboard(config, selection, sessionId, csrfToken, options);
  }

  return renderPreviewDashboard(config, selection, sessionId, csrfToken);
}

function renderFirstRunDashboard(
  config: PreviewConfig,
  selection: DashboardSelection,
  sessionId: string,
  csrfToken: string,
  options: DashboardRenderOptions,
): string {
  const sid = escapeAttribute(sessionId);
  const csrf = escapeAttribute(csrfToken);
  const targetValue = escapeAttribute(config.targetUrl);
  const userUuidValue = options.connectionError ? escapeAttribute(config.userUuid) : "";
  const error = options.connectionError
    ? `<p class="connection-error" role="alert">${escapeHtml(options.connectionError)}</p>`
    : "";

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>TRMNL Preview</title>
    <style>${dashboardCss()}</style>
  </head>
  <body class="empty-page">
    <header class="empty-header">
      <h1>TRMNL Preview</h1>
    </header>
    <main class="empty-shell">
      <section class="empty-card" aria-labelledby="connection-title">
        <p class="eyebrow">Local preview</p>
        <h2 id="connection-title">Connect your plugin</h2>
        <p class="empty-lede">Add your local markup URL and preview credentials to render TRMNL layouts.</p>
        ${error}

        <form class="empty-form" method="post" action="/settings">
          <input type="hidden" name="sid" value="${sid}">
          <input type="hidden" name="csrf" value="${csrf}">
          <input type="hidden" name="model" value="${escapeAttribute(selection.model)}">
          <input type="hidden" name="orientation" value="${escapeAttribute(selection.orientation)}">
          <input type="hidden" name="font" value="${escapeAttribute(selection.fontFamily)}">

          <label for="target">
            <span>Markup URL</span>
            <input id="target" name="target" type="url" value="${targetValue}" required autocomplete="url">
          </label>
          <label for="token">
            <span>Bearer token</span>
            <input id="token" name="token" type="password" placeholder="Bearer token" required autocomplete="off">
          </label>
          <label for="user_uuid">
            <span>User UUID</span>
            <input id="user_uuid" name="user_uuid" value="${userUuidValue}" placeholder="user-uuid" required autocomplete="off">
          </label>

          <button class="empty-submit" type="submit">Connect</button>
        </form>

        <p class="session-note">Stored locally for this preview session. Render links do not include your token.</p>

        <details class="contract-details">
          <summary>Endpoint contract</summary>
          <p>The preview sends a POST request with <code>user_uuid</code> and <code>trmnl</code> form fields. Your endpoint should return JSON with all four markup variants and optional shared markup.</p>
        </details>
      </section>
    </main>
  </body>
</html>`;
}

function renderPreviewDashboard(
  config: PreviewConfig,
  selection: DashboardSelection,
  sessionId: string,
  csrfToken: string,
): string {
  const target = escapeAttribute(config.targetUrl);
  const userUuid = escapeAttribute(config.userUuid);
  const sid = escapeAttribute(sessionId);
  const csrf = escapeAttribute(csrfToken);
  const deviceTitle = selection.model === "v2" ? "TRMNL X" : "TRMNL OG";
  const dimensions = selectedDimensions(selection);

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>TRMNL Preview</title>
    <style>${dashboardCss()}</style>
  </head>
  <body>
    <form class="dashboard-form" method="post" action="/settings" data-connection-source="${escapeAttribute(config.connectionSource)}">
      <header class="app-header">
        <div class="brand">
          <h1>TRMNL Preview</h1>
          <p>Renderer workspace</p>
        </div>
        <input type="hidden" name="sid" value="${sid}">
        <input type="hidden" name="csrf" value="${csrf}">
        <div class="app-header__actions">
          <details class="connection-menu">
            <summary class="settings-button">Settings</summary>
            <div class="connection-panel">
              <div class="connection-panel__header">
                <div>
                  <strong>Endpoint connection</strong>
                  <p>${escapeHtml(connectionHelpText(config))}</p>
                </div>
                <span>${escapeHtml(connectionSourceLabel(config.connectionSource))}</span>
              </div>
              <label for="target">
                <span>Markup URL</span>
                <input id="target" name="target" type="url" value="${target}" required autocomplete="url">
              </label>
              <label for="token">
                <span>Bearer token</span>
                <input id="token" name="token" type="password" autocomplete="off" placeholder="${config.token ? "Configured" : "Bearer token"}">
                <small>${config.token ? "Leave blank to keep the current token." : "Required for authenticated plugin markup endpoints."}</small>
              </label>
              <label for="user_uuid">
                <span>User UUID</span>
                <input id="user_uuid" name="user_uuid" value="${userUuid}" required autocomplete="off">
              </label>
            </div>
          </details>
        </div>
      </header>
      <section class="control-strip" aria-label="Simulator settings">
        ${renderSegmentedControl("Device", "model", [
          { value: "og_png", label: "OG", checked: selection.model === "og_png" },
          { value: "v2", label: "X", checked: selection.model === "v2" },
        ])}
        ${renderSegmentedControl("Orientation", "orientation", [
          { value: "landscape", label: "Landscape", checked: selection.orientation === "landscape" },
          { value: "portrait", label: "Portrait", checked: selection.orientation === "portrait" },
        ])}
        ${renderSegmentedControl("Framework font", "font", [
          { value: "default", label: "Default", checked: selection.fontFamily === "default" },
          { value: "classic", label: "Classic", checked: selection.fontFamily === "classic" },
          { value: "trmnl", label: "TRMNL", checked: selection.fontFamily === "trmnl" },
        ])}
        <button class="refresh-button" type="submit">Reload previews</button>
      </section>
    </form>
    <main class="preview-main">
      ${renderDeviceSection(
        sessionId,
        selection.model,
        selection.orientation,
        selection.fontFamily,
        `${deviceTitle} ${capitalize(selection.orientation)}`,
        dimensions.width,
        dimensions.height,
        displayZoomForModel(selection.model),
        true,
      )}
    </main>
  </body>
</html>`;
}

export function renderDiagnosticsJson(diagnostics: MarkupDiagnostics): string {
  return JSON.stringify(diagnostics, null, 2);
}

export function renderErrorDocument(message: string): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <title>TRMNL Preview Error</title>
    <style>
      body { margin: 0; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; background: #f6f0e8; color: #241f1a; }
      pre { white-space: pre-wrap; margin: 24px; padding: 16px; border: 1px solid #241f1a; background: #fffaf2; }
    </style>
  </head>
  <body><pre>${escapeHtml(message)}</pre></body>
</html>`;
}

export function renderPluginDocument(
  config: PreviewConfig,
  context: RenderContext,
  payload: TrmnlMarkupResponse,
): string {
  const shared = payload.shared ?? "";
  const markup = payload[MARKUP_KEYS[context.view]] ?? "";
  const content = `${shared}\n${normalizeViewMarkup(context.view, markup)}`;
  const mashupClass = MASHUP_CLASSES[context.view];
  const wrapped = mashupClass ? `<div class="${mashupClass}">${content}</div>` : content;
  const classes = screenClasses(context.model, context.palette, context.orientation, context.fontFamily);
  const styles = screenStyle(context.model, context.orientation);
  const dimensions = cssDimensions(context.model, context.orientation);
  const cssUrl = `${config.frameworkAssetHost}/css/${config.frameworkVersion}/plugins.css`;
  const jsUrl = `${config.frameworkAssetHost}/js/${config.frameworkVersion}/plugins.js`;

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=${dimensions.width}, initial-scale=1">
    <link rel="stylesheet" href="${escapeAttribute(cssUrl)}">
    <script src="${escapeAttribute(jsUrl)}"></script>
    <meta name="trmnl-framework-version" content="${escapeAttribute(config.frameworkVersion)}">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap" rel="stylesheet">
    <title>${escapeHtml(context.model.label)} ${escapeHtml(VIEW_LABELS[context.view])}</title>
  </head>
  <body class="environment trmnl">
    <div class="${escapeAttribute(classes)}" style="${escapeAttribute(styles)}">
      ${wrapped}
    </div>
  </body>
</html>`;
}

function renderDeviceSection(
  sessionId: string,
  model: string,
  orientation: string,
  fontFamily: FrameworkFontFamily,
  title: string,
  width: number,
  height: number,
  zoom: number,
  canRender: boolean,
): string {
  const zoomStyle = `--frame-width: ${width}px; --frame-height: ${height}px; --display-zoom: ${formatZoom(zoom)};`;
  const previewMinWidth = Math.max(320, Math.ceil(width * zoom));
  const cards = VIEWS.map((view) => {
    const query = `sid=${encodeURIComponent(sessionId)}&model=${encodeURIComponent(model)}&orientation=${encodeURIComponent(orientation)}${userQuerySuffix()}`;
    const htmlPath = `/render/${view}.html?${query}`;
    const pngPath = `/render/${view}.png?${query}`;
    const viewLabel = VIEW_LABELS[view];
    const iframeTitle = `${model === "v2" ? "TRMNL X" : "TRMNL OG"} ${capitalize(orientation)} ${viewLabel} preview`;

    return `<article class="preview-card${canRender ? "" : " preview-card--blocked"}" data-view="${escapeAttribute(view)}">
      <div class="card-head">
        <div>
          <strong>${escapeHtml(viewLabel)}</strong>
          <span>${width}x${height}</span>
        </div>
        <div class="card-actions">
          <a href="${pngPath}" target="_blank" rel="noopener noreferrer" aria-label="Open ${escapeAttribute(viewLabel)} PNG">PNG</a>
        </div>
      </div>
      <div class="frame-viewport">
        <div class="blocked-state">
          <strong>Preview paused</strong>
          <p>${canRender ? "Diagnostics must pass before this frame loads." : "Save endpoint connection settings to render this layout."}</p>
        </div>
        <div class="frame-shell" style="${zoomStyle}">
          <iframe ${canRender ? `data-src="${htmlPath}"` : ""} title="${escapeAttribute(iframeTitle)}" loading="lazy" sandbox="allow-scripts" referrerpolicy="no-referrer" width="${width}" height="${height}"></iframe>
        </div>
      </div>
    </article>`;
  }).join("");

  return `<section class="preview-section" style="--preview-min-width: ${previewMinWidth}px; --measured-preview-width: ${previewMinWidth}px;">
    <div class="section-head">
      <div>
        <p class="eyebrow">Workspace</p>
        <h2>${escapeHtml(title)}</h2>
      </div>
      ${renderDiagnosticsPanel(sessionId, model, orientation, fontFamily)}
    </div>
    <div class="grid">${cards}</div>
  </section>
  <script>${dashboardScript()}</script>`;
}

function normalizeViewMarkup(view: string, markup: string): string {
  if (markup.includes("view--")) {
    return markup;
  }
  return `<div class="view view--${view}">${markup}</div>`;
}

function userQuerySuffix(): string {
  return "&font={font}";
}

type SegmentOption = {
  value: string;
  label: string;
  checked: boolean;
};

function renderSegmentedControl(legend: string, name: string, options: SegmentOption[]): string {
  const items = options.map((option) => {
    const id = `${name}-${option.value}`;
    return `<label for="${escapeAttribute(id)}">
      <input id="${escapeAttribute(id)}" type="radio" name="${escapeAttribute(name)}" value="${escapeAttribute(option.value)}"${option.checked ? " checked" : ""}>
      <span>${escapeHtml(option.label)}</span>
    </label>`;
  }).join("");

  return `<fieldset class="segmented-field">
    <legend>${escapeHtml(legend)}</legend>
    <div class="segmented-control">${items}</div>
  </fieldset>`;
}

function renderDiagnosticsPanel(sessionId: string, model: string, orientation: string, fontFamily: FrameworkFontFamily): string {
  const diagnosticsUrl = `/api/diagnostics?sid=${encodeURIComponent(sessionId)}&model=${encodeURIComponent(model)}&orientation=${encodeURIComponent(orientation)}&font=${encodeURIComponent(fontFamily)}`;
  return `<details class="diagnostics diagnostics--checking" data-diagnostics-url="${escapeAttribute(diagnosticsUrl)}" aria-live="polite" aria-busy="true">
    <summary>
      <span class="status-dot" aria-hidden="true"></span>
      <span data-diagnostics-field="title" role="status">Checking endpoint</span>
    </summary>
    <p class="diagnostics-error" data-diagnostics-field="error" role="alert" hidden></p>
    <div class="diagnostics-popover">
      <div><span>Endpoint</span><strong data-diagnostics-field="endpoint">-</strong></div>
      <div><span>HTTP</span><strong data-diagnostics-field="http">-</strong></div>
      <div><span>Response keys</span><strong data-diagnostics-field="keys">-</strong></div>
      <label class="diagnostics-curl">
        <span>Simulated request</span>
        <textarea readonly data-diagnostics-field="curl"></textarea>
      </label>
      <button type="button" class="secondary-button" data-copy-curl>Copy curl</button>
    </div>
  </details>`;
}

function dashboardCss(): string {
  return `
    :root {
      color-scheme: light;
      --ink: #1f2523;
      --muted: #68706c;
      --paper: #f4f1ea;
      --surface: #fffdf8;
      --subtle: #ebe6dc;
      --line: #c8c0b3;
      --line-strong: #8f877a;
      --accent: #0f766e;
      --accent-dark: #115e59;
      --warning: #9a5b0b;
      --danger: #9b2c2c;
      --success: #216e45;
      --field: #fffaf2;
      --shadow: 0 12px 30px rgb(31 37 35 / 14%);
    }
    * { box-sizing: border-box; }
    body { margin: 0; min-width: 760px; font-family: Avenir Next, Avenir, Trebuchet MS, sans-serif; background: var(--paper); color: var(--ink); }
    body.empty-page { min-width: 0; min-height: 100vh; background: linear-gradient(180deg, #f8f5ef 0%, #f1ece3 100%); }
    .empty-header { display: flex; align-items: center; justify-content: space-between; padding: 22px 28px; }
    .empty-header h1 { margin: 0; font-size: 20px; line-height: 1; }
    .empty-shell { min-height: calc(100vh - 66px); display: grid; place-items: center; padding: 36px 20px 72px; }
    .empty-card { width: min(100%, 580px); border: 1px solid rgb(200 192 179 / 80%); border-radius: 10px; background: rgb(255 253 248 / 92%); box-shadow: 0 24px 60px rgb(31 37 35 / 10%); padding: 28px; }
    .empty-card h2 { margin: 0; font-size: 34px; line-height: 1.05; letter-spacing: 0; }
    .empty-lede { max-width: 440px; margin-top: 10px; font-size: 17px; line-height: 1.45; }
    .empty-form { display: grid; gap: 14px; margin-top: 26px; }
    .empty-form label { display: grid; gap: 6px; color: #424844; font-size: 13px; font-weight: 800; }
    .empty-form label span { color: var(--muted); font-size: 12px; }
    .empty-form input { min-height: 44px; border-radius: 8px; background: white; }
    .empty-submit { min-height: 46px; margin-top: 4px; border-color: #17211f; border-radius: 8px; background: #17211f; font-weight: 800; }
    .empty-submit:hover { background: #0f1715; }
    .connection-error { margin-top: 18px; border: 1px solid rgb(155 44 44 / 22%); border-radius: 8px; background: rgb(155 44 44 / 7%); color: var(--danger); padding: 10px 12px; font-size: 14px; line-height: 1.4; }
    .session-note { margin-top: 14px; font-size: 13px; text-align: center; }
    .contract-details { margin-top: 18px; border-top: 1px solid var(--subtle); padding-top: 14px; }
    .contract-details summary { display: inline-flex; min-height: auto; padding: 0; border: 0; background: transparent; color: var(--accent); font-size: 13px; font-weight: 800; }
    .contract-details summary:hover { background: transparent; color: var(--accent-dark); }
    .contract-details p { margin-top: 10px; font-size: 13px; line-height: 1.5; }
    .contract-details code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; }
    .dashboard-form { position: sticky; top: 0; z-index: 20; border-bottom: 1px solid rgb(200 192 179 / 72%); background: rgb(244 241 234 / 94%); backdrop-filter: blur(18px); }
    .app-header { display: flex; justify-content: space-between; align-items: center; gap: 20px; padding: 18px 24px 12px; }
    .brand h1 { margin: 0; font-size: 24px; line-height: 1; }
    .brand p, p { margin: 6px 0 0; color: var(--muted); }
    h2 { margin: 0; font-size: 20px; line-height: 1.15; }
    .app-header__actions { position: relative; display: flex; align-items: center; gap: 8px; }
    .control-strip { display: flex; flex-wrap: wrap; gap: 16px; align-items: end; padding: 0 24px 16px; }
    .segmented-field { min-width: 0; margin: 0; padding: 0; border: 0; }
    .segmented-field legend, .eyebrow { display: block; margin: 0 0 6px; color: var(--muted); font-size: 11px; font-weight: 800; text-transform: uppercase; }
    .segmented-control { display: inline-flex; gap: 2px; min-height: 38px; padding: 3px; border: 1px solid rgb(200 192 179 / 86%); border-radius: 10px; background: rgb(235 230 220 / 70%); box-shadow: inset 0 1px 1px rgb(31 37 35 / 4%); }
    .segmented-control label { position: relative; min-width: 86px; cursor: pointer; }
    .segmented-control input { position: absolute; inset: 0; width: 100%; height: 100%; margin: 0; opacity: 0; cursor: pointer; }
    .segmented-control span { display: grid; min-height: 30px; place-items: center; border-radius: 7px; padding: 0 13px; color: #4f5752; font-size: 13px; font-weight: 800; white-space: nowrap; transition: background 140ms ease, color 140ms ease, box-shadow 140ms ease; }
    .segmented-control input:checked + span { background: var(--surface); color: var(--ink); box-shadow: 0 1px 6px rgb(31 37 35 / 12%); }
    .segmented-control input:focus-visible + span { outline: 3px solid rgb(15 118 110 / 28%); outline-offset: 2px; }
    .connection-panel label, .diagnostics-curl { display: grid; gap: 5px; min-width: 0; font-size: 12px; font-weight: 800; color: #424844; }
    .connection-panel label span, .diagnostics-popover span, .diagnostics-curl span { color: var(--muted); font-size: 11px; font-weight: 800; text-transform: uppercase; }
    input, select, textarea { width: 100%; min-width: 0; border: 1px solid var(--line); border-radius: 6px; padding: 9px 10px; font: inherit; background: var(--field); color: var(--ink); }
    input:focus, select:focus, textarea:focus, button:focus-visible, summary:focus-visible, a:focus-visible { outline: 3px solid rgb(15 118 110 / 28%); outline-offset: 2px; }
    button, summary, a { border: 1px solid var(--accent); border-radius: 6px; background: var(--accent); color: white; font: inherit; text-decoration: none; cursor: pointer; }
    summary, .refresh-button { min-height: 38px; padding: 8px 12px; }
    summary { display: inline-flex; align-items: center; list-style: none; user-select: none; }
    summary::-webkit-details-marker { display: none; }
    .refresh-button { border-radius: 999px; font-weight: 800; }
    .settings-button { border-color: var(--line); border-radius: 999px; background: rgb(255 253 248 / 78%); color: var(--ink); font-weight: 800; }
    .refresh-button:hover, a:hover { background: var(--accent-dark); }
    .settings-button:hover, .diagnostics summary:hover { background: white; }
    .secondary-button { justify-self: start; padding: 7px 10px; background: var(--surface); color: var(--accent); }
    .connection-menu { position: relative; flex: 0 0 auto; }
    .connection-panel { position: absolute; z-index: 30; right: 0; top: calc(100% + 8px); display: grid; grid-template-columns: minmax(320px, 1.4fr) minmax(210px, 0.8fr) minmax(210px, 0.8fr); gap: 12px; width: min(920px, calc(100vw - 48px)); padding: 14px; border: 1px solid var(--line); border-radius: 8px; background: var(--surface); box-shadow: var(--shadow); }
    .connection-panel__header { grid-column: 1 / -1; display: flex; justify-content: space-between; gap: 16px; padding-bottom: 10px; border-bottom: 1px solid var(--subtle); }
    .connection-panel__header strong { display: block; font-size: 16px; }
    .connection-panel__header p, .connection-panel small { margin: 3px 0 0; color: var(--muted); font-size: 12px; font-weight: 500; text-transform: none; }
    .connection-panel__header span { white-space: nowrap; align-self: start; border: 1px solid var(--line); border-radius: 999px; padding: 5px 8px; color: var(--muted); font-size: 12px; font-weight: 800; }
    .preview-main { display: grid; gap: 18px; padding: 18px 24px 28px; }
    .preview-card { border: 1px solid var(--line); border-radius: 8px; background: var(--surface); }
    .diagnostics { position: relative; justify-self: end; }
    .diagnostics summary { min-height: 34px; gap: 7px; border-color: var(--line); border-radius: 999px; background: rgb(255 253 248 / 78%); color: var(--muted); font-size: 12px; font-weight: 800; }
    .status-dot { width: 7px; height: 7px; border-radius: 999px; background: var(--warning); }
    .diagnostics--ok summary { color: var(--success); }
    .diagnostics--ok .status-dot { background: var(--success); }
    .diagnostics--error summary { color: var(--danger); }
    .diagnostics--error .status-dot { background: var(--danger); }
    .diagnostics-error { grid-column: 1 / -1; margin: 0; color: var(--danger); overflow-wrap: anywhere; }
    .diagnostics-popover { position: absolute; z-index: 15; right: 0; top: calc(100% + 8px); display: grid; gap: 10px; width: min(560px, calc(100vw - 48px)); padding: 12px; border: 1px solid var(--line); border-radius: 8px; background: var(--surface); box-shadow: var(--shadow); }
    .diagnostics-popover div { display: grid; gap: 3px; min-width: 0; }
    .diagnostics-popover strong { min-width: 0; overflow-wrap: anywhere; font-size: 13px; }
    .diagnostics-curl textarea { min-height: 86px; resize: vertical; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; }
    .preview-section { --preview-card-width: max(var(--preview-min-width), var(--measured-preview-width)); display: grid; gap: 12px; }
    .section-head { display: flex; justify-content: space-between; align-items: end; gap: 16px; }
    .section-head h2 { font-size: 24px; }
    .section-head > span { color: var(--muted); font-size: 13px; font-weight: 700; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, var(--preview-card-width)); gap: 16px; align-items: start; }
    .preview-card { width: var(--preview-card-width); overflow: hidden; }
    .card-head { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 10px 12px; border-bottom: 1px solid var(--line); background: #fbf8f1; }
    .card-head > div:first-child { display: grid; gap: 2px; }
    .card-head strong { font-size: 16px; }
    .card-head span { color: var(--muted); font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11px; }
    .card-actions { display: flex; align-items: center; gap: 8px; }
    .card-actions a { display: inline-flex; padding: 5px 8px; font-size: 12px; }
    .frame-viewport { position: relative; overflow: hidden; background: #d9d3c8; min-height: 112px; }
    .blocked-state { position: absolute; inset: 0; z-index: 2; display: grid; place-content: center; gap: 6px; padding: 18px; text-align: center; background: repeating-linear-gradient(135deg, rgb(235 230 220 / 92%) 0 8px, rgb(244 241 234 / 92%) 8px 16px); }
    .blocked-state strong { font-size: 15px; }
    .blocked-state p { max-width: 340px; margin: 0 auto; font-size: 13px; }
    .preview-card--ready .blocked-state { display: none; }
    .frame-shell { --visible-frame-width: var(--frame-width); --visible-frame-height: var(--frame-height); width: calc(var(--visible-frame-width) * var(--display-zoom)); height: calc(var(--visible-frame-height) * var(--display-zoom)); overflow: hidden; }
    iframe { display: block; width: var(--visible-frame-width); height: var(--visible-frame-height); border: 0; background: white; transform: scale(var(--display-zoom)); transform-origin: top left; }
    @media (max-width: 1100px) {
      .app-header { align-items: flex-start; flex-direction: column; }
      .diagnostics { justify-self: start; }
    }
    @media (max-width: 760px) {
      .app-header__actions { flex-wrap: wrap; }
      .segmented-control { display: flex; width: 100%; }
      .segmented-control label { flex: 1 1 0; }
      .connection-menu, .connection-menu summary, .refresh-button { width: 100%; justify-content: center; }
      .connection-panel { position: static; width: 100%; grid-template-columns: 1fr; margin-top: 8px; box-shadow: none; }
      .diagnostics-popover { position: static; width: 100%; margin-top: 8px; box-shadow: none; }
      .section-head, .card-head { align-items: start; flex-direction: column; }
    }
  `;
}

export function applyDashboardQueryTemplate(html: string, params: URLSearchParams): string {
  const model = encodeURIComponent(params.get("model") ?? "og_png");
  const orientation = encodeURIComponent(params.get("orientation") ?? "landscape");
  const fontFamily = encodeURIComponent(params.get("font") ?? "default");
  const sid = encodeURIComponent(params.get("sid") ?? "local");
  return html
    .replaceAll("{model}", model)
    .replaceAll("{orientation}", orientation)
    .replaceAll("{font}", fontFamily)
    .replaceAll("{sid}", sid);
}

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeAttribute(value: string): string {
  return escapeHtml(value);
}

function selectedDimensions(selection: DashboardSelection): { width: number; height: number } {
  const landscape = selection.model === "v2"
    ? { width: 1040, height: 780 }
    : { width: 800, height: 480 };
  return selection.orientation === "portrait"
    ? { width: landscape.height, height: landscape.width }
    : landscape;
}

function capitalize(value: string): string {
  return `${value.slice(0, 1).toUpperCase()}${value.slice(1)}`;
}

function formatZoom(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function displayZoomForModel(model: DashboardSelection["model"]): number {
  return model === "v2" ? 0.4 : 0.8;
}

function connectionSourceLabel(source: PreviewConfig["connectionSource"]): string {
  if (source === "saved") return "Saved for this browser session";
  if (source === "configured") return "Loaded from CLI or environment";
  return "Using placeholder defaults";
}

function connectionHelpText(config: PreviewConfig): string {
  if (config.connectionSource === "default") {
    return "The current values are placeholders. Replace them with your local plugin server credentials.";
  }
  return "Connection values are stored server-side. Render links only include a session id.";
}

function dashboardScript(): string {
  return `
    const measurePreviewFrames = () => {
      for (const section of document.querySelectorAll(".preview-section")) {
        const sectionStyle = getComputedStyle(section);
        let cardWidth = Number.parseFloat(sectionStyle.getPropertyValue("--preview-min-width")) || 0;

        for (const shell of section.querySelectorAll(".frame-shell")) {
          const iframe = shell.querySelector("iframe");
          const shellStyle = getComputedStyle(shell);
          const frameWidth = Number.parseFloat(shellStyle.getPropertyValue("--frame-width")) || 0;
          const frameHeight = Number.parseFloat(shellStyle.getPropertyValue("--frame-height")) || 0;
          const displayZoom = Number.parseFloat(shellStyle.getPropertyValue("--display-zoom")) || 1;
          let measuredWidth = frameWidth;
          let measuredHeight = frameHeight;

          try {
            const doc = iframe?.contentDocument;
            measuredWidth = Math.max(frameWidth, doc?.documentElement.scrollWidth ?? 0, doc?.body?.scrollWidth ?? 0);
            measuredHeight = Math.max(frameHeight, doc?.documentElement.scrollHeight ?? 0, doc?.body?.scrollHeight ?? 0);
          } catch {
            measuredWidth = frameWidth;
            measuredHeight = frameHeight;
          }

          shell.style.setProperty("--visible-frame-width", Math.ceil(measuredWidth) + "px");
          shell.style.setProperty("--visible-frame-height", Math.ceil(measuredHeight) + "px");
          cardWidth = Math.max(cardWidth, Math.ceil(measuredWidth * displayZoom));
        }

        section.style.setProperty("--measured-preview-width", Math.ceil(cardWidth) + "px");
      }
    };

    for (const iframe of document.querySelectorAll("iframe")) {
      iframe.addEventListener("load", () => {
        const card = iframe.closest(".preview-card");
        card?.classList.add("preview-card--rendered");
        measurePreviewFrames();
        try {
          const doc = iframe.contentDocument;
          doc?.fonts?.ready?.then(measurePreviewFrames).catch(() => {});
        } catch {}
        window.setTimeout(measurePreviewFrames, 100);
      });
    }

    window.addEventListener("load", measurePreviewFrames);
    measurePreviewFrames();

    const diagnostics = document.querySelector(".diagnostics");
    const dashboardForm = document.querySelector(".dashboard-form");
    const previewCards = Array.from(document.querySelectorAll(".preview-card"));
    const setDiagnosticsText = (field, value) => {
      const target = diagnostics?.querySelector('[data-diagnostics-field="' + field + '"]');
      if (target) target.textContent = value || "-";
    };
    const setCardsState = (state) => {
      for (const card of previewCards) {
        card.classList.remove("preview-card--ready", "preview-card--blocked", "preview-card--error");
        card.classList.add("preview-card--" + state);
      }
    };
    const loadPreviewFrames = () => {
      for (const iframe of document.querySelectorAll("iframe[data-src]")) {
        if (!iframe.getAttribute("src")) {
          iframe.setAttribute("src", iframe.dataset.src);
        }
      }
      setCardsState("ready");
    };
    const loadDiagnostics = async () => {
      if (!diagnostics) return;
      try {
        const response = await fetch(diagnostics.dataset.diagnosticsUrl, { headers: { accept: "application/json" } });
        const data = await response.json();
        diagnostics.classList.remove("diagnostics--checking", "diagnostics--ok", "diagnostics--error");
        diagnostics.classList.add(data.ok ? "diagnostics--ok" : "diagnostics--error");
        diagnostics.setAttribute("aria-busy", "false");
        setDiagnosticsText("title", data.ok ? "Endpoint ready" : "Endpoint needs attention");
        setDiagnosticsText("endpoint", data.targetHost);
        setDiagnosticsText("http", data.httpStatus ? String(data.httpStatus) : "-");
        setDiagnosticsText("keys", data.responseKeys?.join(", ") || "none");
        const curl = diagnostics.querySelector('[data-diagnostics-field="curl"]');
        if (curl) curl.value = data.curl || "";
        const error = diagnostics.querySelector('[data-diagnostics-field="error"]');
        if (error) {
          error.hidden = !data.error;
          error.textContent = data.error || "";
        }
        if (data.ok) {
          loadPreviewFrames();
        } else {
          setCardsState("error");
        }
      } catch (error) {
        diagnostics.classList.remove("diagnostics--checking", "diagnostics--ok");
        diagnostics.classList.add("diagnostics--error");
        diagnostics.setAttribute("aria-busy", "false");
        setDiagnosticsText("title", "Endpoint check failed");
        setDiagnosticsText("http", "-");
        setCardsState("error");
        const target = diagnostics.querySelector('[data-diagnostics-field="error"]');
        if (target) {
          target.hidden = false;
          target.textContent = error instanceof Error ? error.message : String(error);
        }
      }
    };
    const copyCurl = diagnostics?.querySelector("[data-copy-curl]");
    copyCurl?.addEventListener("click", async () => {
      const curl = diagnostics.querySelector('[data-diagnostics-field="curl"]')?.value || "";
      try {
        await navigator.clipboard.writeText(curl);
        copyCurl.textContent = "Copied";
        window.setTimeout(() => { copyCurl.textContent = "Copy curl"; }, 1200);
      } catch {
        copyCurl.textContent = "Copy failed";
      }
    });
    for (const control of document.querySelectorAll('.segmented-control input[type="radio"]')) {
      control.addEventListener("change", () => {
        if (control.checked) dashboardForm?.requestSubmit();
      });
    }
    loadDiagnostics();
  `;
}
