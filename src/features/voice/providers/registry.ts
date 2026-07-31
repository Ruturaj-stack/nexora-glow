import type { SpeechRecognitionProvider, SpeechSynthesisProvider } from "../types";
import { BrowserRecognitionProvider } from "./browser-stt";
import { BrowserSynthesisProvider } from "./browser-tts";

/**
 * Provider registries.
 *
 * Future providers (Whisper, Deepgram, AssemblyAI, Google Speech / ElevenLabs,
 * Azure, OpenAI TTS) only need to implement the interface and be appended here
 * — nothing else in the voice layer changes.
 */
export const RECOGNITION_PROVIDERS: SpeechRecognitionProvider[] = [
  new BrowserRecognitionProvider(),
];

export const SYNTHESIS_PROVIDERS: SpeechSynthesisProvider[] = [new BrowserSynthesisProvider()];

export function resolveRecognitionProvider(preferredId?: string): SpeechRecognitionProvider | null {
  const preferred = RECOGNITION_PROVIDERS.find((p) => p.id === preferredId && p.isSupported());
  return preferred ?? RECOGNITION_PROVIDERS.find((p) => p.isSupported()) ?? null;
}

export function resolveSynthesisProvider(preferredId?: string): SpeechSynthesisProvider | null {
  const preferred = SYNTHESIS_PROVIDERS.find((p) => p.id === preferredId && p.isSupported());
  return preferred ?? SYNTHESIS_PROVIDERS.find((p) => p.isSupported()) ?? null;
}
