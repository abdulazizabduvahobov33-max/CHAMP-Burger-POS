import type { Request, Response } from "express";

import * as aiService from "./ai.service.js";
import { sendMessageSchema } from "./ai.schema.js";

export async function list(req: Request, res: Response) {
  const messages = await aiService.listMessages(req.user!.sub);
  res.json({ messages });
}

export async function send(req: Request, res: Response) {
  const input = sendMessageSchema.parse(req.body);
  const result = await aiService.sendMessage(req.user!.sub, req.user!.locationId, input);
  res.json(result);
}

export async function clear(req: Request, res: Response) {
  const result = await aiService.clearHistory(req.user!.sub);
  res.json(result);
}
