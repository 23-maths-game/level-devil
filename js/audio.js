/* ============================================================
   TRAP DEVIL: RAGE EDITION — audio.js
   All SFX + music are SYNTHESIZED with WebAudio.
   Zero audio files. Zero assets. 100% spite.
   ============================================================ */
(function (global) {
'use strict';

const AudioFX = {
  ctx: null,
  enabled: true,
  _musicTimer: null,

  init() {
    if (!this.ctx) {
      const AC = global.AudioContext || global.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  },

  tone(freq, dur, type, vol, slideTo, delay) {
    if (!this.enabled || !this.ctx) return;
    const t0 = this.ctx.currentTime + (delay || 0);
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type || 'square';
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t0 + dur);
    gain.gain.setValueAtTime(vol || 0.15, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  },

  noise(dur, vol, filterFreq, delay) {
    if (!this.enabled || !this.ctx) return;
    const t0 = this.ctx.currentTime + (delay || 0);
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(vol || 0.2, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    let node = src;
    if (filterFreq) {
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = filterFreq;
      src.connect(filter);
      node = filter;
    }
    node.connect(gain);
    gain.connect(this.ctx.destination);
    src.start(t0);
    src.stop(t0 + dur + 0.05);
  },

  jump() { this.tone(440, 0.12, 'square', 0.12, 880); },
  land() { this.noise(0.06, 0.08, 900); },
  click() { this.tone(700, 0.05, 'square', 0.1); },
  tick() { this.tone(1200, 0.03, 'square', 0.06); },

  death() {
    this.noise(0.35, 0.3, 500);
    this.tone(220, 0.35, 'sawtooth', 0.18, 60);
  },

  // The most important sound in the game 😈
  trollLaugh() {
    this.tone(300, 0.12, 'square', 0.12, 180, 0);
    this.tone(300, 0.12, 'square', 0.12, 180, 0.15);
    this.tone(260, 0.22, 'square', 0.12, 140, 0.3);
    this.noise(0.25, 0.1, 1200, 0.05);
  },

  checkpoint() {
    this.tone(660, 0.1, 'sine', 0.15);
    this.tone(880, 0.15, 'sine', 0.15, 0, 0.1);
  },

  fakeCheckpoint() {
    this.tone(200, 0.25, 'sawtooth', 0.15, 90);
    this.trollLaugh();
  },

  win() {
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((f, i) => this.tone(f, 0.25, 'triangle', 0.18, 0, i * 0.12));
  },

  // Simple tense bass loop — the sound of your impending doom
  startMusic() {
    if (!this.enabled || this._musicTimer || !this.ctx) return;
    const pattern = [110, 0, 110, 0, 146.83, 0, 110, 0, 98, 0, 110, 0, 130.81, 0, 110, 0];
    let step = 0;
    this._musicTimer = setInterval(() => {
      if (!this.enabled || !this.ctx) return;
      const f = pattern[step % pattern.length];
      if (f) this.tone(f, 0.18, 'sawtooth', 0.05, f * 0.9);
      step++;
    }, 250);
  },

  stopMusic() {
    if (this._musicTimer) { clearInterval(this._musicTimer); this._musicTimer = null; }
  },

  toggleMute() {
    this.enabled = !this.enabled;
    if (!this.enabled) this.stopMusic();
    else { this.init(); this.startMusic(); }
    return this.enabled;
  }
};

global.AudioFX = AudioFX;
if (typeof module !== 'undefined' && module.exports) module.exports = { AudioFX };
})(typeof window !== 'undefined' ? window : globalThis);
