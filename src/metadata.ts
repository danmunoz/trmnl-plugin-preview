import { DEFAULT_MODELS, DEFAULT_PALETTES } from "./defaults.js";
import type { DeviceModel, Palette } from "./types.js";

type ApiResponse<T> = {
  data?: T[];
};

let modelCache: DeviceModel[] | undefined;
let paletteCache: Palette[] | undefined;

export async function getModels(): Promise<DeviceModel[]> {
  if (modelCache) {
    return modelCache;
  }

  modelCache = await fetchMetadata<DeviceModel>("https://trmnl.com/api/models", DEFAULT_MODELS);
  return modelCache;
}

export async function getPalettes(): Promise<Palette[]> {
  if (paletteCache) {
    return paletteCache;
  }

  paletteCache = await fetchMetadata<Palette>("https://trmnl.com/api/palettes", DEFAULT_PALETTES);
  return paletteCache;
}

export async function findModel(name: string): Promise<DeviceModel> {
  const models = await getModels();
  const model = models.find((candidate) => candidate.name === name);
  if (!model) {
    throw new Error(`Unknown model: ${name}`);
  }
  return model;
}

export async function findPalette(id: string | undefined, model: DeviceModel): Promise<Palette> {
  const palettes = await getPalettes();
  const fallbackId = model.palette_ids[0] ?? "bw";
  const requested = id ?? fallbackId;
  const palette = palettes.find((candidate) => candidate.id === requested);
  if (!palette) {
    throw new Error(`Unknown palette: ${requested}`);
  }
  return palette;
}

async function fetchMetadata<T>(url: string, fallback: T[]): Promise<T[]> {
  try {
    const response = await fetch(url, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(2_000),
    });
    if (!response.ok) {
      return fallback;
    }
    const payload = (await response.json()) as ApiResponse<T>;
    return Array.isArray(payload.data) && payload.data.length > 0 ? payload.data : fallback;
  } catch {
    return fallback;
  }
}
