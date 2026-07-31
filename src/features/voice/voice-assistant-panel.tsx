import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import {
  Mic,
  MicOff,
  Pause,
  Play,
  Send,
  Settings2,
  Square,
  X,
  AlertTriangle,
  WifiOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { AIOrb } from "@/features/orb/ai-orb";
import { AudioVisualizer, VoiceLevelMeter } from "./audio-visualizer";
import { voiceManager } from "./voice-manager";
import { formatDuration, useSessionSeconds, useVoiceShortcuts } from "./use-voice";
import { useVoiceStore } from "@/store/voice-store";
import type { OrbState } from "@/store/app-store";
import type { VoiceStatus } from "./types";
import { cn } from "@/lib/utils";

const STATUS_COPY: Record<VoiceStatus, string> = {
  idle: "Ready",
  listening: "Listening…",
  thinking: "Thinking…",
  speaking: "Speaking",
  muted: "Muted",
  error: "Needs attention",
  offline: "Offline",
};

const ORB_STATE: Record<VoiceStatus, OrbState> = {
  idle: "idle",
  listening: "listening",
  thinking: "thinking",
  speaking: "speaking",
  muted: "offline",
  error: "offline",
  offline: "offline",
};

/**
 * Floating voice assistant panel — mounted once in the app shell.
 * Presentation only: every action delegates to the VoiceManager.
 */
export function VoiceAssistantPanel() {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const {
    panelOpen,
    togglePanel,
    setPanelOpen,
    status,
    interimTranscript,
    finalTranscript,
    caption,
    level,
    bands,
    error,
    setError,
    settings,
  } = useVoiceStore();

  const [paused, setPaused] = useState(false);
  const [online, setOnline] = useState(true);
  const seconds = useSessionSeconds();
  useVoiceShortcuts();

  useEffect(() => {
    void voiceManager.refreshPermission();
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  const supported = voiceManager.isRecognitionSupported();
  const listening = status === "listening";
  const speaking = status === "speaking";
  const transcript = `${finalTranscript} ${interimTranscript}`.trim();
  const effectiveStatus: VoiceStatus = !online ? "offline" : status;

  const ensureChatSurface = () => {
    if (voiceManager.hasSubmitHandler()) return true;
    void navigate({ to: "/chat" });
    return false;
  };

  const handleMic = () => {
    if (!ensureChatSurface()) return;
    void voiceManager.toggleMicrophone();
  };

  const handleSend = () => {
    if (!ensureChatSurface()) return;
    const text = voiceManager.takeTranscript();
    if (text) void voiceManager.submit(text);
  };

  return (
    <>
      {/* Launcher */}
      <motion.div
        className="fixed bottom-16 right-4 z-40 sm:bottom-20 sm:right-6"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.4 }}
      >
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="icon"
              onClick={togglePanel}
              aria-label={panelOpen ? "Close voice assistant" : "Open voice assistant"}
              aria-expanded={panelOpen}
              className={cn(
                "size-12 rounded-full shadow-lg shadow-primary/20",
                listening && "animate-pulse",
              )}
            >
              {listening ? <Mic className="size-5" /> : <Mic className="size-5" />}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left">Voice assistant · Ctrl + M</TooltipContent>
        </Tooltip>
      </motion.div>

      <AnimatePresence>
        {panelOpen && (
          <motion.aside
            role="dialog"
            aria-label="Voice assistant"
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 320, damping: 30 }}
            className="glass fixed bottom-32 right-4 z-50 w-[min(22rem,calc(100vw-2rem))] rounded-2xl border border-glass-border p-4 shadow-2xl sm:bottom-36 sm:right-6"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-display text-sm font-semibold">Voice assistant</p>
                <p className="text-xs text-muted-foreground" aria-live="polite">
                  {STATUS_COPY[effectiveStatus]}
                  {seconds > 0 && ` · ${formatDuration(seconds)}`}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  aria-label="Voice settings"
                  onClick={() => {
                    setPanelOpen(false);
                    void navigate({ to: "/settings", hash: "voice" });
                  }}
                >
                  <Settings2 className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  aria-label="Close voice assistant"
                  onClick={() => setPanelOpen(false)}
                >
                  <X className="size-4" />
                </Button>
              </div>
            </div>

            <div className="mt-3 grid place-items-center">
              <AIOrb state={ORB_STATE[effectiveStatus]} size={112} />
            </div>

            <AudioVisualizer bands={bands} level={level} active={listening} className="mt-1" />
            <VoiceLevelMeter level={level} active={listening} />

            <div className="mt-3 min-h-14 rounded-xl border border-border bg-surface/40 p-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/70">
                {speaking && settings.captions ? "Caption" : "Transcript"}
              </p>
              <p className="mt-1 text-sm" aria-live="polite">
                {speaking && settings.captions
                  ? caption || "…"
                  : transcript || (
                      <span className="text-muted-foreground">
                        {supported
                          ? "Press the microphone and start talking."
                          : "Voice input isn't supported in this browser."}
                      </span>
                    )}
              </p>
            </div>

            {!online && (
              <p className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                <WifiOff className="size-3.5" /> You're offline — voice will resume when the
                connection returns.
              </p>
            )}

            {error && (
              <div className="mt-2 flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-2 text-xs">
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-destructive" />
                <span className="flex-1">{error}</span>
                <button onClick={() => setError(null)} aria-label="Dismiss voice error">
                  <X className="size-3" />
                </button>
              </div>
            )}

            <div className="mt-3 flex items-center gap-2">
              <Button
                className="flex-1"
                variant={listening ? "secondary" : "default"}
                onClick={handleMic}
                disabled={!supported || !online}
                aria-pressed={listening}
              >
                {listening ? <MicOff className="size-4" /> : <Mic className="size-4" />}
                {listening ? "Stop" : "Talk"}
              </Button>

              {speaking ? (
                <>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={paused ? "Resume speaking" : "Pause speaking"}
                    onClick={() => {
                      if (paused) voiceManager.resumeSpeaking();
                      else voiceManager.pauseSpeaking();
                      setPaused(!paused);
                    }}
                  >
                    {paused ? <Play className="size-4" /> : <Pause className="size-4" />}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Stop speaking"
                    onClick={() => {
                      voiceManager.stopSpeaking();
                      setPaused(false);
                    }}
                  >
                    <Square className="size-3.5" />
                  </Button>
                </>
              ) : (
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Send transcript"
                  disabled={!transcript}
                  onClick={handleSend}
                >
                  <Send className="size-4" />
                </Button>
              )}
            </div>

            <p className="mt-2 text-[11px] text-muted-foreground">
              Ctrl + M to toggle the microphone · Esc to stop speaking
            </p>
          </motion.aside>
        )}
      </AnimatePresence>
    </>
  );
}
