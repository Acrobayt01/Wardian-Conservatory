import type { WeatherMode } from './types';

export class TerrariumSoundscape {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private rainGain: GainNode | null = null;
  private windGain: GainNode | null = null;
  private rainFilter: BiquadFilterNode | null = null;
  private enabled = false;

  public setEnabled(enable: boolean): boolean {
    if (enable && !this.ctx) {
      this.initAudio();
    }
    this.enabled = enable;
    if (this.ctx && this.masterGain) {
      if (enable && this.ctx.state === 'suspended') {
        void this.ctx.resume();
      }
      const now = this.ctx.currentTime;
      this.masterGain.gain.cancelScheduledValues(now);
      this.masterGain.gain.setTargetAtTime(enable ? 0.35 : 0.0, now, 0.25);
    }
    return this.enabled;
  }

  public update(weather: WeatherMode, nightFactor: number): void {
    if (!this.ctx || !this.rainGain || !this.windGain || !this.rainFilter || !this.enabled) {
      return;
    }
    const now = this.ctx.currentTime;
    const targetRain =
      weather === 'rain' ? 0.55 : weather === 'sunshower' ? 0.26 : weather === 'mist' ? 0.06 : 0.0;
    const targetWind =
      weather === 'mist' ? 0.28 : weather === 'rain' ? 0.22 : 0.08 + nightFactor * 0.05;

    this.rainGain.gain.setTargetAtTime(targetRain, now, 0.35);
    this.windGain.gain.setTargetAtTime(targetWind, now, 0.35);
    this.rainFilter.frequency.setTargetAtTime(weather === 'rain' ? 1900 : 1200, now, 0.35);
  }

  private initAudio(): void {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    const ctx = new AudioCtx();
    this.ctx = ctx;

    const master = ctx.createGain();
    master.gain.value = 0;
    master.connect(ctx.destination);
    this.masterGain = master;

    // Generate 3-second pink-ish noise buffer
    const bufferSize = ctx.sampleRate * 3;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.05;
      b6 = white * 0.115926;
    }

    // Rain noise branch
    const rainSrc = ctx.createBufferSource();
    rainSrc.buffer = buffer;
    rainSrc.loop = true;
    const rainFilter = ctx.createBiquadFilter();
    rainFilter.type = 'bandpass';
    rainFilter.frequency.value = 1600;
    rainFilter.Q.value = 0.7;
    const rainGain = ctx.createGain();
    rainGain.gain.value = 0;
    rainSrc.connect(rainFilter);
    rainFilter.connect(rainGain);
    rainGain.connect(master);
    rainSrc.start();

    // Soft conservatory breeze branch
    const windSrc = ctx.createBufferSource();
    windSrc.buffer = buffer;
    windSrc.loop = true;
    const windFilter = ctx.createBiquadFilter();
    windFilter.type = 'lowpass';
    windFilter.frequency.value = 340;
    const windGain = ctx.createGain();
    windGain.gain.value = 0.08;
    windSrc.connect(windFilter);
    windFilter.connect(windGain);
    windGain.connect(master);
    windSrc.start();

    this.rainFilter = rainFilter;
    this.rainGain = rainGain;
    this.windGain = windGain;
  }

  public dispose(): void {
    if (this.ctx) {
      void this.ctx.close();
      this.ctx = null;
    }
  }
}
