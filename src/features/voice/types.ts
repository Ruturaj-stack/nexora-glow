/**
 * Voice layer contracts.
 *
 * Every speech-to-text and text-to-speech implementation satisfies one of the
 * interfaces below, so the VoiceManager never branches on a concrete vendor.
 * Adding Whisper, Deepgram, ElevenLabs, Azure … means registering one more
 * object in `src/features/voice/providers/registry.ts`.
 */

export type VoiceStatus =
  | "idle"
  | "listening"
  | "thinking"
  | "speaking"
  | "muted"
  | "error"
  | "offline";

export type MicPermission = "unknown" | "prompt" | "granted" | "denied" | "unavailable";

export interface RecognitionCallbacks {
  /** Fired with the not-yet-stable transcript while the user is talking. */
  onInterim: (text: string) => void;
  /** Fired with a stable transcript segment. */
  onFinal: (text: string) => void;
  /** Fired once recognition stops for any reason. */
  onEnd: () => void;
  onError: (error: VoiceError) => void;
}

export interface RecognitionOptions extends RecognitionCallbacks {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
}

export interface SpeechRecognitionProvider {
  readonly id: string;
  readonly label: string;
  /** True when this runtime can actually run the provider. */
  isSupported(): boolean;
  start(options: RecognitionOptions): Promise<void>;
  /** Graceful stop — remaining audio is still transcribed. */
  stop(): void;
  /** Hard stop — discards pending audio. */
  abort(): void;
}

export interface SynthesisVoice {
  id: string;
  label: string;
  lang: string;
  default?: boolean;
}

export interface SpeakOptions {
  text: string;
  voiceId?: string;
  rate: number;
  pitch: number;
  volume: number;
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (error: VoiceError) => void;
}

export interface SpeechSynthesisProvider {
  readonly id: string;
  readonly label: string;
  isSupported(): boolean;
  listVoices(): Promise<SynthesisVoice[]>;
  speak(options: SpeakOptions): void;
  pause(): void;
  resume(): void;
  cancel(): void;
  isSpeaking(): boolean;
}

export type VoiceErrorCode =
  | "unsupported"
  | "permission-denied"
  | "no-microphone"
  | "device-lost"
  | "network"
  | "no-speech"
  | "timeout"
  | "synthesis"
  | "unknown";

export class VoiceError extends Error {
  constructor(
    public readonly code: VoiceErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "VoiceError";
  }
}

/** Human-readable, non-technical copy for each failure mode. */
export function describeVoiceError(error: VoiceError): string {
  switch (error.code) {
    case "unsupported":
      return "Voice isn't supported in this browser. Try Chrome, Edge or Safari.";
    case "permission-denied":
      return "Microphone access was blocked. Enable it in your browser settings to talk to Nexora.";
    case "no-microphone":
      return "No microphone was found on this device.";
    case "device-lost":
      return "The microphone was disconnected.";
    case "network":
      return "Speech recognition lost its network connection.";
    case "no-speech":
      return "I didn't catch that — try speaking again.";
    case "timeout":
      return "Listening timed out after a long silence.";
    case "synthesis":
      return "Nexora couldn't speak that response.";
    default:
      return error.message || "Something went wrong with voice.";
  }
}
