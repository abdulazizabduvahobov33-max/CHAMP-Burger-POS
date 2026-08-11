/**
 * A short two-note chime for "new order", synthesized with the Web Audio API instead of shipping
 * an audio file — no asset to source/license/host, and it's a handful of lines. Every browser
 * blocks audio from playing before the page has seen at least one real user gesture (click, key,
 * tap); since a new-order chime is triggered by a server push, not a click, the very first one
 * after a fresh page load can arrive before that gesture happens. `armAutoplayUnlock` resolves
 * that: it primes (and, if needed, replays) the chime the moment the cashier touches the page at
 * all, not specifically the notification UI.
 */

let audioCtx: AudioContext | null = null;
let pendingChime = false;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  audioCtx ??= new Ctor();
  return audioCtx;
}

function tone(ctx: AudioContext, startAt: number, freq: number, durationSec: number) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.value = freq;
  // Quick fade in/out instead of a hard on/off — a synthesized tone that starts or stops at full
  // volume instantly produces an audible click/pop, same reason real UI sound kits always ramp.
  gain.gain.setValueAtTime(0, startAt);
  gain.gain.linearRampToValueAtTime(0.35, startAt + 0.02);
  gain.gain.linearRampToValueAtTime(0, startAt + durationSec);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(startAt);
  osc.stop(startAt + durationSec);
}

/** Plays immediately if the audio context is already unlocked; otherwise remembers that a chime
 * is owed and plays it as soon as `armAutoplayUnlock`'s listener fires. */
export function playOrderChime(): void {
  const ctx = getAudioContext();
  if (!ctx) return;
  if (ctx.state === "suspended") {
    pendingChime = true;
    return;
  }
  const now = ctx.currentTime;
  tone(ctx, now, 880, 0.16); // A5
  tone(ctx, now + 0.15, 1318.5, 0.22); // E6 — a bright little "ding-ding" rise, not a harsh beep
}

let unlockArmed = false;

/** Call once near the app root. Resumes the (possibly browser-suspended) AudioContext on the
 * user's first interaction anywhere on the page, then flushes a chime if one was requested while
 * still locked. Safe to call multiple times — only arms the listeners once. */
export function armAutoplayUnlock(): void {
  if (unlockArmed || typeof window === "undefined") return;
  unlockArmed = true;

  const unlock = () => {
    const ctx = getAudioContext();
    if (ctx?.state === "suspended") {
      void ctx.resume().then(() => {
        if (pendingChime) {
          pendingChime = false;
          playOrderChime();
        }
      });
    }
    window.removeEventListener("pointerdown", unlock);
    window.removeEventListener("keydown", unlock);
  };

  window.addEventListener("pointerdown", unlock);
  window.addEventListener("keydown", unlock);
}
