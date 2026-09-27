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

export const listOrdersQuerySchema = z.object({
  status: z.enum(["pending", "paid", "shipped", "completed", "cancelled"]).optional(),
  search: z.string().trim().max(200).optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(50).default(10),
});