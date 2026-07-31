import { useEffect, useState } from "react";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { voiceManager } from "./voice-manager";
import type { SynthesisVoice } from "./types";
import type { MicDevice } from "./permission-manager";
import { useVoiceStore } from "@/store/voice-store";

function Row({
  label,
  hint,
  control,
}: {
  label: string;
  hint: string;
  control: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
      <div className="shrink-0">{control}</div>
    </div>
  );
}

/** Voice configuration surface, rendered inside the Settings page. */
export function VoiceSettings() {
  const { settings, updateSettings } = useVoiceStore();
  const [voices, setVoices] = useState<SynthesisVoice[]>([]);
  const [mics, setMics] = useState<MicDevice[]>([]);

  useEffect(() => {
    void voiceManager.listVoices().then(setVoices);
    void voiceManager.listMicrophones().then(setMics);
  }, []);

  const speechSupported = voiceManager.isSynthesisSupported();
  const micSupported = voiceManager.isRecognitionSupported();

  return (
    <div className="space-y-4">
      {!micSupported && (
        <p className="rounded-xl border border-border bg-surface/40 p-3 text-xs text-muted-foreground">
          Speech recognition isn't available in this browser. Chrome, Edge and Safari are supported.
        </p>
      )}

      <Row
        label="Preferred voice"
        hint="Used when Nexora speaks responses aloud."
        control={
          <Select
            value={settings.voiceId ?? "system"}
            onValueChange={(value) => updateSettings({ voiceId: value === "system" ? null : value })}
            disabled={!speechSupported}
          >
            <SelectTrigger className="h-9 w-52 text-xs">
              <SelectValue placeholder="System default" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="system" className="text-xs">
                System default
              </SelectItem>
              {voices.map((voice) => (
                <SelectItem key={voice.id} value={voice.id} className="text-xs">
                  {voice.label} · {voice.lang}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      />

      <Row
        label="Microphone"
        hint="Choose which input device Nexora listens through."
        control={
          <Select
            value={settings.microphoneId}
            onValueChange={(microphoneId) => updateSettings({ microphoneId })}
          >
            <SelectTrigger className="h-9 w-52 text-xs">
              <SelectValue placeholder="System default" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="default" className="text-xs">
                System default
              </SelectItem>
              {mics
                .filter((mic) => mic.deviceId && mic.deviceId !== "default")
                .map((mic) => (
                  <SelectItem key={mic.deviceId} value={mic.deviceId} className="text-xs">
                    {mic.label}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        }
      />

      <div className="space-y-3">
        <div>
          <Label className="text-xs text-muted-foreground">
            Speaking speed · {settings.rate.toFixed(1)}×
          </Label>
          <Slider
            value={[settings.rate]}
            min={0.5}
            max={2}
            step={0.1}
            onValueChange={([rate]) => updateSettings({ rate })}
            className="mt-2"
          />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">
            Pitch · {settings.pitch.toFixed(1)}
          </Label>
          <Slider
            value={[settings.pitch]}
            min={0}
            max={2}
            step={0.1}
            onValueChange={([pitch]) => updateSettings({ pitch })}
            className="mt-2"
          />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">
            Volume · {Math.round(settings.volume * 100)}%
          </Label>
          <Slider
            value={[settings.volume]}
            min={0}
            max={1}
            step={0.05}
            onValueChange={([volume]) => updateSettings({ volume })}
            className="mt-2"
          />
        </div>
      </div>

      <Row
        label="Auto-speak responses"
        hint="Read new assistant replies aloud automatically."
        control={
          <Switch
            checked={settings.autoSpeak}
            onCheckedChange={(autoSpeak) => updateSettings({ autoSpeak })}
            aria-label="Auto-speak responses"
          />
        }
      />
      <Row
        label="Auto-send transcript"
        hint="Send what you said as soon as you stop talking."
        control={
          <Switch
            checked={settings.autoSend}
            onCheckedChange={(autoSend) => updateSettings({ autoSend })}
            aria-label="Auto-send transcript"
          />
        }
      />
      <Row
        label="Continuous listening"
        hint="Keep the microphone open across multiple sentences."
        control={
          <Switch
            checked={settings.continuous}
            onCheckedChange={(continuous) => updateSettings({ continuous })}
            aria-label="Continuous listening"
          />
        }
      />
      <Row
        label="Noise suppression"
        hint="Filter steady background noise from the microphone."
        control={
          <Switch
            checked={settings.noiseSuppression}
            onCheckedChange={(noiseSuppression) => updateSettings({ noiseSuppression })}
            aria-label="Noise suppression"
          />
        }
      />
      <Row
        label="Echo cancellation"
        hint="Stop Nexora's own voice from being picked up."
        control={
          <Switch
            checked={settings.echoCancellation}
            onCheckedChange={(echoCancellation) => updateSettings({ echoCancellation })}
            aria-label="Echo cancellation"
          />
        }
      />
      <Row
        label="Spoken captions"
        hint="Show the text of spoken responses in the voice panel."
        control={
          <Switch
            checked={settings.captions}
            onCheckedChange={(captions) => updateSettings({ captions })}
            aria-label="Spoken captions"
          />
        }
      />

      <Button
        variant="secondary"
        size="sm"
        disabled={!speechSupported}
        onClick={() => voiceManager.speak("Hello, I'm Nexora. This is how I'll sound.")}
      >
        Preview voice
      </Button>
    </div>
  );
}
