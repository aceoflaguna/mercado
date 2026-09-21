import { Request, Response } from "express";
import { hashPassword, verifyPassword } from "../utils/argon";
import { signToken } from "../utils/jwt";
import {
  createUser,
  findUserByEmail,
  findUserById,
  updateUserRole,
  toPublicUser,
} from "../repositories/users.repository";
import { UnauthorizedError, NotFoundError, BadRequestError } from "../types/errors";

export async function register(req: Request, res: Response): Promise<void> {
  const { email, password, name } = req.body as {
    email: string;
    password: string;
    name: string;
  };

  const passwordHash = await hashPassword(password);
  // Unique email is enforced at the DB level (users.email UNIQUE); a duplicate
  // throws a Postgres 23505 error, translated to a 409 by the error handler.
  const user = await createUser({ email, passwordHash, name });

  const token = signToken({ sub: user.id, role: user.role });

  res.status(201).json({
    status: "ok",
    data: { user: toPublicUser(user), token },
  });
}

export async function login(req: Request, res: Response): Promise<void> {
  const { email, password } = req.body as { email: string; password: string };

  const user = await findUserByEmail(email);
  if (!user) {
    // Same message as a bad password — never reveal whether the email exists.
    throw new UnauthorizedError("Invalid email or password");
  }

  const validPassword = await verifyPassword(user.password_hash, password);
  if (!validPassword) {
    throw new UnauthorizedError("Invalid email or password");
  }

  const token = signToken({ sub: user.id, role: user.role });

  res.status(200).json({
    status: "ok",
    data: { user: toPublicUser(user), token },
  });
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
  const token = signToken({ sub: updated!.id, role: updated!.role });

  res.status(200).json({ status: "ok", data: { user: toPublicUser(updated!), token } });
}
