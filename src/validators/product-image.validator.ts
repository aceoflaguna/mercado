import { z } from "zod";

export const addProductImageSchema = z.object({
  url: z.string().url("Must be a valid image URL"),
});