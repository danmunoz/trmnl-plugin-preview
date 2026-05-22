import type { PreviewConfig } from "./types.js";

const DEFAULT_TARGET = "http://localhost:8787/trmnl/markup";

export function printHelp(): void {
  process.stdout.write(`TRMNL Plugin Preview

Usage:
  trmnl-plugin-preview [options]

Options:
  --host <host>                    Host to bind (default: 127.0.0.1)
  --port <port>                    Port to bind (default: 4568)
  --target <url>                   Plugin markup URL
  --token <token>                  Bearer token for the markup URL
  --user-uuid <uuid>               User UUID sent to the markup URL
  --allow-remote-targets           Allow non-loopback target URLs
  --framework-version <version>    TRMNL framework version (default: 3.1.1)
  --framework-asset-host <url>     TRMNL framework asset host
  --request-timeout-ms <ms>        Markup request timeout
  --cache-ttl-ms <ms>              Markup cache TTL
  --help, -h                       Show this help
  --version, -v                    Show package version
`);
}

export function loadConfig(argv = process.argv.slice(2), env = process.env): PreviewConfig {
  const args = parseArgs(argv);
  const portValue = args.port ?? env.PORT ?? "4568";
  const requestTimeoutValue = args["request-timeout-ms"] ?? env.REQUEST_TIMEOUT_MS ?? "5000";
  const cacheTtlValue = args["cache-ttl-ms"] ?? env.CACHE_TTL_MS ?? "2000";
  const hasExplicitConnection = Boolean(
    args.target
      || env.TRMNL_PREVIEW_TARGET_URL
      || args.token
      || env.TRMNL_PREVIEW_TOKEN
      || args["user-uuid"]
      || env.TRMNL_PREVIEW_USER_UUID,
  );

  return {
    host: args.host ?? env.HOST ?? "127.0.0.1",
    port: parsePositiveInt(portValue, "port"),
    targetUrl: args.target ?? env.TRMNL_PREVIEW_TARGET_URL ?? DEFAULT_TARGET,
    token: args.token ?? env.TRMNL_PREVIEW_TOKEN ?? "local-preview-token",
    userUuid: args["user-uuid"] ?? env.TRMNL_PREVIEW_USER_UUID ?? "local-preview-user",
    connectionSource: hasExplicitConnection ? "configured" : "default",
    allowRemoteTargets: parseBoolean(args["allow-remote-targets"] ?? env.TRMNL_PREVIEW_ALLOW_REMOTE_TARGETS),
    frameworkVersion: args["framework-version"] ?? env.TRMNL_FRAMEWORK_VERSION ?? "3.1.1",
    frameworkAssetHost: args["framework-asset-host"] ?? env.TRMNL_FRAMEWORK_ASSET_HOST ?? "https://trmnl.com",
    requestTimeoutMs: parsePositiveInt(requestTimeoutValue, "request timeout"),
    cacheTtlMs: parsePositiveInt(cacheTtlValue, "cache ttl"),
  };
}

function parseArgs(argv: string[]): Record<string, string> {
  const parsed: Record<string, string> = {};

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];
    if (!current?.startsWith("--")) {
      continue;
    }

    const withoutPrefix = current.slice(2);
    const inlineSeparator = withoutPrefix.indexOf("=");
    if (inlineSeparator >= 0) {
      parsed[withoutPrefix.slice(0, inlineSeparator)] = withoutPrefix.slice(inlineSeparator + 1);
      continue;
    }

    const next = argv[index + 1];
    if (next && !next.startsWith("--")) {
      parsed[withoutPrefix] = next;
      index += 1;
    } else {
      parsed[withoutPrefix] = "true";
    }
  }

  return parsed;
}

function parsePositiveInt(value: string, label: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Invalid ${label}: ${value}`);
  }
  return parsed;
}

function parseBoolean(value: string | undefined): boolean {
  return value === "1" || value === "true" || value === "yes";
}
