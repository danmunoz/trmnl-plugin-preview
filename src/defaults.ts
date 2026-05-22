import type { DeviceModel, Palette, ViewName } from "./types.js";

export const VIEWS: ViewName[] = [
  "full",
  "half_horizontal",
  "half_vertical",
  "quadrant",
];

export const VIEW_LABELS: Record<ViewName, string> = {
  full: "Full",
  half_horizontal: "Half Horizontal",
  half_vertical: "Half Vertical",
  quadrant: "Quadrant",
};

export const MARKUP_KEYS: Record<ViewName, keyof import("./types.js").TrmnlMarkupResponse> = {
  full: "markup",
  half_horizontal: "markup_half_horizontal",
  half_vertical: "markup_half_vertical",
  quadrant: "markup_quadrant",
};

export const MASHUP_CLASSES: Partial<Record<ViewName, string>> = {
  half_horizontal: "mashup mashup--1Tx1B",
  half_vertical: "mashup mashup--1Lx1R",
  quadrant: "mashup mashup--2x2",
};

export const DEFAULT_PALETTES: Palette[] = [
  {
    id: "bw",
    name: "Black & White (1-bit)",
    grays: 2,
    framework_class: "screen--1bit",
  },
  {
    id: "gray-4",
    name: "4 Grays (2-bit)",
    grays: 4,
    framework_class: "screen--2bit",
  },
  {
    id: "gray-16",
    name: "16 Grays (4-bit)",
    grays: 16,
    framework_class: "screen--4bit",
  },
];

export const DEFAULT_MODELS: DeviceModel[] = [
  {
    name: "v2",
    label: "TRMNL X",
    description: "TRMNL X",
    width: 1872,
    height: 1404,
    colors: 16,
    bit_depth: 4,
    scale_factor: 1.8,
    rotation: 0,
    mime_type: "image/png",
    offset_x: 0,
    offset_y: 0,
    kind: "trmnl",
    palette_ids: ["gray-16", "gray-4", "bw"],
    preview_white_point: "true_white",
    image_size_limit: 92160,
    image_upload_supported: true,
    css: {
      classes: {
        device: "screen--v2",
        size: "screen--lg",
        density: "screen--density-2x",
      },
      variables: [
        ["--screen-w", "1040px"],
        ["--screen-h", "780px"],
        ["--pixel-ratio", "1.8"],
        ["--dither-pixel-ratio", "2.0"],
        ["--ui-scale", "1.0"],
        ["--gap-scale", "1.0"],
      ],
    },
  },
  {
    name: "og_png",
    label: "TRMNL OG (1-bit)",
    description: "TRMNL OG (1-bit)",
    width: 800,
    height: 480,
    colors: 2,
    bit_depth: 1,
    scale_factor: 1,
    rotation: 0,
    mime_type: "image/png",
    offset_x: 0,
    offset_y: 0,
    kind: "trmnl",
    palette_ids: ["bw"],
    preview_white_point: "true_white",
    image_size_limit: 92160,
    image_upload_supported: true,
    css: {
      classes: {
        device: "screen--og_png",
        size: "screen--md",
        density: "screen--density-1x",
      },
      variables: [
        ["--screen-w", "800px"],
        ["--screen-h", "480px"],
        ["--pixel-ratio", "1.0"],
        ["--dither-pixel-ratio", "1.0"],
        ["--ui-scale", "1.0"],
        ["--gap-scale", "1.0"],
      ],
    },
  },
];
