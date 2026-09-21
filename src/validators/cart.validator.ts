import { z } from "zod";

export const addToCartSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().int().positive().max(999).default(1),
});

export const updateCartItemSchema = z.object({
  quantity: z.number().int().positive().max(999),
});
