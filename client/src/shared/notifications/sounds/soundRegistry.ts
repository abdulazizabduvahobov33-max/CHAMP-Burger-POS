import { bellChime } from "./bellChime";
import type { NotificationSound } from "./model";

/** Every sound the app can play, keyed by id. Adding a new one is a new file next to
 * bellChime.ts plus one line here — see model.ts. */
export const SOUNDS: Record<string, NotificationSound> = {
  [bellChime.id]: bellChime,
};

export const DEFAULT_SOUND_ID = bellChime.id;
