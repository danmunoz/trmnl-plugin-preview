# HTTP Routes

These routes are primarily useful when debugging or integrating the preview
server with local tooling.

## Dashboard

- `GET /`

Displays the connection screen or preview workspace.

## Settings

- `POST /settings`

Saves local connection settings and simulator controls in the current preview
session. The request requires the session CSRF token rendered into the dashboard
form.

## Rendered Previews

- `GET /render/:view.html`
- `GET /render/:view.png`

Supported `:view` values:

- `full`
- `half_horizontal`
- `half_vertical`
- `quadrant`

HTML routes render the selected markup variant in a TRMNL framework screen
shell. PNG routes open the HTML route with Playwright, capture the viewport, and
quantize the image to the selected device palette.

## Diagnostics

- `GET /api/diagnostics`

Performs the same markup request used by the render pipeline and returns a
redacted JSON diagnostic payload.

## Metadata

- `GET /api/models`
- `GET /api/palettes`

Returns TRMNL model and palette metadata. The server fetches live metadata when
available and falls back to built-in defaults when offline.

## Health

- `GET /healthz`

Returns a small health-check response.
