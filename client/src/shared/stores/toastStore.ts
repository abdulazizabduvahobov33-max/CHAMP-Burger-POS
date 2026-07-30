import { create } from "zustand";

export type ToastType = "success" | "error" | "info";
export type Toast = { id: string; type: ToastType; message: string };

type ToastState = {
  toasts: Toast[];
  push: (type: ToastType, message: string) => void;
  dismiss: (id: string) => void;
};

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  push: (type, message) => {
    const id = crypto.randomUUID();
    set((s) => ({ toasts: [...s.toasts, { id, type, message }] }));
    window.setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 4000);
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

/** Plain-function API (not a hook) so it's callable from mutation `onSuccess`/`onError`
 * callbacks anywhere — same "direct store access outside React" pattern already used by
 * shared/lib/errors.ts and shared/lib/pwa.ts. */
export const toast = {
  success: (message: string) => useToastStore.getState().push("success", message),
  error: (message: string) => useToastStore.getState().push("error", message),
  info: (message: string) => useToastStore.getState().push("info", message),
};
