import { z } from "zod";

export const startConversationSchema = z.object({
  sellerId: z.string().uuid(),
  productId: z.string().uuid().nullable().optional(),
});

export const messageBodySchema = z.object({
  body: z.string().trim().min(1).max(2000),
});