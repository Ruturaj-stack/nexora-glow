import { ToolError } from "./types";

/** Browser-native capabilities the tool registry builds upon. */

export async function writeClipboardText(text: string) {
  if (typeof navigator === "undefined" || !navigator.clipboard) {
    throw new ToolError("NOT_SUPPORTED", "Clipboard access is unavailable in this browser.");
  }
  await navigator.clipboard.writeText(text);
  return { written: text.length };
}

export async function readClipboardText() {
  if (typeof navigator === "undefined" || !navigator.clipboard?.readText) {
    throw new ToolError("NOT_SUPPORTED", "Clipboard reads are unavailable in this browser.");
  }
  try {
    return { text: await navigator.clipboard.readText() };
  } catch {
    throw new ToolError("PERMISSION_DENIED", "The browser blocked reading the clipboard.");
  }
}

export async function showNotification(title: string, body: string) {
  if (typeof window === "undefined" || !("Notification" in window)) {
    throw new ToolError("NOT_SUPPORTED", "Notifications are unavailable in this browser.");
  }
  let permission = Notification.permission;
  if (permission === "default") permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new ToolError("PERMISSION_DENIED", "Notification permission was refused.");
  }
  new Notification(title, { body });
  return { delivered: true };
}

export function openUrl(url: string, newTab = true) {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new ToolError("INVALID_INPUT", "That is not a valid URL.");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new ToolError("INVALID_INPUT", "Only http and https URLs can be opened.");
  }
  const win = window.open(parsed.toString(), newTab ? "_blank" : "_self", "noopener,noreferrer");
  if (!win && newTab) {
    throw new ToolError("PERMISSION_DENIED", "The browser blocked the pop-up.");
  }
  return { url: parsed.toString() };
}

export interface SystemSnapshot {
  platform: string;
  browser: string;
  language: string;
  cores: number | null;
  memoryGb: number | null;
  storageUsedGb: number | null;
  storageQuotaGb: number | null;
  battery: { level: number; charging: boolean } | null;
  network: { online: boolean; effectiveType: string | null; downlinkMbps: number | null };
  screen: { width: number; height: number; pixelRatio: number };
  /** Rough main-thread responsiveness sample, 0–100 (higher = busier). */
  mainThreadLoad: number;
  heapUsedMb: number | null;
  heapLimitMb: number | null;
  uptimeSeconds: number;
  capturedAt: string;
}

/** Samples main-thread congestion by measuring timer drift over ~240ms. */
async function sampleMainThreadLoad(): Promise<number> {
  const samples: number[] = [];
  for (let i = 0; i < 8; i++) {
    const start = performance.now();
    await new Promise((resolve) => setTimeout(resolve, 30));
    samples.push(Math.max(0, performance.now() - start - 30));
  }
  const avgDrift = samples.reduce((a, b) => a + b, 0) / samples.length;
  return Math.min(100, Math.round((avgDrift / 24) * 100));
}

export async function collectSystemSnapshot(): Promise<SystemSnapshot> {
  if (typeof window === "undefined") {
    throw new ToolError("NOT_SUPPORTED", "System telemetry requires a browser context.");
  }
  const nav = navigator as Navigator & {
    deviceMemory?: number;
    connection?: { effectiveType?: string; downlink?: number };
    getBattery?: () => Promise<{ level: number; charging: boolean }>;
    userAgentData?: { platform?: string; brands?: { brand: string; version: string }[] };
  };

  const [storage, battery, load] = await Promise.all([
    nav.storage?.estimate ? nav.storage.estimate().catch(() => null) : Promise.resolve(null),
    nav.getBattery ? nav.getBattery().catch(() => null) : Promise.resolve(null),
    sampleMainThreadLoad(),
  ]);

  const memory = (performance as Performance & {
    memory?: { usedJSHeapSize: number; jsHeapSizeLimit: number };
  }).memory;

  const brand = nav.userAgentData?.brands?.filter((b) => !/Not.?A.?Brand/i.test(b.brand)).at(-1);

  const toGb = (bytes?: number | null) =>
    typeof bytes === "number" ? Math.round((bytes / 1024 ** 3) * 100) / 100 : null;

  return {
    platform: nav.userAgentData?.platform || nav.platform || "Unknown",
    browser: brand ? `${brand.brand} ${brand.version}` : "Browser",
    language: nav.language,
    cores: nav.hardwareConcurrency ?? null,
    memoryGb: nav.deviceMemory ?? null,
    storageUsedGb: toGb(storage?.usage),
    storageQuotaGb: toGb(storage?.quota),
    battery: battery ? { level: Math.round(battery.level * 100), charging: battery.charging } : null,
    network: {
      online: nav.onLine,
      effectiveType: nav.connection?.effectiveType ?? null,
      downlinkMbps: nav.connection?.downlink ?? null,
    },
    screen: {
      width: window.screen.width,
      height: window.screen.height,
      pixelRatio: window.devicePixelRatio,
    },
    mainThreadLoad: load,
    heapUsedMb: memory ? Math.round(memory.usedJSHeapSize / 1024 ** 2) : null,
    heapLimitMb: memory ? Math.round(memory.jsHeapSizeLimit / 1024 ** 2) : null,
    uptimeSeconds: Math.round(performance.now() / 1000),
    capturedAt: new Date().toISOString(),
  };
}

export interface CaptureResult {
  dataUrl: string;
  width: number;
  height: number;
  capturedAt: string;
}

/** Captures a screen/window/tab the user explicitly picks in the browser dialog. */
export async function captureScreen(): Promise<CaptureResult> {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getDisplayMedia) {
    throw new ToolError("NOT_SUPPORTED", "Screen capture is unavailable in this browser.");
  }
  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
  } catch {
    throw new ToolError("PERMISSION_DENIED", "Screen capture was cancelled.");
  }

  try {
    const track = stream.getVideoTracks()[0];
    const video = document.createElement("video");
    video.srcObject = stream;
    video.muted = true;
    await video.play();
    await new Promise((resolve) => setTimeout(resolve, 220));

    const settings = track.getSettings();
    const width = settings.width ?? video.videoWidth;
    const height = settings.height ?? video.videoHeight;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new ToolError("EXECUTION_FAILED", "Could not create a drawing surface.");
    ctx.drawImage(video, 0, 0, width, height);
    video.pause();
    return {
      dataUrl: canvas.toDataURL("image/png"),
      width,
      height,
      capturedAt: new Date().toISOString(),
    };
  } finally {
    stream.getTracks().forEach((t) => t.stop());
  }
}

export async function copyImageToClipboard(dataUrl: string) {
  if (typeof window === "undefined" || !("ClipboardItem" in window)) {
    throw new ToolError("NOT_SUPPORTED", "Image clipboard writes are unavailable here.");
  }
  const blob = await (await fetch(dataUrl)).blob();
  await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
  return { copied: true };
}

export function downloadDataUrl(dataUrl: string, filename: string) {
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = filename;
  link.click();
  return { filename };
}
