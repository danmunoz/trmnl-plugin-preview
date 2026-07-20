# Shapes — minimal example TRMNL plugin

A tiny, zero-dependency endpoint for trying out `trmnl-plugin-preview`. It returns
markup for all four TRMNL views, each drawing a few labelled geometric figures —
just enough to see what renders in each slot, with no real data or logic.

## Run it

```bash
# terminal 1 — the example endpoint
node examples/shapes/server.mjs

# terminal 2 — the preview, pointed at it
pnpm dev -- --target http://localhost:8787/trmnl/markup \
  --token local-preview-token --user-uuid local-preview-user
```

Then open <http://127.0.0.1:4568>. Each command is a long-running server, so give
them separate terminals.

Environment overrides: `PORT`, `HOST`, `SHAPES_TOKEN`.

## What it returns

Each view is the third-party wrapper `<div class="view view--{type}">` with one
`.layout` inside (plus a `.title_bar`). TRMNL — and the preview — add the outer
`.screen` / `.mashup` wrappers; the plugin never writes those.

| View              | Shows                          |
| ----------------- | ------------------------------ |
| `full`            | square, circle, triangle, line |
| `half_horizontal` | square, circle, triangle       |
| `half_vertical`   | square, circle                 |
| `quadrant`        | square                         |

Figures are inline SVG using `currentColor`, so they render cleanly at 1-bit and
4-bit alike. `server.mjs` is a single file — edit the `FIGURES` map or `buildView`
calls to change what each slot draws.
