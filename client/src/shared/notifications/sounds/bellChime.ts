import type { NotificationSound } from "./model";

function playPartial(ctx: AudioContext, startAt: number, freq: number, duration: number, gainPeak: number) {
  if (gainPeak <= 0) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.value = freq;
  // Quick linear attack, exponential decay — an instant on/off click at full volume is what
  // makes a synthesized tone read as "test beep"; a soft attack and a decaying tail is what
  // makes it read as a struck bell instead.
  gain.gain.setValueAtTime(0, startAt);
  gain.gain.linearRampToValueAtTime(gainPeak, startAt + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(startAt);
  osc.stop(startAt + duration + 0.05);
}

// A real bell's partials aren't at clean integer multiples of the fundamental — that inharmonic
// stack is exactly what separates a "bell" or "chime" timbre from a pure sine "beep". Four
// partials, decreasing weight, gives a small metallic shimmer on top of the fundamental note
// without needing anything beyond plain OscillatorNodes.
const BELL_PARTIALS: { ratio: number; weight: number }[] = [
  { ratio: 1, weight: 1 },
  { ratio: 2.42, weight: 0.45 },
  { ratio: 3.02, weight: 0.25 },
  { ratio: 4.5, weight: 0.12 },
];

function playBellNote(ctx: AudioContext, startAt: number, freq: number, peakVolume: number, duration: number) {
  for (const { ratio, weight } of BELL_PARTIALS) {
    playPartial(ctx, startAt, freq * ratio, duration, peakVolume * weight);
  }
}

// G5 → C6 → E6: a short rising major-triad arpeggio, ~1.1s end to end including decay tails —
// closer to what a commercial POS/KDS "new order" chime actually sounds like than a flat
// two-tone beep, and pleasant enough to hear dozens of times in a shift without grating.
const NOTES_HZ = [783.99, 1046.5, 1318.51];
const NOTE_SPACING_SEC = 0.17;
const NOTE_DURATION_SEC = 0.65;

function play(ctx: AudioContext, volume: number): void {
  const now = ctx.currentTime;
  NOTES_HZ.forEach((freq, i) => {
    // Each later note rings slightly louder — mirrors how a real ascending chime is played/mixed
    // and helps the sound cut through kitchen/dining-room noise right as it finishes.
    const noteVolume = volume * (0.75 + i * 0.125);
    playBellNote(ctx, now + i * NOTE_SPACING_SEC, freq, noteVolume, NOTE_DURATION_SEC);
  });
}

export const bellChime: NotificationSound = {
  id: "bell",
  label: "Колокольчик",
  play,
};
