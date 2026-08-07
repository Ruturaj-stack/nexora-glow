/**
 * Single source of truth for release metadata.
 * `BUILD_NUMBER`/`COMMIT` are injected at build time when available and fall
 * back to a local development marker.
 */

export const APP_NAME = "Nexora";
export const APP_VERSION = "1.0.0";

export const BUILD_NUMBER =
  (typeof import.meta !== "undefined" && import.meta.env?.["VITE_BUILD_NUMBER"]) || "local";

export const BUILD_COMMIT =
  (typeof import.meta !== "undefined" && import.meta.env?.["VITE_BUILD_COMMIT"]) || "dev";

export const BUILD_CHANNEL: "development" | "testing" | "production" =
  typeof import.meta !== "undefined" && import.meta.env?.PROD ? "production" : "development";

export interface ReleaseInfo {
  name: string;
  version: string;
  build: string;
  commit: string;
  channel: string;
}

export function releaseInfo(): ReleaseInfo {
  return {
    name: APP_NAME,
    version: APP_VERSION,
    build: String(BUILD_NUMBER),
    commit: String(BUILD_COMMIT),
    channel: BUILD_CHANNEL,
  };
}

export function releaseLabel(): string {
  return `${APP_NAME} v${APP_VERSION} (${BUILD_NUMBER})`;
}
