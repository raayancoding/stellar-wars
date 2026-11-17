/* ============================================================
   AUDIO — fully procedural WebAudio music & SFX
   ============================================================ */

const NOTE = (m) => 440 * Math.pow(2, (m - 69) / 12);

export class AudioSystem {
  constructor(settings) {
    this.ctx = null;
    this.master = null;
    this.musicBus = null;
    this.sfxBus = null;
    this.noiseBuffer = null;
    this.musicMode = null;
    this.pendingMusic = null;
    this.timer = null;
    this.step = 0;
    this.nextTime = 0;
    this.stepDur = 0.3;
    this.lastShoot = 0;
    this.lastHit = 0;
    this.muted = false;
    this.settings = settings || { music: 0.45, sfx: 0.7 };
  }

  unlock() {
    if (!this.ctx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      try {
        this.ctx = new Ctx();
      } catch (e) {
        return;
      }
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.9;
      this.master.connect(this.ctx.destination);

      this.musicBus = this.ctx.createGain();
      this.musicBus.connect(this.master);

      this.sfxBus = this.ctx.createGain();
      this.sfxBus.connect(this.master);

      // gentle limiter-ish compressor
      const comp = this.ctx.createDynamicsCompressor();
      comp.threshold.value = -18;
      comp.knee.value = 20;
      comp.ratio.value = 6;
      comp.attack.value = 0.005;
      comp.release.value = 0.2;
      this.master.disconnect();
      this.master.connect(comp);
      comp.connect(this.ctx.destination);

      this.applyVolumes();
      if (this.pendingMusic) {
        const mode = this.pendingMusic;
        this.pendingMusic = null;
        this.startMusic(mode);
      }
    }
    if (this.ctx.state === "suspended") this.ctx.resume();
  }

  applyVolumes() {
    if (!this.ctx) return;
    const s = this.settings;
    const music = this.muted ? 0 : Math.max(0, Math.min(1, s.music ?? 0.45));
    const sfx = this.muted ? 0 : Math.max(0, Math.min(1, s.sfx ?? 0.7));
    this.musicBus.gain.setTargetAtTime(music * 0.55, this.ctx.currentTime, 0.05);
    this.sfxBus.gain.setTargetAtTime(sfx * 0.9, this.ctx.currentTime, 0.05);
  }

  setSettings(settings) {
    this.settings = settings;
    this.applyVolumes();
  }

  setMuted(m) {
    this.muted = m;
    this.applyVolumes();
  }

  /* ---------------- primitive synth ---------------- */

  getNoise() {
    if (this.noiseBuffer) return this.noiseBuffer;
    const len = this.ctx.sampleRate * 1.2;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.noiseBuffer = buf;
    return buf;
  }

