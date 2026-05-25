import assert from "node:assert/strict";
import test from "node:test";
import { cssDimensions } from "../dist/src/server.js";
import { applyDashboardQueryTemplate, renderDashboard, renderPluginDocument } from "../dist/src/html.js";

const model = {
  name: "v2",
  label: "TRMNL X",
  description: "TRMNL X",
  width: 1872,
  height: 1404,
  colors: 16,
  bit_depth: 4,
  scale_factor: 1.8,
  rotation: 0,
  mime_type: "image/png",
  offset_x: 0,
  offset_y: 0,
  kind: "trmnl",
  palette_ids: ["gray-16"],
  preview_white_point: "true_white",
  image_size_limit: 92160,
  image_upload_supported: true,
  css: {
    classes: {
      device: "screen--v2",
      size: "screen--lg",
      density: "screen--density-2x",
    },
    variables: [
      ["--screen-w", "1040px"],
      ["--screen-h", "780px"],
      ["--pixel-ratio", "1.8"],
    ],
  },
};

const palette = {
  id: "gray-16",
  name: "16 Grays",
  grays: 16,
  framework_class: "screen--4bit",
};

const config = {
  host: "127.0.0.1",
  port: 4568,
  openBrowser: false,
  targetUrl: "http://localhost:8787/trmnl/markup",
  token: "secret-token-for-test",
  userUuid: "user",
  connectionSource: "configured",
  allowRemoteTargets: false,
  frameworkVersion: "3.1.1",
  frameworkAssetHost: "https://trmnl.com",
  requestTimeoutMs: 5000,
  cacheTtlMs: 2000,
};

test("portrait swaps framework CSS dimensions", () => {
  assert.deepEqual(cssDimensions(model, "portrait"), { width: 780, height: 1040 });
});

test("half horizontal render uses mashup wrapper without duplicating view wrapper", () => {
  const html = renderPluginDocument(
    config,
    {
      view: "half_horizontal",
      model,
      palette,
      orientation: "landscape",
      fontFamily: "trmnl",
      sessionId: "local",
      targetUrl: config.targetUrl,
      token: config.token,
      userUuid: config.userUuid,
    },
    {
      shared: "<style>.x{}</style>",
      markup_half_horizontal: "<div class=\"view view--half_horizontal\"><div class=\"layout\">Hello</div></div>",
    },
  );

  assert.match(html, /mashup mashup--1Tx1B/);
  assert.equal((html.match(/view view--half_horizontal/g) ?? []).length, 1);
  assert.match(html, /screen--v2/);
  assert.match(html, /screen--4bit/);
  assert.match(html, /screen--fonts-trmnl/);
  assert.match(html, /screen--1x/);
  assert.match(html, /fonts\.googleapis\.com\/css2\?family=Inter/);
  assert.match(html, /meta name="trmnl-framework-version" content="3\.1\.1"/);
});

test("default framework font leaves the screen font bundle unset", () => {
  const html = renderPluginDocument(
    config,
    {
      view: "full",
      model,
      palette,
      orientation: "landscape",
      fontFamily: "default",
      sessionId: "local",
      targetUrl: config.targetUrl,
      token: config.token,
      userUuid: config.userUuid,
    },
    {
      markup: "<div class=\"view view--full\"><div class=\"layout\">Hello</div></div>",
    },
  );

  assert.doesNotMatch(html, /screen--fonts-classic/);
  assert.doesNotMatch(html, /screen--fonts-trmnl/);
});

