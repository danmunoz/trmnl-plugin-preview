import { chromium } from "playwright";
import sharp from "sharp";
import { physicalDimensions } from "./device.js";
import type { DeviceModel, Orientation, Palette } from "./types.js";

export async function renderPng(input: {
  url: string;
  model: DeviceModel;
  orientation: Orientation;
  palette: Palette;
}): Promise<Buffer> {
  const physical = physicalDimensions(input.model, input.orientation);
  const viewport = { width: physical.width, height: physical.height };

  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({
      viewport,
      deviceScaleFactor: 1,
    });
    await page.goto(input.url, { waitUntil: "networkidle", timeout: 10_000 });
    await page.evaluate(() => document.fonts.ready);
    const screenshot = await page.screenshot({
      type: "png",
      clip: { x: 0, y: 0, width: viewport.width, height: viewport.height },
    });
    return await quantizeToPalette(Buffer.from(screenshot), input.palette);
  } finally {
    await browser.close();
  }
}

export async function quantizeToPalette(image: Buffer, palette: Palette): Promise<Buffer> {
  const levels = Math.max(2, Math.min(256, palette.grays));
  const input = await sharp(image)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height, channels } = input.info;
  const pixels = new Float32Array(width * height);

  for (let offset = 0, pixel = 0; offset < input.data.length; offset += channels, pixel += 1) {
    const red = input.data[offset] ?? 255;
    const green = input.data[offset + 1] ?? red;
    const blue = input.data[offset + 2] ?? red;
    pixels[pixel] = 0.299 * red + 0.587 * green + 0.114 * blue;
  }

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x;
      const oldValue = clamp(pixels[index] ?? 255);
      const newValue = nearestLevel(oldValue, levels);
      const error = oldValue - newValue;
      pixels[index] = newValue;
      distribute(pixels, width, height, x + 1, y, error * 7 / 16);
      distribute(pixels, width, height, x - 1, y + 1, error * 3 / 16);
      distribute(pixels, width, height, x, y + 1, error * 5 / 16);
      distribute(pixels, width, height, x + 1, y + 1, error * 1 / 16);
    }
  }

  const output = Buffer.alloc(width * height * 3);
  for (let index = 0; index < pixels.length; index += 1) {
    const value = clamp(pixels[index] ?? 255);
    const offset = index * 3;
    output[offset] = value;
    output[offset + 1] = value;
    output[offset + 2] = value;
  }

  return await sharp(output, {
    raw: {
      width,
      height,
      channels: 3,
    },
  }).png().toBuffer();
}

function nearestLevel(value: number, levels: number): number {
  return Math.round((clamp(value) / 255) * (levels - 1)) * (255 / (levels - 1));
}

function distribute(
  pixels: Float32Array,
  width: number,
  height: number,
  x: number,
  y: number,
  value: number,
): void {
  if (x < 0 || y < 0 || x >= width || y >= height) {
    return;
  }
  const index = y * width + x;
  pixels[index] = (pixels[index] ?? 255) + value;
}

function clamp(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}
