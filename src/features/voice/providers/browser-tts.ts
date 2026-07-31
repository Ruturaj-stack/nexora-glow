import {
  VoiceError,
  type SpeakOptions,
  type SpeechSynthesisProvider,
  type SynthesisVoice,
} from "../types";

/** Text-to-speech backed by the browser's built-in SpeechSynthesis API. */
export class BrowserSynthesisProvider implements SpeechSynthesisProvider {
  readonly id = "browser";
  readonly label = "Browser (on-device)";

  private current: SpeechSynthesisUtterance | null = null;

  isSupported(): boolean {
    return typeof window !== "undefined" && "speechSynthesis" in window;
  }

  async listVoices(): Promise<SynthesisVoice[]> {
    if (!this.isSupported()) return [];
    const read = () =>
      window.speechSynthesis.getVoices().map((v) => ({
        id: v.voiceURI,
        label: v.name,
        lang: v.lang,
        default: v.default,
      }));

    const immediate = read();
    if (immediate.length) return immediate;

    // Chrome populates the list asynchronously.
    return new Promise((resolve) => {
      const timeout = setTimeout(() => resolve(read()), 1200);
      window.speechSynthesis.onvoiceschanged = () => {
        clearTimeout(timeout);
        resolve(read());
      };
    });
  }

  speak({ text, voiceId, rate, pitch, volume, onStart, onEnd, onError }: SpeakOptions): void {
    if (!this.isSupported()) {
      onError?.(new VoiceError("unsupported", "Speech synthesis is unavailable"));
      return;
    }
    const trimmed = text.trim();
    if (!trimmed) {
      onEnd?.();
      return;
    }

    const utterance = new SpeechSynthesisUtterance(trimmed);
    const voice = voiceId
      ? window.speechSynthesis.getVoices().find((v) => v.voiceURI === voiceId)
      : undefined;
    if (voice) utterance.voice = voice;
    utterance.rate = rate;
    utterance.pitch = pitch;
    utterance.volume = volume;
    utterance.onstart = () => onStart?.();
    utterance.onend = () => {
      this.current = null;
      onEnd?.();
    };
    utterance.onerror = (event) => {
      this.current = null;
      if (event.error === "interrupted" || event.error === "canceled") {
        onEnd?.();
        return;
      }
      onError?.(new VoiceError("synthesis", `Speech synthesis failed: ${event.error}`));
    };

    this.current = utterance;
    window.speechSynthesis.speak(utterance);
  }

  pause(): void {
    if (this.isSupported()) window.speechSynthesis.pause();
  }

  resume(): void {
    if (this.isSupported()) window.speechSynthesis.resume();
  }

  cancel(): void {
    if (!this.isSupported()) return;
    this.current = null;
    window.speechSynthesis.cancel();
  }

  isSpeaking(): boolean {
    return this.isSupported() && window.speechSynthesis.speaking;
  }
}
