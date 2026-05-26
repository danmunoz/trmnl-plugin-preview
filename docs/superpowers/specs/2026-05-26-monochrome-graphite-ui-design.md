# Monochrome Graphite UI Design

read_when: Updating user-facing dashboard, first-run, or error-page styling.

## Context

The current TRMNL Preview web UI uses a warm beige surface palette, teal accent controls, Avenir/Trebuchet typography, heavy label weights, and pill-shaped action buttons. The requested direction is a minimalist, clean, Apple-like developer tool UI with more neutral system fonts and a better color palette.

The approved visual direction is option B from the visual comparison board: Monochrome Graphite.

## Goals

- Use neutral Apple/system fonts across user-facing web pages.
- Replace the warm beige/teal palette with restrained graphite neutrals.
- Keep the UI simple and utilitarian, with preview frames remaining the strongest visual content.
- Preserve existing page structure, routes, forms, fields, and dashboard behavior.
- Keep semantic status colors for diagnostics and errors.

## Non-Goals

- No redesign of plugin preview frame content.
- No new routes, settings, CLI flags, or persisted preferences.
- No icon library or asset dependency.
- No dark mode in this change.

## Visual System

Use this font stack for user-facing dashboard pages:

```css
-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "Segoe UI", sans-serif
```

Use `ui-monospace, SFMono-Regular, Menlo, monospace` only for code-like output such as dimensions, curl text, and error documents where monospaced text helps scanning.

Palette tokens:

- `--ink`: near-black graphite for primary text.
- `--muted`: medium graphite for secondary text and labels.
- `--paper`: off-white page background.
- `--surface`: white cards, popovers, toolbar controls, and form surfaces.
- `--field`: subtle off-white input background.
- `--line`: soft neutral border.
- `--subtle`: lighter divider and selected-control background.
- `--accent`: graphite primary action background.
- `--accent-dark`: darker graphite hover background.
- `--warning`, `--danger`, `--success`: muted semantic colors used only for state.

The primary action (`Reload previews`, `Connect`) should be graphite, not blue or teal. Settings, diagnostics, and secondary buttons should be white or transparent with neutral borders.

## Components

The implementation should update `dashboardCss()` in `src/html.ts` and avoid changing the server routes or dashboard HTML structure unless a class-level tweak is needed for styling.

Dashboard:

- Keep the sticky top form and current control grouping.
- Lower heavy font weights from `800` to `500-650` where practical.
- Use compact 6-8px border radii rather than large pills for buttons and controls.
- Use softer shadows only on popovers and first-run card surfaces.
- Keep focus outlines visible with a neutral graphite ring.

First-run connection page:

- Use the same typography and graphite palette.
- Keep the centered connection card and existing form fields.
- Make the card feel lighter: white surface, soft border, subtle shadow, neutral labels.

Preview cards:

- Keep 8px card radius and existing responsive measured width behavior.
- Use white card surfaces, very light card headers, and neutral borders.
- Preserve PNG action links and frame viewport sizing behavior.

Diagnostics:

- Keep success, warning, and error color differences because they communicate endpoint state quickly.
- Use semantic colors only on the status dot and status text, with neutral container styling.

Error document:

- Replace beige background with off-white graphite styling.
- Keep the monospaced `pre` block for readability.

## Data Flow And Behavior

No request, session, diagnostics, rendering, or security behavior changes. Existing form posts, CSRF fields, hidden selection inputs, iframe loading, diagnostics fetches, and copy-curl behavior remain unchanged.

## Testing

Run:

1. `pnpm typecheck`
2. `pnpm test`

Adjust `test/html.test.mjs` only if assertions check exact CSS or markup affected by the visual update. No behavior tests should need to change unless styling class names change.

## Acceptance Criteria

- The dashboard and first-run page use the neutral system font stack.
- The `Reload previews` button no longer uses the current Avenir/Trebuchet-like appearance.
- The page no longer reads as beige/teal; it reads as monochrome graphite with restrained semantic status colors.
- Existing HTML routes, form submissions, preview iframe loading, diagnostics, and security redaction behavior continue to pass tests.
- No unrelated README or untracked repo changes are modified.
