/**
 * One playable notification sound. Swapping or adding a sound later is: write a new file that
 * exports a function matching this shape, register it in soundRegistry.ts, and (optionally)
 * point DEFAULT_SOUND_ID at it — nothing in sound.ts, the notification store, or any call site
 * changes.
 */
export type NotificationSound = {
  id: string;
  label: string;
  /** `volume` is already resolved (mute + the user's slider collapsed to one 0..1 number) —
   * a sound implementation only ever needs to know how loud to play, never why. */
  play(ctx: AudioContext, volume: number): void;
};
