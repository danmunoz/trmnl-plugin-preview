import type { DeviceModel, FrameworkFontFamily, Orientation, Palette } from "./types.js";

export function cssDimensions(model: DeviceModel, orientation: Orientation): { width: number; height: number } {
  const width = cssVariablePx(model, "--screen-w", Math.round(model.width / model.scale_factor));
  const height = cssVariablePx(model, "--screen-h", Math.round(model.height / model.scale_factor));
  return orientation === "portrait" ? { width: height, height: width } : { width, height };
}

export function physicalDimensions(model: DeviceModel, orientation: Orientation): { width: number; height: number } {
  return orientation === "portrait"
    ? { width: model.height, height: model.width }
    : { width: model.width, height: model.height };
}

export function screenClasses(
  model: DeviceModel,
  palette: Palette,
  orientation: Orientation,
  fontFamily: FrameworkFontFamily,
): string {
  const classes = [
    "screen",
    model.css.classes.device,
    model.css.classes.size,
    model.css.classes.density,
    palette.framework_class,
    "screen--1x",
  ];

  if (fontFamily !== "default") {
    classes.push(`screen--fonts-${fontFamily}`);
  }

  if (orientation === "portrait") {
    classes.push("screen--portrait");
  }

  return classes.filter(Boolean).join(" ");
}

export function screenStyle(model: DeviceModel, orientation: Orientation): string {
  const dimensions = cssDimensions(model, orientation);
  const variables = new Map(model.css.variables);
  variables.set("--screen-w", `${dimensions.width}px`);
  variables.set("--screen-h", `${dimensions.height}px`);

  return Array.from(variables.entries())
    .map(([name, value]) => `${name}: ${value}`)
    .join("; ");
}

function cssVariablePx(model: DeviceModel, name: string, fallback: number): number {
  const variable = model.css.variables.find(([key]) => key === name)?.[1];
  if (!variable) {
    return fallback;
  }

  const parsed = Number.parseFloat(variable.replace("px", ""));
  return Number.isFinite(parsed) ? parsed : fallback;
}
