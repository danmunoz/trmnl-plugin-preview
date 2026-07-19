# Configuration

You can configure the preview server with CLI flags or environment variables.
CLI flags take precedence over environment variables.

| CLI flag | Environment variable | Default |
| --- | --- | --- |
| `--host` | `HOST` | `127.0.0.1` |
| `--port` | `PORT` | `4568` |
| `--no-open` | `TRMNL_PREVIEW_NO_OPEN_BROWSER` | `false` |
| `--open` | `TRMNL_PREVIEW_OPEN_BROWSER` | `true` |
| `--target` | `TRMNL_PREVIEW_TARGET_URL` | `http://localhost:8787/trmnl/markup` |
| `--token` | `TRMNL_PREVIEW_TOKEN` | `local-preview-token` |
| `--user-uuid` | `TRMNL_PREVIEW_USER_UUID` | `local-preview-user` |
| `--allow-remote-targets` | `TRMNL_PREVIEW_ALLOW_REMOTE_TARGETS` | `false` |
| `--framework-version` | `TRMNL_FRAMEWORK_VERSION` | `3.1.1` |
| `--framework-asset-host` | `TRMNL_FRAMEWORK_ASSET_HOST` | `https://trmnl.com` |
| `--request-timeout-ms` | `REQUEST_TIMEOUT_MS` | `5000` |
| `--cache-ttl-ms` | `CACHE_TTL_MS` | `2000` |

## Remote Targets

Remote targets are disabled by default. Without `--allow-remote-targets`, the
target URL must use one of these hosts:

- `localhost`
- `127.x.x.x`
- `[::1]`

Enable remote targets only when the endpoint is controlled by you:

```bash
trmnl-plugin-preview \
  --allow-remote-targets \
  --target https://example.com/trmnl/markup
```

With the default local target policy, all preview traffic stays in your local
development environment. When remote targets are enabled, the preview server
sends the configured bearer token and TRMNL request body to the remote URL.

## Tailscale Access

Set `--host` to the machine's exact Tailscale IPv4 address, such as
`--host 100.x.y.z`. The PNG renderer uses the address that accepted the browser
request when it calls the local HTML render route.

## Framework Assets

By default, the preview server loads TRMNL framework assets from
`https://trmnl.com` with framework version `3.1.1`.

Use these flags when testing another framework version or a local framework
asset mirror:

```bash
trmnl-plugin-preview \
  --framework-version 3.1.1 \
  --framework-asset-host https://trmnl.com
```

## Timeouts And Cache

`--request-timeout-ms` controls how long the preview server waits for the markup
endpoint.

`--cache-ttl-ms` controls the short in-memory cache for markup responses. Keep
this low while actively editing markup.
