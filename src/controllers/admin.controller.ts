import { Request, Response } from "express";
import { listUsers, updateUserStatus, findUserById, toPublicUser } from "../repositories/users.repository";
import { NotFoundError, BadRequestError } from "../types/errors";

export async function getUsers(req: Request, res: Response): Promise<void> {
  const { status, page, pageSize } = req.query as unknown as {
    status?: "active" | "suspended" | "banned" | "deactivated";
    page: number;
    pageSize: number;
  };
  const { items, total } = await listUsers({ status, page, pageSize });
  res.status(200).json({
    status: "ok",
    data: items.map(toPublicUser),
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  });
}

export async function patchUserStatus(req: Request, res: Response): Promise<void> {
  const { status, reason } = req.body as { status: "active" | "suspended" | "banned"; reason?: string | null };

  if (req.params.id === req.user!.sub) {
    throw new BadRequestError("Use the account settings page to manage your own account.");
  }

  const existing = await findUserById(req.params.id);
  if (!existing) throw new NotFoundError("User not found");

  const updated = await updateUserStatus(req.params.id, status, reason ?? null);
  res.status(200).json({ status: "ok", data: toPublicUser(updated!) });
}