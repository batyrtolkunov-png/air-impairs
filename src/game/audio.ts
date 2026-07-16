let context: AudioContext | null = null;
let master: GainNode | null = null;
let music: GainNode | null = null;
let musicTimer: number | null = null;
let masterVolume = 1.4;
let musicStep = 0;
let dangerMusic = false;
const MUSIC_VOLUME = 4.2;
const MUSIC_ENABLED = true;

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
  if (!MUSIC_ENABLED) { if (music) music.gain.setValueAtTime(0, ctx.currentTime); return; }
  if (musicTimer !== null) return;
  // Original contemporary-neoclassical score: piano ostinato, cello bass and soft strings.
  const calmChords = [[220, 261.63, 329.63], [174.61, 220, 261.63], [196, 261.63, 329.63], [196, 246.94, 293.66]];
  const tenseChords = [[220, 261.63, 311.13], [207.65, 246.94, 293.66], [174.61, 220, 261.63], [164.81, 207.65, 246.94]];
  const bassRoots = [110, 87.31, 98, 98];
  const calmScale = [392, 440, 493.88, 523.25, 587.33, 659.25, 698.46, 783.99];
  const dangerScale = [392, 415.3, 466.16, 493.88, 523.25, 554.37, 622.25, 659.25];
  let melodyIndex = 3, melodyDirection = 1, phraseLength = 5 + Math.floor(Math.random() * 7), phraseStep = 0, previousMelody = 0;
  const playBeat = () => {
    if (!context || !music) return;
    const chordIndex = Math.floor(musicStep / 8) % 4; const chord = (dangerMusic ? tenseChords : calmChords)[chordIndex];
    const arpeggioOrder = dangerMusic ? [0, 1, 2, 1, 0, 2, 1, 2] : [0, 1, 2, 1, 2, 1, 0, 1];
    const piano = chord[arpeggioOrder[musicStep % 8]] * 2;
    tone(piano, dangerMusic ? .24 : .52, dangerMusic ? .052 : .044, 'triangle', music);
    tone(piano * 2, .09, .009, 'sine', music, .012);
    if (musicStep % 8 === 0) {
      const bass = bassRoots[chordIndex]; tone(bass, dangerMusic ? 1.3 : 2.4, dangerMusic ? .09 : .07, 'sine', music);
      chord.forEach((note, index) => tone(note / 2, dangerMusic ? 1.5 : 2.8, dangerMusic ? .017 : .012, index === 1 ? 'sine' : 'triangle', music!, index * .035));
    }
    const scale = dangerMusic ? dangerScale : calmScale;
    if (phraseStep >= phraseLength) { phraseStep = 0; phraseLength = 4 + Math.floor(Math.random() * 9); melodyDirection = Math.random() < .5 ? -1 : 1; if (Math.random() < .35) melodyIndex = Math.floor(Math.random() * scale.length); }
    if (Math.random() < .22) melodyDirection *= -1;
    const leap = Math.random() < .18 ? 2 : 1; melodyIndex = Math.max(0, Math.min(scale.length - 1, melodyIndex + melodyDirection * leap));
    if (melodyIndex === 0 || melodyIndex === scale.length - 1) melodyDirection *= -1;
    let melodyNote = scale[melodyIndex]; if (melodyNote === previousMelody) melodyNote = scale[(melodyIndex + 1) % scale.length]; previousMelody = melodyNote; phraseStep++;
    const rest = Math.random() < (dangerMusic ? .1 : .24); if (!rest) { const octave = !dangerMusic && Math.random() < .13 ? 2 : 1; tone(melodyNote * octave, dangerMusic ? .3 : .55 + Math.random() * .45, dangerMusic ? .021 : .024 + Math.random() * .012, 'sine', music, .035); if (Math.random() < .42) tone(melodyNote / 2, .65 + Math.random() * .5, .009, 'triangle', music, .08); }
    if (dangerMusic) {
      tone(55, .1, .085, 'sine', music); if (musicStep % 2 === 1) tone(52, .12, .065, 'sine', music, .13);
      if (musicStep % 4 === 3) tone(piano * 1.05946, .2, .014, 'sawtooth', music, .05);
    }
    musicStep++;
    musicTimer = window.setTimeout(playBeat, dangerMusic ? 260 : 390);
  };
  playBeat();
}

export function setMusicDanger(danger: boolean) { dangerMusic = danger; }

export function setMusicPaused(paused: boolean) {
  if (!context || !music) return;
  if (!MUSIC_ENABLED) { music.gain.setValueAtTime(0, context.currentTime); return; }
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
  if (MUSIC_ENABLED && music) { const now = ctx.currentTime; music.gain.cancelScheduledValues(now); music.gain.setValueAtTime(Math.max(.01, music.gain.value), now); music.gain.exponentialRampToValueAtTime(.035, now + .06); music.gain.setValueAtTime(.035, now + .72); music.gain.exponentialRampToValueAtTime(MUSIC_VOLUME, now + 1.5); }
  const voice = tone(175, .58, .32, 'sawtooth');
  voice.oscillator.frequency.exponentialRampToValueAtTime(82, voice.start + .5);
  tone(118, .48, .16, 'triangle', master!, .05).oscillator.frequency.exponentialRampToValueAtTime(68, ctx.currentTime + .5);
}
