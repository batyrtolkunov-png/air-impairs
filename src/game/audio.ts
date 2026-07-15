let context: AudioContext | null = null;
let master: GainNode | null = null;
let music: GainNode | null = null;
let musicTimer: number | null = null;
let masterVolume = 1.4;
let musicStep = 0;
let dangerMusic = false;
const MUSIC_VOLUME = 2.1;

function setup() {
  if (context) return context;
  context = new AudioContext();
  master = context.createGain();
  music = context.createGain();
  const limiter = context.createDynamicsCompressor();
  limiter.threshold.value = -4; limiter.knee.value = 2; limiter.ratio.value = 12; limiter.attack.value = .003; limiter.release.value = .18;
  master.gain.value = masterVolume;
  music.gain.value = MUSIC_VOLUME;
  music.connect(master); master.connect(limiter); limiter.connect(context.destination);
  return context;
}

function tone(frequency: number, duration: number, volume: number, type: OscillatorType, destination?: AudioNode, delay = 0) {
  const ctx = setup(); const oscillator = ctx.createOscillator(); const gain = ctx.createGain(); const start = ctx.currentTime + delay;
  oscillator.type = type; oscillator.frequency.setValueAtTime(frequency, start); gain.gain.setValueAtTime(0.001, start); gain.gain.exponentialRampToValueAtTime(volume, start + .025); gain.gain.exponentialRampToValueAtTime(.001, start + duration);
  oscillator.connect(gain); gain.connect(destination ?? master!); oscillator.start(start); oscillator.stop(start + duration + .03);
  return { oscillator, gain, start };
}

export function setGameVolume(value: number) {
  masterVolume = Math.max(0, Math.min(1, value)) * 2;
  if (master && context) master.gain.setTargetAtTime(masterVolume, context.currentTime, .04);
}

export function startMusic() {
  const ctx = setup(); void ctx.resume();
  if (musicTimer !== null) return;
  // A minor pentatonic melody: the same musical identity remains in both modes.
  const calmMelody = [220, 261.63, 293.66, 329.63, 293.66, 261.63, 196, 220, 261.63, 329.63, 392, 329.63, 293.66, 261.63, 220, 196];
  const tenseMelody = [220, 261.63, 293.66, 329.63, 349.23, 329.63, 293.66, 261.63];
  const bassRoots = [110, 98, 130.81, 87.31];
  const playBeat = () => {
    if (!context || !music) return;
    const melody = dangerMusic ? tenseMelody : calmMelody;
    const note = melody[musicStep % melody.length]; const bass = bassRoots[Math.floor(musicStep / 4) % bassRoots.length];
    tone(note, dangerMusic ? .28 : .44, dangerMusic ? .055 : .048, 'triangle', music);
    tone(note * 2, .16, dangerMusic ? .018 : .012, 'sine', music, .055);
    if (musicStep % 4 === 0) { tone(bass, dangerMusic ? .42 : .8, dangerMusic ? .095 : .065, 'sine', music); tone(bass * 1.5, .65, .018, 'triangle', music, .08); }
    if (!dangerMusic && musicStep % 4 === 2) tone(bass * 2, .25, .022, 'sine', music);
    if (dangerMusic) {
      // Two low pulses imitate a heartbeat without breaking the melody.
      tone(58, .11, .11, 'sine', music); tone(52, .13, .085, 'sine', music, .17);
      if (musicStep % 2 === 1) tone(note * 1.5, .2, .025, 'triangle', music, .09);
    }
    musicStep++;
  };
  playBeat(); musicTimer = window.setInterval(playBeat, 360);
}

export function setMusicDanger(danger: boolean) { dangerMusic = danger; }

export function setMusicPaused(paused: boolean) {
  if (!context || !music) return;
  music.gain.cancelScheduledValues(context.currentTime);
  music.gain.setTargetAtTime(paused ? .001 : MUSIC_VOLUME, context.currentTime, paused ? .05 : .35);
}

export function playFootstep() {
  const ctx = setup(); if (ctx.state === 'suspended') return;
  const length = Math.floor(ctx.sampleRate * .07); const buffer = ctx.createBuffer(1, length, ctx.sampleRate); const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
  const source = ctx.createBufferSource(); const filter = ctx.createBiquadFilter(); const gain = ctx.createGain(); filter.type = 'lowpass'; filter.frequency.value = 310 + Math.random() * 100; gain.gain.value = .34;
  source.buffer = buffer; source.connect(filter); filter.connect(gain); gain.connect(master!); source.start();
}

export function playHurt() {
  const ctx = setup(); void ctx.resume();
  if (music) { const now = ctx.currentTime; music.gain.cancelScheduledValues(now); music.gain.setValueAtTime(Math.max(.01, music.gain.value), now); music.gain.exponentialRampToValueAtTime(.035, now + .06); music.gain.setValueAtTime(.035, now + .72); music.gain.exponentialRampToValueAtTime(MUSIC_VOLUME, now + 1.5); }
  const voice = tone(175, .58, .32, 'sawtooth');
  voice.oscillator.frequency.exponentialRampToValueAtTime(82, voice.start + .5);
  tone(118, .48, .16, 'triangle', master!, .05).oscillator.frequency.exponentialRampToValueAtTime(68, ctx.currentTime + .5);
}
