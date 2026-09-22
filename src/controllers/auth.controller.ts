import { Request, Response } from "express";
import { hashPassword, verifyPassword } from "../utils/argon";
import { createSession, deleteSessionByToken } from "../repositories/sessions.repository";
import {
  createUser,
  findUserByEmail,
  findUserById,
  updateUserRole,
  toPublicUser,
} from "../repositories/users.repository";
import { UnauthorizedError, NotFoundError, BadRequestError } from "../types/errors";

export async function register(req: Request, res: Response): Promise<void> {
  const { email, password, name } = req.body as { email: string; password: string; name: string };

  const passwordHash = await hashPassword(password);
  const user = await createUser({ email, passwordHash, name });
  const token = await createSession(user.id, {
    userAgent: req.headers["user-agent"],
    ip: req.ip,
  });

  res.status(201).json({ status: "ok", data: { user: toPublicUser(user), token } });
}

export async function login(req: Request, res: Response): Promise<void> {
  const { email, password } = req.body as { email: string; password: string };

  const user = await findUserByEmail(email);
  if (!user) {
    throw new UnauthorizedError("Invalid email or password");
  }
  const validPassword = await verifyPassword(user.password_hash, password);
  if (!validPassword) {
    throw new UnauthorizedError("Invalid email or password");
  }

  const token = await createSession(user.id, {
    userAgent: req.headers["user-agent"],
    ip: req.ip,
  });

  res.status(200).json({ status: "ok", data: { user: toPublicUser(user), token } });
}

export async function me(req: Request, res: Response): Promise<void> {
  const userId = req.user!.sub;
  const user = await findUserById(userId);
  if (!user) {
    throw new NotFoundError("User not found");
  }
  res.status(200).json({ status: "ok", data: toPublicUser(user) });
}

/**
 * Everyone registers as a plain "buyer" (email+password only, no role picker
 * at signup). This endpoint is the "start selling" upgrade path — a buyer
 * can promote their own account to "seller" so they can list products.
 * Issues a fresh token since the role is embedded in the JWT payload.
 */
export async function becomeSeller(req: Request, res: Response): Promise<void> {
  const userId = req.user!.sub;
  const user = await findUserById(userId);
  if (!user) {
    throw new NotFoundError("User not found");
  }
  if (user.role !== "buyer") {
    throw new BadRequestError(`Account already has role "${user.role}"`);
  }

  const updated = await updateUserRole(userId, "seller");
  res.status(200).json({ status: "ok", data: { user: toPublicUser(updated!) } });
}

export async function logout(req: Request, res: Response): Promise<void> {
  const header = req.headers.authorization!; // requireAuth already validated this exists
  const token = header.slice("Bearer ".length);
  await deleteSessionByToken(token);
  res.status(204).send();
}