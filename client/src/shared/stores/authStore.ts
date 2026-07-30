import { create } from "zustand";

export type Role = "SUPER_ADMIN" | "SELLER";

export type AuthUser = {
  id: string;
  name: string;
  login: string;
  role: Role;
  locationId: string;
};

export type AuthStatus = "idle" | "loading" | "authenticated" | "unauthenticated";

type AuthState = {
  user: AuthUser | null;
  accessToken: string | null;
  status: AuthStatus;
  setStatus: (status: AuthStatus) => void;
  setSession: (user: AuthUser, accessToken: string) => void;
  clearSession: () => void;
};

/**
 * Access token lives only in memory (never localStorage) to limit XSS blast radius.
 * The refresh token is an httpOnly cookie the browser attaches automatically; a page
 * reload restores the session via a silent POST /auth/refresh (see AuthBootstrap).
 */
export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  status: "idle",
  setStatus: (status) => set({ status }),
  setSession: (user, accessToken) => set({ user, accessToken, status: "authenticated" }),
  clearSession: () => set({ user: null, accessToken: null, status: "unauthenticated" }),
}));
