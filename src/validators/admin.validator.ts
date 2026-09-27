import { z } from "zod";

export const updateUserStatusSchema = z.object({
  status: z.enum(["active", "suspended", "banned"]), // deactivated is self-service only, not admin-settable
  reason: z.string().trim().max(500).nullable().optional(),
});

export const listUsersQuerySchema = z.object({
  status: z.enum(["active", "suspended", "banned", "deactivated"]).optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});