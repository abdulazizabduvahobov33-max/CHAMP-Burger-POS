import { create } from "zustand";

export type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

type PwaState = {
  installPromptEvent: BeforeInstallPromptEvent | null;
  isInstalled: boolean;
  needRefresh: boolean;
  offlineReady: boolean;
  setInstallPromptEvent: (event: BeforeInstallPromptEvent | null) => void;
  setInstalled: (value: boolean) => void;
  setNeedRefresh: (value: boolean) => void;
  setOfflineReady: (value: boolean) => void;
};

export const usePwaStore = create<PwaState>((set) => ({
  installPromptEvent: null,
  isInstalled: false,
  needRefresh: false,
  offlineReady: false,
  setInstallPromptEvent: (installPromptEvent) => set({ installPromptEvent }),
  setInstalled: (isInstalled) => set({ isInstalled }),
  setNeedRefresh: (needRefresh) => set({ needRefresh }),
  setOfflineReady: (offlineReady) => set({ offlineReady }),
}));
