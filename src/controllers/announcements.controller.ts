import { Request, Response } from "express";
import {
  listPublishedAnnouncements,
  findPublishedAnnouncementById,
  listAllAnnouncements,
  findAnnouncementByIdAny,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
} from "../repositories/announcements.repository";
import { NotFoundError } from "../types/errors";

// --- Public ---

export async function getAnnouncements(req: Request, res: Response): Promise<void> {
  const { page, pageSize } = req.query as unknown as { page: number; pageSize: number };
  const { items, total } = await listPublishedAnnouncements(page, pageSize);
  res.status(200).json({
    status: "ok",
    data: items,
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  });
}

export async function getAnnouncementById(req: Request, res: Response): Promise<void> {
  const announcement = await findPublishedAnnouncementById(req.params.id);
  if (!announcement) throw new NotFoundError("Announcement not found");
  res.status(200).json({ status: "ok", data: announcement });
}

// --- Admin ---

export async function getAdminAnnouncements(req: Request, res: Response): Promise<void> {
  const { page, pageSize } = req.query as unknown as { page: number; pageSize: number };
  const { items, total } = await listAllAnnouncements(page, pageSize);
  res.status(200).json({
    status: "ok",
    data: items,
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  });
}

export async function getAdminAnnouncementById(req: Request, res: Response): Promise<void> {
  const announcement = await findAnnouncementByIdAny(req.params.id);
  if (!announcement) throw new NotFoundError("Announcement not found");
  res.status(200).json({ status: "ok", data: announcement });
}

export async function postAnnouncement(req: Request, res: Response): Promise<void> {
  const { title, body, isPinned, isPublished } = req.body as {
    title: string;
    body: string;
    isPinned: boolean;
    isPublished: boolean;
  };
  const announcement = await createAnnouncement({
    authorId: req.user!.sub,
    title,
    body,
    isPinned,
    isPublished,
  });
  res.status(201).json({ status: "ok", data: announcement });
}

export async function patchAnnouncement(req: Request, res: Response): Promise<void> {
  const existing = await findAnnouncementByIdAny(req.params.id);
  if (!existing) throw new NotFoundError("Announcement not found");
  const updated = await updateAnnouncement(req.params.id, req.body);
  res.status(200).json({ status: "ok", data: updated });
}

export async function removeAnnouncement(req: Request, res: Response): Promise<void> {
  const removed = await deleteAnnouncement(req.params.id);
  if (!removed) throw new NotFoundError("Announcement not found");
  res.status(204).send();
}