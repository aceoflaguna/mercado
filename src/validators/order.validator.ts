import { z } from "zod";

export const checkoutSchema = z.object({
  shippingAddress: z.string().trim().min(5, "Shipping address is required").max(500),
});
