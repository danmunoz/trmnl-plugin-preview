import assert from "node:assert/strict";
import { createServer } from "node:http";
import test from "node:test";
import { createPreviewServer } from "../dist/src/server.js";

const baseConfig = {
  host: "127.0.0.1",
  port: 0,
  openBrowser: false,
  targetUrl: "http://127.0.0.1:1/trmnl/markup",
  token: "default-secret-token",
  userUuid: "default-user",
  connectionSource: "default",
  allowRemoteTargets: false,
  frameworkVersion: "3.1.1",
  frameworkAssetHost: "https://trmnl.com",
  requestTimeoutMs: 5000,
  cacheTtlMs: 0,
};

test("default dashboard renders a first-run connection form without render surface", async () => {
  const preview = createPreviewServer(baseConfig);
  const previewBase = await listen(preview);

  try {
    const response = await fetch(`${previewBase}/`);
    const html = await response.text();

    assert.equal(response.status, 200);
    assert.match(html, /Connect your plugin/);
    assert.match(html, /<form class="empty-form" method="post" action="\/settings">/);
    assert.match(html, /name="target"/);
    assert.match(html, /name="token"/);
    assert.match(html, /name="user_uuid"/);
    assert.doesNotMatch(html, /default-secret-token/);
    assert.doesNotMatch(html, /default-user/);
    assert.doesNotMatch(html, /\/render\//);
    assert.doesNotMatch(html, /\/api\/diagnostics/);
    assert.doesNotMatch(html, /<iframe/);
  } finally {
    await close(preview);
  }
});

test("dashboard ignores credential query params", async () => {
  const preview = createPreviewServer(baseConfig);
  const previewBase = await listen(preview);

  try {
    const response = await fetch(`${previewBase}/?target=http://example.test/markup&token=query-secret&user_uuid=query-user&model=v2&orientation=portrait&font=classic`, {
      redirect: "manual",
    });
    const html = await response.text();

    assert.equal(response.status, 200);
    assert.match(html, /Connect your plugin/);
    assert.match(html, /value="http:\/\/127\.0\.0\.1:1\/trmnl\/markup"/);
    assert.doesNotMatch(html, /query-secret/);
    assert.doesNotMatch(html, /query-user/);
    assert.doesNotMatch(html, /example\.test/);
    assert.doesNotMatch(html, /\/render\//);
    assert.doesNotMatch(html, /\/api\/diagnostics/);
  } finally {
    await close(preview);
  }
});

test("dashboard stores connection settings server-side and redirects to a sanitized URL", async () => {
  const target = createServer((_request, response) => {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({
      markup: "<div>Full</div>",
      markup_half_horizontal: "<div>Half horizontal</div>",
      markup_half_vertical: "<div>Half vertical</div>",
      markup_quadrant: "<div>Quadrant</div>",
    }));
  });
  const targetBase = await listen(target);
  const preview = createPreviewServer(baseConfig);
  const previewBase = await listen(preview);

  try {
    const initial = await getSession(previewBase);
    const response = await fetch(`${previewBase}/settings`, {
      method: "POST",
      redirect: "manual",
      headers: {
        cookie: initial.cookie,
        origin: previewBase,
      },
      body: new URLSearchParams({
        sid: initial.sid,
        csrf: initial.csrf,
        target: `${targetBase}/trmnl/markup`,
        token: "query-secret",
        user_uuid: "query-user",
        model: "v2",
        orientation: "portrait",
        font: "classic",
      }),
    });
    assert.equal(response.status, 303);

    const location = response.headers.get("location");
    assert.ok(location);
    assert.doesNotMatch(location, /query-secret/);
    assert.doesNotMatch(location, /user_uuid/);
    assert.doesNotMatch(location, /target=/);

    const cookie = response.headers.get("set-cookie")?.split(";")[0];
    assert.ok(cookie);

    const dashboard = await fetch(new URL(location, previewBase), { headers: { cookie } });
    const html = await dashboard.text();
    assert.equal(dashboard.status, 200);
    assert.match(html, /type="password" autocomplete="off" placeholder="Configured"/);
    assert.match(html, /\/render\/full\.html\?sid=/);
    assert.match(html, /\/api\/diagnostics\?sid=/);
    assert.doesNotMatch(html, /query-secret/);
    assert.doesNotMatch(html, /token=query-secret/);
    assert.doesNotMatch(html, /user_uuid=query-user/);
  } finally {
    await close(preview);
    await close(target);
  }
});

test("configured startup credentials are validated before rendering the workspace", async () => {
  const target = createServer((request, response) => {
    request.resume();
    response.writeHead(401, { "content-type": "application/json" });
    response.end(JSON.stringify({
      error: "unauthorized",
      token: request.headers.authorization,
      user: "configured-user",
    }));
  });
  const targetBase = await listen(target);
  const preview = createPreviewServer({
    ...baseConfig,
    targetUrl: `${targetBase}/trmnl/markup`,
    token: "configured-secret-token",
    userUuid: "configured-user",
    connectionSource: "configured",
  });
  const previewBase = await listen(preview);

  try {
    const response = await fetch(`${previewBase}/?model=v2&orientation=portrait&font=classic`);
    const html = await response.text();

    assert.equal(response.status, 400);
    assert.match(html, /Connect your plugin/);
    assert.match(html, /role="alert"/);
    assert.match(html, /Markup endpoint returned 401/);
    assert.match(html, /value="configured-user"/);
    assert.match(html, new RegExp(`value="${targetBase.replaceAll(".", "\\.")}/trmnl/markup"`));
    assert.doesNotMatch(html, /configured-secret-token/);
    assert.doesNotMatch(html, /Bearer configured-secret-token/);
    assert.doesNotMatch(html, /Renderer workspace/);
    assert.doesNotMatch(html, /\/api\/diagnostics/);
    assert.doesNotMatch(html, /\/render\//);
    assert.doesNotMatch(html, /<iframe/);
  } finally {
    await close(preview);
    await close(target);
  }
});

test("settings reject invalid credentials and keep the user on the first-run screen", async () => {
  const target = createServer(async (request, response) => {
    request.resume();
    response.writeHead(401, { "content-type": "application/json" });
    response.end(JSON.stringify({
      error: "unauthorized",
      token: request.headers.authorization,
      user: "wrong-user",
    }));
  });
  const targetBase = await listen(target);
  const preview = createPreviewServer(baseConfig);
  const previewBase = await listen(preview);

  try {
    const initial = await getSession(previewBase);
    const response = await fetch(`${previewBase}/settings`, {
      method: "POST",
      redirect: "manual",
      headers: { cookie: initial.cookie },
      body: new URLSearchParams({
        sid: initial.sid,
        csrf: initial.csrf,
        target: `${targetBase}/trmnl/markup`,
        token: "wrong-secret-token",
        user_uuid: "wrong-user",
        model: "og_png",
        orientation: "landscape",
        font: "default",
      }),
    });
    const html = await response.text();

    assert.equal(response.status, 400);
    assert.match(html, /Connect your plugin/);
    assert.match(html, /role="alert"/);
    assert.match(html, /Markup endpoint returned 401/);
    assert.match(html, /value="wrong-user"/);
    assert.match(html, new RegExp(`value="${targetBase.replaceAll(".", "\\.")}/trmnl/markup"`));
    assert.doesNotMatch(html, /wrong-secret-token/);
    assert.doesNotMatch(html, /Bearer wrong-secret-token/);
    assert.doesNotMatch(html, /<section class="preview-section"/);
    assert.doesNotMatch(html, /\/render\//);
    assert.doesNotMatch(html, /<iframe/);
  } finally {
    await close(preview);
    await close(target);
  }
});

test("settings reject missing or invalid csrf tokens", async () => {
  const preview = createPreviewServer(baseConfig);
  const previewBase = await listen(preview);

  try {
    const initial = await getSession(previewBase);
    for (const csrf of ["", "wrong-token"]) {
      const response = await fetch(`${previewBase}/settings`, {
        method: "POST",
        redirect: "manual",
        headers: {
          cookie: initial.cookie,
          origin: "null",
        },
        body: new URLSearchParams({
          sid: initial.sid,
          csrf,
          target: "http://127.0.0.1:1234/trmnl/markup",
          token: "csrf-secret-token",
          user_uuid: "csrf-user",
          model: "og_png",
          orientation: "landscape",
          font: "default",
        }),
      });
      const html = await response.text();

      assert.equal(response.status, 403);
      assert.match(html, /Settings form expired/);
      assert.doesNotMatch(html, /csrf-secret-token/);
      assert.doesNotMatch(html, /\/render\//);
    }
  } finally {
    await close(preview);
  }
});

test("settings accept opaque browser origins when the session csrf token is valid", async () => {
  const target = createServer((_request, response) => {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({
      markup: "<div>Full</div>",
      markup_half_horizontal: "<div>Half horizontal</div>",
      markup_half_vertical: "<div>Half vertical</div>",
      markup_quadrant: "<div>Quadrant</div>",
    }));
  });
  const targetBase = await listen(target);
  const preview = createPreviewServer(baseConfig);
  const previewBase = await listen(preview);

  try {
    const initial = await getSession(previewBase);
    const response = await fetch(`${previewBase}/settings`, {
      method: "POST",
      redirect: "manual",
      headers: {
        cookie: initial.cookie,
        origin: "null",
      },
      body: new URLSearchParams({
        sid: initial.sid,
        csrf: initial.csrf,
        target: `${targetBase}/trmnl/markup`,
        token: "opaque-origin-secret-token",
        user_uuid: "opaque-origin-user",
        model: "og_png",
        orientation: "landscape",
        font: "default",
      }),
    });

    assert.equal(response.status, 303);
    const location = response.headers.get("location") ?? "";
    assert.match(location, /^\//);
    assert.doesNotMatch(location, /opaque-origin-secret-token/);
    assert.doesNotMatch(location, /user_uuid/);
    assert.doesNotMatch(location, /target=/);

    const cookie = response.headers.get("set-cookie")?.split(";")[0];
    assert.ok(cookie);

    const dashboard = await fetch(new URL(location, previewBase), { headers: { cookie } });
    const html = await dashboard.text();
    assert.equal(dashboard.status, 200);
    assert.match(html, /\/render\/full\.html\?sid=/);
    assert.doesNotMatch(html, /opaque-origin-secret-token/);
  } finally {
    await close(preview);
    await close(target);
  }
});

test("settings accept unusable origin headers when the session csrf token is valid", async () => {
  const target = createServer((_request, response) => {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({
      markup: "<div>Full</div>",
      markup_half_horizontal: "<div>Half horizontal</div>",
      markup_half_vertical: "<div>Half vertical</div>",
      markup_quadrant: "<div>Quadrant</div>",
    }));
  });
  const targetBase = await listen(target);
  const preview = createPreviewServer(baseConfig);
  const previewBase = await listen(preview);

  try {
    const initial = await getSession(previewBase);
    const response = await fetch(`${previewBase}/settings`, {
      method: "POST",
      redirect: "manual",
      headers: {
        cookie: initial.cookie,
        origin: "http://[::1",
      },
      body: new URLSearchParams({
        sid: initial.sid,
        csrf: initial.csrf,
        target: `${targetBase}/trmnl/markup`,
        token: "unusable-origin-secret-token",
        user_uuid: "unusable-origin-user",
        model: "og_png",
        orientation: "landscape",
        font: "default",
      }),
    });

    assert.equal(response.status, 303);
    const location = response.headers.get("location") ?? "";
    assert.match(location, /^\//);
    assert.doesNotMatch(location, /unusable-origin-secret-token/);
    assert.doesNotMatch(location, /user_uuid/);
    assert.doesNotMatch(location, /target=/);
  } finally {
    await close(preview);
    await close(target);
  }
});

test("settings reject cross-site browser origins even when the csrf token is present", async () => {
  const preview = createPreviewServer(baseConfig);
  const previewBase = await listen(preview);

  try {
    const initial = await getSession(previewBase);
    const response = await fetch(`${previewBase}/settings`, {
      method: "POST",
      redirect: "manual",
      headers: {
        cookie: initial.cookie,
        origin: "http://attacker.test",
      },
      body: new URLSearchParams({
        sid: initial.sid,
        csrf: initial.csrf,
        target: "http://127.0.0.1:1234/trmnl/markup",
        token: "cross-site-secret-token",
        user_uuid: "cross-site-user",
        model: "og_png",
        orientation: "landscape",
        font: "default",
      }),
    });
    const html = await response.text();

    assert.equal(response.status, 403);
    assert.match(html, /Settings requests must come from this preview server/);
    assert.doesNotMatch(html, /cross-site-secret-token/);
    assert.doesNotMatch(html, /\/render\//);
  } finally {
    await close(preview);
  }
});

test("settings reject remote targets unless explicitly enabled", async () => {
  const preview = createPreviewServer(baseConfig);
  const previewBase = await listen(preview);

  try {
    const initial = await getSession(previewBase);
    const response = await fetch(`${previewBase}/settings`, {
      method: "POST",
      redirect: "manual",
      headers: { cookie: initial.cookie },
      body: new URLSearchParams({
        sid: initial.sid,
        csrf: initial.csrf,
        target: "https://example.com/trmnl/markup",
        token: "remote-secret-token",
        user_uuid: "remote-user",
        model: "og_png",
        orientation: "landscape",
        font: "default",
      }),
    });
    const html = await response.text();

    assert.equal(response.status, 400);
    assert.match(html, /Remote markup URLs are disabled by default/);
    assert.doesNotMatch(html, /remote-secret-token/);
    assert.doesNotMatch(html, /\/render\//);
  } finally {
    await close(preview);
  }
});

test("render requests use the session bearer token without putting it in render URLs", async () => {
  const seen = [];
  const target = createServer(async (request, response) => {
    const body = await readBody(request);
    seen.push({
      authorization: request.headers.authorization,
      body: new URLSearchParams(body),
    });
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({
      markup: "<div class=\"view view--full\">Full</div>",
      markup_half_horizontal: "<div>Half horizontal</div>",
      markup_half_vertical: "<div>Half vertical</div>",
      markup_quadrant: "<div>Quadrant</div>",
    }));
  });
  const targetBase = await listen(target);
  const preview = createPreviewServer({
    ...baseConfig,
    targetUrl: `${targetBase}/trmnl/markup`,
    connectionSource: "default",
  });
  const previewBase = await listen(preview);

  try {
    const initial = await getSession(previewBase);
    const settings = await fetch(`${previewBase}/settings`, {
      method: "POST",
      redirect: "manual",
      headers: { cookie: initial.cookie },
      body: new URLSearchParams({
        sid: initial.sid,
        csrf: initial.csrf,
        target: `${targetBase}/trmnl/markup`,
        token: "session-secret-token",
        user_uuid: "session-user",
        model: "og_png",
        orientation: "landscape",
        font: "trmnl",
      }),
    });
    assert.equal(settings.status, 303);
    const cookie = settings.headers.get("set-cookie")?.split(";")[0];
    const sid = new URL(settings.headers.get("location"), previewBase).searchParams.get("sid");
    assert.ok(cookie);
    assert.ok(sid);

    const renderUrl = `${previewBase}/render/full.html?sid=${encodeURIComponent(sid)}&model=og_png&orientation=landscape&font=trmnl`;
    assert.doesNotMatch(renderUrl, /session-secret-token/);
    const render = await fetch(renderUrl, { headers: { cookie } });
    const html = await render.text();

    assert.equal(render.status, 200);
    assert.match(render.headers.get("content-security-policy") ?? "", /default-src 'none'/);
    assert.match(render.headers.get("content-security-policy") ?? "", /connect-src 'none'/);
    assert.match(html, /Full/);
    assert.equal(seen.length, 2);
    assert.equal(seen[0].authorization, "Bearer session-secret-token");
    assert.equal(seen[0].body.get("user_uuid"), "session-user");
    assert.equal(seen[1].authorization, "Bearer session-secret-token");
    assert.equal(seen[1].body.get("user_uuid"), "session-user");
  } finally {
    await close(preview);
    await close(target);
  }
});

test("diagnostics report response shape problems while redacting bearer tokens", async () => {
  const target = createServer((_request, response) => {
    response.writeHead(401, { "content-type": "application/json" });
    response.end(JSON.stringify({
      error: "unauthorized",
      token: "diagnostic-secret-token",
      user: "diagnostic-user",
    }));
  });
  const targetBase = await listen(target);
  const preview = createPreviewServer({
    ...baseConfig,
    targetUrl: `${targetBase}/trmnl/markup`,
    token: "diagnostic-secret-token",
    userUuid: "diagnostic-user",
  });
  const previewBase = await listen(preview);

  try {
    const response = await fetch(`${previewBase}/api/diagnostics?model=og_png&orientation=landscape&font=default`);
    const diagnostics = await response.json();

    const serialized = JSON.stringify(diagnostics);

    assert.equal(response.status, 200);
    assert.equal(diagnostics.ok, false);
    assert.equal(diagnostics.httpStatus, 401);
    assert.match(diagnostics.curl, /Authorization: Bearer <token>/);
    assert.doesNotMatch(diagnostics.curl, /diagnostic-secret-token/);
    assert.doesNotMatch(serialized, /diagnostic-secret-token/);
    assert.doesNotMatch(serialized, /diagnostic-user/);
  } finally {
    await close(preview);
    await close(target);
  }
});

function listen(server) {
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      assert.ok(address && typeof address === "object");
      resolve(`http://127.0.0.1:${address.port}`);
    });
  });
}

function close(server) {
  return new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

async function readBody(request) {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
}

async function getSession(previewBase) {
  const response = await fetch(`${previewBase}/`);
  const html = await response.text();
  const cookie = response.headers.get("set-cookie")?.split(";")[0];
  const csrf = matchValue(html, "csrf");
  const sid = matchValue(html, "sid");
  assert.ok(cookie);
  assert.ok(csrf);
  assert.ok(sid);
  return { cookie, csrf, sid };
}

function matchValue(html, name) {
  const match = html.match(new RegExp(`name="${name}" value="([^"]+)"`));
  return match?.[1];
}
