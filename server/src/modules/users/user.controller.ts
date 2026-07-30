import type { Request, Response } from "express";

import * as userService from "./user.service.js";
import { createUserSchema, setPasswordSchema, updateUserSchema } from "./user.schema.js";

export async function list(_req: Request, res: Response) {
  const users = await userService.listUsers();
  res.json({ items: users });
}

export async function create(req: Request, res: Response) {
  const input = createUserSchema.parse(req.body);
  const user = await userService.createUser(req.user!.locationId, input);
  res.status(201).json({ user });
}

export async function update(req: Request, res: Response) {
  const input = updateUserSchema.parse(req.body);
  const user = await userService.updateUser(req.params.id, req.user!.sub, input);
  res.json({ user });
}

export async function setPassword(req: Request, res: Response) {
  const input = setPasswordSchema.parse(req.body);
  await userService.setUserPassword(req.params.id, input);
  res.status(204).end();
}

export async function remove(req: Request, res: Response) {
  await userService.deleteUser(req.params.id, req.user!.sub);
  res.status(204).end();
}
