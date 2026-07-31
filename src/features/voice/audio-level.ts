/**
 * AudioLevelMeter — turns a live microphone stream into a normalised
 * amplitude (0…1) plus a small frequency band array for the waveform UI.
 */
export class AudioLevelMeter {
  private context: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private raf: number | null = null;
  private buffer: Uint8Array = new Uint8Array(0);

  start(stream: MediaStream, onSample: (level: number, bands: number[]) => void): void {
    this.stop();
    const Ctx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;

    const context = new Ctx();
    const analyser = context.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.8;
    const source = context.createMediaStreamSource(stream);
    source.connect(analyser);

    this.context = context;
    this.analyser = analyser;
    this.source = source;
    this.buffer = new Uint8Array(analyser.frequencyBinCount);

    const tick = () => {
      if (!this.analyser) return;
      this.analyser.getByteFrequencyData(this.buffer as Uint8Array<ArrayBuffer>);
      const bandCount = 16;
      const step = Math.floor(this.buffer.length / bandCount) || 1;
      const bands: number[] = [];
      let total = 0;
      for (let b = 0; b < bandCount; b += 1) {
        let sum = 0;
        for (let i = 0; i < step; i += 1) sum += this.buffer[b * step + i] ?? 0;
        const value = sum / step / 255;
        bands.push(value);
        total += value;
      }
      onSample(Math.min(1, (total / bandCount) * 2.2), bands);
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }

  stop(): void {
    if (this.raf !== null) cancelAnimationFrame(this.raf);
    this.raf = null;
    this.source?.disconnect();
    this.analyser?.disconnect();
    void this.context?.close().catch(() => undefined);
    this.source = null;
    this.analyser = null;
    this.context = null;
  }
}
