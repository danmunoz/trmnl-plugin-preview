# Contributing

## Development Setup

1. Install Node `>=24 <26`.
2. Install dependencies with `pnpm install`.
3. Run the verification suite:

```bash
pnpm typecheck
pnpm test
pnpm test:pack
```

## Change Expectations

- Keep the preview server generic for third-party TRMNL plugin markup endpoints.
- Do not add plugin-specific assumptions or references to a particular plugin.
- Keep bearer tokens and user UUIDs out of URLs, logs, diagnostics, and docs.
- Add regression tests for bug fixes when the failure mode is testable.

## Pull Requests

Please include:

- What changed
- Why it changed
- How it was verified
- Any security or compatibility impact
