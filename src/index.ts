#!/usr/bin/env node
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
  const url = `http://${config.host}:${config.port}`;
  console.log(`TRMNL preview server listening at ${url}`);
  console.log(`Markup target: ${config.targetUrl}`);
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
