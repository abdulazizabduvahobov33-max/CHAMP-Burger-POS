import type { Request, Response } from "express";

import * as settingsService from "./settings.service.js";
import { updateSettingsSchema } from "./settings.schema.js";

export async function get(_req: Request, res: Response) {
  const [settings, security] = [await settingsService.getCompanySettings(), settingsService.getSecurityInfo()];
  res.json({ settings, security });
}

/** Unlike `get` above, reachable by SELLER too — see getReceiptSettings()'s comment. */
export async function receiptInfo(_req: Request, res: Response) {
  const settings = await settingsService.getReceiptSettings();
  res.json({ settings });
}

export async function update(req: Request, res: Response) {
  const input = updateSettingsSchema.parse(req.body);
  const settings = await settingsService.updateCompanySettings(input);
  res.json({ settings });
}

export async function systemInfo(_req: Request, res: Response) {
  const info = await settingsService.getSystemInfo();
  res.json(info);
}
