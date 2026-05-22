import { createHash } from "node:crypto";
import type { DeviceModel, MarkupDiagnostics, Orientation, TrmnlMarkupResponse } from "./types.js";
import { physicalDimensions } from "./device.js";
import { MARKUP_KEYS } from "./defaults.js";
import { MAX_MARKUP_RESPONSE_BYTES, redactConnectionError, safePublicUrl } from "./security.js";

type CacheEntry = {
  expiresAt: number;
  value: TrmnlMarkupResponse;
};

export class PluginClient {
  private readonly cache = new Map<string, CacheEntry>();
  private readonly maxCacheEntries = 100;

  constructor(private readonly timeoutMs: number, private readonly cacheTtlMs: number) {}

  async fetchMarkup(input: {
    targetUrl: string;
    token: string;
    userUuid: string;
    model: DeviceModel;
    orientation: Orientation;
  }): Promise<TrmnlMarkupResponse> {
    const cacheKey = JSON.stringify({
      targetUrl: input.targetUrl,
      tokenHash: hashSecret(input.token),
      userUuid: input.userUuid,
      modelName: input.model.name,
      orientation: input.orientation,
    });
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value;
    }

    const result = await this.inspectMarkup(input);
    if (!result.payload) {
      throw new Error(result.diagnostics.error ?? "Markup endpoint returned no payload");
    }
    this.cache.set(cacheKey, { expiresAt: Date.now() + this.cacheTtlMs, value: result.payload });
    this.pruneCache();
    return result.payload;
  }

  async inspectMarkup(input: {
    targetUrl: string;
    token: string;
    userUuid: string;
    model: DeviceModel;
    orientation: Orientation;
  }): Promise<{ diagnostics: MarkupDiagnostics; payload?: TrmnlMarkupResponse }> {
    const body = buildRequestBody(input.model, input.orientation, input.userUuid);
    const physical = physicalDimensions(input.model, input.orientation);
    const diagnosticsBase = {
      method: "POST" as const,
      targetHost: safeHost(input.targetUrl),
      modelName: input.model.name,
      orientation: input.orientation,
      physicalWidth: physical.width,
      physicalHeight: physical.height,
      responseKeys: [],
      missingKeys: Object.values(MARKUP_KEYS),
      curl: buildCurl(input.targetUrl, body),
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(input.targetUrl, {
        method: "POST",
        headers: {
          accept: "application/json",
          authorization: `Bearer ${input.token}`,
          "content-type": "application/x-www-form-urlencoded",
        },
        body,
        signal: controller.signal,
      });

      const text = await readLimitedText(response);
      if (!response.ok) {
        return {
          diagnostics: {
            ...diagnosticsBase,
            ok: false,
            httpStatus: response.status,
            error: redactConnectionError(`Markup endpoint returned ${response.status}: ${text.slice(0, 500)}`, input),
          },
        };
      }

      let payload: TrmnlMarkupResponse;
      try {
        payload = JSON.parse(text) as TrmnlMarkupResponse;
      } catch (error) {
        return {
          diagnostics: {
            ...diagnosticsBase,
            ok: false,
            httpStatus: response.status,
            error: redactConnectionError(
              `Markup endpoint returned invalid JSON: ${error instanceof Error ? error.message : String(error)}`,
              input,
            ),
          },
        };
      }

      const responseKeys = Object.keys(payload).sort();
      const missingKeys = Object.values(MARKUP_KEYS).filter((key) => !payload[key]);
      const error = missingKeys.length > 0 ? `Missing required markup keys: ${missingKeys.join(", ")}` : undefined;
      return {
        payload,
        diagnostics: {
          ...diagnosticsBase,
          ok: missingKeys.length === 0,
          httpStatus: response.status,
          responseKeys,
          missingKeys,
          ...(error ? { error } : {}),
        },
      };
    } catch (error) {
      return {
        diagnostics: {
          ...diagnosticsBase,
          ok: false,
          error: redactConnectionError(error instanceof Error ? error.message : String(error), input),
        },
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  private pruneCache(): void {
    const now = Date.now();
    for (const [key, value] of this.cache) {
      if (value.expiresAt <= now) {
        this.cache.delete(key);
      }
    }

    while (this.cache.size > this.maxCacheEntries) {
      const oldest = this.cache.keys().next().value;
      if (!oldest) return;
      this.cache.delete(oldest);
    }
  }
}

function buildRequestBody(model: DeviceModel, orientation: Orientation, userUuid: string): URLSearchParams {
  const body = new URLSearchParams();
  body.set("user_uuid", userUuid);
  body.set("trmnl", JSON.stringify(buildTrmnlMetadata(model, orientation)));
  return body;
}

function buildTrmnlMetadata(model: DeviceModel, orientation: Orientation) {
  const dimensions = physicalDimensions(model, orientation);
  const now = Math.floor(Date.now() / 1000);

  return {
    user: {
      name: "Local Preview",
      first_name: "Local",
      last_name: "Preview",
      locale: "en",
      time_zone: "UTC",
      time_zone_iana: "UTC",
      utc_offset: 0,
    },
    device: {
      friendly_id: "LOCAL",
      percent_charged: 100,
      wifi_strength: 100,
      width: dimensions.width,
      height: dimensions.height,
    },
    system: {
      timestamp_utc: now,
    },
    plugin_settings: {
      instance_name: "Local Preview",
    },
  };
}

function safeHost(rawUrl: string): string {
  try {
    return new URL(safePublicUrl(rawUrl)).host;
  } catch {
    return "<invalid url>";
  }
}

function buildCurl(targetUrl: string, body: URLSearchParams): string {
  const trmnl = body.get("trmnl") ?? "{}";
  return [
    "curl -X POST",
    shellQuote(safePublicUrl(targetUrl)),
    "-H 'Content-Type: application/x-www-form-urlencoded'",
    "-H 'Authorization: Bearer <token>'",
    "--data-urlencode 'user_uuid=<redacted>'",
    `--data-urlencode ${shellQuote(`trmnl=${trmnl}`)}`,
  ].join(" ");
}

function shellQuote(value: string): string {
  return `'${value.replaceAll("'", "'\\''")}'`;
}

function hashSecret(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

async function readLimitedText(response: Response): Promise<string> {
  const text = await response.text();
  if (text.length > MAX_MARKUP_RESPONSE_BYTES) {
    throw new Error(`Markup endpoint response exceeded ${MAX_MARKUP_RESPONSE_BYTES} bytes.`);
  }
  return text;
}
