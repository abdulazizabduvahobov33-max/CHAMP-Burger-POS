import { create } from "zustand";

// A speaker is a property of this specific till/device, not the business — same reasoning as
// printerProfilesStore's "pos-printer-profiles" key: plain localStorage, never the shared
// Settings table other devices would also read. The tablet running the register and the
// manager's own laptop can each have their own mute/volume without stepping on each other.
const STORAGE_KEY = "pos-notification-sound";

type StoredSettings = { muted: boolean; volume: number };

const DEFAULTS: StoredSettings = { muted: false, volume: 0.8 };

function loadStored(): StoredSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw);
    return {
      muted: typeof parsed?.muted === "boolean" ? parsed.muted : DEFAULTS.muted,
      volume: typeof parsed?.volume === "number" ? Math.min(1, Math.max(0, parsed.volume)) : DEFAULTS.volume,
    };
  } catch {
    return DEFAULTS;
  }
}

type NotificationSoundSettingsState = StoredSettings & {
  setMuted: (muted: boolean) => void;
  setVolume: (volume: number) => void;
};

export const useNotificationSoundSettingsStore = create<NotificationSoundSettingsState>((set, get) => {
  function persist(next: StoredSettings) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }

  return {
    ...loadStored(),
    setMuted: (muted) => {
      const next = { muted, volume: get().volume };
      persist(next);
      set(next);
    },
    setVolume: (volume) => {
      const clamped = Math.min(1, Math.max(0, volume));
      const next = { muted: get().muted, volume: clamped };
      persist(next);
      set(next);
    },
  };
});

/** The single number a sound implementation needs: 0 when muted, otherwise the user's slider
 * value. Kept as a plain function (not a hook) so non-component code — sound.ts's playOrderChime,
 * called from the SSE event handler — can read it without needing to be a React component. */
export function getEffectiveVolume(): number {
  const { muted, volume } = useNotificationSoundSettingsStore.getState();
  return muted ? 0 : volume;
}
