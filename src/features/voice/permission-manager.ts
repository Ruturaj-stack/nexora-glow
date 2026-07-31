import { VoiceError, type MicPermission } from "./types";

export interface MicDevice {
  deviceId: string;
  label: string;
}

/**
 * VoicePermissionManager — owns microphone access and the live input stream.
 * Access is requested lazily, only when the user actually starts a session.
 */
export class VoicePermissionManager {
  private stream: MediaStream | null = null;

  isSupported(): boolean {
    return (
      typeof navigator !== "undefined" &&
      typeof navigator.mediaDevices?.getUserMedia === "function"
    );
  }

  async query(): Promise<MicPermission> {
    if (!this.isSupported()) return "unavailable";
    try {
      const permissions = (navigator as Navigator & { permissions?: Permissions }).permissions;
      if (!permissions?.query) return "unknown";
      const status = await permissions.query({ name: "microphone" as PermissionName });
      return status.state as MicPermission;
    } catch {
      return "unknown";
    }
  }

  async listDevices(): Promise<MicDevice[]> {
    if (!this.isSupported()) return [];
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      return devices
        .filter((d) => d.kind === "audioinput")
        .map((d, index) => ({
          deviceId: d.deviceId,
          label: d.label || `Microphone ${index + 1}`,
        }));
    } catch {
      return [];
    }
  }

  async acquire(options: {
    deviceId?: string;
    noiseSuppression: boolean;
    echoCancellation: boolean;
  }): Promise<MediaStream> {
    if (!this.isSupported()) {
      throw new VoiceError("unsupported", "Microphone capture is unavailable in this browser");
    }
    if (this.stream?.active) return this.stream;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          ...(options.deviceId && options.deviceId !== "default"
            ? { deviceId: { exact: options.deviceId } }
            : {}),
          noiseSuppression: options.noiseSuppression,
          echoCancellation: options.echoCancellation,
          autoGainControl: true,
        },
      });
      this.stream = stream;
      return stream;
    } catch (error) {
      const name = (error as DOMException)?.name;
      if (name === "NotAllowedError" || name === "SecurityError") {
        throw new VoiceError("permission-denied", "Microphone permission denied");
      }
      if (name === "NotFoundError" || name === "OverconstrainedError") {
        throw new VoiceError("no-microphone", "No microphone available");
      }
      if (name === "NotReadableError") {
        throw new VoiceError("device-lost", "The microphone is in use by another application");
      }
      throw new VoiceError("unknown", "Could not open the microphone");
    }
  }

  release(): void {
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
  }
}
