export type ViewName = "full" | "half_horizontal" | "half_vertical" | "quadrant";

export type Orientation = "landscape" | "portrait";

export type FrameworkFontFamily = "default" | "classic" | "trmnl";

export type PreviewConnectionSource = "default" | "configured" | "saved";

export type TrmnlMarkupResponse = {
  markup?: string;
  markup_half_horizontal?: string;
  markup_half_vertical?: string;
  markup_quadrant?: string;
  shared?: string;
};

export type MarkupDiagnostics = {
  ok: boolean;
  method: "POST";
  targetHost: string;
  modelName: string;
  orientation: Orientation;
  physicalWidth: number;
  physicalHeight: number;
  httpStatus?: number;
  responseKeys: string[];
  missingKeys: string[];
  error?: string;
  curl: string;
};

export type CssMetadata = {
  classes: {
    device: string;
    size: string;
    density?: string;
  };
  variables: Array<[string, string]>;
};

export type DeviceModel = {
  name: string;
  label: string;
  description: string;
  width: number;
  height: number;
  colors: number;
  bit_depth: number;
  scale_factor: number;
  rotation: number;
  mime_type: string;
  offset_x: number;
  offset_y: number;
  kind: string;
  palette_ids: string[];
  preview_white_point: string;
  image_size_limit: number;
  image_upload_supported: boolean;
  css: CssMetadata;
};

export type Palette = {
  id: string;
  name: string;
  grays: number;
  framework_class: string;
  colors?: string[];
  grayscale_bit_depth?: number;
};

export type PreviewConfig = {
  host: string;
  port: number;
  openBrowser: boolean;
  targetUrl: string;
  token: string;
  userUuid: string;
  connectionSource: PreviewConnectionSource;
  allowRemoteTargets: boolean;
  frameworkVersion: string;
  frameworkAssetHost: string;
  requestTimeoutMs: number;
  cacheTtlMs: number;
};

export type RenderRequest = {
  view: ViewName;
  modelName: string;
  orientation: Orientation;
  fontFamily?: FrameworkFontFamily;
  paletteId?: string;
  targetUrl?: string;
  token?: string;
  userUuid?: string;
};

export type RenderContext = {
  view: ViewName;
  sessionId: string;
  model: DeviceModel;
  palette: Palette;
  orientation: Orientation;
  fontFamily: FrameworkFontFamily;
  targetUrl: string;
  token: string;
  userUuid: string;
};
