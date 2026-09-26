import { z } from "zod";

export const listAuditLogsQuerySchema = z.object({
  userId: z.string().uuid().optional(),
  method: z.enum(["GET", "POST", "PATCH", "PUT", "DELETE"]).optional(),
  path: z.string().trim().max(200).optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(50),
});