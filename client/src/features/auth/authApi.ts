import { api } from "@/shared/lib/api";
import type { AuthUser } from "@/shared/stores/authStore";

export type AuthResponse = { accessToken: string; user: AuthUser };

export async function loginRequest(login: string, password: string): Promise<AuthResponse> {
  const { data } = await api.post<AuthResponse>("/auth/login", { login, password });
  return data;
}

export async function logoutRequest(): Promise<void> {
  await api.post("/auth/logout");
}

export async function changePasswordRequest(currentPassword: string, newPassword: string): Promise<void> {
  await api.post("/auth/change-password", { currentPassword, newPassword });
}
