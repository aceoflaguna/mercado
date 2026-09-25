import { z } from "zod";

export const createAddressSchema = z.object({
  label: z.string().trim().min(1).max(50).default("Home"),
  fullAddress: z.string().trim().min(5).max(500),
  isDefault: z.boolean().optional().default(false),
});

export const updateAddressSchema = z.object({
  label: z.string().trim().min(1).max(50).optional(),
  fullAddress: z.string().trim().min(5).max(500).optional(),
  isDefault: z.boolean().optional(),
});