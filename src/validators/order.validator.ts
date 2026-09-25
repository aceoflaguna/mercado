import { z } from "zod";

export const checkoutSchema = z
  .object({
    addressId: z.string().uuid().optional(),
    shippingAddress: z.string().trim().min(5).max(500).optional(),
  })
  .refine((data) => !(data.addressId && data.shippingAddress), {
    message: "Provide either addressId or shippingAddress, not both",
  });

export const updateOrderStatusSchema = z.object({
  status: z.literal("completed"),
});