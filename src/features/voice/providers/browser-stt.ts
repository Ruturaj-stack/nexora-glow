import { VoiceError, type RecognitionOptions, type SpeechRecognitionProvider } from "../types";

/* Minimal typings for the vendor-prefixed Web Speech API. */
interface SpeechRecognitionAlternativeLike {
  transcript: string;
}
interface SpeechRecognitionResultLike {
  isFinal: boolean;
  0: SpeechRecognitionAlternativeLike;
  length: number;
}
interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: { length: number; [index: number]: SpeechRecognitionResultLike };
}
interface SpeechRecognitionErrorEventLike {
  error: string;
  message?: string;
}
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
}
type RecognitionCtor = new () => SpeechRecognitionLike;

function getCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: RecognitionCtor;
    webkitSpeechRecognition?: RecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

function mapError(code: string): VoiceError {
  switch (code) {
    case "not-allowed":
    case "service-not-allowed":
      return new VoiceError("permission-denied", "Microphone permission denied");
    case "audio-capture":
      return new VoiceError("no-microphone", "No microphone available");
    case "network":
      return new VoiceError("network", "Recognition network error");
    case "no-speech":
      return new VoiceError("no-speech", "No speech detected");
    case "aborted":
      return new VoiceError("unknown", "Recognition aborted");
    default:
      return new VoiceError("unknown", `Recognition error: ${code}`);
  }
}

/** Speech-to-text backed by the browser's built-in Web Speech API. */
export class BrowserRecognitionProvider implements SpeechRecognitionProvider {
  readonly id = "browser";
  readonly label = "Browser (on-device)";

  private recognition: SpeechRecognitionLike | null = null;
  private stopping = false;

  isSupported(): boolean {
    return getCtor() !== null;
  }

  async start(options: RecognitionOptions): Promise<void> {
    const Ctor = getCtor();
    if (!Ctor) throw new VoiceError("unsupported", "Speech recognition is unavailable");

    this.abort();
    this.stopping = false;

    const recognition = new Ctor();
    recognition.lang = options.lang;
    recognition.continuous = options.continuous;
    recognition.interimResults = options.interimResults;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        const text = result[0]?.transcript ?? "";
        if (result.isFinal) {
          const trimmed = text.trim();
          if (trimmed) options.onFinal(trimmed);
        } else {
          interim += text;
        }
      }
      options.onInterim(interim.trim());
    };

    recognition.onerror = (event) => {
      if (this.stopping && event.error === "aborted") return;
      options.onError(mapError(event.error));
    };

    recognition.onend = () => {
      this.recognition = null;
      options.onEnd();
    };

    this.recognition = recognition;
    try {
      recognition.start();
    } catch {
      // start() throws when a previous session is still winding down.
      this.recognition = null;
      throw new VoiceError("unknown", "Recognition could not start — try again");
    }
  }

  stop(): void {
    this.stopping = true;
    this.recognition?.stop();
  }

  abort(): void {
    this.stopping = true;
    const current = this.recognition;
    this.recognition = null;
    current?.abort();
  }
}
