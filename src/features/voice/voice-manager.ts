import { AudioLevelMeter } from "./audio-level";
import { VoicePermissionManager } from "./permission-manager";
import { resolveRecognitionProvider, resolveSynthesisProvider } from "./providers/registry";
import { VoiceError, describeVoiceError, type SynthesisVoice } from "./types";
import { useVoiceStore } from "@/store/voice-store";

type SubmitHandler = (text: string) => void | Promise<void>;

const SILENCE_TIMEOUT_MS = 8000;

/**
 * VoiceManager — the single orchestration point for the voice layer.
 *
 * It owns the session lifecycle (permissions → recognition → chat submit →
 * synthesis) and mirrors every transition into the Zustand store. UI components
 * only ever call these methods; they never touch a provider directly.
 */
class VoiceManager {
  private readonly permissions = new VoicePermissionManager();
  private readonly meter = new AudioLevelMeter();
  private submitHandler: SubmitHandler | null = null;
  private silenceTimer: ReturnType<typeof setTimeout> | null = null;
  private listening = false;

  private get store() {
    return useVoiceStore.getState();
  }

  /** The chat surface registers how a finished transcript should be sent. */
  registerSubmitHandler(handler: SubmitHandler | null): void {
    this.submitHandler = handler;
  }

  hasSubmitHandler(): boolean {
    return this.submitHandler !== null;
  }

  isRecognitionSupported(): boolean {
    return resolveRecognitionProvider(this.store.settings.recognitionProvider) !== null;
  }

  isSynthesisSupported(): boolean {
    return resolveSynthesisProvider(this.store.settings.synthesisProvider) !== null;
  }

  listMicrophones() {
    return this.permissions.listDevices();
  }

  async listVoices(): Promise<SynthesisVoice[]> {
    const provider = resolveSynthesisProvider(this.store.settings.synthesisProvider);
    return provider ? provider.listVoices() : [];
  }

  async refreshPermission(): Promise<void> {
    this.store.setPermission(await this.permissions.query());
  }

  private fail(error: unknown): void {
    const voiceError =
      error instanceof VoiceError ? error : new VoiceError("unknown", String(error));
    if (voiceError.code === "permission-denied") this.store.setPermission("denied");
    this.store.setError(describeVoiceError(voiceError));
    this.store.setStatus(voiceError.code === "no-speech" ? "idle" : "error");
  }

  private armSilenceTimer(): void {
    this.clearSilenceTimer();
    this.silenceTimer = setTimeout(() => {
      if (this.listening) void this.stopListening();
    }, SILENCE_TIMEOUT_MS);
  }

  private clearSilenceTimer(): void {
    if (this.silenceTimer) clearTimeout(this.silenceTimer);
    this.silenceTimer = null;
  }

  async startListening(): Promise<void> {
    if (this.listening) return;
    const { settings } = this.store;

    const provider = resolveRecognitionProvider(settings.recognitionProvider);
    if (!provider) {
      this.fail(new VoiceError("unsupported", "Speech recognition is unavailable"));
      return;
    }

    // Barge-in: talking always interrupts Nexora.
    this.stopSpeaking();
    this.store.setError(null);
    this.store.clearTranscript();

    try {
      const stream = await this.permissions.acquire({
        deviceId: settings.microphoneId,
        noiseSuppression: settings.noiseSuppression,
        echoCancellation: settings.echoCancellation,
      });
      this.store.setPermission("granted");
      this.meter.start(stream, (level, bands) => this.store.setLevel(level, bands));

      await provider.start({
        lang: settings.lang,
        continuous: settings.continuous,
        interimResults: true,
        onInterim: (text) => {
          this.store.setInterim(text);
          if (text) this.armSilenceTimer();
        },
        onFinal: (text) => {
          this.store.appendFinal(text);
          this.armSilenceTimer();
          if (!settings.continuous) void this.stopListening();
        },
        onEnd: () => this.finishListening(),
        onError: (error) => {
          this.finishListening(true);
          this.fail(error);
        },
      });

      this.listening = true;
      this.store.startSession();
      this.store.setStatus("listening");
      this.store.setPanelOpen(true);
      this.armSilenceTimer();
    } catch (error) {
      this.meter.stop();
      this.permissions.release();
      this.fail(error);
    }
  }

  /** Graceful stop — flushes the transcript into the chat when auto-send is on. */
  async stopListening(): Promise<void> {
    const provider = resolveRecognitionProvider(this.store.settings.recognitionProvider);
    provider?.stop();
    this.finishListening();
  }

  /** Hard cancel — discards whatever was captured. */
  cancelListening(): void {
    const provider = resolveRecognitionProvider(this.store.settings.recognitionProvider);
    provider?.abort();
    this.finishListening(true);
    this.store.clearTranscript();
    this.store.setStatus("idle");
  }

  private finishListening(discard = false): void {
    if (!this.listening && discard) {
      this.meter.stop();
      this.permissions.release();
      return;
    }
    this.listening = false;
    this.clearSilenceTimer();
    this.meter.stop();
    this.permissions.release();
    this.store.endSession();

    if (discard) return;

    const { finalTranscript, interimTranscript, settings } = this.store;
    const transcript = `${finalTranscript} ${interimTranscript}`.trim();
    this.store.setStatus("idle");
    if (!transcript) return;

    if (settings.autoSend && this.submitHandler) {
      this.store.setStatus("thinking");
      void Promise.resolve(this.submitHandler(transcript)).catch(() => {
        this.store.setStatus("idle");
      });
      this.store.clearTranscript();
    }
  }

  /** Consumes the transcript manually (used by the panel's Send button). */
  takeTranscript(): string {
    const { finalTranscript, interimTranscript } = this.store;
    const transcript = `${finalTranscript} ${interimTranscript}`.trim();
    this.store.clearTranscript();
    return transcript;
  }

  async submit(text: string): Promise<void> {
    if (!text.trim() || !this.submitHandler) return;
    this.store.setStatus("thinking");
    await Promise.resolve(this.submitHandler(text)).catch(() => undefined);
  }

  speak(text: string): void {
    const { settings } = this.store;
    const provider = resolveSynthesisProvider(settings.synthesisProvider);
    if (!provider) {
      this.fail(new VoiceError("unsupported", "Speech synthesis is unavailable"));
      return;
    }
    provider.cancel();
    this.store.setCaption(text);
    provider.speak({
      text,
      voiceId: settings.voiceId ?? undefined,
      rate: settings.rate,
      pitch: settings.pitch,
      volume: settings.volume,
      onStart: () => this.store.setStatus("speaking"),
      onEnd: () => {
        if (useVoiceStore.getState().status === "speaking") this.store.setStatus("idle");
      },
      onError: (error) => this.fail(error),
    });
  }

  pauseSpeaking(): void {
    resolveSynthesisProvider(this.store.settings.synthesisProvider)?.pause();
  }

  resumeSpeaking(): void {
    resolveSynthesisProvider(this.store.settings.synthesisProvider)?.resume();
  }

  stopSpeaking(): void {
    const provider = resolveSynthesisProvider(this.store.settings.synthesisProvider);
    provider?.cancel();
    if (useVoiceStore.getState().status === "speaking") this.store.setStatus("idle");
  }

  isSpeaking(): boolean {
    return resolveSynthesisProvider(this.store.settings.synthesisProvider)?.isSpeaking() ?? false;
  }

  async toggleMicrophone(): Promise<void> {
    if (this.listening) await this.stopListening();
    else await this.startListening();
  }

  isListening(): boolean {
    return this.listening;
  }
}

export const voiceManager = new VoiceManager();
