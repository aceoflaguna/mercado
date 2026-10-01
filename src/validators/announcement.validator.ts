import { z } from "zod";

export const createAnnouncementSchema = z.object({
  title: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1).max(10000),
  isPinned: z.boolean().optional().default(false),
  isPublished: z.boolean().optional().default(true),
});

export const updateAnnouncementSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  body: z.string().trim().min(1).max(10000).optional(),
  isPinned: z.boolean().optional(),
  isPublished: z.boolean().optional(),
});

export const listAnnouncementsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});