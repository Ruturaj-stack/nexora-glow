import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { MicPermission, VoiceStatus } from "@/features/voice/types";

export interface VoiceSettings {
  /** Provider ids — future-proofed for Whisper / ElevenLabs etc. */
  recognitionProvider: string;
  synthesisProvider: string;
  lang: string;
  voiceId: string | null;
  rate: number;
  pitch: number;
  volume: number;
  autoSpeak: boolean;
  autoSend: boolean;
  continuous: boolean;
  noiseSuppression: boolean;
  echoCancellation: boolean;
  captions: boolean;
  microphoneId: string;
}

interface VoiceState {
  settings: VoiceSettings;
  updateSettings: (patch: Partial<VoiceSettings>) => void;

  panelOpen: boolean;
  setPanelOpen: (open: boolean) => void;
  togglePanel: () => void;

  status: VoiceStatus;
  setStatus: (status: VoiceStatus) => void;

  permission: MicPermission;
  setPermission: (permission: MicPermission) => void;

  /** Stable transcript accumulated in the current utterance. */
  finalTranscript: string;
  /** Live, not-yet-stable transcript. */
  interimTranscript: string;
  setInterim: (text: string) => void;
  appendFinal: (text: string) => void;
  clearTranscript: () => void;

  /** Last spoken assistant reply, used for captions. */
  caption: string;
  setCaption: (text: string) => void;

  level: number;
  bands: number[];
  setLevel: (level: number, bands: number[]) => void;

  sessionStartedAt: number | null;
  startSession: () => void;
  endSession: () => void;

  error: string | null;
  setError: (message: string | null) => void;
}

const defaultSettings: VoiceSettings = {
  recognitionProvider: "browser",
  synthesisProvider: "browser",
  lang: "en-US",
  voiceId: null,
  rate: 1,
  pitch: 1,
  volume: 1,
  autoSpeak: true,
  autoSend: true,
  continuous: false,
  noiseSuppression: true,
  echoCancellation: true,
  captions: true,
  microphoneId: "default",
};

export const useVoiceStore = create<VoiceState>()(
  persist(
    (set) => ({
      settings: defaultSettings,
      updateSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),

      panelOpen: false,
      setPanelOpen: (panelOpen) => set({ panelOpen }),
      togglePanel: () => set((s) => ({ panelOpen: !s.panelOpen })),

      status: "idle",
      setStatus: (status) => set({ status }),

      permission: "unknown",
      setPermission: (permission) => set({ permission }),

      finalTranscript: "",
      interimTranscript: "",
      setInterim: (interimTranscript) => set({ interimTranscript }),
      appendFinal: (text) =>
        set((s) => ({
          finalTranscript: s.finalTranscript ? `${s.finalTranscript} ${text}` : text,
          interimTranscript: "",
        })),
      clearTranscript: () => set({ finalTranscript: "", interimTranscript: "" }),

      caption: "",
      setCaption: (caption) => set({ caption }),

      level: 0,
      bands: [],
      setLevel: (level, bands) => set({ level, bands }),

      sessionStartedAt: null,
      startSession: () => set({ sessionStartedAt: Date.now() }),
      endSession: () => set({ sessionStartedAt: null, level: 0, bands: [] }),

      error: null,
      setError: (error) => set({ error }),
    }),
    {
      name: "nexora-voice",
      partialize: (state) => ({ settings: state.settings }),
    },
  ),
);
