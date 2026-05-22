# Security Policy

TRMNL Plugin Preview is a local development tool that sends bearer-token
authenticated requests to plugin markup endpoints. Please report security issues
privately.

By default, target URLs are restricted to loopback hosts so preview traffic stays
inside the local development environment. If `--allow-remote-targets` is enabled,
the configured bearer token and preview request body are sent to the remote URL
provided by the user.

## Supported Versions

Security fixes are applied to the current `main` branch and the latest published
npm release.

## Reporting

Email: `me@danmunoz.com`

Please include:

- A clear description of the issue
- Reproduction steps or a proof of concept
- Expected impact
- Any suggested mitigation

Do not open public GitHub issues for token leakage, credential relay, SSRF,
cross-origin rendering, or package integrity issues.

## Response Expectations

- Initial acknowledgement target: within 5 business days
- Triage outcome target: within 10 business days
- Fix timing depends on severity and blast radius
