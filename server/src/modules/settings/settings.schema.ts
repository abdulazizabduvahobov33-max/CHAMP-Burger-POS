import { z } from "zod";

// A fixed whitelist, not free-form key-value — Setting is a generic table (Module 1), but the
// API only accepts the keys Module 10's company-settings form actually edits, so a client can't
// write arbitrary rows into it.
export const updateSettingsSchema = z
  .object({
    cafe_name: z.string().trim().min(1, "Введите название").max(120),
    logo_url: z.string().trim().max(500),
    contact_phone: z.string().trim().max(40),
    address: z.string().trim().max(300),
    currency: z.string().trim().min(1, "Укажите валюту").max(10),
    timezone: z.string().trim().max(60),
    tax_percent: z.coerce.number().min(0).max(100),
    receipt_header: z.string().trim().max(300),
    receipt_footer: z.string().trim().max(300),
  })
  .partial();

export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;
