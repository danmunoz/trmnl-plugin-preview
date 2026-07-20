#!/usr/bin/env node
/**
 * Shapes — a minimal example TRMNL third-party plugin endpoint.
 *
 * It answers a POST with markup for all four TRMNL views. Each view just draws a
 * few labelled geometric figures, so you can see at a glance what a plugin
 * renders in each slot without any real data or logic getting in the way.
 *
 * Run it, then point the preview at it:
 *
 *   node examples/shapes/server.mjs
 *   pnpm dev -- --target http://localhost:8787/trmnl/markup \
 *     --token local-preview-token --user-uuid local-preview-user
 *
 * Zero dependencies — Node standard library only.
 */

import { createServer } from "node:http";

const PORT = Number(process.env.PORT ?? 8787);
const HOST = process.env.HOST ?? "127.0.0.1";
const EXPECTED_TOKEN = process.env.SHAPES_TOKEN ?? "local-preview-token";

// --- geometric figures (inline SVG, currentColor so they render at any bit depth) ---

const FIGURES = {
  square: `<rect x="6" y="6" width="36" height="36" fill="currentColor"/>`,
  circle: `<circle cx="24" cy="24" r="18" fill="none" stroke="currentColor" stroke-width="3"/>`,
  triangle: `<polygon points="24,5 43,43 5,43" fill="none" stroke="currentColor" stroke-width="3"/>`,
  line: `<line x1="6" y1="42" x2="42" y2="6" stroke="currentColor" stroke-width="3"/>`,
};

/**
 * A labelled figure tile.
 * @param {keyof typeof FIGURES} name
 * @param {boolean} [small]
 */
function figure(name, small = false) {
  return (
    `<div class="fig${small ? " fig--sm" : ""}">` +
    `<svg viewBox="0 0 48 48" role="img" aria-label="${name}">${FIGURES[name]}</svg>` +
    `<span class="fig__label">${name}</span>` +
    `</div>`
  );
}

/**
 * Build one view: a big name, a subtitle, and a row of figures. Returns the
 * third-party wrapper `<div class="view view--{type}">` with one `.layout`
 * inside; TRMNL adds the surrounding `.screen`/`.mashup` itself.
 * @param {string} type
 * @param {string} name
 * @param {string} sub
 * @param {string[]} figures
 * @param {boolean} [small]
 */
function buildView(type, name, sub, figures, small = false) {
  const tiles = figures.map((f) => figure(f, small)).join("");
  return (
    `<div class="view view--${type}">` +
    `<div class="layout">` +
    `<div class="fig-wrap">` +
    `<span class="fig-name">${name}</span>` +
    `<span class="fig-sub">${sub}</span>` +
    `<div class="fig-row">${tiles}</div>` +
    `</div>` +
    `</div>` +
    `<div class="title_bar">` +
    `<img class="image" src="https://usetrmnl.com/images/plugins/trmnl--render.svg" alt="">` +
    `<span class="title">Shapes Preview</span>` +
    `<span class="instance">${name}</span>` +
    `</div>` +
    `</div>`
  );
}

/** Assemble the JSON payload TRMNL expects: one markup string per view + shared. */
function buildPayload() {
  return {
    markup: buildView("full", "Full", "800×480 · 5:3", ["square", "circle", "triangle", "line"]),
    markup_half_horizontal: buildView("half_horizontal", "Half Horizontal", "wide · 8:3", ["square", "circle", "triangle"]),
    markup_half_vertical: buildView("half_vertical", "Half Vertical", "tall · 2:3", ["square", "circle"], true),
    markup_quadrant: buildView("quadrant", "Quadrant", "4:3", ["square"], true),
    shared: SHARED,
  };
}

/** Custom styles for the figure tiles, prepended to every view. */
const SHARED = `
<style>
  .fig-wrap { display:flex; flex-direction:column; align-items:center; justify-content:center; gap:14px; height:100%; text-align:center; }
  .fig-name { font-size:34px; font-weight:700; line-height:1; }
  .fig-sub { font-size:13px; opacity:.7; }
  .fig-row { display:flex; flex-wrap:wrap; gap:22px; justify-content:center; align-items:flex-end; }
  .fig { display:flex; flex-direction:column; align-items:center; gap:6px; }
  .fig svg { width:56px; height:56px; color:currentColor; }
  .fig--sm svg { width:40px; height:40px; }
  .fig__label { font-size:13px; text-transform:capitalize; }
</style>`;

// --- HTTP layer ---

const server = createServer((req, res) => {
  if (req.method === "GET") {
    return sendJson(res, 200, { service: "shapes-example", usage: "POST with a Bearer token for TRMNL markup." });
  }
  if (req.method !== "POST") {
    res.setHeader("allow", "GET, POST");
    return sendJson(res, 405, { error: "Method not allowed" });
  }
  const token = /^Bearer\s+(.+)$/i.exec(req.headers.authorization ?? "")?.[1];
  if (token !== EXPECTED_TOKEN) {
    res.setHeader("www-authenticate", "Bearer");
    return sendJson(res, 401, { error: "Missing or invalid bearer token" });
  }
  // The request body (user_uuid + trmnl metadata) is ignored — this example is
  // static. Drain it, then respond.
  req.resume();
  req.on("end", () => sendJson(res, 200, buildPayload()));
});

/**
 * @param {import("node:http").ServerResponse} res
 * @param {number} status
 * @param {unknown} value
 */
function sendJson(res, status, value) {
  const text = JSON.stringify(value);
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "content-length": Buffer.byteLength(text) });
  res.end(text);
}

server.listen(PORT, HOST, () => {
  process.stdout.write(`Shapes example running at http://${HOST}:${PORT}\n  token:  ${EXPECTED_TOKEN}\n  target: http://${HOST}:${PORT}/trmnl/markup\n`);
});