test("dashboard renders one selected device and four variant frames", () => {
  const html = applyDashboardQueryTemplate(
    renderDashboard(config, { model: "v2", orientation: "portrait", fontFamily: "classic" }, "session-123"),
    new URLSearchParams({
      sid: "session-123",
      model: "v2",
      orientation: "portrait",
      font: "classic",
    }),
  );

  assert.match(html, /TRMNL X Portrait/);
  assert.match(html, /<form class="dashboard-form" method="post" action="\/settings" data-connection-source="configured">/);
  assert.match(html, /<input type="hidden" name="sid" value="session-123">/);
  assert.match(html, /<input type="hidden" name="csrf" value="local">/);
  assert.match(html, /<section class="control-strip" aria-label="Simulator settings">/);
  assert.match(html, /<fieldset class="segmented-field">\s*<legend>Device<\/legend>/);
  assert.match(html, /<input id="model-v2" type="radio" name="model" value="v2" checked>/);
  assert.match(html, /<input id="orientation-portrait" type="radio" name="orientation" value="portrait" checked>/);
  assert.match(html, /<input id="font-classic" type="radio" name="font" value="classic" checked>/);
  assert.match(html, /<button class="refresh-button" type="submit">Reload previews<\/button>/);
  assert.match(html, /<details class="connection-menu">\s*<summary class="settings-button">Settings<\/summary>/);
  assert.doesNotMatch(html, /Saved session/);
  assert.doesNotMatch(html, /connection-badge/);
  assert.match(html, /<div class="connection-panel">/);
  assert.match(html, /type="password" autocomplete="off" placeholder="Configured"/);
  assert.match(html, /Leave blank to keep the current token\./);
  assert.match(html, /<details class="diagnostics diagnostics--checking" data-diagnostics-url="\/api\/diagnostics\?sid=session-123&amp;model=v2&amp;orientation=portrait&amp;font=classic"/);
  assert.match(html, /Checking endpoint/);
  assert.match(html, /Copy curl/);
  assert.doesNotMatch(html, /data-diagnostics-field="device"/);
  assert.doesNotMatch(html, /data-diagnostics-field="missing"/);
  assert.doesNotMatch(html, /data-diagnostics-field="status"/);
  assert.match(html, /connection-panel \{ position: absolute;[^}]*width: min\(920px, calc\(100vw - 48px\)\)/);
  assert.match(html, /@media \(max-width: 760px\)/);
  assert.doesNotMatch(html, /name="zoom"/);
  assert.match(html, /font=classic/);
  assert.match(html, /style="--frame-width: 780px; --frame-height: 1040px; --display-zoom: 0\.4;"/);
  assert.match(html, /class="frame-viewport"/);
  assert.match(html, /<section class="preview-section" style="--preview-min-width: 320px; --measured-preview-width: 320px;">/);
  assert.match(html, /grid-template-columns: repeat\(auto-fit, var\(--preview-card-width\)\)/);
  assert.match(html, /\.preview-card \{ width: var\(--preview-card-width\);/);
  assert.match(html, /measurePreviewFrames/);
  assert.match(html, /--visible-frame-width/);
  assert.doesNotMatch(html, /--fit-zoom/);
  assert.doesNotMatch(html, /ResizeObserver/);
  assert.match(html, /<iframe data-src="\/render\/full\.html\?sid=session-123&model=v2&orientation=portrait&font=classic/);
  assert.match(html, /sandbox="allow-scripts" referrerpolicy="no-referrer"/);
  assert.match(html, /title="TRMNL X Portrait Full preview"/);
  assert.match(html, /target="_blank" rel="noopener noreferrer" aria-label="Open Full PNG"/);
  assert.match(html, />780x1040<\/span>/);
  assert.doesNotMatch(html, />HTML<\/a>/);
  assert.doesNotMatch(html, /data-card-status/);
  assert.doesNotMatch(html, /4 layouts rendered/);
  assert.match(html, /dashboardForm\?\.requestSubmit\(\)/);
  assert.doesNotMatch(html, /secret-token-for-test/);
  assert.doesNotMatch(html, /token=secret-token-for-test/);
  assert.equal((html.match(/<iframe/g) ?? []).length, 4);
  assert.equal((html.match(/<section/g) ?? []).length, 2);
  assert.doesNotMatch(html, /Connect a local TRMNL markup endpoint/);
});

test("dashboard first run is connection-first and does not load preview frames", () => {
  const html = renderDashboard(
    { ...config, connectionSource: "default" },
    { model: "og_png", orientation: "landscape", fontFamily: "default" },
    "session-default",
  );

  assert.match(html, /<body class="empty-page">/);
  assert.match(html, /<main class="empty-shell">/);
  assert.match(html, /<section class="empty-card" aria-labelledby="connection-title">/);
  assert.match(html, /Connect your plugin/);
  assert.match(html, /Add your local markup URL and preview credentials to render TRMNL layouts\./);
  assert.match(html, /<form class="empty-form" method="post" action="\/settings">/);
  assert.match(html, /<input type="hidden" name="sid" value="session-default">/);
  assert.match(html, /<input type="hidden" name="csrf" value="local">/);
  assert.match(html, /<input type="hidden" name="model" value="og_png">/);
  assert.match(html, /<input type="hidden" name="orientation" value="landscape">/);
  assert.match(html, /<input type="hidden" name="font" value="default">/);
  assert.match(html, /name="target"/);
  assert.match(html, /value="http:\/\/localhost:8787\/trmnl\/markup"/);
  assert.match(html, /name="token"/);
  assert.match(html, /name="user_uuid"/);
  assert.doesNotMatch(html, /secret-token-for-test/);
  assert.doesNotMatch(html, /value="secret-token-for-test"/);
  assert.doesNotMatch(html, /value="user"/);
  assert.match(html, /<button class="empty-submit" type="submit">Connect<\/button>/);
  assert.match(html, /Stored locally for this preview session\. Render links do not include your token\./);
  assert.match(html, /Endpoint contract/);
  assert.doesNotMatch(html, /<fieldset class="toolbar-group render-settings">/);
  assert.doesNotMatch(html, /data-diagnostics-url/);
  assert.doesNotMatch(html, /<section class="diagnostics/);
  assert.doesNotMatch(html, /Request details/);
  assert.doesNotMatch(html, /Copy curl/);
  assert.doesNotMatch(html, /<section class="preview-section"/);
  assert.doesNotMatch(html, /class="preview-card/);
  assert.doesNotMatch(html, /class="frame-viewport"/);
  assert.doesNotMatch(html, /\/render\//);
  assert.doesNotMatch(html, /\/api\/diagnostics/);
  assert.doesNotMatch(html, /<iframe/);
  assert.equal((html.match(/<iframe/g) ?? []).length, 0);
});

test("dashboard uses fixed display zoom by device", () => {
  const og = renderDashboard(config, { model: "og_png", orientation: "landscape", fontFamily: "default" });
  const x = renderDashboard(config, { model: "v2", orientation: "landscape", fontFamily: "default" });

  assert.match(og, /--display-zoom: 0\.8;/);
  assert.match(x, /--display-zoom: 0\.4;/);
  assert.doesNotMatch(og, /name="zoom"/);
  assert.doesNotMatch(x, /name="zoom"/);
});
