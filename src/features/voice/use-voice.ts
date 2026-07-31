import { useEffect, useState } from "react";
import { voiceManager } from "./voice-manager";
import { useVoiceStore } from "@/store/voice-store";

/**
 * Registers the chat submit path with the voice layer for as long as the
 * component is mounted, so a spoken transcript lands in the active conversation.
 */
export function useVoiceSubmit(handler: ((text: string) => void | Promise<void>) | null) {
  useEffect(() => {
    voiceManager.registerSubmitHandler(handler);
    return () => voiceManager.registerSubmitHandler(null);
  }, [handler]);
}

/**
 * Speaks assistant replies when auto-speak is enabled. Call with the final
 * assistant text once a stream completes.
 */
export function useAutoSpeak(text: string | null, enabled = true) {
  const autoSpeak = useVoiceStore((s) => s.settings.autoSpeak);
  useEffect(() => {
    if (!enabled || !autoSpeak || !text?.trim()) return;
    voiceManager.speak(text);
  }, [text, autoSpeak, enabled]);
}

/** Global voice keyboard shortcuts: Ctrl/Cmd+M toggles mic, Esc stops speech. */
export function useVoiceShortcuts() {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "m") {
        event.preventDefault();
        void voiceManager.toggleMicrophone();
        return;
      }
      if (event.key === "Escape" && voiceManager.isSpeaking()) {
        voiceManager.stopSpeaking();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}

/** Live session duration in seconds, ticking while a session is open. */
export function useSessionSeconds(): number {
  const startedAt = useVoiceStore((s) => s.sessionStartedAt);
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    if (!startedAt) {
      setSeconds(0);
      return;
    }
    const tick = () => setSeconds(Math.floor((Date.now() - startedAt) / 1000));
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [startedAt]);

  return seconds;
}

export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}
