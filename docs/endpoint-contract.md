# Endpoint Contract

The preview server calls a TRMNL third-party plugin markup endpoint the same way
TRMNL does.

## Request

- Method: `POST`
- Header: `Content-Type: application/x-www-form-urlencoded`
- Header: `Authorization: Bearer <token>`
- Body field: `user_uuid`
- Body field: `trmnl`

The `trmnl` field contains JSON metadata describing the selected user, device,
system time, and plugin settings.

Example request body shape:

```text
user_uuid=<user-uuid>
trmnl={"user":{...},"device":{...},"system":{...},"plugin_settings":{...}}
```

## Response

Return JSON with every layout variant:

```json
{
  "markup": "<div class=\"view view--full\">...</div>",
  "markup_half_horizontal": "<div class=\"view view--half_horizontal\">...</div>",
  "markup_half_vertical": "<div class=\"view view--half_vertical\">...</div>",
  "markup_quadrant": "<div class=\"view view--quadrant\">...</div>",
  "shared": "<style>...</style>"
}
```

`shared` is optional. The four `markup*` fields are required for the preview
workspace because it renders every variant at once.

## Rendering Notes

The preview server:

- prepends `shared` to each variant when present
- adds a missing `view view--...` wrapper when needed
- wraps mashup layouts in the matching TRMNL framework mashup container
- loads TRMNL framework CSS and JavaScript for the selected framework version
- uses live TRMNL model and palette metadata with local fallbacks

Do not rely on browser viewport size to determine layout dimensions. Use TRMNL
framework classes, variables, and layout components so markup can render
correctly on both TRMNL OG and TRMNL X.