  tone({
    freq = 440, freqEnd = null, dur = 0.2, type = "sine",
    gain = 0.1, attack = 0.005, release = 0.1, detune = 0,
    filter = null, filterEnd = null, delay = 0, bus = "sfx"
  } = {}) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(20, freq), t);
    if (freqEnd) osc.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), t + dur);
    if (detune) osc.detune.value = detune;

    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0001, gain), t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + release);

    let node = osc;
    if (filter) {
      const f = this.ctx.createBiquadFilter();
      f.type = "lowpass";
      f.frequency.setValueAtTime(filter, t);
      if (filterEnd) f.frequency.exponentialRampToValueAtTime(Math.max(60, filterEnd), t + dur);
      f.Q.value = 2;
      node.connect(f);
      node = f;
    }
    node.connect(g);
    g.connect(bus === "music" ? this.musicBus : this.sfxBus);
    osc.start(t);
    osc.stop(t + dur + release + 0.02);
  }

  noise({ dur = 0.3, gain = 0.12, filter = 1800, filterEnd = 120, type = "lowpass", delay = 0, q = 1 } = {}) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + delay;
    const src = this.ctx.createBufferSource();
    src.buffer = this.getNoise();
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(filter, t);
    f.frequency.exponentialRampToValueAtTime(Math.max(50, filterEnd), t + dur);
    f.Q.value = q;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f);
    f.connect(g);
    g.connect(this.sfxBus);
    src.start(t);
    src.stop(t + dur + 0.05);
  }

  /* ---------------- SFX ---------------- */

  play(name, intensity = 1) {
    if (!this.ctx || this.muted) return;
    const now = this.ctx.currentTime;
    const i = Math.max(0.3, Math.min(1.4, intensity));

    switch (name) {
      case "shoot":
        if (now - this.lastShoot < 0.055) return;
        this.lastShoot = now;
        this.tone({ freq: 1250, freqEnd: 480, dur: 0.065, type: "square", gain: 0.035 * i, release: 0.03 });
        break;
      case "shootPlasma":
        if (now - this.lastShoot < 0.06) return;
        this.lastShoot = now;
        this.tone({ freq: 620, freqEnd: 140, dur: 0.1, type: "sawtooth", gain: 0.05 * i, release: 0.04, filter: 2400, filterEnd: 400 });
        break;
      case "beam":
        if (now - this.lastShoot < 0.085) return;
        this.lastShoot = now;
        this.tone({ freq: 1500, freqEnd: 900, dur: 0.1, type: "sawtooth", gain: 0.024 * i, release: 0.02, filter: 3200 });
        break;
      case "eshoot":
        if (now - this.lastShoot < 0.04) return;
        this.lastShoot = now;
        this.tone({ freq: 300, freqEnd: 120, dur: 0.11, type: "triangle", gain: 0.028 * i, release: 0.04 });
        break;
      case "missile":
        this.noise({ dur: 0.35, gain: 0.09, filter: 3400, filterEnd: 300, type: "bandpass", q: 2 });
        this.tone({ freq: 170, freqEnd: 60, dur: 0.35, type: "sawtooth", gain: 0.05, release: 0.1 });
        break;
      case "hit":
        if (now - this.lastHit < 0.035) return;
        this.lastHit = now;
        this.tone({ freq: 240, freqEnd: 130, dur: 0.045, type: "square", gain: 0.022, release: 0.02 });
        break;
      case "explode":
        this.noise({ dur: 0.32, gain: 0.12 * i, filter: 2200, filterEnd: 90 });
        this.tone({ freq: 110, freqEnd: 42, dur: 0.24, type: "triangle", gain: 0.09 * i, release: 0.08 });
        break;
      case "explodeBig":
        this.noise({ dur: 0.8, gain: 0.2, filter: 1600, filterEnd: 60 });
        this.tone({ freq: 90, freqEnd: 30, dur: 0.7, type: "sawtooth", gain: 0.14, release: 0.2, filter: 600, filterEnd: 80 });
        break;
      case "playerHit":
        this.noise({ dur: 0.28, gain: 0.14, filter: 1200, filterEnd: 160 });
        this.tone({ freq: 190, freqEnd: 70, dur: 0.28, type: "square", gain: 0.08, release: 0.1 });
        break;
      case "coin":
        this.tone({ freq: 1320, dur: 0.07, type: "sine", gain: 0.05, release: 0.03 });
        this.tone({ freq: 1980, dur: 0.09, type: "sine", gain: 0.04, release: 0.04, delay: 0.05 });
        break;
      case "powerup":
        [660, 880, 1100, 1470].forEach((f, idx) =>
          this.tone({ freq: f, dur: 0.11, type: "triangle", gain: 0.06, release: 0.06, delay: idx * 0.06 })
        );
        break;
      case "ultimate":
        this.tone({ freq: 120, freqEnd: 1400, dur: 0.7, type: "sawtooth", gain: 0.08, release: 0.2, filter: 500, filterEnd: 6000 });
        this.noise({ dur: 0.55, gain: 0.07, filter: 400, filterEnd: 6000, type: "bandpass", q: 1 });
        break;
      case "alarm":
        this.tone({ freq: 240, dur: 0.18, type: "square", gain: 0.06, release: 0.06 });
        this.tone({ freq: 190, dur: 0.2, type: "square", gain: 0.06, release: 0.08, delay: 0.22 });
        this.tone({ freq: 240, dur: 0.18, type: "square", gain: 0.05, release: 0.06, delay: 0.44 });
        break;
      case "click":
        this.tone({ freq: 720, freqEnd: 540, dur: 0.04, type: "sine", gain: 0.035, release: 0.02 });
        break;
      case "purchase":
        [880, 1174, 1568].forEach((f, idx) =>
          this.tone({ freq: f, dur: 0.12, type: "sine", gain: 0.05, release: 0.08, delay: idx * 0.07 })
        );
        break;
      case "error":
        this.tone({ freq: 160, dur: 0.16, type: "square", gain: 0.05, release: 0.05 });
        break;
      case "freeze":
        this.tone({ freq: 2400, freqEnd: 600, dur: 0.5, type: "sine", gain: 0.06, release: 0.2 });
        this.noise({ dur: 0.4, gain: 0.04, filter: 6000, filterEnd: 2000, type: "highpass" });
        break;
      case "warp":
        this.tone({ freq: 80, freqEnd: 1800, dur: 0.6, type: "sine", gain: 0.05, release: 0.15 });
        break;
      case "victory":
        [523, 659, 784, 1046, 1318].forEach((f, idx) =>
          this.tone({ freq: f, dur: 0.4, type: "triangle", gain: 0.07, release: 0.2, delay: idx * 0.14 })
        );
        break;
      case "defeat":
        [392, 330, 262, 196].forEach((f, idx) =>
          this.tone({ freq: f, dur: 0.5, type: "sine", gain: 0.07, release: 0.25, delay: idx * 0.18 })
        );
        break;
      case "bossPhase":
        this.tone({ freq: 90, freqEnd: 55, dur: 0.7, type: "sawtooth", gain: 0.09, release: 0.15 });
        this.noise({ dur: 0.6, gain: 0.08, filter: 800, filterEnd: 100 });
        break;
      default:
        break;
    }
  }

  /* ---------------- MUSIC ---------------- */

  startMusic(mode = "menu") {
    if (!this.ctx) {
      this.pendingMusic = mode;
      return;
    }
    if (this.musicMode === mode) return;
    this.musicMode = mode;
    this.step = 0;
    this.nextTime = this.ctx.currentTime + 0.12;
    this.stepDur = mode === "battle" ? 0.16 : 0.32;
    if (!this.timer) {
      this.timer = setInterval(() => this._schedule(), 90);
    }
  }

  stopMusic() {
    this.musicMode = null;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  _schedule() {
    if (!this.ctx || !this.musicMode || this.ctx.state !== "running") return;
    const ahead = this.ctx.currentTime + 0.4;
    if (this.nextTime < this.ctx.currentTime - 0.5) this.nextTime = this.ctx.currentTime + 0.05;
    while (this.nextTime < ahead) {
      this._step(this.step, this.nextTime - this.ctx.currentTime);
      this.nextTime += this.stepDur;
      this.step++;
    }
  }

  _step(step, delay) {
    const menu = this.musicMode === "menu";
    const s = step % 32;

    const menuChords = [
      [45, 52, 57, 60], [41, 48, 53, 57], [48, 55, 60, 64], [43, 50, 55, 59]
    ];
    const battleChords = [
      [40, 47, 52], [36, 43, 48], [43, 50, 55], [38, 45, 50]
    ];
    const chords = menu ? menuChords : battleChords;
    const chord = chords[Math.floor(step / 8) % chords.length];

    // pad every 8 steps
    if (s % 8 === 0) {
      const dur = this.stepDur * 8;
      chord.forEach((m, idx) => {
        this.tone({
          freq: NOTE(m), dur, type: menu ? "sine" : "triangle",
          gain: menu ? 0.045 : 0.028, attack: 0.4, release: 0.6,
          detune: (idx - 1) * 4, filter: menu ? 1400 : 2200, bus: "music", delay
        });
      });
    }

    const arpPattern = menu ? [0, 7, 12, 7, 4, 7, 12, 16] : [0, 12, 7, 12, 4, 0, 7, 12];
    const arp = arpPattern[step % 8];
    if (menu) {
      if (step % 2 === 0) {
        this.tone({
          freq: NOTE(chord[2] + arp + 12), dur: 0.22, type: "sine",
          gain: 0.02, attack: 0.01, release: 0.25, filter: 2400, bus: "music", delay
        });
      }
    } else {
      this.tone({
        freq: NOTE(chord[1] + arp + 12), dur: 0.12, type: "square",
        gain: 0.016, attack: 0.005, release: 0.08, filter: 2600,
        bus: "music", delay
      });
      if (step % 4 === 0) {
        this.tone({
          freq: NOTE(chord[0] - 12), dur: 0.28, type: "sawtooth",
          gain: 0.04, attack: 0.005, release: 0.12, filter: 300, bus: "music", delay
        });
      }
      if (step % 2 === 1) {
        this.noise({ dur: 0.04, gain: 0.012, filter: 7000, filterEnd: 4000, type: "highpass" });
      }
    }
  }
}
