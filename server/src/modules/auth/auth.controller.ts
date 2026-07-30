import type { Request, Response } from "express";

import { env } from "../../config/env.js";
import { parseDurationMs } from "../../shared/utils/duration.js";
import * as authService from "./auth.service.js";
import { changePasswordSchema, loginSchema } from "./auth.schema.js";

export const REFRESH_COOKIE_NAME = "refreshToken";
const REFRESH_COOKIE_PATH = "/api/auth";
const REFRESH_COOKIE_MAX_AGE = parseDurationMs(env.jwt.refreshExpires);

function setRefreshCookie(res: Response, token: string) {
  res.cookie(REFRESH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: env.isProd,
    sameSite: "lax",
    path: REFRESH_COOKIE_PATH,
    maxAge: REFRESH_COOKIE_MAX_AGE,
  });
}

function clearRefreshCookie(res: Response) {
  res.clearCookie(REFRESH_COOKIE_NAME, { path: REFRESH_COOKIE_PATH });
}

export async function login(req: Request, res: Response) {
  const { login: loginValue, password } = loginSchema.parse(req.body);
  const { accessToken, refreshToken, user } = await authService.login(loginValue, password);

  setRefreshCookie(res, refreshToken);
  res.json({ accessToken, user });
}

export async function refresh(req: Request, res: Response) {
  const rawToken = req.cookies?.[REFRESH_COOKIE_NAME] as string | undefined;
  const { accessToken, refreshToken, user } = await authService.refresh(rawToken);

  setRefreshCookie(res, refreshToken);
  res.json({ accessToken, user });
}

export async function logout(req: Request, res: Response) {
  const rawToken = req.cookies?.[REFRESH_COOKIE_NAME] as string | undefined;
  await authService.logout(rawToken);

  clearRefreshCookie(res);
  res.status(204).end();
}

export async function me(req: Request, res: Response) {
  const user = await authService.getMe(req.user!.sub);
  res.json({ user });
}

export async function changePassword(req: Request, res: Response) {
  const { currentPassword, newPassword } = changePasswordSchema.parse(req.body);
  await authService.changePassword(req.user!.sub, currentPassword, newPassword);
  res.status(204).end();
}
