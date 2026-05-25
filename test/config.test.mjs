import assert from "node:assert/strict";
import test from "node:test";
import { loadConfig } from "../dist/src/config.js";

test("browser auto-open is enabled by default", () => {
  const config = loadConfig([], {});
  assert.equal(config.openBrowser, true);
});

test("browser auto-open can be disabled with --no-open", () => {
  const config = loadConfig(["--no-open"], {});
  assert.equal(config.openBrowser, false);
});

test("no-open flag overrides explicit open configuration", () => {
  const config = loadConfig(["--open", "true", "--no-open"], { TRMNL_PREVIEW_OPEN_BROWSER: "true" });
  assert.equal(config.openBrowser, false);
});

test("TRMNL_PREVIEW_NO_OPEN_BROWSER disables auto-open", () => {
  const config = loadConfig([], { TRMNL_PREVIEW_NO_OPEN_BROWSER: "true" });
  assert.equal(config.openBrowser, false);
});
