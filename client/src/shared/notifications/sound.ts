/**
 * Plays the currently-registered "new order" sound (see sounds/soundRegistry.ts), synthesized
 * with the Web Audio API instead of shipping an audio file — no asset to source/license/host.
 * Every browser blocks audio from playing before the page has seen a real user gesture (click,
 * key, tap); since a chime is triggered by a server push, not a click, the very first one after a
 * fresh page load can arrive before that gesture happens. `armAutoplayUnlock` resolves that: it
 * primes (and, if needed, replays) the chime the moment the cashier touches the page at all, not
 * specifically the notification UI.
 *
 * Swapping the sound itself never touches this file — see sounds/model.ts's NotificationSound.
 */

import { getEffectiveVolume } from "./notificationSoundSettingsStore";
import { DEFAULT_SOUND_ID, SOUNDS } from "./sounds/soundRegistry";

let audioCtx: AudioContext | null = null;
let pendingChime = false;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  audioCtx ??= new Ctor();
  return audioCtx;
}

/** Plays immediately if the audio context is already unlocked; otherwise remembers that a chime
 * is owed and plays it as soon as `armAutoplayUnlock`'s listener fires. A no-op while muted —
 * not queued to "catch up" once unmuted, since that would just be a surprise sound later. */
export function playOrderChime(): void {
  const volume = getEffectiveVolume();
  if (volume <= 0) return;

  const ctx = getAudioContext();
  if (!ctx) return;
  if (ctx.state === "suspended") {
    pendingChime = true;
    return;
  }

  const sound = SOUNDS[DEFAULT_SOUND_ID];
  sound.play(ctx, volume);
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
