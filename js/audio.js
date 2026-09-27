// All sound is synthesised in the browser: wheels on rail joints, rumble, wind, rain, thunder,
// a maglev hum, station chimes and an optional slow ambient pad. Nothing is downloaded.
(function () {
  "use strict";

  class TrainAudio {
    constructor() {
      this.ctx = null;
      this.levels = { master: 0.8, train: 0.8, weather: 0.7, music: 0 };
      this.fade = 1;
    }

    start() {
      if (this.ctx) {
        this.ctx.resume();
        return;
      }
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      const ctx = (this.ctx = new AC());
      this.master = ctx.createGain();
      this.master.connect(ctx.destination);
      this.bus = {};
      for (const k of ["train", "weather", "music"]) {
        this.bus[k] = ctx.createGain();
        this.bus[k].connect(this.master);
      }
      this.white = this.noiseBuffer("white");
      this.brown = this.noiseBuffer("brown");
      this.pink = this.noiseBuffer("pink");

      this.rumble = this.loop(this.brown, "lowpass", 140, this.bus.train);
      this.wind = this.loop(this.pink, "bandpass", 700, this.bus.train);
      this.wind.filter.Q.value = 0.6;
      this.rain = this.loop(this.pink, "highpass", 900, this.bus.weather);
      this.rainLow = this.loop(this.brown, "lowpass", 400, this.bus.weather);

      // Maglev hum: two slightly detuned oscillators through a soft filter.
      this.hum = ctx.createGain();
      this.hum.gain.value = 0;
      const hf = ctx.createBiquadFilter();
      hf.type = "lowpass";
      hf.frequency.value = 500;
      this.hum.connect(hf);
      hf.connect(this.bus.train);
      this.humOsc = [55, 55.4, 110.3].map((f, i) => {
        const o = ctx.createOscillator();
        o.type = i === 2 ? "sine" : "sawtooth";
        o.frequency.value = f;
        const g = ctx.createGain();
        g.gain.value = i === 2 ? 0.3 : 0.12;
        o.connect(g);
        g.connect(this.hum);
        o.start();
        return o;
      });

      this.setupMusic();
      this.applyLevels();
    }

    noiseBuffer(kind) {
      const ctx = this.ctx;
      const len = ctx.sampleRate * 4;
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      let last = 0, b0 = 0, b1 = 0, b2 = 0;
      for (let i = 0; i < len; i++) {
        const w = Math.random() * 2 - 1;
        if (kind === "white") d[i] = w * 0.5;
        else if (kind === "brown") {
          last = (last + 0.02 * w) / 1.02;
          d[i] = last * 3.2;
        } else {
          b0 = 0.99765 * b0 + w * 0.099;
          b1 = 0.963 * b1 + w * 0.2965;
          b2 = 0.57 * b2 + w * 1.0526;
          d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.18;
        }
      }
      return buf;
    }

    loop(buffer, type, freq, out) {
      const ctx = this.ctx;
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.loop = true;
      src.loopStart = Math.random();
      const filter = ctx.createBiquadFilter();
      filter.type = type;
      filter.frequency.value = freq;
      const gain = ctx.createGain();
      gain.gain.value = 0;
      src.connect(filter);
      filter.connect(gain);
      gain.connect(out);
      src.start(0, Math.random() * 3);
      return { src, filter, gain };
    }

    set(param, value, time = 0.4) {
      if (!this.ctx) return;
      param.setTargetAtTime(value, this.ctx.currentTime, time);
    }

    applyLevels() {
      if (!this.ctx) return;
      const L = this.levels;
      this.set(this.master.gain, L.master * this.fade, 0.3);
      this.set(this.bus.train.gain, L.train, 0.2);
      this.set(this.bus.weather.gain, L.weather, 0.2);
      this.set(this.bus.music.gain, L.music * 0.5, 0.8);
    }

    setFade(f) {
      this.fade = f;
      if (this.ctx) this.set(this.master.gain, this.levels.master * f, 0.5);
    }

    // Called every frame with the state of the ride.
    update(st) {
      if (!this.ctx) return;
      const v = st.v; // m/s
      const k = Math.min(1, v / 30);
      const tunnel = st.tunnel ? 1 : 0;
      if (st.maglev) {
        this.set(this.rumble.gain.gain, 0.08 + k * 0.12);
        this.set(this.rumble.filter.frequency, 90 + k * 60);
        this.set(this.hum.gain, st.space ? 0.05 + k * 0.08 : 0.04 + k * 0.1);
        this.humOsc[0].frequency.setTargetAtTime(48 + k * 30, this.ctx.currentTime, 1);
        this.humOsc[1].frequency.setTargetAtTime(48.4 + k * 30, this.ctx.currentTime, 1);
        this.humOsc[2].frequency.setTargetAtTime(96 + k * 60, this.ctx.currentTime, 1);
      } else {
        this.set(this.rumble.gain.gain, (0.12 + k * 0.45) * (1 + tunnel * 0.7));
        this.set(this.rumble.filter.frequency, 110 + k * 160 + tunnel * 120);
        this.set(this.hum.gain, 0);
      }
      this.set(this.wind.gain.gain, st.space ? 0 : k * k * 0.18 * (1 + tunnel * 1.5));
      this.set(this.wind.filter.frequency, 400 + k * 900);
      const rain = st.space || st.tunnel ? 0 : Math.min(1, st.rain + st.storm);
      this.set(this.rain.gain.gain, rain * 0.35, 1.2);
      this.set(this.rainLow.gain.gain, (rain * 0.25 + st.storm * 0.2) * 0.6, 1.2);
    }

    // A wheel passing over a rail joint.
    clack(strength) {
      if (!this.ctx) return;
      const ctx = this.ctx, t = ctx.currentTime;
      const src = ctx.createBufferSource();
      src.buffer = this.white;
      const bp = ctx.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.value = 1400 + Math.random() * 500;
      bp.Q.value = 1.4;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.35 * strength, t + 0.004);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
      src.connect(bp);
      bp.connect(g);
      g.connect(this.bus.train);
      src.start(t, Math.random() * 3, 0.1);
      // low thump
      const o = ctx.createOscillator();
      o.type = "sine";
      o.frequency.setValueAtTime(95, t);
      o.frequency.exponentialRampToValueAtTime(45, t + 0.08);
      const og = ctx.createGain();
      og.gain.setValueAtTime(0.5 * strength, t);
      og.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
      o.connect(og);
      og.connect(this.bus.train);
      o.start(t);
      o.stop(t + 0.15);
    }

    // Two-tone station chime.
    chime(future) {
      if (!this.ctx) return;
      const ctx = this.ctx, t = ctx.currentTime;
      const notes = future ? [880, 1318.5, 1760] : [659.25, 523.25];
      notes.forEach((f, i) => {
        for (const [mult, amp] of [[1, 0.18], [2.01, 0.05], [3, 0.02]]) {
          const o = ctx.createOscillator();
          o.type = "sine";
          o.frequency.value = f * mult;
          const g = ctx.createGain();
          const s = t + i * 0.55;
          g.gain.setValueAtTime(0, s);
          g.gain.linearRampToValueAtTime(amp, s + 0.01);
          g.gain.exponentialRampToValueAtTime(0.0005, s + 1.8);
          o.connect(g);
          g.connect(this.master);
          o.start(s);
          o.stop(s + 2);
        }
      });
    }

    thunder(distance) {
      if (!this.ctx) return;
      const ctx = this.ctx, t = ctx.currentTime + distance;
      const src = ctx.createBufferSource();
      src.buffer = this.brown;
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.setValueAtTime(900, t);
      lp.frequency.exponentialRampToValueAtTime(80, t + 4);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.9 / (1 + distance), t + 0.15);
      g.gain.exponentialRampToValueAtTime(0.001, t + 5);
      src.connect(lp);
      lp.connect(g);
      g.connect(this.bus.weather);
      src.start(t, Math.random() * 2, 6);
    }

    horn(future) {
      if (!this.ctx) return;
      const ctx = this.ctx, t = ctx.currentTime;
      const freqs = future ? [440, 554] : [311, 370, 466];
      for (const f of freqs) {
        const o = ctx.createOscillator();
        o.type = future ? "sine" : "sawtooth";
        o.frequency.value = f;
        const lp = ctx.createBiquadFilter();
        lp.type = "lowpass";
        lp.frequency.value = 1200;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(0.035, t + 0.15);
        g.gain.setValueAtTime(0.035, t + 1.3);
        g.gain.exponentialRampToValueAtTime(0.0005, t + 2.2);
        o.connect(lp);
        lp.connect(g);
        g.connect(this.bus.train);
        o.start(t);
        o.stop(t + 2.3);
      }
    }

    // A slow, quiet chord progression for sleep.
    setupMusic() {
      const ctx = this.ctx;
      const out = ctx.createBiquadFilter();
      out.type = "lowpass";
      out.frequency.value = 1400;
      const delay = ctx.createDelay(2);
      delay.delayTime.value = 0.6;
      const fb = ctx.createGain();
      fb.gain.value = 0.35;
      out.connect(this.bus.music);
      out.connect(delay);
      delay.connect(fb);
      fb.connect(delay);
      delay.connect(this.bus.music);
      this.musicOut = out;
      this.chords = [
        [48, 55, 64, 71],
        [45, 52, 60, 67, 71],
        [41, 48, 57, 64],
        [43, 50, 59, 62, 66],
      ];
      this.chordIndex = 0;
      this.nextChord = 0;
    }

    tickMusic() {
      if (!this.ctx || this.levels.music <= 0) return;
      const ctx = this.ctx;
      if (ctx.currentTime < this.nextChord) return;
      const dur = 11;
      const chord = this.chords[this.chordIndex++ % this.chords.length];
      const t = ctx.currentTime + 0.05;
      chord.forEach((n, i) => {
        const f = 440 * Math.pow(2, (n - 69) / 12);
        const o = ctx.createOscillator();
        o.type = i === 0 ? "sine" : "triangle";
        o.frequency.value = f;
        o.detune.value = (Math.random() - 0.5) * 8;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(0.05 / (1 + i * 0.3), t + 3.5);
        g.gain.setValueAtTime(0.05 / (1 + i * 0.3), t + dur - 3);
        g.gain.linearRampToValueAtTime(0, t + dur + 2);
        o.connect(g);
        g.connect(this.musicOut);
        o.start(t);
        o.stop(t + dur + 2.2);
      });
      // an occasional soft high note
      if (Math.random() < 0.7) {
        const n = chord[chord.length - 1] + 12 + [0, 2, 4, 7][Math.floor(Math.random() * 4)];
        const o = ctx.createOscillator();
        o.type = "sine";
        o.frequency.value = 440 * Math.pow(2, (n - 69) / 12);
        const g = ctx.createGain();
        const s = t + 2 + Math.random() * 5;
        g.gain.setValueAtTime(0, s);
        g.gain.linearRampToValueAtTime(0.025, s + 0.05);
        g.gain.exponentialRampToValueAtTime(0.0005, s + 4);
        o.connect(g);
        g.connect(this.musicOut);
        o.start(s);
        o.stop(s + 4.2);
      }
      this.nextChord = t + dur;
    }

    suspend() {
      if (this.ctx) this.ctx.suspend();
    }
  }

  window.TrainAudio = TrainAudio;
})();
