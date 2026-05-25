#!/usr/bin/env node
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { loadConfig, printHelp } from "./config.js";
import { createPreviewServer } from "./server.js";

const require = createRequire(import.meta.url);
const packageJson = loadPackageJson();
const version = typeof packageJson.version === "string" ? packageJson.version : "0.0.0-development";
const args = process.argv.slice(2);

if (args.includes("--help") || args.includes("-h")) {
  printHelp();
  process.exit(0);
}

if (args.includes("--version") || args.includes("-v")) {
  console.log(version);
  process.exit(0);
}

const config = loadConfig();
const server = createPreviewServer(config);

server.listen(config.port, config.host, () => {
  const listenUrl = buildHttpUrl(config.host, config.port);
  console.log(`TRMNL preview server listening at ${listenUrl}`);
  console.log(`Markup target: ${config.targetUrl}`);

  if (config.openBrowser) {
    const browserUrl = buildHttpUrl(resolveBrowserHost(config.host), config.port);
    openInDefaultBrowser(browserUrl);
  }
});

function loadPackageJson(): { version?: unknown } {
  for (const path of ["../package.json", "../../package.json"]) {
    try {
      return require(path) as { version?: unknown };
    } catch {
      // Source execution resolves ../package.json; packed dist resolves ../../package.json.
    }
  }
  return {};
}

function resolveBrowserHost(host: string): string {
  if (host === "0.0.0.0" || host === "::" || host === "[::]") {
    return "127.0.0.1";
  }
  return host;
}

function buildHttpUrl(host: string, port: number): string {
  const normalizedHost = host.includes(":") && !host.startsWith("[") ? `[${host}]` : host;
  return `http://${normalizedHost}:${port}`;
}

function openInDefaultBrowser(url: string): void {
  const command = process.platform === "darwin" ? "open" : process.platform === "win32" ? "cmd" : "xdg-open";
  const args = process.platform === "win32" ? ["/c", "start", "", url] : [url];

  try {
    const child = spawn(command, args, { detached: true, stdio: "ignore" });
    child.on("error", (error) => {
      console.warn(`Unable to open browser automatically: ${error.message}`);
    });
    child.unref();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`Unable to open browser automatically: ${message}`);
  }
}
